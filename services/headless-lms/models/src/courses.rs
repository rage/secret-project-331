use headless_lms_utils::{
    document_schema_processor::GutenbergBlock, file_store::FileStore,
    language_tag_to_name::LANGUAGE_TAG_TO_NAME, ApplicationConfiguration,
};

use crate::{
    chapters::{course_chapters, Chapter},
    course_instances::{CourseInstance, NewCourseInstance},
    course_language_groups,
    course_modules::CourseModule,
    pages::{course_pages, NewPage, Page},
    peer_review_questions::CmsPeerReviewQuestion,
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
WHERE course_language_group_id = $1
AND deleted_at IS NULL
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

// Represents the subset of page fields that are required to create a new course.
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

pub async fn insert_course(
    conn: &mut PgConnection,
    id: Uuid,
    default_instance_id: Uuid,
    new_course: NewCourse,
    user: Uuid,
) -> ModelResult<(Course, Page, CourseInstance, CourseModule)> {
    let mut tx = conn.begin().await?;

    let course_language_group_id = course_language_groups::insert(&mut tx).await?;
    let course = sqlx::query_as!(
        Course,
        r#"
INSERT INTO courses(id, name, description, slug, organization_id, language_code, course_language_group_id, is_draft, is_test_mode)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
  base_module_completion_requires_n_submodule_completions;
            "#,
        id,
        new_course.name,
        new_course.description,
        new_course.slug,
        new_course.organization_id,
        new_course.language_code,
        course_language_group_id,
        new_course.is_draft,
        new_course.is_test_mode
    )
    .fetch_one(&mut tx)
    .await?;

    // Create front page for course
    let course_front_page_content = serde_json::to_value(vec![
        GutenbergBlock::landing_page_hero_section("Welcome to...", "Subheading"),
        GutenbergBlock::course_objective_section(),
        GutenbergBlock::empty_block_from_name("moocfi/course-chapter-grid".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/top-level-pages".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/congratulations".to_string()),
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

    // Create default course module
    let default_module = crate::course_modules::insert(&mut tx, course.id, None, 0).await?;

    // Create course default peer review config
    let peer_review_config_id =
        crate::peer_review_configs::insert(&mut tx, course.id, None).await?;

    // Create peer review questions for default peer review config
    crate::peer_review_questions::upsert_multiple_peer_review_questions(
        &mut tx,
        &[
            CmsPeerReviewQuestion {
                id: Uuid::new_v4(),
                peer_review_config_id,
                order_number: 0,
                question: "General comments".to_string(),
                question_type: crate::peer_review_questions::PeerReviewQuestionType::Essay,
                answer_required: false,
            },
            CmsPeerReviewQuestion {
                id: Uuid::new_v4(),
                peer_review_config_id,
                order_number: 1,
                question: "The answer was correct".to_string(),
                question_type: crate::peer_review_questions::PeerReviewQuestionType::Scale,
                answer_required: true,
            },
            CmsPeerReviewQuestion {
                id: Uuid::new_v4(),
                peer_review_config_id,
                order_number: 2,
                question: "The answer was easy to read".to_string(),
                question_type: crate::peer_review_questions::PeerReviewQuestionType::Scale,
                answer_required: true,
            },
        ],
    )
    .await?;

    tx.commit().await?;
    Ok((course, page, default_course_instance, default_module))
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
    use crate::{courses, test_helper::*};

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
            is_test_mode: false,
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
}
