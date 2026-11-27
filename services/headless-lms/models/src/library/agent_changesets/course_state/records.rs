use std::collections::HashMap;
use std::sync::Arc;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use utoipa::ToSchema;

use crate::{
    exercise_tasks::ExerciseTaskLayoutRow,
    library::entity_snapshots::{ContentEntityType, EntityRef, ExerciseBundle, PageSnapshot},
    pages::{CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask},
    peer_or_self_review_configs::CmsPeerOrSelfReviewConfiguration,
    peer_or_self_review_questions::normalize_cms_peer_or_self_review_questions,
    prelude::*,
};

/// A page's structure fields and blocks; exercises stay in the full [`PageSnapshot`].
#[derive(Debug, Clone, PartialEq)]
pub struct PageRecord {
    pub id: Uuid,
    pub chapter_id: Option<Uuid>,
    pub url_path: String,
    pub title: String,
    pub hidden: bool,
    pub order_number: i32,
    /// Shared between states and snapshots until one of them changes it, so that comparing
    /// unchanged blocks is a pointer comparison.
    pub content: Arc<Vec<GutenbergBlock>>,
    /// See [`PageSnapshot::joins_page_language_group_id`].
    pub joins_page_language_group_id: Option<Uuid>,
}

impl PageRecord {
    /// The page, labelled with its title.
    pub fn entity_ref(&self) -> EntityRef {
        EntityRef {
            entity_type: ContentEntityType::Page,
            entity_id: self.id,
            label: self.title.clone(),
        }
    }
}

impl PageSnapshot {
    /// The page `record` describes, with exactly the exercises its exercise blocks name, taken
    /// from `bundles`. Errors with the exercise ids `bundles` doesn't have.
    pub fn from_record_and_bundles(
        course_id: Uuid,
        record: &PageRecord,
        bundles: &HashMap<Uuid, ExerciseBundle>,
    ) -> Result<Self, Vec<Uuid>> {
        let mut snapshot = Self {
            id: record.id,
            course_id,
            chapter_id: record.chapter_id,
            url_path: record.url_path.clone(),
            title: record.title.clone(),
            hidden: record.hidden,
            order_number: record.order_number,
            content: Arc::clone(&record.content),
            exercises: Vec::new(),
            exercise_slides: Vec::new(),
            exercise_tasks: Vec::new(),
            joins_page_language_group_id: record.joins_page_language_group_id,
        };
        let mut missing = Vec::new();
        for exercise_id in record
            .content
            .iter()
            .filter_map(GutenbergBlock::exercise_id)
        {
            match bundles.get(&exercise_id) {
                Some(bundle) => {
                    snapshot.exercises.push(bundle.exercise.clone());
                    snapshot
                        .exercise_slides
                        .extend(bundle.slides.iter().cloned());
                    snapshot.exercise_tasks.extend(bundle.tasks.iter().cloned());
                }
                None => missing.push(exercise_id),
            }
        }
        snapshot.sort();
        if missing.is_empty() {
            Ok(snapshot)
        } else {
            Err(missing)
        }
    }
}

impl From<&PageSnapshot> for PageRecord {
    fn from(page: &PageSnapshot) -> Self {
        Self {
            id: page.id,
            chapter_id: page.chapter_id,
            url_path: page.url_path.clone(),
            title: page.title.clone(),
            hidden: page.hidden,
            order_number: page.order_number,
            content: Arc::clone(&page.content),
            joins_page_language_group_id: page.joins_page_language_group_id,
        }
    }
}

/// What agents may edit of an exercise, and what identifies its tasks and review settings. The
/// exercise itself is stored in the full [`PageSnapshot`] of its page.
#[derive(Debug, Clone, PartialEq)]
pub struct ExerciseRecord {
    pub id: Uuid,
    /// The page whose snapshot the record was made from. A call that moves the exercise's block
    /// leaves it as it was;
    /// [`CourseState::exercise_page_id`](super::CourseState::exercise_page_id) has the page that
    /// holds the block.
    pub page_id: Uuid,
    pub name: String,
    /// The exercise's own deadline; `None` lets its chapter's apply.
    pub deadline: Option<DateTime<Utc>>,
    pub needs_peer_review: bool,
    pub needs_self_review: bool,
    /// Slide ids in slide order.
    pub slides: Vec<Uuid>,
    /// In slide order, then task order; see [`Self::sort_tasks_by_slide`].
    pub tasks: Vec<ExerciseTaskRecord>,
    pub review_config: ExerciseReviewConfig,
}

/// One task of an [`ExerciseRecord`].
#[derive(Debug, Clone, PartialEq)]
pub struct ExerciseTaskRecord {
    pub id: Uuid,
    pub slide_id: Uuid,
    pub exercise_type: String,
    /// The task's instructions: blocks, as the CMS stores them.
    pub assignment: Arc<serde_json::Value>,
    pub private_spec: Option<Arc<serde_json::Value>>,
    /// See [`CmsPageExerciseTask::private_spec_files`].
    pub private_spec_files: Vec<Uuid>,
    pub repository_exercise_id: Option<Uuid>,
}

impl ExerciseTaskRecord {
    fn of_task(task: &CmsPageExerciseTask) -> Self {
        Self {
            id: task.id,
            slide_id: task.exercise_slide_id,
            exercise_type: task.exercise_type.clone(),
            assignment: Arc::new(task.assignment.clone()),
            private_spec: task.private_spec.clone().map(Arc::new),
            private_spec_files: task.private_spec_files.clone(),
            repository_exercise_id: task.repository_exercise_id,
        }
    }

    fn to_task(&self, order_number: i32) -> CmsPageExerciseTask {
        CmsPageExerciseTask {
            id: self.id,
            exercise_slide_id: self.slide_id,
            assignment: (*self.assignment).clone(),
            exercise_type: self.exercise_type.clone(),
            private_spec: self.private_spec.as_deref().cloned(),
            order_number,
            private_spec_files: self.private_spec_files.clone(),
            repository_exercise_id: self.repository_exercise_id,
        }
    }
}

/// Which review settings an exercise uses.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReviewConfigKind {
    CourseDefault,
    Own,
}

/// Which peer and self review settings an exercise uses.
#[derive(Debug, Clone, PartialEq)]
pub enum ExerciseReviewConfig {
    CourseDefault,
    Own {
        config_id: Uuid,
        /// Blocks; `None` when there are none.
        review_instructions: Option<Arc<serde_json::Value>>,
    },
    /// Neither the course default nor settings of its own.
    Unset,
}

impl ExerciseReviewConfig {
    /// The settings the exercise uses.
    pub fn of_exercise(exercise: &CmsPageExercise) -> Self {
        match &exercise.peer_or_self_review_config {
            _ if exercise.use_course_default_peer_or_self_review_config => Self::CourseDefault,
            Some(config) => Self::Own {
                config_id: config.id,
                review_instructions: config.review_instructions.clone().map(Arc::new),
            },
            None => Self::Unset,
        }
    }

    /// Whether these are the course default's or the exercise's own; `None` for
    /// [`ExerciseReviewConfig::Unset`].
    pub fn kind(&self) -> Option<ReviewConfigKind> {
        match self {
            Self::CourseDefault => Some(ReviewConfigKind::CourseDefault),
            Self::Own { .. } => Some(ReviewConfigKind::Own),
            Self::Unset => None,
        }
    }

    /// The review instructions of the exercise's own settings; `None` also when it uses the
    /// course default's.
    pub fn own_review_instructions(&self) -> Option<&serde_json::Value> {
        match self {
            Self::Own {
                review_instructions,
                ..
            } => review_instructions.as_deref(),
            _ => None,
        }
    }
}

impl ExerciseRecord {
    /// The record of one exercise of the page `page_id`.
    pub fn of_bundle(page_id: Uuid, bundle: &ExerciseBundle) -> Self {
        let exercise = &bundle.exercise;
        let review_config = ExerciseReviewConfig::of_exercise(exercise);
        Self {
            id: exercise.id,
            page_id,
            name: exercise.name.clone(),
            deadline: exercise.deadline,
            needs_peer_review: exercise.needs_peer_review,
            needs_self_review: exercise.needs_self_review,
            slides: bundle.slides.iter().map(|slide| slide.id).collect(),
            tasks: bundle
                .tasks
                .iter()
                .map(ExerciseTaskRecord::of_task)
                .collect(),
            review_config,
        }
    }

    /// The records of the page's exercises.
    pub fn of_page(page: &PageSnapshot) -> Vec<Self> {
        page.exercise_bundles()
            .iter()
            .map(|bundle| Self::of_bundle(page.id, bundle))
            .collect()
    }

    /// Whether the records differ only in the page they were made from.
    pub fn has_same_content(&self, other: &ExerciseRecord) -> bool {
        let ExerciseRecord {
            id,
            page_id: _,
            name,
            deadline,
            needs_peer_review,
            needs_self_review,
            slides,
            tasks,
            review_config,
        } = self;
        *id == other.id
            && *name == other.name
            && *deadline == other.deadline
            && *needs_peer_review == other.needs_peer_review
            && *needs_self_review == other.needs_self_review
            && *slides == other.slides
            && *tasks == other.tasks
            && *review_config == other.review_config
    }

    /// Each task's id and slide, in order.
    fn task_layout(&self) -> impl Iterator<Item = (Uuid, Uuid)> + '_ {
        self.tasks.iter().map(|task| (task.id, task.slide_id))
    }

    /// Restores the task order invariant after tasks were added or moved between slides: slide
    /// order first, the order within a slide kept.
    pub fn sort_tasks_by_slide(&mut self) {
        let position = |slide_id: Uuid| self.slides.iter().position(|id| *id == slide_id);
        let mut tasks = std::mem::take(&mut self.tasks);
        tasks.sort_by_key(|task| position(task.slide_id));
        self.tasks = tasks;
    }

    /// Replaces the bundle's slides and tasks with the record's, numbered in order.
    fn rebuild_slides_and_tasks(&self, bundle: &mut ExerciseBundle) {
        let exercise_id = bundle.exercise.id;
        bundle.slides = self
            .slides
            .iter()
            .zip(0..)
            .map(|(id, order_number)| CmsPageExerciseSlide {
                id: *id,
                exercise_id,
                order_number,
            })
            .collect();
        bundle.tasks = self
            .slides
            .iter()
            .flat_map(|slide_id| {
                self.tasks
                    .iter()
                    .filter(move |task| task.slide_id == *slide_id)
                    .zip(0..)
                    .map(|(task, order_number)| task.to_task(order_number))
            })
            .collect();
    }

    /// Whether the exercise has peer or self reviews, whose instructions it then shows.
    pub fn has_reviews(&self) -> bool {
        self.needs_peer_review || self.needs_self_review
    }

    /// Writes the change from `before` to this record into `bundle`. Switching to own review
    /// settings copies `course_default`, with `new_id` ids for its questions. Errors if `bundle`
    /// isn't the exercise `before` describes, or the copy needs a default the course lacks.
    pub fn apply_to(
        &self,
        before: &ExerciseRecord,
        bundle: &mut ExerciseBundle,
        course_default: Option<&CmsPeerOrSelfReviewConfiguration>,
        new_id: impl FnMut() -> Uuid,
    ) -> Result<(), ExerciseEditError> {
        let current = ExerciseRecord::of_bundle(before.page_id, bundle);
        if current != *before {
            return Err(ExerciseEditError::ChangedSinceRead);
        }
        if self.slides == before.slides && self.task_layout().eq(before.task_layout()) {
            for task in &self.tasks {
                let before_task = before.tasks.iter().find(|t| t.id == task.id);
                if before_task != Some(task)
                    && let Some(bundle_task) = bundle.tasks.iter_mut().find(|t| t.id == task.id)
                {
                    *bundle_task = task.to_task(bundle_task.order_number);
                }
            }
        } else {
            self.rebuild_slides_and_tasks(bundle);
        }
        let exercise = &mut bundle.exercise;
        if self.name != before.name {
            exercise.name = self.name.clone();
        }
        if self.deadline != before.deadline {
            exercise.deadline = self.deadline;
        }
        match (&before.review_config, &self.review_config) {
            (before_config, after_config) if before_config == after_config => {}
            (
                ExerciseReviewConfig::Own { config_id, .. },
                ExerciseReviewConfig::Own {
                    config_id: after_id,
                    review_instructions,
                },
            ) if config_id == after_id => {
                if let Some(config) = exercise.peer_or_self_review_config.as_mut() {
                    config.review_instructions = review_instructions.as_deref().cloned();
                }
            }
            (
                ExerciseReviewConfig::CourseDefault,
                ExerciseReviewConfig::Own {
                    config_id,
                    review_instructions,
                },
            ) => {
                let course_default = course_default.ok_or(ExerciseEditError::NoCourseDefault)?;
                copy_course_default_review_config(
                    exercise,
                    course_default,
                    *config_id,
                    review_instructions.as_deref().cloned(),
                    new_id,
                );
            }
            (_, ExerciseReviewConfig::CourseDefault) => {
                exercise.peer_or_self_review_config = None;
                exercise.peer_or_self_review_questions = None;
                exercise.use_course_default_peer_or_self_review_config = true;
            }
            _ => return Err(ExerciseEditError::UnsupportedReviewConfigChange),
        }
        Ok(())
    }
}

/// Gives the exercise review settings of its own, copied from `course_default` with its
/// questions: config `config_id` with `review_instructions`, questions with ids from `new_id`.
pub(crate) fn copy_course_default_review_config(
    exercise: &mut CmsPageExercise,
    course_default: &CmsPeerOrSelfReviewConfiguration,
    config_id: Uuid,
    review_instructions: Option<serde_json::Value>,
    mut new_id: impl FnMut() -> Uuid,
) {
    let mut config = course_default.peer_or_self_review_config.clone();
    config.id = config_id;
    config.exercise_id = Some(exercise.id);
    config.review_instructions = review_instructions;
    let mut questions = course_default.peer_or_self_review_questions.clone();
    for question in questions.iter_mut() {
        question.id = new_id();
        question.peer_or_self_review_config_id = config_id;
    }
    normalize_cms_peer_or_self_review_questions(&mut questions);
    exercise.peer_or_self_review_config = Some(config);
    exercise.peer_or_self_review_questions = Some(questions);
    exercise.use_course_default_peer_or_self_review_config = false;
}

/// Why an [`ExerciseRecord`] couldn't be applied.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExerciseEditError {
    /// The exercise changed after the record's base was read.
    ChangedSinceRead,
    /// Own review settings are copied from a course default the course doesn't have.
    NoCourseDefault,
    /// Review settings change only by copying the course default or by switching back to it.
    UnsupportedReviewConfigChange,
}

/// Review instructions as the CMS stores them: `None` for no blocks or only empty paragraphs.
pub fn review_instructions_for_storage(blocks: serde_json::Value) -> Option<serde_json::Value> {
    let is_empty = match &blocks {
        serde_json::Value::Null => true,
        serde_json::Value::Array(items) => items.iter().all(|block| {
            block["name"] == "core/paragraph"
                && block["attributes"]["content"]
                    .as_str()
                    .is_none_or(|content| content.trim().is_empty())
        }),
        _ => false,
    };
    (!is_empty).then_some(blocks)
}

/// One task as risk compares it, held in slide and task order for every exercise of a course's
/// pages so that risk sees task changes without the [`ExerciseRecord`]s loaded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskLayout {
    pub id: Uuid,
    pub slide_id: Uuid,
    pub exercise_type: String,
    pub private_spec: Option<Arc<serde_json::Value>>,
    pub repository_exercise_id: Option<Uuid>,
}

impl From<ExerciseTaskLayoutRow> for TaskLayout {
    fn from(task: ExerciseTaskLayoutRow) -> Self {
        Self {
            id: task.id,
            slide_id: task.exercise_slide_id,
            exercise_type: task.exercise_type,
            private_spec: task.private_spec.map(Arc::new),
            repository_exercise_id: task.repository_exercise_id,
        }
    }
}

impl From<&CmsPageExerciseTask> for TaskLayout {
    fn from(task: &CmsPageExerciseTask) -> Self {
        Self {
            id: task.id,
            slide_id: task.exercise_slide_id,
            exercise_type: task.exercise_type.clone(),
            private_spec: task.private_spec.clone().map(Arc::new),
            repository_exercise_id: task.repository_exercise_id,
        }
    }
}

/// What decides an exercise's deadline, held for every exercise of a course's pages so that risk
/// sees deadlines without the [`ExerciseRecord`]s loaded.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExerciseDeadline {
    /// The exercise's own deadline, which overrides its chapter's.
    pub own: Option<DateTime<Utc>>,
    /// The chapter whose deadline applies without an own one: `exercises.chapter_id` live, which
    /// can differ from its page's chapter; in a staged page, that page's chapter, as publishing
    /// sets it.
    pub chapter_id: Option<Uuid>,
}
