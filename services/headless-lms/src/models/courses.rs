use std::collections::HashMap;

use super::{course_instances::CourseInstance, ModelResult};
use crate::{
    models::{
        chapters::{self, DatabaseChapter},
        course_instances::{self, VariantStatus},
        exercise_tasks,
        exercises::{self, Exercise},
        pages::{self, NewPage},
    },
    utils::{document_schema_processor::GutenbergBlock, file_store::FileStore},
    ApplicationConfiguration,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgConnection};
use ts_rs::TS;
use uuid::Uuid;

use super::{
    chapters::{course_chapters, Chapter},
    pages::{course_pages, Page},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct Course {
    pub id: Uuid,
    pub slug: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub organization_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub language_code: String,
    pub copied_from_course_id: Option<Uuid>,
    pub language_version_of_course_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct CourseStructure {
    pub course: Course,
    pub pages: Vec<Page>,
    pub chapters: Vec<Chapter>,
}

pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    organization_id: Uuid,
    slug: &str,
    language_code: &str,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO courses (name, organization_id, slug, language_code)
VALUES ($1, $2, $3, $4)
RETURNING id
",
        name,
        organization_id,
        slug,
        language_code,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn all_courses(conn: &mut PgConnection) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(Course, r#"SELECT * FROM courses WHERE deleted_at IS NULL;"#)
        .fetch_all(conn)
        .await?;
    Ok(courses)
}

pub async fn get_all_language_versions_of_course(
    conn: &mut PgConnection,
    course: Course,
) -> ModelResult<Vec<Course>> {
    let parent_id = course.language_version_of_course_id.unwrap_or(course.id);
    let courses = sqlx::query_as!(
        Course,
        "
SELECT *
FROM courses
WHERE id = $1
  OR language_version_of_course_id = $1;
        ",
        parent_id
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn clone_course_as_language_version_of_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_course: NewCourse,
) -> ModelResult<Course> {
    let mut tx = conn.begin().await?;

    // Copy the course.
    let course = get_course(&mut tx, course_id).await?;
    let language_parent_course_id = course.language_version_of_course_id.unwrap_or(course.id);
    let copied_course = sqlx::query_as!(
        Course,
        "
INSERT INTO courses (
    name,
    organization_id,
    slug,
    language_code,
    copied_from_course_id,
    language_version_of_course_id
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;
    ",
        new_course.name,
        new_course.organization_id,
        new_course.slug,
        new_course.language_code,
        course.id,
        language_parent_course_id
    )
    .fetch_one(&mut tx)
    .await?;

    // Copy course chapters. At this point, front_page_id will point to old course's page.
    let course_chapters: HashMap<Uuid, DatabaseChapter> =
        chapters::course_chapters(&mut tx, course.id)
            .await?
            .into_iter()
            .map(|chapter| (chapter.id, chapter))
            .collect();
    for course_chapter in course_chapters.values() {
        sqlx::query!(
            "
INSERT INTO chapters (
    id,
    name,
    course_id,
    chapter_number,
    front_page_id,
    opens_at,
    chapter_image
  )
VALUES (uuid_generate_v5($1, $2), $3, $4, $5, $6, $7, $8)
RETURNING id;
    ",
            copied_course.id,
            &course_chapter.id.to_string(),
            course_chapter.name,
            copied_course.id,
            course_chapter.chapter_number,
            course_chapter.front_page_id, // TODO: Update front page id
            course_chapter.opens_at,
            course_chapter.chapter_image
        )
        .fetch_one(&mut tx)
        .await?;
    }

    // Copy course pages. At this point, exercise ids in content will point to old course's exercises.
    let course_pages: HashMap<Uuid, Page> = pages::course_pages(&mut tx, course.id)
        .await?
        .into_iter()
        .map(|page| (page.id, page))
        .collect();
    for course_page in course_pages.values() {
        sqlx::query!(
            "
INSERT INTO pages (
    id,
    course_id,
    content,
    url_path,
    title,
    chapter_id,
    order_number
  )
VALUES (uuid_generate_v5($2, $1), $2, $3, $4, $5, $6, $7);
            ",
            &course_page.id.to_string(),
            copied_course.id,
            course_page.content,
            course_page.url_path,
            course_page.title,
            course_page.chapter_id,
            course_page.order_number,
        )
        .execute(&mut tx)
        .await?;
    }

    // Copy course exercises
    let course_exercises: HashMap<Uuid, Exercise> =
        exercises::get_exercises_by_course_id(&mut tx, course.id)
            .await?
            .into_iter()
            .map(|exercise| (exercise.id, exercise))
            .collect();
    for course_exercise in course_exercises.values() {
        let copied_exercise_id = sqlx::query!(
            "
INSERT INTO exercises (
    id,
    course_id,
    name,
    deadline,
    page_id,
    score_maximum,
    order_number,
    chapter_id
  )
VALUES (
    uuid_generate_v5($2, $1),
    $2,
    $3,
    $4,
    uuid_generate_v5($2, $5),
    $6,
    $7,
    uuid_generate_v5($2, $8)
  )
RETURNING id;
            ",
            &course_exercise.id.to_string(),
            copied_course.id,
            course_exercise.name,
            course_exercise.deadline,
            &course_exercise.page_id.to_string(),
            course_exercise.score_maximum,
            course_exercise.order_number,
            &course_exercise.chapter_id.to_string(),
        )
        .fetch_one(&mut tx)
        .await?
        .id;

        // Copy exercise tasks
        for exercise_task in
            exercise_tasks::get_exercise_tasks_by_exercise_id(&mut tx, course_exercise.id).await?
        {
            sqlx::query!(
                "
INSERT INTO exercise_tasks (
    id,
    exercise_id,
    exercise_type,
    assignment,
    private_spec,
    spec_file_id,
    public_spec,
    model_solution_spec
  )
VALUES (
    uuid_generate_v5($1, $2),
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
  );
            ",
                copied_course.id,
                &exercise_task.id.to_string(),
                copied_exercise_id,
                exercise_task.exercise_type,
                exercise_task.assignment,
                exercise_task.private_spec,
                exercise_task.spec_file_id,
                exercise_task.public_spec,
                exercise_task.model_solution_spec,
            )
            .execute(&mut tx)
            .await?;
        }
    }

    // Create default instance for copied course.
    course_instances::insert(&mut tx, copied_course.id, None, Some(VariantStatus::Draft)).await?;

    tx.commit().await?;
    Ok(copied_course)
}

pub async fn get_course(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<Course> {
    let course = sqlx::query_as!(Course, r#"SELECT * FROM courses WHERE id = $1;"#, course_id)
        .fetch_one(conn)
        .await?;
    Ok(course)
}

pub async fn get_organization_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let organization_id = sqlx::query!("SELECT organization_id FROM courses WHERE id = $1", id)
        .fetch_one(conn)
        .await?
        .organization_id;
    Ok(organization_id)
}

pub async fn get_course_structure(
    conn: &mut PgConnection,
    course_id: Uuid,
    file_store: &impl FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<CourseStructure> {
    let course = get_course(conn, course_id).await?;
    let pages = course_pages(conn, course_id).await?;
    let chapters = course_chapters(conn, course_id)
        .await?
        .iter()
        .map(|chapter| Chapter::from_database_chapter(chapter, file_store, app_conf))
        .collect();
    Ok(CourseStructure {
        course,
        pages,
        chapters,
    })
}

pub async fn organization_courses(
    conn: &mut PgConnection,
    organization_id: &Uuid,
) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"SELECT * FROM courses WHERE organization_id = $1 AND deleted_at IS NULL;"#,
        organization_id
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NewCourse {
    pub name: String,
    pub slug: String,
    pub organization_id: Uuid,
    pub language_code: String,
}

pub async fn insert_course(
    conn: &mut PgConnection,
    course: NewCourse,
) -> ModelResult<(Course, Page, CourseInstance)> {
    let mut tx = conn.begin().await?;

    let course = sqlx::query_as!(
        Course,
        r#"
    INSERT INTO
      courses(name, slug, organization_id, language_code)
    VALUES($1, $2, $3, $4)
    RETURNING *
            "#,
        course.name,
        course.slug,
        course.organization_id,
        course.language_code,
    )
    .fetch_one(&mut tx)
    .await?;

    // Create front page for course
    let course_front_page_content = serde_json::to_value(vec![
        GutenbergBlock::landing_page_hero_section("Welcome to...", "Subheading"),
        GutenbergBlock::course_objective_section(),
        GutenbergBlock::empty_block_from_name("moocfi/course-chapter-grid".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/course-progress".to_string()),
    ])?;
    let course_front_page = NewPage {
        chapter_id: None,
        content: course_front_page_content,
        course_id: course.id,
        front_page_of_chapter_id: None,
        title: course.name.clone(),
        url_path: String::from("/"),
    };
    let page = crate::models::pages::insert_page(&mut tx, course_front_page).await?;

    // Create default course instance
    let default_course_instance = crate::models::course_instances::insert(
        &mut tx,
        course.id,
        None,
        Some(VariantStatus::Draft),
    )
    .await?;

    tx.commit().await?;
    Ok((course, page, default_course_instance))
}

// Represents the subset of page fields that one is allowed to update in a course
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct CourseUpdate {
    name: String,
}

pub async fn update_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    course_update: CourseUpdate,
) -> ModelResult<Course> {
    let res = sqlx::query_as!(
        Course,
        r#"
UPDATE courses
    SET name = $1
WHERE
    id = $2
    RETURNING *
    "#,
        course_update.name,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete_course(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<Course> {
    let deleted = sqlx::query_as!(
        Course,
        r#"
UPDATE courses
    SET deleted_at = now()
WHERE
    id = $1
RETURNING *
    "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        models::{courses, organizations},
        test_helper::Conn,
    };

    #[tokio::test]
    async fn valid_locale_allows_course_creation() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let organization_id = insert_organization(tx.as_mut()).await;
        let course_id = courses::insert(tx.as_mut(), "", organization_id, "course", "en_US").await;
        assert!(course_id.is_ok());
    }

    #[tokio::test]
    async fn empty_locale_is_not_allowed() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let organization_id = insert_organization(tx.as_mut()).await;
        let course_id = courses::insert(tx.as_mut(), "", organization_id, "course", "").await;
        assert!(course_id.is_err());
    }

    #[tokio::test]
    async fn wrong_case_locale_is_not_allowed() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let organization_id = insert_organization(tx.as_mut()).await;
        let course_id = courses::insert(tx.as_mut(), "", organization_id, "course", "en_us").await;
        assert!(course_id.is_err());
    }

    #[tokio::test]
    async fn hyphen_in_locale_is_not_allowed() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let organization_id = insert_organization(tx.as_mut()).await;
        let course_id = courses::insert(tx.as_mut(), "", organization_id, "course", "en-US").await;
        assert!(course_id.is_err());
    }

    async fn insert_organization(conn: &mut PgConnection) -> Uuid {
        organizations::insert(
            conn,
            "",
            "",
            Uuid::parse_str("8c34e601-b5db-4b33-a588-57cb6a5b1669").unwrap(),
        )
        .await
        .unwrap()
    }
}
