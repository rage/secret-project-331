use std::collections::HashMap;

use crate::{
    chapters::{Chapter, get_course_chapters},
    course_audiences::{CourseAudience, EditCourseAudience, upsert_course_audiences},
    course_instances::CourseInstance,
    course_modules::{CourseAuditingModuleUpdate, CourseModule},
    course_prerequisites::{
        CoursePrerequisite, EditCoursePrerequisite, upsert_course_prerequisites,
    },
    entity_history::{self, HistoryAuthor},
    error::missing_model_error,
    library::entity_snapshots::{
        self, ContentEntityType, CourseAudienceSnapshot, CourseSettingsSnapshot,
    },
    organizations::DatabaseOrganization,
    pages::{Page, PageVisibility, get_all_by_course_id_and_visibility},
    prelude::*,
};
use headless_lms_utils::{
    azure_embedding::create_embeddings, file_store::FileStore,
    language_tag_to_name::LANGUAGE_TAG_TO_NAME, strings::non_empty_trimmed,
};
use pgvector::Vector;
use utoipa::ToSchema;
pub struct CourseInfo {
    pub id: Uuid,
    pub is_draft: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, ToSchema)]

pub struct CourseCount {
    pub count: u32,
}

pub struct CourseContextData {
    pub id: Uuid,
    pub is_test_mode: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseMetadata {
    course_description: Option<String>,
    course_audiences: Vec<CourseAudience>,
    course_prerequisites: Vec<CoursePrerequisite>,
    course_updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, ToSchema)]
pub struct CourseMetadataUpdate {
    course_description: Option<String>,
    course_audiences: Vec<EditCourseAudience>,
    course_prerequisites: Vec<EditCoursePrerequisite>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CompleteCourseMetadata {
    course: Course,
    course_instances: Vec<CourseInstance>,
    default_module: CourseModule,
    course_prerequisites: Vec<CoursePrerequisite>,
    course_audiences: Vec<CourseAudience>,
    course_organization: DatabaseOrganization,
}

/// The AI policy a teacher has selected for a course. Drives which variant of the student-facing
/// AI usage notice is shown; `NotSet` (the default) keeps the generic default message.
#[derive(
    Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Default, sqlx::Type, ToSchema,
)]
#[sqlx(type_name = "course_ai_policy", rename_all = "snake_case")]
pub enum CourseAiPolicy {
    /// No policy selected; the notice shows the generic default message.
    #[default]
    NotSet,
    /// AI is not allowed at any point.
    NoAi,
    /// AI may be used for planning (brainstorming/outlining) but not in the final work.
    PlanningOnly,
    /// AI may be used for specific tasks only, with disclosure.
    Limited,
    /// AI may be used freely; the student directs it and discloses their use.
    FullUse,
    /// AI use is expected or mandatory.
    Required,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

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
    pub is_unlisted: bool,
    pub base_module_completion_requires_n_submodule_completions: i32,
    pub can_add_chatbot: bool,
    pub is_joinable_by_code_only: bool,
    pub join_code: Option<String>,
    pub ask_marketing_consent: bool,
    pub flagged_answers_threshold: Option<i32>,
    pub flagged_answers_skip_manual_review_and_allow_retry: bool,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_additional_message: Option<String>,
    pub closed_course_successor_id: Option<Uuid>,
    pub chapter_locking_enabled: bool,
    pub cheater_detection_enabled: bool,
    pub ai_policy: CourseAiPolicy,
    pub course_material_ai_instructions: Option<bool>,
}
impl Course {
    pub fn is_closed(&self) -> bool {
        if let Some(closed_at) = self.closed_at {
            let now = chrono::Utc::now();
            closed_at <= now
        } else {
            false
        }
    }
}

/** A subset of the `Course` struct that contains the fields that are allowed to be shown to all students on the course materials. */
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CourseMaterialCourse {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub organization_id: Uuid,
    pub language_code: String,
    pub copied_from: Option<Uuid>,
    pub content_search_language: Option<String>,
    pub course_language_group_id: Uuid,
    pub is_draft: bool,
    pub is_test_mode: bool,
    pub is_unlisted: bool,
    pub base_module_completion_requires_n_submodule_completions: i32,
    pub is_joinable_by_code_only: bool,
    pub ask_marketing_consent: bool,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_additional_message: Option<String>,
    pub closed_course_successor_id: Option<Uuid>,
    pub chapter_locking_enabled: bool,
    pub ai_policy: CourseAiPolicy,
    pub course_material_ai_instructions: Option<bool>,
}

impl From<Course> for CourseMaterialCourse {
    fn from(course: Course) -> Self {
        CourseMaterialCourse {
            id: course.id,
            slug: course.slug,
            name: course.name,
            description: course.description,
            organization_id: course.organization_id,
            language_code: course.language_code,
            copied_from: course.copied_from,
            content_search_language: course.content_search_language,
            course_language_group_id: course.course_language_group_id,
            is_draft: course.is_draft,
            is_test_mode: course.is_test_mode,
            is_unlisted: course.is_unlisted,
            base_module_completion_requires_n_submodule_completions: course
                .base_module_completion_requires_n_submodule_completions,
            is_joinable_by_code_only: course.is_joinable_by_code_only,
            ask_marketing_consent: course.ask_marketing_consent,
            closed_at: course.closed_at,
            closed_additional_message: course.closed_additional_message,
            closed_course_successor_id: course.closed_course_successor_id,
            chapter_locking_enabled: course.chapter_locking_enabled,
            ai_policy: course.ai_policy,
            course_material_ai_instructions: course.course_material_ai_instructions,
        }
    }
}

/** All the necessary info that can be used to switch the user's browser to a different language version of the course. */
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CourseLanguageVersionNavigationInfo {
    pub course_language_group_id: Uuid,
    pub course_id: Uuid,
    pub language_code: String,
    pub course_slug: String,
    pub page_path: String,
    pub is_draft: bool,
    pub current_page_unavailable_in_this_language: bool,
}

impl CourseLanguageVersionNavigationInfo {
    /// Creates a new `CourseLanguageVersionNavigationInfo` from a course and page language group navigation info.
    pub fn from_course_and_page_info(
        course: &Course,
        page_info: Option<&crate::page_language_groups::PageLanguageGroupNavigationInfo>,
    ) -> Self {
        Self {
            course_language_group_id: course.course_language_group_id,
            course_id: course.id,
            language_code: course.language_code.clone(),
            course_slug: course.slug.clone(),
            page_path: page_info
                .map(|p| p.page_path.clone())
                .unwrap_or_else(|| "/".to_string()),
            is_draft: course.is_draft,
            current_page_unavailable_in_this_language: page_info.is_none(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CourseBreadcrumbInfo {
    pub course_id: Uuid,
    pub course_name: String,
    pub course_slug: String,
    pub organization_slug: String,
    pub organization_name: String,
}

/// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

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
    pub is_unlisted: bool,
    /// If true, copies all user permissions from the original course to the new one.
    pub copy_user_permissions: bool,
    pub is_joinable_by_code_only: bool,
    pub join_code: Option<String>,
    pub ask_marketing_consent: bool,
    pub flagged_answers_threshold: Option<i32>,
    pub can_add_chatbot: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CourseAuditingData {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub description: Option<String>,
    pub is_draft: bool,
    pub is_test_mode: bool,
    pub is_unlisted: bool,
    pub is_joinable_by_code_only: bool,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_additional_message: Option<String>,
    pub closed_course_successor_id: Option<Uuid>,
    pub organization_id: Uuid,
    pub organization_name: String,
    pub organization_slug: String,
    pub prerequisites: Vec<EditCoursePrerequisite>,
    pub audiences: Vec<EditCourseAudience>,
    pub modules: Vec<CourseModule>,
}

#[derive(Debug, Deserialize, ToSchema)]

pub struct CourseAuditingDataUpdate {
    pub description: Option<String>,
    pub is_draft: bool,
    pub is_test_mode: bool,
    pub is_unlisted: bool,
    pub is_joinable_by_code_only: bool,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_additional_message: Option<String>,
    pub closed_course_successor_id: Option<Uuid>,
    pub prerequisites: Vec<EditCoursePrerequisite>,
    pub audiences: Vec<EditCourseAudience>,
    pub modules: Vec<CourseAuditingModuleUpdate>,
}

pub async fn insert(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    pkey_policy: PKeyPolicy<Uuid>,
    course_language_group_id: Uuid,
    new_course: &NewCourse,
) -> ModelResult<Uuid> {
    let title = non_empty_trimmed(&new_course.name);
    let name = title.unwrap_or(&new_course.name);
    let description = non_empty_trimmed(&new_course.description);
    let embeddings = if app_config.disable_embedding_vector_creation_when_seeding {
        None
    } else {
        let texts = title.into_iter().chain(description).map(str::to_string);
        let embeddings = TextEmbeddings::create(app_config, texts.collect()).await?;
        Some((
            embeddings.get_or_create_one(app_config, title).await?,
            embeddings
                .get_or_create_one(app_config, description)
                .await?,
        ))
    };

    let mut tx = conn.begin().await?;

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
    is_test_mode,
    is_joinable_by_code_only,
    join_code,
    can_add_chatbot
  )
VALUES(
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12
  )
RETURNING id
        ",
        pkey_policy.into_uuid(),
        name,
        description,
        new_course.slug,
        new_course.organization_id,
        new_course.language_code,
        course_language_group_id,
        new_course.is_draft,
        new_course.is_test_mode,
        new_course.is_joinable_by_code_only,
        new_course.join_code,
        new_course.can_add_chatbot,
    )
    .fetch_one(&mut *tx)
    .await?;
    if let Some((title_embedding, description_embedding)) = embeddings {
        update_course_embeddings(&mut tx, res.id, title_embedding, description_embedding).await?
    }
    tx.commit().await?;
    Ok(res.id)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

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
SELECT *
FROM courses
WHERE deleted_at IS NULL;
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn all_courses_for_auditing(
    conn: &mut PgConnection,
) -> ModelResult<Vec<CourseAuditingData>> {
    let courses_data = sqlx::query!(
        r#"
SELECT c.id,
  c.name,
  c.slug,
  c.created_at,
  c.updated_at,
  c.organization_id,
  c.description,
  c.is_draft,
  c.is_test_mode,
  c.is_unlisted,
  c.is_joinable_by_code_only,
  c.closed_at,
  c.closed_additional_message,
  c.closed_course_successor_id,
  o.name AS organization_name,
  o.slug AS organization_slug
FROM courses c
  JOIN organizations o ON o.id = c.organization_id
WHERE c.deleted_at IS NULL
  AND o.deleted_at IS NULL
GROUP BY c.id,
  c.name,
  o.name,
  o.slug
"#
    )
    .fetch_all(&mut *conn)
    .await?;

    let modules_data = crate::course_modules::get_all_modules(conn).await?;

    let prerequisites_data =
        crate::course_prerequisites::get_all_edit_course_prerequisites(conn).await?;

    let audiences_data = crate::course_audiences::get_all_edit_course_audiences(conn).await?;

    let mut modules_by_course_id: HashMap<Uuid, Vec<CourseModule>> = HashMap::new();
    for module in modules_data {
        modules_by_course_id
            .entry(module.course_id)
            .or_default()
            .push(module);
    }

    for course_modules in modules_by_course_id.values_mut() {
        course_modules.sort_by_key(|c| c.order_number);
    }

    let mut prerequisites_by_course_id: HashMap<Uuid, Vec<EditCoursePrerequisite>> = HashMap::new();
    for prerequisite in prerequisites_data {
        prerequisites_by_course_id
            .entry(prerequisite.course_id)
            .or_default()
            .push(prerequisite);
    }

    let mut audiences_by_course_id: HashMap<Uuid, Vec<EditCourseAudience>> = HashMap::new();
    for audience in audiences_data {
        audiences_by_course_id
            .entry(audience.course_id)
            .or_default()
            .push(audience);
    }

    let data: Vec<CourseAuditingData> = courses_data
        .into_iter()
        .map(|c| CourseAuditingData {
            id: c.id,
            name: c.name,
            slug: c.slug,
            created_at: c.created_at,
            updated_at: c.updated_at,
            organization_id: c.organization_id,
            description: c.description,
            is_draft: c.is_draft,
            is_test_mode: c.is_test_mode,
            is_unlisted: c.is_unlisted,
            is_joinable_by_code_only: c.is_joinable_by_code_only,
            closed_at: c.closed_at,
            closed_additional_message: c.closed_additional_message,
            closed_course_successor_id: c.closed_course_successor_id,
            organization_name: c.organization_name,
            organization_slug: c.organization_slug,
            modules: modules_by_course_id.remove(&c.id).unwrap_or_default(),
            prerequisites: prerequisites_by_course_id.remove(&c.id).unwrap_or_default(),
            audiences: audiences_by_course_id.remove(&c.id).unwrap_or_default(),
        })
        .collect();

    Ok(data)
}

pub async fn course_auditing_data_by_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CourseAuditingData> {
    let course_data = sqlx::query!(
        r#"
SELECT c.id,
  c.name,
  c.slug,
  c.created_at,
  c.updated_at,
  c.organization_id,
  c.description,
  c.is_draft,
  c.is_test_mode,
  c.is_unlisted,
  c.is_joinable_by_code_only,
  c.closed_at,
  c.closed_additional_message,
  c.closed_course_successor_id,
  o.name AS organization_name,
  o.slug AS organization_slug
FROM courses c
  JOIN organizations o ON o.id = c.organization_id
WHERE c.id = $1
  AND c.deleted_at IS NULL
  AND o.deleted_at IS NULL
GROUP BY c.id,
  c.name,
  o.name,
  o.slug
"#,
        course_id
    )
    .fetch_one(&mut *conn)
    .await?;

    let mut modules_data = crate::course_modules::get_by_course_id(conn, course_id).await?;

    modules_data.sort_by_key(|c| c.order_number);

    let prerequisites_data =
        crate::course_prerequisites::get_edit_course_prerequisites_by_course_id(conn, course_id)
            .await?;

    let audiences_data =
        crate::course_audiences::get_edit_course_audiences_by_course_id(conn, course_id).await?;

    let data: CourseAuditingData = CourseAuditingData {
        id: course_data.id,
        name: course_data.name,
        slug: course_data.slug,
        created_at: course_data.created_at,
        updated_at: course_data.updated_at,
        organization_id: course_data.organization_id,
        description: course_data.description,
        is_draft: course_data.is_draft,
        is_test_mode: course_data.is_test_mode,
        is_unlisted: course_data.is_unlisted,
        is_joinable_by_code_only: course_data.is_joinable_by_code_only,
        closed_at: course_data.closed_at,
        closed_additional_message: course_data.closed_additional_message,
        closed_course_successor_id: course_data.closed_course_successor_id,
        organization_name: course_data.organization_name,
        organization_slug: course_data.organization_slug,
        modules: modules_data,
        prerequisites: prerequisites_data,
        audiences: audiences_data,
    };

    Ok(data)
}

/// Saves the auditing view's changes and records the course settings and modules it changed in
/// their history. Modules of other courses in the update are ignored.
pub async fn update_course_auditing_data(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    data_update: CourseAuditingDataUpdate,
    author_user_id: Uuid,
) -> ModelResult<()> {
    // destructure so new fields cause a compilation error here
    let CourseAuditingDataUpdate {
        description,
        is_draft,
        is_test_mode,
        is_unlisted,
        is_joinable_by_code_only,
        closed_at,
        closed_additional_message,
        closed_course_successor_id,
        prerequisites,
        audiences,
        modules,
    } = data_update;
    let author = HistoryAuthor::user(author_user_id);
    let audiences = audience_snapshots(audiences);
    let edit = |live: &CourseSettingsSnapshot| CourseSettingsSnapshot {
        description: description.clone(),
        is_draft,
        is_test_mode,
        is_unlisted,
        is_joinable_by_code_only,
        closed_at,
        closed_additional_message: closed_additional_message.clone(),
        closed_course_successor_id,
        audiences: audiences.clone(),
        ..live.clone()
    };
    let embeddings =
        embed_changed_metadata(conn, app_config, course_id, &edit, &prerequisites).await?;
    let mut tx = conn.begin().await?;
    let live = load_settings(&mut tx, course_id).await?;
    write_settings(&mut tx, app_config, &edit(&live), &live, false, &embeddings).await?;
    write_prerequisites(&mut tx, app_config, course_id, prerequisites, &embeddings).await?;
    entity_history::record_current(
        &mut tx,
        ContentEntityType::CourseSettings,
        course_id,
        author,
    )
    .await?;

    for module_id in
        crate::course_modules::update_auditing_fields(&mut tx, course_id, modules).await?
    {
        entity_history::record_current(&mut tx, ContentEntityType::Module, module_id, author)
            .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn all_courses_user_enrolled_to(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE courses.deleted_at IS NULL
  AND id IN (
    SELECT current_course_id
    FROM user_course_settings
    WHERE deleted_at IS NULL
      AND user_id = $1
  )
"#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

/// A course with its organization's name, as listed to a native client.
#[derive(Debug)]
pub struct CourseWithOrganizationName {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub ai_policy: CourseAiPolicy,
    pub organization_name: String,
}

/// Courses the user is enrolled on, through any of their instances, that contain at least one
/// task of any of the given exercise types; each course once, ordered by name. An empty
/// `exercise_types` matches nothing.
pub async fn get_enrolled_courses_with_exercise_types(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_types: &[String],
) -> ModelResult<Vec<CourseWithOrganizationName>> {
    let courses = sqlx::query_as!(
        CourseWithOrganizationName,
        r#"
SELECT c.id,
  c.slug,
  c.name,
  c.description,
  c.ai_policy AS "ai_policy: CourseAiPolicy",
  o.name AS organization_name
FROM courses AS c
  JOIN organizations AS o ON o.id = c.organization_id
WHERE c.deleted_at IS NULL
  AND o.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM course_instance_enrollments AS cie
      JOIN course_instances AS ci ON ci.id = cie.course_instance_id
    WHERE cie.user_id = $1
      AND ci.course_id = c.id
      AND cie.deleted_at IS NULL
      AND ci.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1
    FROM exercises AS e
      JOIN exercise_slides AS es ON es.exercise_id = e.id
      JOIN exercise_tasks AS et ON et.exercise_slide_id = es.id
    WHERE e.course_id = c.id
      AND et.exercise_type = ANY($2)
      AND e.deleted_at IS NULL
      AND es.deleted_at IS NULL
      AND et.deleted_at IS NULL
  )
ORDER BY c.name,
  c.id
"#,
        user_id,
        exercise_types,
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn all_courses_with_roles_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE courses.deleted_at IS NULL
  AND (
    id IN (
      SELECT course_id
      FROM roles
      WHERE deleted_at IS NULL
        AND user_id = $1
        AND course_id IS NOT NULL
    )
    OR (
      id IN (
        SELECT ci.course_id
        FROM course_instances ci
          JOIN ROLES r ON r.course_instance_id = ci.id
        WHERE r.user_id = $1
          AND r.deleted_at IS NULL
          AND ci.deleted_at IS NULL
      )
    )
  ) "#,
        user_id
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
        r#"
SELECT *
FROM courses
WHERE course_language_group_id = $1
AND deleted_at IS NULL
        "#,
        course.course_language_group_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

/// The courses of the course language groups: [`get_all_language_versions_of_course`] for many
/// groups at once.
pub async fn get_by_course_language_group_ids(
    conn: &mut PgConnection,
    course_language_group_ids: &[Uuid],
) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE course_language_group_id = ANY($1)
  AND deleted_at IS NULL
        "#,
        course_language_group_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn get_active_courses_for_organization(
    conn: &mut PgConnection,
    organization_id: Uuid,
    pagination: Pagination,
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
    c.base_module_completion_requires_n_submodule_completions,
    c.can_add_chatbot,
    c.is_unlisted,
    c.is_joinable_by_code_only,
    c.join_code,
    c.ask_marketing_consent,
    c.flagged_answers_threshold,
    c.flagged_answers_skip_manual_review_and_allow_retry,
    c.closed_at,
    c.closed_additional_message,
    c.closed_course_successor_id,
    c.chapter_locking_enabled,
    c.cheater_detection_enabled,
    c.ai_policy,
    c.course_material_ai_instructions
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
SELECT *
FROM courses
WHERE id = $1
  AND deleted_at IS NULL;
    "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(course)
}

pub async fn get_by_id_and_join_code(
    conn: &mut PgConnection,
    course_id: Uuid,
    join_code: &str,
) -> ModelResult<Course> {
    let course = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE id = $1
  AND join_code = $2
  AND deleted_at IS NULL;
    "#,
        course_id,
        join_code,
    )
    .fetch_one(conn)
    .await?;
    Ok(course)
}

pub async fn get_course_breadcrumb_info(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CourseBreadcrumbInfo> {
    let res = sqlx::query_as!(
        CourseBreadcrumbInfo,
        r#"
SELECT courses.id as course_id,
  courses.name as course_name,
  courses.slug as course_slug,
  organizations.slug as organization_slug,
  organizations.name as organization_name
FROM courses
  JOIN organizations ON (courses.organization_id = organizations.id)
WHERE courses.id = $1
  AND courses.deleted_at IS NULL;
    "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
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

/// None when no active course has this slug.
pub async fn get_active_course_id_by_slug(
    conn: &mut PgConnection,
    slug: &str,
) -> ModelResult<Option<Uuid>> {
    let id = sqlx::query_scalar!(
        "SELECT id FROM courses WHERE slug = $1 AND deleted_at IS NULL",
        slug
    )
    .fetch_optional(conn)
    .await?;
    Ok(id)
}

pub async fn get_organization_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let organization_id = sqlx::query!("SELECT organization_id FROM courses WHERE id = $1", id)
        .fetch_one(conn)
        .await?
        .organization_id;
    Ok(organization_id)
}

/// Gets full course structure including all the pages.
pub async fn get_course_structure(
    conn: &mut PgConnection,
    course_id: Uuid,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<CourseStructure> {
    let course = get_course(conn, course_id).await?;
    let pages = get_all_by_course_id_and_visibility(conn, course_id, PageVisibility::Any).await?;
    let chapters = get_course_chapters(conn, course_id)
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
  base_module_completion_requires_n_submodule_completions,
  can_add_chatbot,
  courses.is_unlisted,
  courses.is_joinable_by_code_only,
  courses.join_code,
  courses.ask_marketing_consent,
  courses.flagged_answers_threshold,
  courses.flagged_answers_skip_manual_review_and_allow_retry,
  courses.closed_at,
  courses.closed_additional_message,
  courses.closed_course_successor_id,
  courses.chapter_locking_enabled,
  courses.cheater_detection_enabled,
  courses.ai_policy,
  courses.course_material_ai_instructions
FROM courses
WHERE courses.organization_id = $1
  AND (
    (
      courses.is_draft IS FALSE
      AND courses.is_unlisted IS FALSE
    )
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
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Default, ToSchema)]

pub struct CourseUpdate {
    pub name: String,
    pub description: Option<String>,
    pub is_draft: bool,
    pub is_test_mode: bool,
    pub can_add_chatbot: bool,
    pub is_unlisted: bool,
    pub is_joinable_by_code_only: bool,
    pub ask_marketing_consent: bool,
    pub flagged_answers_threshold: i32,
    pub flagged_answers_skip_manual_review_and_allow_retry: bool,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_additional_message: Option<String>,
    pub closed_course_successor_id: Option<Uuid>,
    pub chapter_locking_enabled: bool,
    pub ai_policy: CourseAiPolicy,
    pub course_material_ai_instructions: Option<bool>,
}

/// Lets the rest of the transaction swap chapter numbers, module and page order numbers, page
/// paths and citation keys, and point a chapter at a front page it writes later; these
/// constraints are checked at commit.
pub(crate) async fn defer_structure_constraints(conn: &mut PgConnection) -> ModelResult<()> {
    sqlx::query!(
        "SET CONSTRAINTS unique_chapters_chapter_number_course_id_when_not_deleted,
  course_modules_order_number_uniqueness,
  pages_order_number_uniqueness,
  unique_pages_url_path_course_id_when_not_deleted,
  citation_key_uniqueness,
  chapters_front_page_id_fkey DEFERRED"
    )
    .execute(conn)
    .await?;
    Ok(())
}

impl From<&Course> for CourseUpdate {
    /// The course's current values, to change some of them and save with [`update_course`].
    fn from(course: &Course) -> Self {
        Self {
            name: course.name.clone(),
            description: course.description.clone(),
            is_draft: course.is_draft,
            is_test_mode: course.is_test_mode,
            can_add_chatbot: course.can_add_chatbot,
            is_unlisted: course.is_unlisted,
            is_joinable_by_code_only: course.is_joinable_by_code_only,
            ask_marketing_consent: course.ask_marketing_consent,
            flagged_answers_threshold: course.flagged_answers_threshold.unwrap_or(0),
            flagged_answers_skip_manual_review_and_allow_retry: course
                .flagged_answers_skip_manual_review_and_allow_retry,
            closed_at: course.closed_at,
            closed_additional_message: course.closed_additional_message.clone(),
            closed_course_successor_id: course.closed_course_successor_id,
            chapter_locking_enabled: course.chapter_locking_enabled,
            ai_policy: course.ai_policy,
            course_material_ai_instructions: course.course_material_ai_instructions,
        }
    }
}

/// Saves the course's editable fields and records the result in its history. Errors with
/// `PreconditionFailed` if the update changes `can_add_chatbot` and `can_change_chatbot` is false.
pub async fn update_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    course_update: CourseUpdate,
    author_user_id: Uuid,
    can_change_chatbot: bool,
) -> ModelResult<Course> {
    // destructure so new fields cause a compilation error here
    let CourseUpdate {
        name,
        description,
        is_draft,
        is_test_mode,
        can_add_chatbot,
        is_unlisted,
        is_joinable_by_code_only,
        ask_marketing_consent,
        flagged_answers_threshold,
        flagged_answers_skip_manual_review_and_allow_retry,
        closed_at,
        closed_additional_message,
        closed_course_successor_id,
        chapter_locking_enabled,
        ai_policy,
        course_material_ai_instructions,
    } = course_update;
    let edit = move |live: &CourseSettingsSnapshot| CourseSettingsSnapshot {
        name: name.clone(),
        description: description.clone(),
        is_draft,
        is_test_mode,
        can_add_chatbot,
        is_unlisted,
        is_joinable_by_code_only,
        ask_marketing_consent,
        flagged_answers_threshold: Some(flagged_answers_threshold),
        flagged_answers_skip_manual_review_and_allow_retry,
        closed_at,
        closed_additional_message: closed_additional_message.clone(),
        closed_course_successor_id,
        chapter_locking_enabled,
        ai_policy,
        course_material_ai_instructions,
        ..live.clone()
    };
    let live = load_settings(conn, course_id).await?;
    let embeddings =
        TextEmbeddings::create(app_config, changed_settings_texts(&edit(&live), &live)).await?;
    entity_history::save_recording(
        conn,
        ContentEntityType::CourseSettings,
        course_id,
        HistoryAuthor::user(author_user_id),
        async move |tx| {
            let live = load_settings(&mut *tx, course_id).await?;
            write_settings(
                tx,
                app_config,
                &edit(&live),
                &live,
                can_change_chatbot,
                &embeddings,
            )
            .await
        },
    )
    .await
}

async fn load_settings(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CourseSettingsSnapshot> {
    let course = get_course(conn, course_id).await?;
    entity_snapshots::course_settings_of(conn, &course).await
}

/// Writes the course settings of the snapshot without recording history: the course row in one
/// write, and the audiences that differ from `live`, the current settings. Embeddings of the
/// changed name, description and audiences come from `embeddings` where it has them. Errors with
/// `PreconditionFailed` if the snapshot is of another course, or if it changes `can_add_chatbot`
/// and `can_change_chatbot` is false.
pub async fn write_settings(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    settings: &CourseSettingsSnapshot,
    live: &CourseSettingsSnapshot,
    can_change_chatbot: bool,
    embeddings: &TextEmbeddings,
) -> ModelResult<Course> {
    if settings.course_id != live.course_id {
        return Err(model_err!(
            PreconditionFailed,
            "Course settings snapshot is for another course".to_string()
        ));
    }
    if settings.can_add_chatbot != live.can_add_chatbot && !can_change_chatbot {
        return Err(model_err!(
            PreconditionFailed,
            "Only global admins can change whether the course can have a chatbot".to_string()
        ));
    }
    let course_id = settings.course_id;
    let mut tx = conn.begin().await?;
    let course = sqlx::query_as!(
        Course,
        r#"
UPDATE courses
SET name = $1,
  description = $2,
  is_draft = $3,
  is_test_mode = $4,
  can_add_chatbot = $5,
  is_unlisted = $6,
  is_joinable_by_code_only = $7,
  ask_marketing_consent = $8,
  flagged_answers_threshold = $9,
  flagged_answers_skip_manual_review_and_allow_retry = $10,
  closed_at = $11,
  closed_additional_message = $12,
  closed_course_successor_id = $13,
  chapter_locking_enabled = $14,
  ai_policy = $15,
  course_material_ai_instructions = $16,
  base_module_completion_requires_n_submodule_completions = $17
WHERE id = $18
  AND deleted_at IS NULL
RETURNING *
    "#,
        settings.name,
        settings.description,
        settings.is_draft,
        settings.is_test_mode,
        settings.can_add_chatbot,
        settings.is_unlisted,
        settings.is_joinable_by_code_only,
        settings.ask_marketing_consent,
        settings.flagged_answers_threshold,
        settings.flagged_answers_skip_manual_review_and_allow_retry,
        settings.closed_at,
        settings.closed_additional_message,
        settings.closed_course_successor_id,
        settings.chapter_locking_enabled,
        settings.ai_policy as CourseAiPolicy,
        settings.course_material_ai_instructions,
        settings.base_module_completion_requires_n_submodule_completions,
        course_id
    )
    .fetch_one(&mut *tx)
    .await?;

    let (title, description) = changed_embedded_texts(settings, live);
    let title_embedding = embeddings.get_or_create_one(app_config, title).await?;
    let description_embedding = embeddings
        .get_or_create_one(app_config, description)
        .await?;
    update_course_embeddings(&mut tx, course_id, title_embedding, description_embedding).await?;

    if !live.chapter_locking_enabled && settings.chapter_locking_enabled {
        let user_ids: Vec<Uuid> =
            crate::user_course_settings::get_all_by_course_id(&mut tx, course_id)
                .await?
                .into_iter()
                .map(|settings| settings.user_id)
                .collect();
        crate::user_chapter_locking_statuses::init_for_users(&mut tx, course_id, &user_ids).await?;
    }

    let (changed_ids, changed_audiences) = changed_audiences(&settings.audiences, &live.audiences);
    if !changed_audiences.is_empty() {
        let embeddings = embeddings
            .get_or_create(app_config, &changed_audiences)
            .await?;
        upsert_course_audiences(
            &mut tx,
            course_id,
            changed_ids,
            changed_audiences,
            embeddings,
        )
        .await?;
    }
    let removed_audience_ids: Vec<Uuid> = live
        .audiences
        .iter()
        .filter(|live| !settings.audiences.iter().any(|a| a.id == live.id))
        .map(|live| live.id)
        .collect();
    crate::course_audiences::delete_batch(&mut tx, removed_audience_ids).await?;

    tx.commit().await?;
    Ok(course)
}

/// Enables or disables suspected-cheater detection for a single course. Used by the seed routine to
/// turn detection off for seeded courses (which are completed in seconds and would otherwise flag
/// every seeded user); production courses keep the on-by-default value set at creation.
pub async fn set_cheater_detection_enabled(
    conn: &mut PgConnection,
    course_id: Uuid,
    enabled: bool,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE courses
SET cheater_detection_enabled = $1
WHERE id = $2
  AND deleted_at IS NULL
        ",
        enabled,
        course_id,
    )
    .execute(conn)
    .await?;
    Ok(())
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
AND deleted_at IS NULL
RETURNING *
    "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}

pub async fn get_course_by_slug(conn: &mut PgConnection, course_slug: &str) -> ModelResult<Course> {
    let course = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE slug = $1
  AND deleted_at IS NULL
"#,
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

pub async fn is_joinable_by_code_only(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let res = sqlx::query!(
        "
SELECT is_joinable_by_code_only
FROM courses
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.is_joinable_by_code_only)
}

pub async fn get_by_ids(conn: &mut PgConnection, course_ids: &[Uuid]) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE id IN (SELECT * FROM UNNEST($1::uuid[]))
  AND deleted_at IS NULL
        "#,
        course_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

/// Finds courses by slug or (fuzzy) name for the support chatbot's `find_course` tool. Exact
/// slug matches rank first, then substring name matches, then trigram similarity to `name`.
pub async fn search_courses_by_slug_or_name(
    conn: &mut PgConnection,
    query: &str,
    limit: i64,
) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE deleted_at IS NULL
  AND (LOWER(slug) = LOWER($1) OR name ILIKE '%' || $1 || '%' OR similarity(name, $1) > 0.1)
ORDER BY
  LOWER(slug) = LOWER($1) DESC,
  name ILIKE '%' || $1 || '%' DESC,
  similarity(name, $1) DESC
LIMIT $2
        "#,
        query,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

/// The courses the user holds a role in, directly or through the course's organization, by name.
/// Which of them the user may edit is for `headless_lms_authorization` to decide.
pub async fn get_by_course_or_organization_role(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE deleted_at IS NULL
  AND (
    id IN (
      SELECT course_id
      FROM roles
      WHERE deleted_at IS NULL
        AND user_id = $1
        AND course_id IS NOT NULL
    )
    OR organization_id IN (
      SELECT organization_id
      FROM roles
      WHERE deleted_at IS NULL
        AND user_id = $1
        AND organization_id IS NOT NULL
    )
  )
ORDER BY name COLLATE "C",
  id
        "#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn get_by_organization_id(
    conn: &mut PgConnection,
    organization_id: Uuid,
) -> ModelResult<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE organization_id = $1
  AND deleted_at IS NULL
ORDER BY name
        "#,
        organization_id
    )
    .fetch_all(conn)
    .await?;
    Ok(courses)
}

pub async fn set_join_code_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    join_code: String,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE courses
SET join_code = $2
WHERE id = $1
",
        course_id,
        join_code
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_course_with_join_code(
    conn: &mut PgConnection,
    join_code: String,
) -> ModelResult<Course> {
    let course = sqlx::query_as!(
        Course,
        r#"
SELECT *
FROM courses
WHERE join_code = $1
  AND deleted_at IS NULL;
    "#,
        join_code,
    )
    .fetch_one(conn)
    .await?;
    Ok(course)
}

/// Saves the course description, audiences and prerequisites, and records the course settings in
/// their history.
pub async fn set_metadata(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    course_metadata: CourseMetadataUpdate,
    author_user_id: Uuid,
) -> ModelResult<CourseMetadata> {
    let CourseMetadataUpdate {
        course_description,
        course_audiences,
        course_prerequisites,
    } = course_metadata;
    let course_audiences = audience_snapshots(course_audiences);
    let edit = move |live: &CourseSettingsSnapshot| CourseSettingsSnapshot {
        description: course_description.clone(),
        audiences: course_audiences.clone(),
        ..live.clone()
    };
    let embeddings =
        embed_changed_metadata(conn, app_config, course_id, &edit, &course_prerequisites).await?;
    let course = entity_history::save_recording(
        conn,
        ContentEntityType::CourseSettings,
        course_id,
        HistoryAuthor::user(author_user_id),
        async move |tx| {
            let live = load_settings(&mut *tx, course_id).await?;
            let course = write_settings(
                &mut *tx,
                app_config,
                &edit(&live),
                &live,
                false,
                &embeddings,
            )
            .await?;
            write_prerequisites(tx, app_config, course_id, course_prerequisites, &embeddings)
                .await?;
            Ok(course)
        },
    )
    .await?;

    Ok(CourseMetadata {
        course_description: course.description,
        course_audiences: crate::course_audiences::get_by_course_id(conn, course_id).await?,
        course_prerequisites: crate::course_prerequisites::get_by_course_id(conn, course_id)
            .await?,
        course_updated_at: course.updated_at,
    })
}

/// The audiences of an edit, sorted by id as [`CourseSettingsSnapshot::audiences`] are.
fn audience_snapshots(audiences: Vec<EditCourseAudience>) -> Vec<CourseAudienceSnapshot> {
    let mut audiences: Vec<CourseAudienceSnapshot> = audiences
        .into_iter()
        .map(|a| CourseAudienceSnapshot {
            id: a.id,
            audience: a.audience,
        })
        .collect();
    audiences.sort_by_key(|a| a.id);
    audiences
}

/// Saves the course's prerequisites as listed, deleting the ones left out. Only new and changed
/// prerequisites get new embeddings, taken from `embeddings` where it has them.
async fn write_prerequisites(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    prerequisites: Vec<EditCoursePrerequisite>,
    embeddings: &TextEmbeddings,
) -> ModelResult<()> {
    let old_prerequisites = crate::course_prerequisites::get_by_course_id(conn, course_id).await?;
    let removed_ids: Vec<Uuid> = old_prerequisites
        .iter()
        .filter(|old| !prerequisites.iter().any(|p| p.id == old.id))
        .map(|old| old.id)
        .collect();
    let (changed_ids, changed_texts) = changed_prerequisites(&prerequisites, &old_prerequisites);
    if !changed_texts.is_empty() {
        let embeddings = embeddings.get_or_create(app_config, &changed_texts).await?;
        upsert_course_prerequisites(conn, course_id, changed_ids, changed_texts, embeddings)
            .await?;
    }
    crate::course_prerequisites::delete_batch(conn, removed_ids).await?;
    Ok(())
}

/// The audiences of `audiences` that `live` lacks or has with another text.
fn changed_audiences(
    audiences: &[CourseAudienceSnapshot],
    live: &[CourseAudienceSnapshot],
) -> (Vec<Uuid>, Vec<String>) {
    changed_texts(
        audiences,
        live,
        |a| (a.id, a.audience.as_str()),
        |a| (a.id, a.audience.as_str()),
    )
}

/// The prerequisites of `prerequisites` that `old` lacks or has with another text.
fn changed_prerequisites(
    prerequisites: &[EditCoursePrerequisite],
    old: &[CoursePrerequisite],
) -> (Vec<Uuid>, Vec<String>) {
    changed_texts(
        prerequisites,
        old,
        |p| (p.id, p.prerequisite.as_str()),
        |p| (p.id, p.prerequisite.as_str()),
    )
}

/// The ids and texts of `new` that `old` lacks or has with another text.
fn changed_texts<New, Old>(
    new: &[New],
    old: &[Old],
    new_text: fn(&New) -> (Uuid, &str),
    old_text: fn(&Old) -> (Uuid, &str),
) -> (Vec<Uuid>, Vec<String>) {
    let old: HashMap<Uuid, &str> = old.iter().map(old_text).collect();
    new.iter()
        .map(new_text)
        .filter(|(id, text)| old.get(id) != Some(text))
        .map(|(id, text)| (id, text.to_string()))
        .unzip()
}

/// Embeds the settings texts that `edit` of the live settings and saving `prerequisites` would add
/// or change.
async fn embed_changed_metadata(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    edit: &impl Fn(&CourseSettingsSnapshot) -> CourseSettingsSnapshot,
    prerequisites: &[EditCoursePrerequisite],
) -> ModelResult<TextEmbeddings> {
    let live = load_settings(conn, course_id).await?;
    let old_prerequisites = crate::course_prerequisites::get_by_course_id(conn, course_id).await?;
    let mut texts = changed_settings_texts(&edit(&live), &live);
    texts.extend(changed_prerequisites(prerequisites, &old_prerequisites).1);
    TextEmbeddings::create(app_config, texts).await
}

/// The texts whose embeddings [`write_settings`] updates when writing `settings` over `live`.
pub(crate) fn changed_settings_texts(
    settings: &CourseSettingsSnapshot,
    live: &CourseSettingsSnapshot,
) -> Vec<String> {
    let (title, description) = changed_embedded_texts(settings, live);
    let mut texts: Vec<String> = title
        .into_iter()
        .chain(description)
        .map(str::to_string)
        .collect();
    texts.extend(changed_audiences(&settings.audiences, &live.audiences).1);
    texts
}

/// Every text of `settings` that has an embedding, for settings with no earlier version.
pub(crate) fn settings_texts(settings: &CourseSettingsSnapshot) -> Vec<String> {
    std::iter::once(settings.name.as_str())
        .chain(settings.description.as_deref().filter(|d| !d.is_empty()))
        .chain(settings.audiences.iter().map(|a| a.audience.as_str()))
        .map(str::to_string)
        .collect()
}

/// The name and description of `settings` whose course embeddings need updating.
fn changed_embedded_texts<'a>(
    settings: &'a CourseSettingsSnapshot,
    live: &CourseSettingsSnapshot,
) -> (Option<&'a str>, Option<&'a str>) {
    let title = (settings.name != live.name).then_some(settings.name.as_str());
    let description = settings
        .description
        .as_deref()
        .filter(|description| settings.description != live.description && !description.is_empty());
    (title, description)
}

/// Embeddings of course name, description, audience and prerequisite texts, made before a save's
/// transaction so that the save doesn't wait for the embedding API while holding row locks. Texts
/// it lacks, such as ones changed in between, are embedded during the save.
#[derive(Debug, Default)]
pub struct TextEmbeddings(HashMap<String, Vec<f32>>);

impl TextEmbeddings {
    /// Embeds `texts`; calls the embedding API only if there are any.
    pub async fn create(
        app_config: &ApplicationConfiguration,
        texts: Vec<String>,
    ) -> ModelResult<Self> {
        Ok(Self(embed_texts(app_config, texts).await?))
    }

    /// The embeddings of `texts` in order, embedding the ones `self` lacks.
    async fn get_or_create(
        &self,
        app_config: &ApplicationConfiguration,
        texts: &[String],
    ) -> ModelResult<Vec<Vec<f32>>> {
        let missing: Vec<String> = texts
            .iter()
            .filter(|text| !self.0.contains_key(*text))
            .cloned()
            .collect();
        let created = embed_texts(app_config, missing).await?;
        texts
            .iter()
            .map(|text| {
                self.0
                    .get(text)
                    .or_else(|| created.get(text))
                    .cloned()
                    .ok_or_else(missing_model_error(
                        ModelErrorType::Generic,
                        "The embedding API returned too few embeddings.",
                    ))
            })
            .collect()
    }

    /// The embedding of `text`, if any, embedding it if `self` lacks it.
    async fn get_or_create_one(
        &self,
        app_config: &ApplicationConfiguration,
        text: Option<&str>,
    ) -> ModelResult<Option<Vector>> {
        let Some(text) = text else {
            return Ok(None);
        };
        let embedding = self
            .get_or_create(app_config, &[text.to_string()])
            .await?
            .pop()
            .map(Vector::from);
        Ok(embedding)
    }
}

async fn embed_texts(
    app_config: &ApplicationConfiguration,
    mut texts: Vec<String>,
) -> ModelResult<HashMap<String, Vec<f32>>> {
    texts.sort();
    texts.dedup();
    if texts.is_empty() {
        return Ok(HashMap::new());
    }
    let embeddings = create_embeddings(app_config, texts.clone()).await?;
    Ok(texts.into_iter().zip(embeddings).collect())
}

pub async fn get_metadata(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CompleteCourseMetadata> {
    let prerequisites: Vec<CoursePrerequisite> =
        crate::course_prerequisites::get_by_course_id(conn, course_id).await?;
    let audiences: Vec<CourseAudience> =
        crate::course_audiences::get_by_course_id(conn, course_id).await?;
    let course_data = get_course(conn, course_id).await?;
    let instances =
        crate::course_instances::get_course_instances_for_course(conn, course_id).await?;
    let module = crate::course_modules::get_default_by_course_id(conn, course_id).await?;

    let organization =
        crate::organizations::get_organization(conn, course_data.organization_id).await?;

    let metadata = CompleteCourseMetadata {
        course: course_data,
        course_instances: instances,
        default_module: module,
        course_prerequisites: prerequisites,
        course_audiences: audiences,
        course_organization: organization,
    };
    Ok(metadata)
}

/// Saves the course's title and description embeddings, keeping the stored one where an argument
/// is `None`.
pub async fn update_course_embeddings(
    conn: &mut PgConnection,
    course_id: Uuid,
    title_embedding: Option<Vector>,
    description_embedding: Option<Vector>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO course_embeddings (
    course_id,
    title_embedding,
    description_embedding
)
VALUES ($1, $2, $3)
ON CONFLICT (course_id) WHERE deleted_at IS NULL
DO UPDATE SET
    title_embedding = COALESCE(
        $2,
        course_embeddings.title_embedding
    ),
    description_embedding = COALESCE(
        $3,
        course_embeddings.description_embedding
    )
"#,
        course_id,
        title_embedding,
        description_embedding,
    )
    .execute(conn)
    .await?;

    Ok(())
}

pub async fn get_by_description_vectors(
    conn: &mut PgConnection,
    query_vecs: Vec<Vec<f32>>,
    description_keywords: Vec<String>,
) -> ModelResult<Vec<Uuid>> {
    let vectors: Vec<Vector> = query_vecs.into_iter().map(Vector::from).collect();
    let res = sqlx::query_scalar!(
        r#"
SELECT id
FROM (
    SELECT
        c.id,
        LEAST(MIN(ce.title_embedding <#> v.embedding),
              MIN(ce.description_embedding <#> v.embedding)) AS distance
    FROM courses c, course_embeddings ce
    CROSS JOIN unnest($1::vector[]) AS v(embedding)
    WHERE c.deleted_at IS NULL AND ce.deleted_at IS NULL AND c.id = ce.course_id
    GROUP BY c.id
    ORDER BY distance ASC
    LIMIT 10
) t
UNION ALL
SELECT DISTINCT c.id
FROM courses c
CROSS JOIN unnest($2::text[]) AS k(keyword)
WHERE deleted_at IS NULL
  AND to_tsvector(
      c.content_search_language::regconfig,
      c.name || ' ' || coalesce(c.description, '')
  ) @@ websearch_to_tsquery(
      c.content_search_language::regconfig,
      k.keyword
  )
        "#,
        &vectors as _,
        &description_keywords
    )
    .fetch_all(conn)
    .await?;
    Ok(res.into_iter().flatten().collect())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{course_language_groups, courses, test_helper::*};

    mod language_code_validation {
        use super::*;

        #[tokio::test]
        async fn allows_valid_language_code() {
            let app_config =
                init_app_conf().expect("Application Configuration initialization failed");
            insert_data!(:tx, user: _user, :org);
            let course_language_group_id = course_language_groups::insert(
                tx.as_mut(),
                PKeyPolicy::Fixed(Uuid::parse_str("8e40c36c-835b-479c-8f07-863ad408f181").unwrap()),
                "test-clg-allows-valid",
            )
            .await
            .unwrap();
            let new_course = create_new_course(org, "en-US");
            let res = courses::insert(
                tx.as_mut(),
                &app_config,
                PKeyPolicy::Fixed(Uuid::parse_str("95d8ab4d-073c-4794-b8c5-f683f0856356").unwrap()),
                course_language_group_id,
                &new_course,
            )
            .await;
            assert!(res.is_ok());
        }

        #[tokio::test]
        async fn disallows_empty_language_code() {
            let app_config =
                init_app_conf().expect("Application Configuration initialization failed");
            insert_data!(:tx, user: _user, :org);
            let course_language_group_id = course_language_groups::insert(
                tx.as_mut(),
                PKeyPolicy::Fixed(Uuid::parse_str("8e40c36c-835b-479c-8f07-863ad408f181").unwrap()),
                "test-clg-disallows-empty",
            )
            .await
            .unwrap();
            let new_course = create_new_course(org, "");
            let res = courses::insert(
                tx.as_mut(),
                &app_config,
                PKeyPolicy::Fixed(Uuid::parse_str("95d8ab4d-073c-4794-b8c5-f683f0856356").unwrap()),
                course_language_group_id,
                &new_course,
            )
            .await;
            assert!(res.is_err());
        }

        #[tokio::test]
        async fn disallows_wrong_case_language_code() {
            let app_config =
                init_app_conf().expect("Application Configuration initialization failed");
            insert_data!(:tx, user: _user, :org);
            let course_language_group_id = course_language_groups::insert(
                tx.as_mut(),
                PKeyPolicy::Fixed(Uuid::parse_str("8e40c36c-835b-479c-8f07-863ad408f181").unwrap()),
                "test-clg-disallows-wrong-case",
            )
            .await
            .unwrap();
            let new_course = create_new_course(org, "en-us");
            let res = courses::insert(
                tx.as_mut(),
                &app_config,
                PKeyPolicy::Fixed(Uuid::parse_str("95d8ab4d-073c-4794-b8c5-f683f0856356").unwrap()),
                course_language_group_id,
                &new_course,
            )
            .await;
            assert!(res.is_err());
        }

        #[tokio::test]
        async fn disallows_underscore_in_language_code() {
            let app_config =
                init_app_conf().expect("Application Configuration initialization failed");
            insert_data!(:tx, user: _user, :org);
            let course_language_group_id = course_language_groups::insert(
                tx.as_mut(),
                PKeyPolicy::Fixed(Uuid::parse_str("8e40c36c-835b-479c-8f07-863ad408f181").unwrap()),
                "test-clg-disallows-underscore",
            )
            .await
            .unwrap();
            let new_course = create_new_course(org, "en_US");
            let res = courses::insert(
                tx.as_mut(),
                &app_config,
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
                is_unlisted: false,
                copy_user_permissions: false,
                is_joinable_by_code_only: false,
                join_code: None,
                ask_marketing_consent: false,
                flagged_answers_threshold: Some(3),
                can_add_chatbot: false,
            }
        }
    }

    mod ai_policy {
        use super::*;

        #[tokio::test]
        async fn update_course_round_trips_ai_policy_fields() {
            let app_config =
                init_app_conf().expect("Application Configuration initialization failed");
            insert_data!(:tx, :user, :org);
            let course_language_group_id = course_language_groups::insert(
                tx.as_mut(),
                PKeyPolicy::Fixed(Uuid::parse_str("a1b2c3d4-0000-0000-0000-000000000001").unwrap()),
                "test-clg-ai-policy",
            )
            .await
            .unwrap();
            let new_course = NewCourse {
                name: "AI policy course".to_string(),
                slug: "ai-policy-course".to_string(),
                organization_id: org,
                language_code: "en-US".to_string(),
                teacher_in_charge_name: "teacher".to_string(),
                teacher_in_charge_email: "teacher@example.com".to_string(),
                description: "description".to_string(),
                is_draft: false,
                is_test_mode: false,
                is_unlisted: false,
                copy_user_permissions: false,
                is_joinable_by_code_only: false,
                join_code: None,
                ask_marketing_consent: false,
                flagged_answers_threshold: Some(3),
                can_add_chatbot: false,
            };
            let course_id = courses::insert(
                tx.as_mut(),
                &app_config,
                PKeyPolicy::Fixed(Uuid::parse_str("a1b2c3d4-0000-0000-0000-000000000002").unwrap()),
                course_language_group_id,
                &new_course,
            )
            .await
            .unwrap();

            // New courses default to the generic notice (NotSet / Unknown).
            let created = courses::get_course(tx.as_mut(), course_id).await.unwrap();
            assert_eq!(created.ai_policy, CourseAiPolicy::NotSet);
            assert_eq!(created.course_material_ai_instructions, None);

            // A teacher selects a policy and indicates the material has its own AI instructions.
            let updated = courses::update_course(
                tx.as_mut(),
                &app_config,
                course_id,
                CourseUpdate {
                    name: created.name.clone(),
                    flagged_answers_threshold: 3,
                    ai_policy: CourseAiPolicy::Limited,
                    course_material_ai_instructions: Some(true),
                    ..Default::default()
                },
                user,
                false,
            )
            .await
            .unwrap();
            assert_eq!(updated.ai_policy, CourseAiPolicy::Limited);
            assert_eq!(updated.course_material_ai_instructions, Some(true));

            // The change is persisted for subsequent reads (which feed the student dialog).
            let reread = courses::get_course(tx.as_mut(), course_id).await.unwrap();
            assert_eq!(reread.ai_policy, CourseAiPolicy::Limited);
            assert_eq!(reread.course_material_ai_instructions, Some(true));
        }
    }

    mod enrolled_courses_with_exercise_types {
        use super::*;
        use crate::{
            course_instance_enrollments::{self, NewCourseInstanceEnrollment},
            exercise_tasks::{self, NewExerciseTask},
        };

        #[tokio::test]
        async fn gets_enrolled_courses_with_exercise_types() {
            insert_data!(:tx, user:user_id, :org, course:course_id, :instance, course_module:_course_module_id, chapter:chapter_id, page:page_id, :exercise, slide:exercise_slide_id);

            course_instance_enrollments::insert_enrollment_and_set_as_current(
                tx.as_mut(),
                NewCourseInstanceEnrollment {
                    course_id,
                    user_id,
                    course_instance_id: instance.id,
                },
            )
            .await
            .unwrap();
            let tmc = ["tmc".to_string()];
            let courses = get_enrolled_courses_with_exercise_types(tx.as_mut(), user_id, &tmc)
                .await
                .unwrap();
            assert!(
                courses.is_empty(),
                "user should not be enrolled on any course with tmc exercises"
            );

            exercise_tasks::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                NewExerciseTask {
                    assignment: Vec::new(),
                    exercise_slide_id,
                    exercise_type: "tmc".to_string(),
                    model_solution_spec: None,
                    private_spec: None,
                    public_spec: None,
                    order_number: 1,
                },
            )
            .await
            .unwrap();
            let courses = get_enrolled_courses_with_exercise_types(tx.as_mut(), user_id, &tmc)
                .await
                .unwrap();
            assert_eq!(
                courses.len(),
                1,
                "user should be enrolled on one course with tmc exercises"
            );

            // A type list the course has no task for must not match, and neither must an empty list.
            let others = ["quizzes".to_string(), "example-exercise".to_string()];
            assert!(
                get_enrolled_courses_with_exercise_types(tx.as_mut(), user_id, &others)
                    .await
                    .unwrap()
                    .is_empty()
            );
            assert!(
                get_enrolled_courses_with_exercise_types(tx.as_mut(), user_id, &[])
                    .await
                    .unwrap()
                    .is_empty()
            );

            // Any list containing a type the course does have matches.
            let mixed = ["quizzes".to_string(), "tmc".to_string()];
            assert_eq!(
                get_enrolled_courses_with_exercise_types(tx.as_mut(), user_id, &mixed)
                    .await
                    .unwrap()
                    .len(),
                1
            );
            tx.rollback().await;
        }

        #[tokio::test]
        async fn lists_a_course_once_when_enrolled_on_several_of_its_instances() {
            insert_data!(:tx, user:user_id, :org, course:course_id, :instance, course_module:_course_module_id, chapter:_chapter_id, page:_page_id, :exercise, slide:exercise_slide_id);
            exercise_tasks::insert(
                tx.as_mut(),
                PKeyPolicy::Generate,
                NewExerciseTask {
                    assignment: Vec::new(),
                    exercise_slide_id,
                    exercise_type: "tmc".to_string(),
                    model_solution_spec: None,
                    private_spec: None,
                    public_spec: None,
                    order_number: 1,
                },
            )
            .await
            .unwrap();
            let default_instance =
                crate::course_instances::get_default_by_course_id(tx.as_mut(), course_id)
                    .await
                    .unwrap();
            for course_instance_id in [instance.id, default_instance.id] {
                course_instance_enrollments::insert_enrollment_and_set_as_current(
                    tx.as_mut(),
                    NewCourseInstanceEnrollment {
                        course_id,
                        user_id,
                        course_instance_id,
                    },
                )
                .await
                .unwrap();
            }

            let courses = get_enrolled_courses_with_exercise_types(
                tx.as_mut(),
                user_id,
                &["tmc".to_string()],
            )
            .await
            .unwrap();
            assert_eq!(
                courses.iter().map(|c| c.id).collect::<Vec<_>>(),
                vec![course_id]
            );
            tx.rollback().await;
        }
    }
}
