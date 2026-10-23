//! A course's editable content held in memory: as published, or as the user sees it with their
//! open changeset laid over it.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Arc;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use sqlx::types::Json;
use utoipa::ToSchema;

use crate::{
    agent_changeset_entities::{self, AgentChangesetEntity},
    agent_changesets::{self, AgentChangeset},
    chapters, course_module_completions, course_modules,
    courses::Course,
    exercise_slide_submissions, glossary,
    library::{
        agent_changesets::{field_changes::ReviewConfigKind, staging::StagedEntity},
        entity_snapshots::{
            self, ChapterSnapshot, ContentEntity, ContentEntityType,
            CourseDefaultReviewConfigSnapshot, CourseSettingsSnapshot, EntityKey, EntityRef,
            EntitySnapshot, ExerciseBundle, GlossaryTermSnapshot, ModuleSnapshot, PageSnapshot,
            ReferenceSnapshot, exercise_bundles, match_snapshot, put_by_id, with_snapshot_type,
        },
    },
    material_references,
    pages::CmsPageExercise,
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
    /// leaves it as it was; [`CourseState::exercise_page_id`] has the page that holds the block.
    pub page_id: Uuid,
    pub name: String,
    /// The exercise's own deadline; `None` lets its chapter's apply.
    pub deadline: Option<DateTime<Utc>>,
    pub needs_peer_review: bool,
    pub needs_self_review: bool,
    /// In slide order, then task order.
    pub tasks: Vec<ExerciseTaskRecord>,
    pub review_config: ExerciseReviewConfig,
}

/// One task of an [`ExerciseRecord`].
#[derive(Debug, Clone, PartialEq)]
pub struct ExerciseTaskRecord {
    pub id: Uuid,
    pub exercise_type: String,
    /// The task's instructions: blocks, as the CMS stores them.
    pub assignment: Arc<serde_json::Value>,
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
            tasks: bundle
                .tasks
                .iter()
                .map(|task| ExerciseTaskRecord {
                    id: task.id,
                    exercise_type: task.exercise_type.clone(),
                    assignment: Arc::new(task.assignment.clone()),
                })
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
            tasks,
            review_config,
        } = self;
        *id == other.id
            && *name == other.name
            && *deadline == other.deadline
            && *needs_peer_review == other.needs_peer_review
            && *needs_self_review == other.needs_self_review
            && *tasks == other.tasks
            && *review_config == other.review_config
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
        let exercise = &mut bundle.exercise;
        if self.name != before.name {
            exercise.name = self.name.clone();
        }
        if self.deadline != before.deadline {
            exercise.deadline = self.deadline;
        }
        for task in &self.tasks {
            let before_task = before.tasks.iter().find(|t| t.id == task.id);
            if before_task.is_some_and(|before_task| before_task.assignment != task.assignment)
                && let Some(bundle_task) = bundle.tasks.iter_mut().find(|t| t.id == task.id)
            {
                bundle_task.assignment = (*task.assignment).clone();
            }
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

/// Every editable entity of one course.
#[derive(Debug, Clone, PartialEq)]
pub struct CourseState {
    pub settings: CourseSettingsSnapshot,
    pub modules: Vec<ModuleSnapshot>,
    pub chapters: Vec<ChapterSnapshot>,
    pub pages: Vec<PageRecord>,
    pub glossary: Vec<GlossaryTermSnapshot>,
    pub references: Vec<ReferenceSnapshot>,
    /// `None` when the course has none, or when the state was loaded without it.
    pub course_default_review_config: Option<CourseDefaultReviewConfigSnapshot>,
    /// By exercise id; `None` until [`CourseView::load_exercises`] or
    /// [`CourseView::load_exercises_on_pages`] loads them, the latter only some.
    pub exercises: Option<BTreeMap<Uuid, ExerciseRecord>>,
    /// By exercise id; loaded with the pages. Entries of exercises no page holds any more stay.
    pub exercise_deadlines: BTreeMap<Uuid, ExerciseDeadline>,
}

/// What changed between two course states. Pages are listed by id: their full snapshots hold
/// exercises, which only the database has.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StateChanges {
    pub entities: Vec<StagedEntity>,
    pub pages: Vec<Uuid>,
}

fn changed_by_id<T: ContentEntity>(before: &[T], after: &[T], changes: &mut Vec<StagedEntity>) {
    let before_by_id: HashMap<Uuid, &T> = before.iter().map(|b| (b.id(), b)).collect();
    let after_ids: HashSet<Uuid> = after.iter().map(T::id).collect();
    for item in after {
        if before_by_id.get(&item.id()) != Some(&item) {
            changes.push(StagedEntity::Write(item.clone().into()));
        }
    }
    for item in before {
        if !after_ids.contains(&item.id()) {
            changes.push(StagedEntity::Delete((T::ENTITY_TYPE, item.id())));
        }
    }
}

/// A rule publishing relies on that a course state breaks. Pages, chapters and modules are named
/// as the state has them.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PublishBlocker {
    /// The page is in a chapter the course doesn't have.
    PageInMissingChapter { page: EntityRef, chapter_id: Uuid },
    /// The pages share a path, which must be unique in the course.
    DuplicatePath {
        url_path: String,
        pages: Vec<EntityRef>,
    },
    /// The pages share a position in their chapter, or among the top-level pages with no
    /// `chapter`.
    DuplicatePageOrderNumber {
        chapter: Option<EntityRef>,
        order_number: i32,
        pages: Vec<EntityRef>,
    },
    /// The chapter is in a module the course doesn't have.
    ChapterInMissingModule { chapter: EntityRef, module_id: Uuid },
    /// The chapter's front page is a page the course doesn't have.
    MissingFrontPage {
        chapter: EntityRef,
        front_page_id: Uuid,
    },
    /// The chapter's front page is in another chapter.
    FrontPageInOtherChapter {
        chapter: EntityRef,
        front_page: EntityRef,
    },
    /// The chapter's front page isn't at the path its chapter number gives it.
    FrontPageOffPath {
        chapter: EntityRef,
        front_page: EntityRef,
        url_path: String,
        expected_url_path: String,
    },
    /// The chapters share a number, which must be unique in the course.
    DuplicateChapterNumber {
        chapter_number: i32,
        chapters: Vec<EntityRef>,
    },
    /// The modules share an order number, which must be unique in the course.
    DuplicateModuleOrderNumber {
        order_number: i32,
        modules: Vec<EntityRef>,
    },
}

impl PublishBlocker {
    /// The blocker with every label left empty.
    fn unlabelled(mut self) -> Self {
        let clear = |entity: &mut EntityRef| entity.label.clear();
        match &mut self {
            Self::PageInMissingChapter { page, .. } => clear(page),
            Self::DuplicatePath { pages, .. } => pages.iter_mut().for_each(clear),
            Self::DuplicatePageOrderNumber { chapter, pages, .. } => {
                chapter.iter_mut().chain(pages.iter_mut()).for_each(clear)
            }
            Self::ChapterInMissingModule { chapter, .. }
            | Self::MissingFrontPage { chapter, .. } => clear(chapter),
            Self::FrontPageInOtherChapter {
                chapter,
                front_page,
            }
            | Self::FrontPageOffPath {
                chapter,
                front_page,
                ..
            } => {
                clear(chapter);
                clear(front_page);
            }
            Self::DuplicateChapterNumber { chapters, .. } => chapters.iter_mut().for_each(clear),
            Self::DuplicateModuleOrderNumber { modules, .. } => modules.iter_mut().for_each(clear),
        }
        self
    }
}

fn sorted(mut entities: Vec<EntityRef>) -> Vec<EntityRef> {
    entities.sort_by_key(|entity| entity.entity_id);
    entities
}

impl CourseState {
    pub fn course_id(&self) -> Uuid {
        self.settings.course_id
    }

    pub fn page(&self, page_id: Uuid) -> Option<&PageRecord> {
        self.pages.iter().find(|p| p.id == page_id)
    }

    pub fn page_mut(&mut self, page_id: Uuid) -> Option<&mut PageRecord> {
        self.pages.iter_mut().find(|p| p.id == page_id)
    }

    /// The pages of a chapter, or the top-level pages with `None`, in the order the course
    /// structure shows them: the chapter's front page (the course front page `/`) first, then by
    /// order number and path.
    pub fn pages_in_order(&self, chapter_id: Option<Uuid>) -> Vec<&PageRecord> {
        let first = match chapter_id {
            Some(chapter_id) => self
                .chapters
                .iter()
                .find(|c| c.id == chapter_id)
                .and_then(|c| c.front_page_id),
            None => self
                .pages
                .iter()
                .find(|p| p.chapter_id.is_none() && p.url_path == "/")
                .map(|p| p.id),
        };
        let mut pages: Vec<&PageRecord> = self
            .pages
            .iter()
            .filter(|p| p.chapter_id == chapter_id)
            .collect();
        pages.sort_by(|a, b| {
            (Some(a.id) != first, a.order_number, &a.url_path).cmp(&(
                Some(b.id) != first,
                b.order_number,
                &b.url_path,
            ))
        });
        pages
    }

    /// The chapters of a module in the order the course structure shows them.
    pub fn chapters_in_order(&self, module_id: Uuid) -> Vec<&ChapterSnapshot> {
        let mut chapters: Vec<&ChapterSnapshot> = self
            .chapters
            .iter()
            .filter(|c| c.course_module_id == module_id)
            .collect();
        chapters.sort_by_key(|c| (c.chapter_number, c.id));
        chapters
    }

    /// The modules in the order the course structure shows them: the default module first.
    pub fn modules_in_order(&self) -> Vec<&ModuleSnapshot> {
        let mut modules: Vec<&ModuleSnapshot> = self.modules.iter().collect();
        modules.sort_by_key(|m| (m.name.is_some(), m.order_number, m.id));
        modules
    }

    /// Whether the state has the entity.
    pub fn has_entity(&self, (entity_type, entity_id): EntityKey) -> bool {
        with_snapshot_type!(entity_type, T => T::is_in(self, entity_id))
    }

    /// The full snapshot of an entity, which a state holds of every entity type but pages.
    pub fn entity_snapshot(&self, (entity_type, entity_id): EntityKey) -> Option<EntitySnapshot> {
        with_snapshot_type!(entity_type, T => {
            T::find_in(self, entity_id).cloned().map(EntitySnapshot::from)
        })
    }

    /// What people call the entity; see [`entity_snapshots::EntityRef::label`].
    pub fn entity_label(&self, key: EntityKey) -> Option<String> {
        match key.0 {
            ContentEntityType::Page => self.page(key.1).map(|page| page.title.clone()),
            _ => self
                .entity_snapshot(key)
                .map(|snapshot| snapshot.label().to_string()),
        }
    }

    /// Replaces, adds or (with `None`) removes one entity. Course settings can't be removed.
    pub fn set_entity(
        &mut self,
        (entity_type, entity_id): EntityKey,
        snapshot: Option<&EntitySnapshot>,
    ) {
        match snapshot {
            Some(snapshot) => match_snapshot!(snapshot, snapshot => snapshot.put_in(self)),
            None => with_snapshot_type!(entity_type, T => T::remove_from(self, entity_id)),
        }
    }

    /// Sets one entity to its state in `source`, removing it if `source` doesn't have it.
    pub fn copy_entity_from(&mut self, source: &CourseState, key: EntityKey) {
        let (entity_type, entity_id) = key;
        if entity_type != ContentEntityType::Page {
            self.set_entity(key, source.entity_snapshot(key).as_ref());
            return;
        }
        match source.page(entity_id) {
            Some(page) => {
                for exercise_id in page.content.iter().filter_map(|b| b.exercise_id()) {
                    if let Some(deadline) = source.exercise_deadlines.get(&exercise_id) {
                        self.exercise_deadlines.insert(exercise_id, *deadline);
                    }
                }
                put_by_id(&mut self.pages, page.clone(), |p| p.id)
            }
            None => self.pages.retain(|p| p.id != entity_id),
        }
        if let (Some(exercises), Some(source_exercises)) =
            (self.exercises.as_mut(), source.exercises.as_ref())
        {
            exercises.retain(|_, exercise| exercise.page_id != entity_id);
            exercises.extend(
                source_exercises
                    .iter()
                    .filter(|(_, exercise)| exercise.page_id == entity_id)
                    .map(|(id, exercise)| (*id, exercise.clone())),
            );
        }
    }

    /// Replaces the exercise records made from the page's snapshot with those of `page`, or
    /// removes them with `None`. Does nothing to a state without exercise records.
    pub fn set_page_exercises(&mut self, page_id: Uuid, page: Option<&PageSnapshot>) {
        let Some(exercises) = self.exercises.as_mut() else {
            return;
        };
        exercises.retain(|_, exercise| exercise.page_id != page_id);
        for exercise in page.map(ExerciseRecord::of_page).unwrap_or_default() {
            exercises.insert(exercise.id, exercise);
        }
    }

    /// Sets the deadlines of the page's exercises from its snapshot.
    pub fn set_page_exercise_deadlines(&mut self, page: &PageSnapshot) {
        for exercise in &page.exercises {
            self.exercise_deadlines.insert(
                exercise.id,
                ExerciseDeadline {
                    own: exercise.deadline,
                    chapter_id: page.chapter_id,
                },
            );
        }
    }

    /// Sets the exercise's own deadline in its record, if loaded, and in its deadline entry.
    pub fn set_exercise_deadline(&mut self, exercise_id: Uuid, deadline: Option<DateTime<Utc>>) {
        if let Some(record) = self
            .exercises
            .as_mut()
            .and_then(|exercises| exercises.get_mut(&exercise_id))
        {
            record.deadline = deadline;
        }
        if let Some(entry) = self.exercise_deadlines.get_mut(&exercise_id) {
            entry.own = deadline;
        }
    }

    /// The deadline that applies to the exercise: its own, else its chapter's. `None` also when
    /// the state doesn't know the exercise.
    pub fn effective_exercise_deadline(&self, exercise_id: Uuid) -> Option<DateTime<Utc>> {
        let entry = self.exercise_deadlines.get(&exercise_id)?;
        entry.own.or_else(|| {
            let chapter_id = entry.chapter_id?;
            self.chapters.iter().find(|c| c.id == chapter_id)?.deadline
        })
    }

    /// The exercise's record; `None` also when the state has no exercise records.
    pub fn exercise(&self, exercise_id: Uuid) -> Option<&ExerciseRecord> {
        self.exercises.as_ref()?.get(&exercise_id)
    }

    /// The page holding the exercise: the one whose blocks hold it, else the one its record was
    /// made from.
    pub fn exercise_page_id(&self, exercise_id: Uuid) -> Option<Uuid> {
        self.pages
            .iter()
            .find(|page| {
                page.content
                    .iter()
                    .any(|block| block.exercise_id() == Some(exercise_id))
            })
            .map(|page| page.id)
            .or_else(|| self.exercise(exercise_id).map(|exercise| exercise.page_id))
    }

    /// The page whose blocks hold each exercise, by exercise id.
    pub fn exercise_page_ids(&self) -> HashMap<Uuid, Uuid> {
        self.pages
            .iter()
            .flat_map(|page| {
                page.content
                    .iter()
                    .filter_map(|block| block.exercise_id())
                    .map(|exercise_id| (exercise_id, page.id))
            })
            .collect()
    }

    /// The state with the staged entities of a changeset laid over it. Rows of entity types left
    /// out of `parts` are skipped.
    pub fn overlay<'a>(
        &self,
        rows: impl IntoIterator<Item = &'a AgentChangesetEntity>,
        parts: CourseParts,
    ) -> CourseState {
        let mut staged = self.clone();
        for row in rows {
            if parts.includes(row.entity_type) {
                staged.set_entity(row.key(), row.after_snapshot.as_ref());
            }
        }
        staged
    }

    /// The entities that differ between `before` and this state; the inverse of
    /// [`CourseState::overlay`].
    pub fn changes_since(&self, before: &CourseState) -> StateChanges {
        let mut entities = Vec::new();
        if before.settings != self.settings {
            entities.push(StagedEntity::Write(self.settings.clone().into()));
        }
        changed_by_id(&before.modules, &self.modules, &mut entities);
        changed_by_id(&before.chapters, &self.chapters, &mut entities);
        changed_by_id(&before.glossary, &self.glossary, &mut entities);
        changed_by_id(&before.references, &self.references, &mut entities);
        changed_by_id(
            before.course_default_review_config.as_slice(),
            self.course_default_review_config.as_slice(),
            &mut entities,
        );
        let page_ids: HashSet<Uuid> = self.pages.iter().map(|p| p.id).collect();
        let mut pages: Vec<Uuid> = self
            .pages_changed_since(before)
            .map(|p| p.id)
            .chain(
                before
                    .pages
                    .iter()
                    .filter(|p| !page_ids.contains(&p.id))
                    .map(|p| p.id),
            )
            .collect();
        let exercise_pages = self.exercise_page_ids();
        for exercise_id in self.exercises_changed_since(before) {
            let owner = exercise_pages
                .get(&exercise_id)
                .copied()
                .or_else(|| self.exercise(exercise_id).map(|e| e.page_id));
            if let Some(owner) = owner
                && !pages.contains(&owner)
            {
                pages.push(owner);
            }
        }
        StateChanges { entities, pages }
    }

    /// The exercises whose records differ from those of `before`, when both have records.
    /// Exercises only one of the states has are left out: their pages' blocks differ.
    pub fn exercises_changed_since(&self, before: &CourseState) -> Vec<Uuid> {
        let (Some(after), Some(before)) = (&self.exercises, &before.exercises) else {
            return Vec::new();
        };
        after
            .iter()
            .filter(|(id, exercise)| {
                before
                    .get(id)
                    .is_some_and(|before| !exercise.has_same_content(before))
            })
            .map(|(id, _)| *id)
            .collect()
    }

    /// The pages of this state that differ from their state in `before`, new pages included.
    pub fn pages_changed_since<'a>(
        &'a self,
        before: &CourseState,
    ) -> impl Iterator<Item = &'a PageRecord> {
        let before_by_id: HashMap<Uuid, &PageRecord> =
            before.pages.iter().map(|p| (p.id, p)).collect();
        self.pages.iter().filter(move |page| {
            before_by_id
                .get(&page.id)
                .is_none_or(|before| before != page)
        })
    }

    /// What publishing this state would break, in a fixed order; empty if nothing.
    pub fn publish_blockers(&self) -> Vec<PublishBlocker> {
        let mut blockers = Vec::new();
        let chapter_ids: HashSet<Uuid> = self.chapters.iter().map(|c| c.id).collect();
        let module_ids: HashSet<Uuid> = self.modules.iter().map(|m| m.id).collect();
        let mut pages_by_path: BTreeMap<&str, Vec<EntityRef>> = BTreeMap::new();
        let mut pages_by_position: BTreeMap<(Option<Uuid>, i32), Vec<EntityRef>> = BTreeMap::new();
        for page in &self.pages {
            let page_ref = page.entity_ref();
            if let Some(chapter_id) = page.chapter_id
                && !chapter_ids.contains(&chapter_id)
            {
                blockers.push(PublishBlocker::PageInMissingChapter {
                    page: page_ref.clone(),
                    chapter_id,
                });
            }
            pages_by_path
                .entry(&page.url_path)
                .or_default()
                .push(page_ref.clone());
            pages_by_position
                .entry((page.chapter_id, page.order_number))
                .or_default()
                .push(page_ref);
        }
        for (url_path, pages) in pages_by_path {
            if pages.len() > 1 {
                blockers.push(PublishBlocker::DuplicatePath {
                    url_path: url_path.to_string(),
                    pages: sorted(pages),
                });
            }
        }
        for ((chapter_id, order_number), pages) in pages_by_position {
            if pages.len() > 1 {
                blockers.push(PublishBlocker::DuplicatePageOrderNumber {
                    chapter: chapter_id.map(|id| self.entity_ref((ContentEntityType::Chapter, id))),
                    order_number,
                    pages: sorted(pages),
                });
            }
        }
        let mut chapters_by_number: BTreeMap<i32, Vec<EntityRef>> = BTreeMap::new();
        for chapter in &self.chapters {
            let chapter_ref = self.entity_ref((ContentEntityType::Chapter, chapter.id));
            if !module_ids.contains(&chapter.course_module_id) {
                blockers.push(PublishBlocker::ChapterInMissingModule {
                    chapter: chapter_ref.clone(),
                    module_id: chapter.course_module_id,
                });
            }
            if let Some(front_page_id) = chapter.front_page_id {
                let expected_url_path = chapters::front_page_path(chapter.chapter_number);
                match self.page(front_page_id) {
                    None => blockers.push(PublishBlocker::MissingFrontPage {
                        chapter: chapter_ref.clone(),
                        front_page_id,
                    }),
                    Some(page) if page.chapter_id != Some(chapter.id) => {
                        blockers.push(PublishBlocker::FrontPageInOtherChapter {
                            chapter: chapter_ref.clone(),
                            front_page: page.entity_ref(),
                        })
                    }
                    Some(page) if page.url_path != expected_url_path => {
                        blockers.push(PublishBlocker::FrontPageOffPath {
                            chapter: chapter_ref.clone(),
                            front_page: page.entity_ref(),
                            url_path: page.url_path.clone(),
                            expected_url_path,
                        })
                    }
                    Some(_) => {}
                }
            }
            chapters_by_number
                .entry(chapter.chapter_number)
                .or_default()
                .push(chapter_ref);
        }
        for (chapter_number, chapters) in chapters_by_number {
            if chapters.len() > 1 {
                blockers.push(PublishBlocker::DuplicateChapterNumber {
                    chapter_number,
                    chapters: sorted(chapters),
                });
            }
        }
        let mut modules_by_order_number: BTreeMap<i32, Vec<EntityRef>> = BTreeMap::new();
        for module in &self.modules {
            modules_by_order_number
                .entry(module.order_number)
                .or_default()
                .push(self.entity_ref((ContentEntityType::Module, module.id)));
        }
        for (order_number, modules) in modules_by_order_number {
            if modules.len() > 1 {
                blockers.push(PublishBlocker::DuplicateModuleOrderNumber {
                    order_number,
                    modules: sorted(modules),
                });
            }
        }
        blockers
    }

    /// The publish blockers of this state that `before` doesn't have. The entities' labels don't
    /// count, so a blocker that only renames them isn't new.
    pub fn blockers_added_since(&self, before: &CourseState) -> Vec<PublishBlocker> {
        let existing: Vec<PublishBlocker> = before
            .publish_blockers()
            .into_iter()
            .map(PublishBlocker::unlabelled)
            .collect();
        self.publish_blockers()
            .into_iter()
            .filter(|blocker| !existing.contains(&blocker.clone().unlabelled()))
            .collect()
    }

    /// The entity, labelled as this state has it; with an empty label if the state lacks it.
    pub fn entity_ref(&self, key: EntityKey) -> EntityRef {
        EntityRef {
            entity_type: key.0,
            entity_id: key.1,
            label: self.entity_label(key).unwrap_or_default(),
        }
    }

    /// Students see this course: it is neither a draft nor in test mode.
    pub fn is_live(&self) -> bool {
        !self.settings.is_draft && !self.settings.is_test_mode
    }
}

/// The published course and the user's staged view of it.
#[derive(Debug, Clone)]
pub struct CourseView {
    pub course: Course,
    pub live: CourseState,
    pub staged: CourseState,
    pub changeset: Option<AgentChangeset>,
    pub staged_entities: BTreeMap<EntityKey, AgentChangesetEntity>,
}

impl CourseView {
    pub fn staged_row(&self, key: EntityKey) -> Option<&AgentChangesetEntity> {
        self.staged_entities.get(&key)
    }

    /// The page's full staged snapshot: `Some(None)` when the changeset deletes it, `None` when
    /// the changeset doesn't have it.
    pub fn staged_page_snapshot(&self, page_id: Uuid) -> Option<Option<&PageSnapshot>> {
        let row = self.staged_row((ContentEntityType::Page, page_id))?;
        Some(row.after_snapshot.as_ref().and_then(PageSnapshot::narrow))
    }

    /// The pages' full snapshots as the user sees them, exercises included, by id; the pages
    /// that don't exist for the user are left out.
    pub async fn current_page_snapshots(
        &self,
        conn: &mut PgConnection,
        page_ids: &[Uuid],
    ) -> ModelResult<HashMap<Uuid, PageSnapshot>> {
        let mut snapshots = HashMap::new();
        let mut unstaged = Vec::new();
        for page_id in page_ids {
            match self.staged_page_snapshot(*page_id) {
                Some(staged) => {
                    if let Some(page) = staged {
                        snapshots.insert(*page_id, page.clone());
                    }
                }
                None => unstaged.push(*page_id),
            }
        }
        snapshots.extend(entity_snapshots::load_pages(conn, &unstaged).await?);
        Ok(snapshots)
    }

    /// Loads the exercise records of both states, unless they are loaded already. The view must
    /// hold every part of the course.
    pub async fn load_exercises(&mut self, conn: &mut PgConnection) -> ModelResult<()> {
        let page_ids: Vec<Uuid> = self.live.pages.iter().map(|page| page.id).collect();
        self.load_exercise_records(conn, &page_ids).await
    }

    /// Loads into both states the records of the exercises on `page_ids`, staged or published,
    /// and maybe others; does nothing if records are already loaded. The view must hold every
    /// part of the course.
    pub async fn load_exercises_on_pages(
        &mut self,
        conn: &mut PgConnection,
        page_ids: &[Uuid],
    ) -> ModelResult<()> {
        let live_pages = self.live.exercise_page_ids();
        let mut pages: HashSet<Uuid> = page_ids.iter().copied().collect();
        let staged_exercises = page_ids
            .iter()
            .filter_map(|page_id| self.staged.page(*page_id))
            .flat_map(|page| page.content.iter().filter_map(|block| block.exercise_id()));
        pages.extend(staged_exercises.filter_map(|exercise_id| live_pages.get(&exercise_id)));
        let pages: Vec<Uuid> = pages.into_iter().collect();
        self.load_exercise_records(conn, &pages).await
    }

    /// Loads the records of the live pages `page_ids` into both states, then lays the staged
    /// pages' over the staged state.
    async fn load_exercise_records(
        &mut self,
        conn: &mut PgConnection,
        page_ids: &[Uuid],
    ) -> ModelResult<()> {
        if self.live.exercises.is_some() {
            return Ok(());
        }
        let records = load_exercise_records(conn, page_ids).await?;
        let staged_pages: HashMap<Uuid, Option<&PageSnapshot>> = self
            .staged_entities
            .values()
            .filter(|row| row.entity_type == ContentEntityType::Page)
            .map(|row| {
                let page = row.after_snapshot.as_ref().and_then(PageSnapshot::narrow);
                (row.entity_id, page)
            })
            .collect();
        let mut staged = records.clone();
        staged.retain(|_, exercise| !staged_pages.contains_key(&exercise.page_id));
        for exercise in staged_pages
            .values()
            .flatten()
            .flat_map(|page| ExerciseRecord::of_page(page))
        {
            staged.insert(exercise.id, exercise);
        }
        self.live.exercises = Some(records);
        self.staged.exercises = Some(staged);
        Ok(())
    }
}

/// The records of the live pages' exercises, by exercise id.
async fn load_exercise_records(
    conn: &mut PgConnection,
    page_ids: &[Uuid],
) -> ModelResult<BTreeMap<Uuid, ExerciseRecord>> {
    let mut records = BTreeMap::new();
    for (page_id, exercises) in crate::pages::exercises_of_pages(conn, page_ids).await? {
        for bundle in exercise_bundles(
            &exercises.exercises,
            &exercises.exercise_slides,
            &exercises.exercise_tasks,
        ) {
            records.insert(
                bundle.exercise.id,
                ExerciseRecord::of_bundle(page_id, &bundle),
            );
        }
    }
    Ok(records)
}

/// Which parts of a course a tool reads; the course settings are always there, the other parts
/// left out stay empty.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CourseParts {
    All,
    /// The modules, whose settings the settings tools read too.
    Settings,
    Glossary,
}

impl CourseParts {
    fn includes(self, entity_type: ContentEntityType) -> bool {
        match self {
            CourseParts::All => true,
            CourseParts::Settings => matches!(
                entity_type,
                ContentEntityType::CourseSettings | ContentEntityType::Module
            ),
            CourseParts::Glossary => matches!(
                entity_type,
                ContentEntityType::CourseSettings
                    | ContentEntityType::GlossaryTerm
                    | ContentEntityType::Reference
            ),
        }
    }
}

/// Loads the parts of the course as published.
pub async fn load_live_course(
    conn: &mut PgConnection,
    course: &Course,
    parts: CourseParts,
) -> ModelResult<CourseState> {
    let mut state = CourseState {
        settings: entity_snapshots::course_settings_of(conn, course).await?,
        modules: Vec::new(),
        chapters: Vec::new(),
        pages: Vec::new(),
        glossary: Vec::new(),
        references: Vec::new(),
        course_default_review_config: None,
        exercises: None,
        exercise_deadlines: BTreeMap::new(),
    };
    if parts.includes(ContentEntityType::CourseDefaultReviewConfig) {
        state.course_default_review_config =
            entity_snapshots::load_course_default_review_config(conn, course.id).await?;
    }
    if parts.includes(ContentEntityType::Module) {
        state.modules = course_modules::get_by_course_id(conn, course.id)
            .await?
            .into_iter()
            .map(ModuleSnapshot::from)
            .collect();
    }
    if parts.includes(ContentEntityType::Chapter) {
        state.chapters = chapters::get_course_chapters(conn, course.id)
            .await?
            .into_iter()
            .map(ChapterSnapshot::from)
            .collect();
    }
    if parts.includes(ContentEntityType::Page) {
        state.pages = sqlx::query!(
            r#"
SELECT id,
  chapter_id,
  url_path,
  title,
  hidden,
  order_number,
  content AS "content: Json<Vec<GutenbergBlock>>"
FROM pages
WHERE course_id = $1
  AND exam_id IS NULL
  AND deleted_at IS NULL
            "#,
            course.id
        )
        .fetch_all(&mut *conn)
        .await?
        .into_iter()
        .map(|page| PageRecord {
            id: page.id,
            chapter_id: page.chapter_id,
            url_path: page.url_path,
            title: page.title,
            hidden: page.hidden,
            order_number: page.order_number,
            content: Arc::new(page.content.0),
            joins_page_language_group_id: None,
        })
        .collect();
        state.exercise_deadlines = crate::exercises::get_exercises_by_course_id(conn, course.id)
            .await?
            .into_iter()
            .map(|exercise| {
                let deadline = ExerciseDeadline {
                    own: exercise.deadline,
                    chapter_id: exercise.chapter_id,
                };
                (exercise.id, deadline)
            })
            .collect();
    }
    if parts.includes(ContentEntityType::GlossaryTerm) {
        state.glossary = glossary::fetch_for_course(conn, course.id)
            .await?
            .into_iter()
            .map(GlossaryTermSnapshot::from)
            .collect();
        state.references = material_references::get_references_by_course_id(conn, course.id)
            .await?
            .into_iter()
            .map(ReferenceSnapshot::from)
            .collect();
    }
    Ok(state)
}

/// Loads the parts of the published course and the user's open changeset for it.
pub async fn load_view(
    conn: &mut PgConnection,
    user_id: Uuid,
    course: Course,
    parts: CourseParts,
) -> ModelResult<CourseView> {
    let live = load_live_course(conn, &course, parts).await?;
    let changeset = agent_changesets::get_open(conn, user_id, course.id).await?;
    let staged_entities: BTreeMap<EntityKey, AgentChangesetEntity> = match &changeset {
        Some(changeset) => agent_changeset_entities::get_by_changeset_id(conn, changeset.id)
            .await?
            .into_iter()
            .map(|row| (row.key(), row))
            .collect(),
        None => BTreeMap::new(),
    };
    let staged = live.overlay(staged_entities.values(), parts);
    Ok(CourseView {
        course,
        live,
        staged,
        changeset,
        staged_entities,
    })
}

/// Published facts about student activity that make a change risky.
#[derive(Debug, Clone, Default)]
pub struct StudentActivity {
    pub exercises_with_submissions: HashSet<Uuid>,
    pub pages_with_submissions: HashSet<Uuid>,
    pub modules_with_completions: HashSet<Uuid>,
}

/// Which exercises have submissions and which modules have completions.
pub async fn load_student_activity(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<StudentActivity> {
    let exercises =
        exercise_slide_submissions::get_exercises_with_submissions_by_course_id(conn, course_id)
            .await?;
    let modules =
        course_module_completions::get_completed_module_ids_by_course_id(conn, course_id).await?;
    Ok(StudentActivity {
        exercises_with_submissions: exercises.iter().map(|e| e.exercise_id).collect(),
        pages_with_submissions: exercises.iter().map(|e| e.page_id).collect(),
        modules_with_completions: modules.into_iter().collect(),
    })
}
