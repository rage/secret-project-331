//! Full snapshots of course content entities.
//!
//! Agent changesets stage these, the chapter, module and course settings history tables store
//! them, and publishing and restoring write them back through the existing save paths. A snapshot
//! holds every field its save path writes, so writing back an unchanged snapshot is a no-op.

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use utoipa::ToSchema;

use crate::{
    agent_changeset_entities::AgentChangesetEntityType,
    course_modules::{self, CompletionPolicy},
    courses::CourseAiPolicy,
    pages::{CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask, CmsPageUpdate},
    prelude::*,
};

/// A course page: its metadata, its stored blocks and its exercises, in the shape the CMS page
/// save takes. Exercise blocks in `content` are stored stripped to their id, as the CMS stores
/// them; the exercises themselves are in `exercises`, `exercise_slides` and `exercise_tasks`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PageSnapshot {
    pub id: Uuid,
    pub course_id: Uuid,
    /// `None` for top-level pages.
    pub chapter_id: Option<Uuid>,
    pub url_path: String,
    pub title: String,
    pub hidden: bool,
    /// Position among the pages of the same chapter (or the top-level pages). 0 is reserved for
    /// a chapter's front page.
    pub order_number: i32,
    pub content: Vec<GutenbergBlock>,
    pub exercises: Vec<CmsPageExercise>,
    pub exercise_slides: Vec<CmsPageExerciseSlide>,
    pub exercise_tasks: Vec<CmsPageExerciseTask>,
}

impl PageSnapshot {
    /// The CMS page save payload that writes this snapshot.
    pub fn to_cms_page_update(&self) -> CmsPageUpdate {
        CmsPageUpdate {
            content: self.content.clone(),
            exercises: self.exercises.clone(),
            exercise_slides: self.exercise_slides.clone(),
            exercise_tasks: self.exercise_tasks.clone(),
            url_path: self.url_path.clone(),
            title: self.title.clone(),
            chapter_id: self.chapter_id,
            hidden: self.hidden,
        }
    }

    /// Sorts the exercise lists so that two snapshots of the same page compare equal regardless
    /// of the order the database returned the rows in.
    fn sort(&mut self) {
        self.exercises.sort_by_key(|a| (a.order_number, a.id));
        for exercise in self.exercises.iter_mut() {
            if let Some(questions) = exercise.peer_or_self_review_questions.as_mut() {
                questions.sort_by_key(|a| (a.order_number, a.id));
            }
        }
        self.exercise_slides
            .sort_by_key(|a| (a.exercise_id, a.order_number, a.id));
        self.exercise_tasks
            .sort_by_key(|a| (a.exercise_slide_id, a.order_number, a.id));
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ChapterSnapshot {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub chapter_image_path: Option<String>,
}

/// A course module's structure fields and settings.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ModuleSnapshot {
    pub id: Uuid,
    pub course_id: Uuid,
    /// `None` only for the course's default module.
    pub name: Option<String>,
    /// 0 only for the course's default module.
    pub order_number: i32,
    pub completion_policy: CompletionPolicy,
    pub certification_enabled: bool,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub completion_registration_link_override: Option<String>,
    pub completions_can_be_registered_to_sisu: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct CourseAudienceSnapshot {
    pub id: Uuid,
    pub audience: String,
}

/// The course's own settings: the editable fields of the `courses` row and its audiences.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct CourseSettingsSnapshot {
    pub course_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_draft: bool,
    pub is_test_mode: bool,
    pub is_unlisted: bool,
    pub can_add_chatbot: bool,
    pub is_joinable_by_code_only: bool,
    pub ask_marketing_consent: bool,
    pub flagged_answers_threshold: Option<i32>,
    pub flagged_answers_skip_manual_review_and_allow_retry: bool,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_additional_message: Option<String>,
    pub closed_course_successor_id: Option<Uuid>,
    pub chapter_locking_enabled: bool,
    pub ai_policy: CourseAiPolicy,
    pub course_material_ai_instructions: Option<bool>,
    pub base_module_completion_requires_n_submodule_completions: i32,
    /// Sorted by id.
    pub audiences: Vec<CourseAudienceSnapshot>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct GlossaryTermSnapshot {
    pub id: Uuid,
    pub course_id: Uuid,
    pub term: String,
    pub definition: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct ReferenceSnapshot {
    pub id: Uuid,
    pub course_id: Uuid,
    pub citation_key: String,
    pub reference: String,
}

/// A snapshot of any entity type an agent changeset can hold.
#[derive(Debug, Clone, PartialEq)]
pub enum EntitySnapshot {
    Page(PageSnapshot),
    Chapter(ChapterSnapshot),
    Module(ModuleSnapshot),
    CourseSettings(CourseSettingsSnapshot),
    GlossaryTerm(GlossaryTermSnapshot),
    Reference(ReferenceSnapshot),
}

impl EntitySnapshot {
    /// Parses a stored snapshot. Errors if `value` is not in the shape of `entity_type`.
    pub fn from_value(
        entity_type: AgentChangesetEntityType,
        value: &serde_json::Value,
    ) -> ModelResult<Self> {
        let value = value.clone();
        let parsed = match entity_type {
            AgentChangesetEntityType::Page => Self::Page(serde_json::from_value(value)?),
            AgentChangesetEntityType::Chapter => Self::Chapter(serde_json::from_value(value)?),
            AgentChangesetEntityType::Module => Self::Module(serde_json::from_value(value)?),
            AgentChangesetEntityType::CourseSettings => {
                Self::CourseSettings(serde_json::from_value(value)?)
            }
            AgentChangesetEntityType::GlossaryTerm => {
                Self::GlossaryTerm(serde_json::from_value(value)?)
            }
            AgentChangesetEntityType::Reference => Self::Reference(serde_json::from_value(value)?),
        };
        Ok(parsed)
    }

    pub fn to_value(&self) -> ModelResult<serde_json::Value> {
        let value = match self {
            Self::Page(s) => serde_json::to_value(s)?,
            Self::Chapter(s) => serde_json::to_value(s)?,
            Self::Module(s) => serde_json::to_value(s)?,
            Self::CourseSettings(s) => serde_json::to_value(s)?,
            Self::GlossaryTerm(s) => serde_json::to_value(s)?,
            Self::Reference(s) => serde_json::to_value(s)?,
        };
        Ok(value)
    }

    pub fn entity_type(&self) -> AgentChangesetEntityType {
        match self {
            Self::Page(_) => AgentChangesetEntityType::Page,
            Self::Chapter(_) => AgentChangesetEntityType::Chapter,
            Self::Module(_) => AgentChangesetEntityType::Module,
            Self::CourseSettings(_) => AgentChangesetEntityType::CourseSettings,
            Self::GlossaryTerm(_) => AgentChangesetEntityType::GlossaryTerm,
            Self::Reference(_) => AgentChangesetEntityType::Reference,
        }
    }

    /// The entity's id; the course id for course settings.
    pub fn entity_id(&self) -> Uuid {
        match self {
            Self::Page(s) => s.id,
            Self::Chapter(s) => s.id,
            Self::Module(s) => s.id,
            Self::CourseSettings(s) => s.course_id,
            Self::GlossaryTerm(s) => s.id,
            Self::Reference(s) => s.id,
        }
    }

    pub fn course_id(&self) -> Uuid {
        match self {
            Self::Page(s) => s.course_id,
            Self::Chapter(s) => s.course_id,
            Self::Module(s) => s.course_id,
            Self::CourseSettings(s) => s.course_id,
            Self::GlossaryTerm(s) => s.course_id,
            Self::Reference(s) => s.course_id,
        }
    }

    /// What people call the entity: a page title, chapter or module name, glossary term or
    /// citation key.
    pub fn label(&self) -> String {
        match self {
            Self::Page(s) => s.title.clone(),
            Self::Chapter(s) => s.name.clone(),
            Self::Module(s) => s.name.clone().unwrap_or_default(),
            Self::CourseSettings(s) => s.name.clone(),
            Self::GlossaryTerm(s) => s.term.clone(),
            Self::Reference(s) => s.citation_key.clone(),
        }
    }
}

/// The live entity, or `None` if it does not exist or is deleted. Pages that belong to an exam
/// are treated as not existing: changesets only hold course content.
pub async fn load_live(
    conn: &mut PgConnection,
    entity_type: AgentChangesetEntityType,
    entity_id: Uuid,
) -> ModelResult<Option<EntitySnapshot>> {
    let snapshot = match entity_type {
        AgentChangesetEntityType::Page => {
            load_page(conn, entity_id).await?.map(EntitySnapshot::Page)
        }
        AgentChangesetEntityType::Chapter => load_chapter(conn, entity_id)
            .await?
            .map(EntitySnapshot::Chapter),
        AgentChangesetEntityType::Module => load_module(conn, entity_id)
            .await?
            .map(EntitySnapshot::Module),
        AgentChangesetEntityType::CourseSettings => load_course_settings(conn, entity_id)
            .await?
            .map(EntitySnapshot::CourseSettings),
        AgentChangesetEntityType::GlossaryTerm => load_glossary_term(conn, entity_id)
            .await?
            .map(EntitySnapshot::GlossaryTerm),
        AgentChangesetEntityType::Reference => load_reference(conn, entity_id)
            .await?
            .map(EntitySnapshot::Reference),
    };
    Ok(snapshot)
}

pub async fn load_page(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Option<PageSnapshot>> {
    let page = match crate::pages::get_page(conn, page_id).await.optional()? {
        Some(page) if page.deleted_at.is_none() && page.exam_id.is_none() => page,
        _ => return Ok(None),
    };
    let Some(course_id) = page.course_id else {
        return Ok(None);
    };
    let cms_page = crate::pages::get_page_with_exercises(conn, page_id).await?;
    let mut snapshot = PageSnapshot {
        id: page.id,
        course_id,
        chapter_id: page.chapter_id,
        url_path: page.url_path,
        title: page.title,
        hidden: page.hidden,
        order_number: page.order_number,
        content: serde_json::from_value(page.content)?,
        exercises: cms_page.exercises,
        exercise_slides: cms_page.exercise_slides,
        exercise_tasks: cms_page.exercise_tasks,
    };
    snapshot.sort();
    Ok(Some(snapshot))
}

pub async fn load_chapter(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<Option<ChapterSnapshot>> {
    let res = sqlx::query_as!(
        ChapterSnapshot,
        r#"
SELECT id,
  course_id,
  course_module_id,
  name,
  color,
  chapter_number,
  front_page_id,
  opens_at,
  deadline,
  chapter_image_path
FROM chapters
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        chapter_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn load_module(
    conn: &mut PgConnection,
    module_id: Uuid,
) -> ModelResult<Option<ModuleSnapshot>> {
    let module = course_modules::get_by_id(conn, module_id)
        .await
        .optional()?;
    Ok(module.map(ModuleSnapshot::from))
}

impl From<course_modules::CourseModule> for ModuleSnapshot {
    fn from(module: course_modules::CourseModule) -> Self {
        Self {
            id: module.id,
            course_id: module.course_id,
            name: module.name,
            order_number: module.order_number,
            completion_policy: module.completion_policy,
            certification_enabled: module.certification_enabled,
            uh_course_code: module.uh_course_code,
            ects_credits: module.ects_credits,
            completion_registration_link_override: module.completion_registration_link_override,
            completions_can_be_registered_to_sisu: module.completions_can_be_registered_to_sisu,
        }
    }
}

impl From<crate::chapters::DatabaseChapter> for ChapterSnapshot {
    fn from(chapter: crate::chapters::DatabaseChapter) -> Self {
        Self {
            id: chapter.id,
            course_id: chapter.course_id,
            course_module_id: chapter.course_module_id,
            name: chapter.name,
            color: chapter.color,
            chapter_number: chapter.chapter_number,
            front_page_id: chapter.front_page_id,
            opens_at: chapter.opens_at,
            deadline: chapter.deadline,
            chapter_image_path: chapter.chapter_image_path,
        }
    }
}

pub async fn load_course_settings(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Option<CourseSettingsSnapshot>> {
    let Some(course) = crate::courses::get_course(conn, course_id)
        .await
        .optional()?
    else {
        return Ok(None);
    };
    let mut audiences: Vec<CourseAudienceSnapshot> =
        crate::course_audiences::get_by_course_id(conn, course_id)
            .await?
            .into_iter()
            .map(|audience| CourseAudienceSnapshot {
                id: audience.id,
                audience: audience.audience,
            })
            .collect();
    audiences.sort_by_key(|audience| audience.id);
    Ok(Some(CourseSettingsSnapshot {
        course_id: course.id,
        name: course.name,
        description: course.description,
        is_draft: course.is_draft,
        is_test_mode: course.is_test_mode,
        is_unlisted: course.is_unlisted,
        can_add_chatbot: course.can_add_chatbot,
        is_joinable_by_code_only: course.is_joinable_by_code_only,
        ask_marketing_consent: course.ask_marketing_consent,
        flagged_answers_threshold: course.flagged_answers_threshold,
        flagged_answers_skip_manual_review_and_allow_retry: course
            .flagged_answers_skip_manual_review_and_allow_retry,
        closed_at: course.closed_at,
        closed_additional_message: course.closed_additional_message,
        closed_course_successor_id: course.closed_course_successor_id,
        chapter_locking_enabled: course.chapter_locking_enabled,
        ai_policy: course.ai_policy,
        course_material_ai_instructions: course.course_material_ai_instructions,
        base_module_completion_requires_n_submodule_completions: course
            .base_module_completion_requires_n_submodule_completions,
        audiences,
    }))
}

pub async fn load_glossary_term(
    conn: &mut PgConnection,
    term_id: Uuid,
) -> ModelResult<Option<GlossaryTermSnapshot>> {
    let res = sqlx::query_as!(
        GlossaryTermSnapshot,
        r#"
SELECT id,
  course_id,
  term,
  definition
FROM glossary
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        term_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn load_reference(
    conn: &mut PgConnection,
    reference_id: Uuid,
) -> ModelResult<Option<ReferenceSnapshot>> {
    let res = sqlx::query_as!(
        ReferenceSnapshot,
        r#"
SELECT id,
  course_id,
  citation_key,
  reference
FROM material_references
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        reference_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// The newest history row of an entity: who last changed it and when.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct EntityVersion {
    pub history_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub author_user_id: Uuid,
    /// The agent client the change was made through; `None` for the web UI.
    pub agent_client_name: Option<String>,
}

/// The entity's newest history row. Always `None` for glossary terms and references, which have
/// no history table, and for entities never saved since history was introduced.
pub async fn latest_version(
    conn: &mut PgConnection,
    entity_type: AgentChangesetEntityType,
    entity_id: Uuid,
) -> ModelResult<Option<EntityVersion>> {
    let version = match entity_type {
        AgentChangesetEntityType::Page => {
            sqlx::query_as!(
                EntityVersion,
                r#"
SELECT id AS history_id,
  created_at,
  author_user_id,
  agent_client_name
FROM page_history
WHERE page_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC,
  id DESC
LIMIT 1
            "#,
                entity_id,
            )
            .fetch_optional(conn)
            .await?
        }
        AgentChangesetEntityType::Chapter => {
            sqlx::query_as!(
                EntityVersion,
                r#"
SELECT id AS history_id,
  created_at,
  author_user_id,
  agent_client_name
FROM chapter_history
WHERE chapter_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC,
  id DESC
LIMIT 1
            "#,
                entity_id,
            )
            .fetch_optional(conn)
            .await?
        }
        AgentChangesetEntityType::Module => {
            sqlx::query_as!(
                EntityVersion,
                r#"
SELECT id AS history_id,
  created_at,
  author_user_id,
  agent_client_name
FROM course_module_history
WHERE course_module_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC,
  id DESC
LIMIT 1
            "#,
                entity_id,
            )
            .fetch_optional(conn)
            .await?
        }
        AgentChangesetEntityType::CourseSettings => {
            sqlx::query_as!(
                EntityVersion,
                r#"
SELECT id AS history_id,
  created_at,
  author_user_id,
  agent_client_name
FROM course_settings_history
WHERE course_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC,
  id DESC
LIMIT 1
            "#,
                entity_id,
            )
            .fetch_optional(conn)
            .await?
        }
        AgentChangesetEntityType::GlossaryTerm | AgentChangesetEntityType::Reference => None,
    };
    Ok(version)
}
