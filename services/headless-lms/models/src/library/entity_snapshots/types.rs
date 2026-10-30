use std::collections::HashMap;
use std::sync::Arc;

use headless_lms_utils::{document_schema_processor::GutenbergBlock, stable_digest::stable_digest};
use utoipa::ToSchema;

use super::{ContentEntity, ContentEntityType, EntityKey};
use crate::{
    course_modules::{self, CompletionPolicy},
    courses::CourseAiPolicy,
    pages::{
        CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask, CmsPageUpdate,
        fork_peer_or_self_review_config,
    },
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
    /// Shared with the page records made from the snapshot.
    #[schema(value_type = Vec<GutenbergBlock>)]
    pub content: Arc<Vec<GutenbergBlock>>,
    pub exercises: Vec<CmsPageExercise>,
    pub exercise_slides: Vec<CmsPageExerciseSlide>,
    pub exercise_tasks: Vec<CmsPageExerciseTask>,
    /// For a page publishing creates: the page language group of its versions in the course's
    /// other languages that it joins. `None` for every other page, whatever group it is in.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub joins_page_language_group_id: Option<Uuid>,
}

impl PageSnapshot {
    /// The CMS page save payload that writes this snapshot.
    pub fn to_cms_page_update(&self) -> CmsPageUpdate {
        CmsPageUpdate {
            content: self.content.to_vec(),
            exercises: self.exercises.clone(),
            exercise_slides: self.exercise_slides.clone(),
            exercise_tasks: self.exercise_tasks.clone(),
            url_path: self.url_path.clone(),
            title: self.title.clone(),
            chapter_id: self.chapter_id,
            hidden: self.hidden,
        }
    }

    /// Trims and normalises the title and path the way the page save does, so that the snapshot
    /// equals the page publishing it produces.
    pub fn normalize_for_storage(&mut self) {
        self.title = self.title.trim().to_string();
        self.url_path = crate::pages::normalize_url_path_for_storage(&self.url_path);
    }

    /// The page's exercises in exercise order, each with its slides and tasks.
    pub fn exercise_bundles(&self) -> Vec<ExerciseBundle> {
        exercise_bundles(&self.exercises, &self.exercise_slides, &self.exercise_tasks)
    }

    /// Replaces the page's exercises, with their slides and tasks, with `bundles`.
    pub fn set_exercise_bundles<'a>(
        &mut self,
        bundles: impl IntoIterator<Item = &'a ExerciseBundle>,
    ) {
        self.exercises.clear();
        self.exercise_slides.clear();
        self.exercise_tasks.clear();
        for bundle in bundles {
            self.exercises.push(bundle.exercise.clone());
            self.exercise_slides.extend(bundle.slides.iter().cloned());
            self.exercise_tasks.extend(bundle.tasks.iter().cloned());
        }
        self.sort();
    }

    /// Sorts the exercise lists so that two snapshots of the same page compare equal regardless
    /// of the order the database returned the rows in.
    pub fn sort(&mut self) {
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

/// Each exercise in exercise order, with its slides and tasks.
pub fn exercise_bundles(
    exercises: &[CmsPageExercise],
    exercise_slides: &[CmsPageExerciseSlide],
    exercise_tasks: &[CmsPageExerciseTask],
) -> Vec<ExerciseBundle> {
    exercises
        .iter()
        .map(|exercise| {
            let mut slides: Vec<CmsPageExerciseSlide> = exercise_slides
                .iter()
                .filter(|slide| slide.exercise_id == exercise.id)
                .cloned()
                .collect();
            slides.sort_by_key(|slide| (slide.order_number, slide.id));
            let tasks = slides
                .iter()
                .flat_map(|slide| {
                    let mut tasks: Vec<CmsPageExerciseTask> = exercise_tasks
                        .iter()
                        .filter(|task| task.exercise_slide_id == slide.id)
                        .cloned()
                        .collect();
                    tasks.sort_by_key(|task| (task.order_number, task.id));
                    tasks
                })
                .collect();
            ExerciseBundle {
                exercise: exercise.clone(),
                slides,
                tasks,
            }
        })
        .collect()
}

/// One exercise of a page snapshot with its slides and tasks.
#[derive(Debug, Clone, PartialEq)]
pub struct ExerciseBundle {
    pub exercise: CmsPageExercise,
    /// In slide order.
    pub slides: Vec<CmsPageExerciseSlide>,
    /// In slide order, then task order.
    pub tasks: Vec<CmsPageExerciseTask>,
}

impl ExerciseBundle {
    /// A new exercise `new_exercise_id` with this one's settings, slides and tasks, which get ids
    /// from `new_id`. Stored files the tasks reference are shared, not duplicated.
    pub fn copy_with_new_ids(
        &self,
        new_exercise_id: Uuid,
        mut new_id: impl FnMut() -> Uuid,
    ) -> Self {
        let mut exercise = self.exercise.clone();
        exercise.id = new_exercise_id;
        if let Some(config) = exercise.peer_or_self_review_config.as_mut() {
            let questions = exercise
                .peer_or_self_review_questions
                .as_deref_mut()
                .unwrap_or_default();
            fork_peer_or_self_review_config(config, questions, new_exercise_id, &mut new_id);
        } else if let Some(questions) = exercise.peer_or_self_review_questions.as_mut() {
            for question in questions {
                question.id = new_id();
            }
        }
        let slide_ids: HashMap<Uuid, Uuid> = self.slides.iter().map(|s| (s.id, new_id())).collect();
        let slides = self
            .slides
            .iter()
            .map(|s| CmsPageExerciseSlide {
                id: slide_ids[&s.id],
                exercise_id: new_exercise_id,
                order_number: s.order_number,
            })
            .collect();
        let tasks = self
            .tasks
            .iter()
            .map(|t| {
                let mut task = t.clone();
                task.id = new_id();
                task.exercise_slide_id = slide_ids
                    .get(&t.exercise_slide_id)
                    .copied()
                    .unwrap_or(t.exercise_slide_id);
                task
            })
            .collect();
        Self {
            exercise,
            slides,
            tasks,
        }
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

impl ChapterSnapshot {
    /// A new, unnamed chapter of `course_module_id`.
    pub fn new(id: Uuid, course_id: Uuid, course_module_id: Uuid) -> Self {
        Self {
            id,
            course_id,
            course_module_id,
            name: String::new(),
            color: None,
            chapter_number: 0,
            front_page_id: None,
            opens_at: None,
            deadline: None,
            chapter_image_path: None,
        }
    }
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

impl ModuleSnapshot {
    /// A new, unnamed module with the settings modules created in the editor get.
    pub fn new(id: Uuid, course_id: Uuid) -> Self {
        course_modules::NewCourseModule::new(course_id, None, 0).into_snapshot(id)
    }
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

/// The peer and self review settings of a course that exercises use unless they have their own.
/// Agents edit only the instructions; the other settings are left out.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct CourseDefaultReviewConfigSnapshot {
    /// The `peer_or_self_review_configs` row.
    pub id: Uuid,
    pub course_id: Uuid,
    /// Blocks; `None` when there are none.
    pub review_instructions: Option<serde_json::Value>,
}

/// A snapshot of any entity type an agent changeset can hold. Serialised as the bare snapshot;
/// stored ones are parsed with [`EntitySnapshot::from_json`], which knows the type.
#[derive(Debug, Clone, PartialEq, Serialize, ToSchema)]
#[serde(untagged)]
pub enum EntitySnapshot {
    Page(PageSnapshot),
    Chapter(ChapterSnapshot),
    Module(ModuleSnapshot),
    CourseSettings(CourseSettingsSnapshot),
    GlossaryTerm(GlossaryTermSnapshot),
    Reference(ReferenceSnapshot),
    CourseDefaultReviewConfig(CourseDefaultReviewConfigSnapshot),
}

/// `$body` with `$inner` bound to the snapshot inside the [`EntitySnapshot`] `$snapshot`.
macro_rules! match_snapshot {
    ($snapshot:expr, $inner:ident => $body:expr) => {
        match $snapshot {
            EntitySnapshot::Page($inner) => $body,
            EntitySnapshot::Chapter($inner) => $body,
            EntitySnapshot::Module($inner) => $body,
            EntitySnapshot::CourseSettings($inner) => $body,
            EntitySnapshot::GlossaryTerm($inner) => $body,
            EntitySnapshot::Reference($inner) => $body,
            EntitySnapshot::CourseDefaultReviewConfig($inner) => $body,
        }
    };
}

/// `$body` with the type alias `$t` naming the snapshot type of the [`ContentEntityType`]
/// `$entity_type`.
macro_rules! with_snapshot_type {
    ($entity_type:expr, $t:ident => $body:expr) => {
        match $entity_type {
            ContentEntityType::Page => {
                type $t = PageSnapshot;
                $body
            }
            ContentEntityType::Chapter => {
                type $t = ChapterSnapshot;
                $body
            }
            ContentEntityType::Module => {
                type $t = ModuleSnapshot;
                $body
            }
            ContentEntityType::CourseSettings => {
                type $t = CourseSettingsSnapshot;
                $body
            }
            ContentEntityType::GlossaryTerm => {
                type $t = GlossaryTermSnapshot;
                $body
            }
            ContentEntityType::Reference => {
                type $t = ReferenceSnapshot;
                $body
            }
            ContentEntityType::CourseDefaultReviewConfig => {
                type $t = CourseDefaultReviewConfigSnapshot;
                $body
            }
        }
    };
}

pub(crate) use {match_snapshot, with_snapshot_type};

impl EntitySnapshot {
    /// Parses a stored snapshot. Errors if `json` is not in the shape of `entity_type`.
    pub fn from_json(entity_type: ContentEntityType, json: &str) -> ModelResult<Self> {
        Ok(with_snapshot_type!(entity_type, T => serde_json::from_str::<T>(json)?.into()))
    }

    /// The kind of entity the snapshot holds.
    pub fn entity_type(&self) -> ContentEntityType {
        fn entity_type_of<T: ContentEntity>(_: &T) -> ContentEntityType {
            T::ENTITY_TYPE
        }
        match_snapshot!(self, snapshot => entity_type_of(snapshot))
    }

    /// The entity's id; the course id for course settings.
    pub fn entity_id(&self) -> Uuid {
        match_snapshot!(self, snapshot => snapshot.id())
    }

    /// The course the entity belongs to.
    pub fn course_id(&self) -> Uuid {
        match_snapshot!(self, snapshot => snapshot.course_id())
    }

    /// The entity's key.
    pub fn key(&self) -> EntityKey {
        EntityKey::new(self.entity_type(), self.entity_id())
    }

    /// See [`EntityRef::label`](super::EntityRef::label).
    pub fn label(&self) -> &str {
        match_snapshot!(self, snapshot => snapshot.label())
    }

    /// The chapter or module the entity is placed in; `None` for entities of the course itself.
    pub fn parent(&self) -> Option<EntityKey> {
        match_snapshot!(self, snapshot => snapshot.parent())
    }

    /// A digest that two snapshots share exactly when they are equal, for storing in place of a
    /// snapshot that is only compared.
    pub fn digest(&self) -> ModelResult<String> {
        Ok(json_digest(&serde_json::to_string(self)?))
    }
}

/// [`EntitySnapshot::digest`] of a snapshot serialised as `json`.
pub(crate) fn json_digest(json: &str) -> String {
    stable_digest(&[json.as_bytes()])
}

impl From<PageSnapshot> for EntitySnapshot {
    fn from(snapshot: PageSnapshot) -> Self {
        Self::Page(snapshot)
    }
}

impl From<ChapterSnapshot> for EntitySnapshot {
    fn from(snapshot: ChapterSnapshot) -> Self {
        Self::Chapter(snapshot)
    }
}

impl From<ModuleSnapshot> for EntitySnapshot {
    fn from(snapshot: ModuleSnapshot) -> Self {
        Self::Module(snapshot)
    }
}

impl From<CourseSettingsSnapshot> for EntitySnapshot {
    fn from(snapshot: CourseSettingsSnapshot) -> Self {
        Self::CourseSettings(snapshot)
    }
}

impl From<GlossaryTermSnapshot> for EntitySnapshot {
    fn from(snapshot: GlossaryTermSnapshot) -> Self {
        Self::GlossaryTerm(snapshot)
    }
}

impl From<ReferenceSnapshot> for EntitySnapshot {
    fn from(snapshot: ReferenceSnapshot) -> Self {
        Self::Reference(snapshot)
    }
}

impl From<CourseDefaultReviewConfigSnapshot> for EntitySnapshot {
    fn from(snapshot: CourseDefaultReviewConfigSnapshot) -> Self {
        Self::CourseDefaultReviewConfig(snapshot)
    }
}
