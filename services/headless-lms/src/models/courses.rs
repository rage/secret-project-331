use super::{course_instances::CourseInstance, ModelResult};
use crate::{
    models::{course_instances::VariantStatus, pages::NewPage},
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
    pub content_search_language: String,
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
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO courses (name, organization_id, slug)
VALUES ($1, $2, $3)
RETURNING id
",
        name,
        organization_id,
        slug,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn all_courses(conn: &mut PgConnection) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"
SELECT id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language as "content_search_language: String"
FROM courses
WHERE deleted_at IS NULL;
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn get_course(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<Course> {
    let course = sqlx::query_as!(
        Course,
        r#"
SELECT id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language as "content_search_language: String"
FROM courses
WHERE id = $1;
    "#,
        course_id
    )
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
        r#"
SELECT id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language as "content_search_language: String"
FROM courses
WHERE organization_id = $1
  AND deleted_at IS NULL;
        "#,
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
}

pub async fn insert_course(
    conn: &mut PgConnection,
    course: NewCourse,
) -> ModelResult<(Course, Page, CourseInstance)> {
    let mut tx = conn.begin().await?;

    let course = sqlx::query_as!(
        Course,
        r#"
INSERT INTO courses(name, slug, organization_id)
VALUES($1, $2, $3)
RETURNING id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language as "content_search_language: String"
            "#,
        course.name,
        course.slug,
        course.organization_id
    )
    .fetch_one(&mut tx)
    .await?;

    // Create front page for course
    let course_front_page_content = serde_json::to_value(vec![
        GutenbergBlock::landing_page_hero_section(),
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
WHERE id = $2
RETURNING id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language as "content_search_language: String"
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
WHERE id = $1
RETURNING id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language as "content_search_language: String"
    "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}
