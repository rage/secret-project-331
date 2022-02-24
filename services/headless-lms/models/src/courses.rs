use std::collections::HashMap;

use headless_lms_utils::{
    document_schema_processor::GutenbergBlock, file_store::FileStore,
    language_tag_to_name::LANGUAGE_TAG_TO_NAME, ApplicationConfiguration,
};
use serde_json::Value;

use crate::{
    chapters::{course_chapters, Chapter},
    course_instances::{self, CourseInstance, NewCourseInstance},
    course_language_groups,
    pages::{course_pages, NewPage, Page},
    prelude::*,
};

pub struct CourseInfo {
    pub id: Uuid,
    pub is_draft: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct CourseCount {
    pub count: u32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct Course {
    pub id: Uuid,
    pub slug: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub description: Option<String>,
    pub organization_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub language_code: String,
    pub copied_from: Option<Uuid>,
    pub content_search_language: Option<String>,
    pub course_language_group_id: Uuid,
    pub is_draft: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct CourseStructure {
    pub course: Course,
    pub pages: Vec<Page>,
    pub chapters: Vec<Chapter>,
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
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft
FROM courses
WHERE deleted_at IS NULL;
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn get_all_language_versions_of_course(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        "
SELECT id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft
FROM courses
WHERE course_language_group_id = $1;
        ",
        course.course_language_group_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn get_active_courses_for_organization(
    conn: &mut PgConnection,
    organization_id: Uuid,
    pagination: &Pagination,
) -> ModelResult<Vec<Course>> {
    let course_instances = sqlx::query_as!(
        Course,
        r#"
SELECT
    DISTINCT(c.id),
    c.name,
    c.created_at,
    c.updated_at,
    c.organization_id,
    c.deleted_at,
    c.slug,
    c.content_search_language::text,
    c.language_code,
    c.copied_from,
    c.course_language_group_id,
    c.description,
    c.is_draft
FROM courses as c
    LEFT JOIN course_instances as ci on c.id = ci.course_id
WHERE
    c.organization_id = $1 AND
    ci.starts_at < NOW() AND ci.ends_at > NOW() AND
    c.deleted_at IS NULL AND ci.deleted_at IS NULL
    LIMIT $2 OFFSET $3;
        "#,
        organization_id,
        pagination.limit(),
        pagination.offset()
    )
    .fetch_all(conn)
    .await?;
    Ok(course_instances)
}

pub async fn get_active_courses_for_organization_count(
    conn: &mut PgConnection,
    organization_id: Uuid,
) -> ModelResult<CourseCount> {
    let result = sqlx::query!(
        r#"
SELECT
    COUNT(DISTINCT c.id) as count
FROM courses as c
    LEFT JOIN course_instances as ci on c.id = ci.course_id
WHERE
    c.organization_id = $1 AND
    ci.starts_at < NOW() AND ci.ends_at > NOW() AND
    c.deleted_at IS NULL AND ci.deleted_at IS NULL;
        "#,
        organization_id
    )
    .fetch_one(conn)
    .await?;
    Ok(CourseCount {
        count: result.count.unwrap_or_default().try_into()?,
    })
}

pub async fn copy_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_course: &NewCourse,
) -> ModelResult<Course> {
    let course = get_course(conn, course_id).await?;
    copy_course_internal(conn, course, new_course, false).await
}

pub async fn copy_course_as_language_version_of_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    new_course: &NewCourse,
) -> ModelResult<Course> {
    let course = get_course(conn, course_id).await?;
    copy_course_internal(conn, course, new_course, true).await
}

async fn copy_course_internal(
    conn: &mut PgConnection,
    parent_course: Course,
    new_course: &NewCourse,
    same_language_group: bool,
) -> ModelResult<Course> {
    let mut tx = conn.begin().await?;

    let course_language_group_id = if same_language_group {
        parent_course.course_language_group_id
    } else {
        course_language_groups::insert(&mut tx).await?
    };

    // Create new course.
    let copied_course = sqlx::query_as!(
        Course,
        "
INSERT INTO courses (
    name,
    organization_id,
    slug,
    content_search_language,
    language_code,
    copied_from,
    course_language_group_id,
    is_draft
  )
VALUES ($1, $2, $3, $4::regconfig, $5, $6, $7, $8)
RETURNING id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft;
    ",
        new_course.name,
        new_course.organization_id,
        new_course.slug,
        parent_course.content_search_language as _,
        new_course.language_code,
        parent_course.id,
        course_language_group_id,
        new_course.is_draft
    )
    .fetch_one(&mut tx)
    .await?;

    // Copy course chapters. At this point, front_page_id will point to old course's page.
    sqlx::query!(
        "
INSERT INTO chapters (
    id,
    name,
    course_id,
    chapter_number,
    front_page_id,
    opens_at,
    chapter_image_path,
    copied_from
  )
SELECT uuid_generate_v5($1, id::text),
  name,
  $1,
  chapter_number,
  front_page_id,
  opens_at,
  chapter_image_path,
  id
FROM chapters
WHERE (course_id = $2);
    ",
        copied_course.id,
        parent_course.id
    )
    .execute(&mut tx)
    .await?;

    // Copy course pages. At this point, exercise ids in content will point to old course's exercises.
    let contents_iter = sqlx::query!(
        "
INSERT INTO pages (
    id,
    course_id,
    content,
    url_path,
    title,
    chapter_id,
    order_number,
    copied_from,
    content_search_language
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  content,
  url_path,
  title,
  uuid_generate_v5($1, chapter_id::text),
  order_number,
  id,
  content_search_language
FROM pages
WHERE (course_id = $2)
RETURNING id,
  content;
    ",
        copied_course.id,
        parent_course.id
    )
    .fetch_all(&mut tx)
    .await?
    .into_iter()
    .map(|record| (record.id, record.content));

    // Update front_page_id of chapters now that new pages exist.
    sqlx::query!(
        "
UPDATE chapters
SET front_page_id = uuid_generate_v5(course_id, front_page_id::text)
WHERE course_id = $1
    AND front_page_id IS NOT NULL;
        ",
        copied_course.id,
    )
    .execute(&mut tx)
    .await?;

    // Copy course exercises
    let old_to_new_exercise_ids = sqlx::query!(
        "
INSERT INTO exercises (
    id,
    course_id,
    name,
    deadline,
    page_id,
    score_maximum,
    order_number,
    chapter_id,
    copied_from
  )
SELECT uuid_generate_v5($1, id::text),
  $1,
  name,
  deadline,
  uuid_generate_v5($1, page_id::text),
  score_maximum,
  order_number,
  chapter_id,
  id
FROM exercises
WHERE course_id = $2
RETURNING id,
  copied_from;
    ",
        copied_course.id,
        parent_course.id
    )
    .fetch_all(&mut tx)
    .await?
    .into_iter()
    .map(|record| {
        Ok((
            record
                .copied_from
                .ok_or_else(|| {
                    ModelError::Generic("Query failed to return valid data.".to_string())
                })?
                .to_string(),
            record.id.to_string(),
        ))
    })
    .collect::<ModelResult<HashMap<String, String>>>()?;

    // Replace exercise ids in page contents.
    for (page_id, content) in contents_iter {
        if let Value::Array(mut blocks) = content {
            for block in blocks.iter_mut() {
                if block["name"] != Value::String("moocfi/exercise".to_string()) {
                    continue;
                }
                if let Value::String(old_id) = &block["attributes"]["id"] {
                    let new_id = old_to_new_exercise_ids
                        .get(old_id)
                        .ok_or_else(|| {
                            ModelError::Generic("Invalid exercise id in content.".to_string())
                        })?
                        .to_string();
                    block["attributes"]["id"] = Value::String(new_id);
                }
            }
            sqlx::query!(
                "
UPDATE pages
SET content = $1
WHERE id = $2;
                ",
                Value::Array(blocks),
                page_id,
            )
            .execute(&mut tx)
            .await?;
        }
    }

    // Copy exercise slides
    sqlx::query!(
        "
INSERT INTO exercise_slides (
    id, exercise_id, order_number
)
SELECT uuid_generate_v5($1, id::text),
    uuid_generate_v5($1, exercise_id::text),
    order_number
FROM exercise_slides
WHERE exercise_id IN (SELECT id FROM exercises WHERE course_id = $2);
        ",
        copied_course.id,
        parent_course.id
    )
    .execute(&mut tx)
    .await?;

    // Copy exercise tasks
    sqlx::query!(
        "
INSERT INTO exercise_tasks (
    id,
    exercise_slide_id,
    exercise_type,
    assignment,
    private_spec,
    spec_file_id,
    public_spec,
    model_solution_spec,
    copied_from
  )
SELECT uuid_generate_v5($1, id::text),
  uuid_generate_v5($1, exercise_slide_id::text),
  exercise_type,
  assignment,
  private_spec,
  spec_file_id,
  public_spec,
  model_solution_spec,
  id
FROM exercise_tasks
WHERE exercise_slide_id IN (
    SELECT s.id
    FROM exercise_slides s
      JOIN exercises e ON (e.id = s.exercise_id)
    WHERE e.course_id = $2
  );
    ",
        copied_course.id,
        parent_course.id,
    )
    .execute(&mut tx)
    .await?;

    // Create default instance for copied course.
    course_instances::insert(
        &mut tx,
        NewCourseInstance {
            id: Uuid::new_v4(),
            course_id: copied_course.id,
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: &new_course.teacher_in_charge_name,
            teacher_in_charge_email: &new_course.teacher_in_charge_email,
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;

    tx.commit().await?;
    Ok(copied_course)
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
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft
FROM courses
WHERE id = $1;
    "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(course)
}

pub async fn get_nondeleted_course_id_by_slug(
    conn: &mut PgConnection,
    slug: &str,
) -> ModelResult<Uuid> {
    let id = sqlx::query!(
        "SELECT id FROM courses WHERE slug = $1 AND deleted_at IS NULL",
        slug
    )
    .fetch_one(conn)
    .await?
    .id;
    Ok(id)
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
    file_store: &dyn FileStore,
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

pub async fn organization_courses_visible_to_user_paginated(
    conn: &mut PgConnection,
    organization_id: Uuid,
    user: Option<Uuid>,
    pagination: Pagination,
) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"
SELECT courses.id,
  courses.name,
  courses.created_at,
  courses.updated_at,
  courses.organization_id,
  courses.deleted_at,
  courses.slug,
  courses.content_search_language::text,
  courses.language_code,
  courses.copied_from,
  courses.course_language_group_id,
  courses.description,
  courses.is_draft
FROM courses
WHERE courses.organization_id = $1
  AND (
    courses.is_draft IS FALSE
    OR EXISTS (
      SELECT id
      FROM roles
      WHERE user_id = $2
        AND (
          course_id = courses.id
          OR roles.organization_id = courses.organization_id
          OR roles.is_global IS TRUE
        )
    )
  )
  AND courses.deleted_at IS NULL
LIMIT $3 OFFSET $4;
"#,
        organization_id,
        user,
        pagination.limit(),
        pagination.offset()
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn organization_course_count(
    conn: &mut PgConnection,
    organization_id: Uuid,
) -> ModelResult<CourseCount> {
    let course_count = sqlx::query!(
        r#"
SELECT
    COUNT(DISTINCT id) as count
FROM courses
WHERE organization_id = $1
    AND deleted_at IS NULL;
        "#,
        organization_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(CourseCount {
        count: course_count.count.unwrap_or_default().try_into()?,
    })
}

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NewCourse {
    pub name: String,
    pub slug: String,
    pub organization_id: Uuid,
    pub language_code: String,
    pub teacher_in_charge_name: String,
    pub teacher_in_charge_email: String,
    pub description: String,
    pub is_draft: bool,
}

pub async fn insert_course(
    conn: &mut PgConnection,
    id: Uuid,
    default_instance_id: Uuid,
    new_course: NewCourse,
    user: Uuid,
) -> ModelResult<(Course, Page, CourseInstance)> {
    let mut tx = conn.begin().await?;

    let course_language_group_id = course_language_groups::insert(&mut tx).await?;
    let course = sqlx::query_as!(
        Course,
        r#"
INSERT INTO courses(id, name, slug, organization_id, language_code, course_language_group_id, is_draft)
VALUES($1, $2, $3, $4, $5, $6, $7)
RETURNING id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft;
            "#,
        id,
        new_course.name,
        new_course.slug,
        new_course.organization_id,
        new_course.language_code,
        course_language_group_id,
        new_course.is_draft
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
        course_id: Some(course.id),
        exam_id: None,
        front_page_of_chapter_id: None,
        title: course.name.clone(),
        url_path: String::from("/"),
        exercises: vec![],
        exercise_slides: vec![],
        exercise_tasks: vec![],
        content_search_language: None,
    };
    let page = crate::pages::insert_page(&mut tx, course_front_page, user).await?;

    // Create default course instance
    let default_course_instance = crate::course_instances::insert(
        &mut tx,
        NewCourseInstance {
            id: default_instance_id,
            course_id: course.id,
            name: None,
            description: None,
            support_email: None,
            teacher_in_charge_name: &new_course.teacher_in_charge_name,
            teacher_in_charge_email: &new_course.teacher_in_charge_email,
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;

    tx.commit().await?;
    Ok((course, page, default_course_instance))
}

// Represents the subset of page fields that one is allowed to update in a course
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct CourseUpdate {
    name: String,
    is_draft: bool,
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
SET name = $1,
  is_draft = $2
WHERE id = $3
RETURNING id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft
    "#,
        course_update.name,
        course_update.is_draft,
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
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft
    "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}

pub async fn get_course_by_slug(conn: &mut PgConnection, course_slug: &str) -> ModelResult<Course> {
    println!("hi!");
    let course = sqlx::query_as!(
        Course,
        "
SELECT id,
  name,
  created_at,
  updated_at,
  organization_id,
  deleted_at,
  slug,
  content_search_language::text,
  language_code,
  copied_from,
  course_language_group_id,
  description,
  is_draft
FROM courses
WHERE slug = $1
  AND deleted_at IS NULL
",
        course_slug,
    )
    .fetch_one(conn)
    .await?;
    Ok(course)
}

pub async fn get_cfgname_by_tag(
    conn: &mut PgConnection,
    ietf_language_tag: String,
) -> ModelResult<String> {
    let tag = ietf_language_tag
        .split('-')
        .next()
        .unwrap_or_else(|| &ietf_language_tag[..]);

    let lang_name = LANGUAGE_TAG_TO_NAME.get(&tag);

    let name = sqlx::query!(
        "SELECT cfgname::text FROM pg_ts_config WHERE cfgname = $1",
        lang_name
    )
    .fetch_optional(conn)
    .await?;

    let res = name
        .and_then(|n| n.cfgname)
        .unwrap_or_else(|| "simple".to_string());

    Ok(res)
}

pub async fn is_draft(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let res = sqlx::query!(
        "
SELECT is_draft
FROM courses
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.is_draft)
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use serde_json::Value;

    use super::*;
    use crate::{
        chapters::{self, DatabaseChapter, NewChapter},
        courses, exercise_slides,
        exercise_tasks::{self, ExerciseTask},
        exercises::{self, Exercise},
        organizations, pages,
        test_helper::*,
        users,
    };

    #[tokio::test]
    async fn validates_language_code_when_adding_a_course() {
        insert_data!(:tx, :user, :org);

        // Valid language code allows course creation.
        let mut new_course = NewCourse {
            name: "".to_string(),
            slug: "".to_string(),
            organization_id: org,
            language_code: "en-US".to_string(),
            teacher_in_charge_name: "teacher".to_string(),
            teacher_in_charge_email: "teacher@example.com".to_string(),
            description: "description".to_string(),
            is_draft: false,
        };
        let mut tx2 = tx.begin().await;
        courses::insert_course(
            tx2.as_mut(),
            Uuid::new_v4(),
            Uuid::new_v4(),
            new_course.clone(),
            user,
        )
        .await
        .unwrap();
        tx2.rollback().await;

        // Empty language code is not allowed.
        new_course.language_code = "".to_string();
        let mut tx2 = tx.begin().await;
        courses::insert_course(
            tx2.as_mut(),
            Uuid::new_v4(),
            Uuid::new_v4(),
            new_course.clone(),
            user,
        )
        .await
        .unwrap_err();
        tx2.rollback().await;

        // Wrong case language code is not allowed.
        new_course.language_code = "en-us".to_string();
        let mut tx2 = tx.begin().await;
        let course_id = courses::insert_course(
            tx2.as_mut(),
            Uuid::new_v4(),
            Uuid::new_v4(),
            new_course.clone(),
            user,
        )
        .await;
        assert!(course_id.is_err());
        tx2.rollback().await;

        // Underscore in locale is not allowed.
        let mut tx2 = tx.begin().await;
        new_course.language_code = "en_US".to_string();
        let course_id = courses::insert_course(
            tx2.as_mut(),
            Uuid::new_v4(),
            Uuid::new_v4(),
            new_course.clone(),
            user,
        )
        .await;
        assert!(course_id.is_err());
        tx2.rollback().await;
    }

    #[tokio::test]
    async fn copies_course() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        // Create test data
        let organization_id = organizations::insert(
            tx.as_mut(),
            "",
            "",
            "description",
            Uuid::parse_str("8c34e601-b5db-4b33-a588-57cb6a5b1669").unwrap(),
        )
        .await
        .unwrap();
        let user_id = users::insert(tx.as_mut(), "copies_course_user@example.com", None, None)
            .await
            .unwrap();
        let (course, _page, _instance) = courses::insert_course(
            tx.as_mut(),
            Uuid::parse_str("86ede846-db97-4204-94c3-29cc2e71818e").unwrap(),
            Uuid::new_v4(),
            NewCourse {
                language_code: "en-US".to_string(),
                name: "Course".to_string(),
                organization_id,
                slug: "course".to_string(),
                teacher_in_charge_name: "admin".to_string(),
                teacher_in_charge_email: "admin@example.org".to_string(),
                description: "description".to_string(),
                is_draft: false,
            },
            user_id,
        )
        .await
        .unwrap();
        let (chapter, chapter_front_page) = chapters::insert_chapter(
            tx.as_mut(),
            NewChapter {
                chapter_number: 1,
                course_id: course.id,
                front_front_page_id: None,
                name: "Chapter".to_string(),
            },
            user_id,
        )
        .await
        .unwrap();
        let exercise_id = exercises::insert(
            tx.as_mut(),
            course.id,
            "Exercise",
            chapter_front_page.id,
            chapter.id,
            1,
        )
        .await
        .unwrap();
        let exercise_slide_id = exercise_slides::insert_with_id(
            tx.as_mut(),
            Uuid::from_str("a676876f-1827-4db6-abbb-f41079cc0315").unwrap(),
            exercise_id,
            0,
        )
        .await
        .unwrap();
        let exercise_task_id = exercise_tasks::insert(
            tx.as_mut(),
            exercise_slide_id,
            "Exercise",
            vec![],
            Value::Null,
            Value::Null,
            Value::Null,
        )
        .await
        .unwrap();
        pages::update_page_content(
            tx.as_mut(),
            chapter_front_page.id,
            &serde_json::json!([{
                "name": "moocfi/exercise",
                "isValid": true,
                "clientId": "b2ecb473-38cc-4df1-84f7-06709cc63e95",
                "attributes": {
                    "id": exercise_id,
                    "name": "Exercise"
                },
                "innerBlocks": []
            }]),
        )
        .await
        .unwrap();

        // Copy the course
        let copied_course = copy_course_as_language_version_of_course(
            tx.as_mut(),
            course.id,
            &NewCourse {
                language_code: "fi-FI".to_string(),
                name: "Kurssi".to_string(),
                organization_id,
                slug: "kurssi".to_string(),
                teacher_in_charge_name: "admin".to_string(),
                teacher_in_charge_email: "admin@example.org".to_string(),
                description: "description".to_string(),
                is_draft: false,
            },
        )
        .await
        .unwrap();
        assert_eq!(copied_course.copied_from, Some(course.id));

        // Assuming there's only one chapter per course in test data.
        let copied_chapter = sqlx::query_as!(
            DatabaseChapter,
            "SELECT * FROM chapters WHERE course_id = $1;",
            copied_course.id,
        )
        .fetch_one(tx.as_mut())
        .await
        .unwrap();
        assert_eq!(copied_chapter.copied_from, Some(chapter.id));

        // Assuming there's only one page per chapter in test data.
        let copied_page = sqlx::query_as!(
            Page,
            "
SELECT id,
  created_at,
  updated_at,
  course_id,
  exam_id,
  chapter_id,
  url_path,
  title,
  deleted_at,
  content,
  order_number,
  copied_from
FROM pages
WHERE chapter_id = $1
  AND course_id IS NOT NULL
",
            copied_chapter.id
        )
        .fetch_one(tx.as_mut())
        .await
        .unwrap();
        assert_eq!(copied_page.copied_from, Some(chapter_front_page.id));

        // Assuming there's only one exercise per page in test data.
        let copied_exercise = sqlx::query_as!(
            Exercise,
            "SELECT * FROM exercises WHERE page_id = $1;",
            copied_page.id
        )
        .fetch_one(tx.as_mut())
        .await
        .unwrap();
        assert_eq!(copied_exercise.copied_from, Some(exercise_id));
        assert_eq!(
            copied_page.content[0]["attributes"]["id"],
            Value::String(copied_exercise.id.to_string())
        );

        // Assuming there's only one exercise task per exercise in test data.
        let copied_exercise_task = sqlx::query_as!(
            ExerciseTask,
            "
SELECT t.*
FROM exercise_tasks t
  JOIN exercise_slides s ON (t.exercise_slide_id = s.id)
WHERE s.exercise_id = $1;
            ",
            copied_exercise.id
        )
        .fetch_one(tx.as_mut())
        .await
        .unwrap();
        assert_eq!(copied_exercise_task.copied_from, Some(exercise_task_id));
    }
}
