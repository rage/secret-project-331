use headless_lms_utils::{
    file_store::FileStore, language_tag_to_name::LANGUAGE_TAG_TO_NAME, ApplicationConfiguration,
};

use crate::{
    chapters::{course_chapters, Chapter},
    course_modules::CourseModule,
    pages::{course_pages, Page},
    prelude::*,
};

pub struct CourseInfo {
    pub id: Uuid,
    pub is_draft: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseCount {
    pub count: u32,
}

pub struct CourseContextData {
    pub id: Uuid,
    pub is_test_mode: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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
    pub is_test_mode: bool,
    pub base_module_completion_requires_n_submodule_completions: i32,
}

/// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewCourse {
    pub name: String,
    pub slug: String,
    pub organization_id: Uuid,
    pub language_code: String,
    /// Name of the teacher who is responsible for the course. Must be a valid name.
    pub teacher_in_charge_name: String,
    /// Email of the teacher who is responsible for the course. Must be a valid email.
    pub teacher_in_charge_email: String,
    pub description: String,
    pub is_draft: bool,
    pub is_test_mode: bool,
}

pub async fn insert(
    conn: &mut PgConnection,
    id: PKeyPolicy<Uuid>,
    course_language_group_id: Uuid,
    new_course: &NewCourse,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO courses(
    id,
    name,
    description,
    slug,
    organization_id,
    language_code,
    course_language_group_id,
    is_draft,
    is_test_mode
  )
VALUES(
    COALESCE($1, uuid_generate_v4()),
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
  )
RETURNING id
        ",
        id.fixed(),
        new_course.name,
        new_course.description,
        new_course.slug,
        new_course.organization_id,
        new_course.language_code,
        course_language_group_id,
        new_course.is_draft,
        new_course.is_test_mode
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseStructure {
    pub course: Course,
    pub pages: Vec<Page>,
    pub chapters: Vec<Chapter>,
    pub modules: Vec<CourseModule>,
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
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions
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
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions
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
    c.is_draft,
    c.is_test_mode,
    c.base_module_completion_requires_n_submodule_completions
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
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions
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
) -> ModelResult<CourseContextData> {
    let data = sqlx::query_as!(
        CourseContextData,
        "SELECT id, is_test_mode FROM courses WHERE slug = $1 AND deleted_at IS NULL",
        slug
    )
    .fetch_one(conn)
    .await?;
    Ok(data)
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
    let modules = crate::course_modules::get_by_course_id(conn, course_id).await?;
    Ok(CourseStructure {
        course,
        pages,
        chapters,
        modules,
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
  courses.is_draft,
  courses.is_test_mode,
  base_module_completion_requires_n_submodule_completions
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
ORDER BY courses.name
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
// Represents the subset of page fields that one is allowed to update in a course
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseUpdate {
    name: String,
    description: Option<String>,
    is_draft: bool,
    is_test_mode: bool,
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
  description = $2,
  is_draft = $3,
  is_test_mode = $4
WHERE id = $5
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
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions
    "#,
        course_update.name,
        course_update.description,
        course_update.is_draft,
        course_update.is_test_mode,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_course_base_module_completion_count_requirement(
    conn: &mut PgConnection,
    id: Uuid,
    base_module_completion_requires_n_submodule_completions: i32,
) -> ModelResult<bool> {
    let res = sqlx::query!(
        "
UPDATE courses
SET base_module_completion_requires_n_submodule_completions = $1
WHERE id = $2
  AND deleted_at IS NULL
        ",
        base_module_completion_requires_n_submodule_completions,
        id,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected() > 0)
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
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions
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
  is_draft,
  is_test_mode,
  base_module_completion_requires_n_submodule_completions
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

pub async fn get_top_level_pages(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Page>> {
    let pages = sqlx::query_as!(
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
FROM pages p
WHERE p.chapter_id IS NULL
  AND p.deleted_at IS NULL
  AND course_id = $1
  AND p.url_path != '/'
  ORDER BY order_number DESC;
    ",
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(pages)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{course_language_groups, courses, test_helper::*};

    mod language_code_validation {
        use super::*;

        #[tokio::test]
        async fn allows_valid_language_code() {
            insert_data!(:tx, user: _user, :org);
            let course_language_group_id = course_language_groups::insert_with_id(
                tx.as_mut(),
                Uuid::parse_str("8e40c36c-835b-479c-8f07-863ad408f181").unwrap(),
            )
            .await
            .unwrap();
            let new_course = create_new_course(org, "en-US");
            let res = courses::insert(
                tx.as_mut(),
                PKeyPolicy::Fixed(Uuid::parse_str("95d8ab4d-073c-4794-b8c5-f683f0856356").unwrap()),
                course_language_group_id,
                &new_course,
            )
            .await;
            assert!(res.is_ok());
        }

        #[tokio::test]
        async fn disallows_empty_language_code() {
            insert_data!(:tx, user: _user, :org);
            let course_language_group_id = course_language_groups::insert_with_id(
                tx.as_mut(),
                Uuid::parse_str("8e40c36c-835b-479c-8f07-863ad408f181").unwrap(),
            )
            .await
            .unwrap();
            let new_course = create_new_course(org, "");
            let res = courses::insert(
                tx.as_mut(),
                PKeyPolicy::Fixed(Uuid::parse_str("95d8ab4d-073c-4794-b8c5-f683f0856356").unwrap()),
                course_language_group_id,
                &new_course,
            )
            .await;
            assert!(res.is_err());
        }

        #[tokio::test]
        async fn disallows_wrong_case_language_code() {
            insert_data!(:tx, user: _user, :org);
            let course_language_group_id = course_language_groups::insert_with_id(
                tx.as_mut(),
                Uuid::parse_str("8e40c36c-835b-479c-8f07-863ad408f181").unwrap(),
            )
            .await
            .unwrap();
            let new_course = create_new_course(org, "en-us");
            let res = courses::insert(
                tx.as_mut(),
                PKeyPolicy::Fixed(Uuid::parse_str("95d8ab4d-073c-4794-b8c5-f683f0856356").unwrap()),
                course_language_group_id,
                &new_course,
            )
            .await;
            assert!(res.is_err());
        }

        #[tokio::test]
        async fn disallows_underscore_in_language_code() {
            insert_data!(:tx, user: _user, :org);
            let course_language_group_id = course_language_groups::insert_with_id(
                tx.as_mut(),
                Uuid::parse_str("8e40c36c-835b-479c-8f07-863ad408f181").unwrap(),
            )
            .await
            .unwrap();
            let new_course = create_new_course(org, "en_US");
            let res = courses::insert(
                tx.as_mut(),
                PKeyPolicy::Fixed(Uuid::parse_str("95d8ab4d-073c-4794-b8c5-f683f0856356").unwrap()),
                course_language_group_id,
                &new_course,
            )
            .await;
            assert!(res.is_err());
        }

        fn create_new_course(organization_id: Uuid, language_code: &str) -> NewCourse {
            NewCourse {
                name: "".to_string(),
                slug: "".to_string(),
                organization_id,
                language_code: language_code.to_string(),
                teacher_in_charge_name: "teacher".to_string(),
                teacher_in_charge_email: "teacher@example.com".to_string(),
                description: "description".to_string(),
                is_draft: false,
                is_test_mode: false,
            }
        }
    }
}
