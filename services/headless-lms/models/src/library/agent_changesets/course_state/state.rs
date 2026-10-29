use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Arc;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use sqlx::types::Json;

use super::{ExerciseDeadline, ExerciseRecord, ExerciseReviewConfig, PageRecord};
use crate::{
    agent_changeset_entities::AgentChangesetEntity,
    chapters, course_modules,
    courses::Course,
    glossary,
    library::entity_snapshots::{
        self, ChapterSnapshot, ContentEntity, ContentEntityType, CourseDefaultReviewConfigSnapshot,
        CourseSettingsSnapshot, EntityKey, EntityRef, EntitySnapshot, GlossaryTermSnapshot,
        ModuleSnapshot, PageSnapshot, ReferenceSnapshot, match_snapshot, with_snapshot_type,
    },
    material_references,
    prelude::*,
};

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
    /// By exercise id; `None` until
    /// [`CourseView::load_exercises`](super::CourseView::load_exercises) or
    /// [`CourseView::load_exercises_on_pages`](super::CourseView::load_exercises_on_pages) loads
    /// them, the latter only some.
    pub exercises: Option<BTreeMap<Uuid, ExerciseRecord>>,
    /// By exercise id; loaded with the pages. Entries of exercises no page holds any more stay.
    pub exercise_deadlines: BTreeMap<Uuid, ExerciseDeadline>,
}

/// The state one entity has after an agent write call.
#[derive(Debug, Clone, PartialEq)]
pub enum StagedEntity {
    /// The entity's full snapshot after the call. Ids of new entities are assigned by the caller.
    Write(EntitySnapshot),
    Delete(EntityKey),
}

impl StagedEntity {
    /// The entity written or deleted.
    pub fn key(&self) -> EntityKey {
        match self {
            Self::Write(snapshot) => snapshot.key(),
            Self::Delete(key) => *key,
        }
    }

    /// The snapshot after the call; `None` for a delete.
    pub fn after(&self) -> Option<&EntitySnapshot> {
        match self {
            Self::Write(snapshot) => Some(snapshot),
            Self::Delete(_) => None,
        }
    }

    /// The snapshot after the call; `None` for a delete. See [`Self::after`].
    pub fn into_after(self) -> Option<EntitySnapshot> {
        match self {
            Self::Write(snapshot) => Some(snapshot),
            Self::Delete(_) => None,
        }
    }

    /// Writes `after`, or deletes the entity when it is `None`.
    pub fn new(key: EntityKey, after: Option<EntitySnapshot>) -> Self {
        match after {
            Some(snapshot) => Self::Write(snapshot),
            None => Self::Delete(key),
        }
    }
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
            changes.push(StagedEntity::Delete(EntityKey::new(
                T::ENTITY_TYPE,
                item.id(),
            )));
        }
    }
}

impl CourseState {
    /// The course the state belongs to.
    pub fn course_id(&self) -> Uuid {
        self.settings.course_id
    }

    /// The page `page_id`.
    pub fn page(&self, page_id: Uuid) -> Option<&PageRecord> {
        self.pages.iter().find(|p| p.id == page_id)
    }

    /// [`Self::page`] for editing.
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
    pub fn has_entity(
        &self,
        EntityKey {
            entity_type,
            entity_id,
        }: EntityKey,
    ) -> bool {
        with_snapshot_type!(entity_type, T => T::is_in(self, entity_id))
    }

    /// The full snapshot of an entity, which a state holds of every entity type but pages.
    pub fn entity_snapshot(
        &self,
        EntityKey {
            entity_type,
            entity_id,
        }: EntityKey,
    ) -> Option<EntitySnapshot> {
        with_snapshot_type!(entity_type, T => {
            T::find_in(self, entity_id).cloned().map(EntitySnapshot::from)
        })
    }

    /// What people call the entity; see [`entity_snapshots::EntityRef::label`].
    pub fn entity_label(&self, key: EntityKey) -> Option<String> {
        match key.entity_type {
            ContentEntityType::Page => self.page(key.entity_id).map(|page| page.title.clone()),
            entity_type => with_snapshot_type!(entity_type, T => {
                T::find_in(self, key.entity_id).map(|entity| entity.label().to_string())
            }),
        }
    }

    /// Replaces, adds or (with `None`) removes one entity. Course settings can't be removed.
    pub fn set_entity(
        &mut self,
        EntityKey {
            entity_type,
            entity_id,
        }: EntityKey,
        snapshot: Option<&EntitySnapshot>,
    ) {
        match snapshot {
            Some(snapshot) => match_snapshot!(snapshot, snapshot => snapshot.put_in(self)),
            None => with_snapshot_type!(entity_type, T => T::remove_from(self, entity_id)),
        }
    }

    /// Sets one entity to its state in `source`, removing it if `source` doesn't have it.
    pub fn copy_entity_from(&mut self, source: &CourseState, key: EntityKey) {
        let EntityKey {
            entity_type,
            entity_id,
        } = key;
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

    /// Gives the exercise its own review config `config_id`, starting from a copy of the course
    /// default's review instructions. No-op when the exercise's record isn't loaded.
    pub fn fork_review_config(&mut self, exercise_id: Uuid, config_id: Uuid) {
        let review_instructions = self
            .course_default_review_config
            .as_ref()
            .and_then(|config| config.review_instructions.clone())
            .map(Arc::new);
        if let Some(record) = self.exercise_mut(exercise_id) {
            record.review_config = ExerciseReviewConfig::Own {
                config_id,
                review_instructions,
            };
        }
    }

    /// Switches the exercise to the course default review config, dropping its own. No-op when
    /// the exercise's record isn't loaded.
    pub fn use_course_default_review_config(&mut self, exercise_id: Uuid) {
        if let Some(record) = self.exercise_mut(exercise_id) {
            record.review_config = ExerciseReviewConfig::CourseDefault;
        }
    }

    /// The exercise's record, to change; `None` also when the state has no exercise records.
    pub fn exercise_mut(&mut self, exercise_id: Uuid) -> Option<&mut ExerciseRecord> {
        self.exercises.as_mut()?.get_mut(&exercise_id)
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

    /// The entity, labelled as this state has it; with an empty label if the state lacks it.
    pub fn entity_ref(&self, key: EntityKey) -> EntityRef {
        EntityRef {
            entity_type: key.entity_type,
            entity_id: key.entity_id,
            label: self.entity_label(key).unwrap_or_default(),
        }
    }

    /// Whether the page is its chapter's front page in this state.
    pub fn is_chapter_front_page(&self, page_id: Uuid) -> bool {
        self.chapters
            .iter()
            .any(|chapter| chapter.front_page_id == Some(page_id))
    }

    /// Students see this course: it is neither a draft nor in test mode.
    pub fn is_live(&self) -> bool {
        !self.settings.is_draft && !self.settings.is_test_mode
    }
}

/// How a [`CourseState`] holds one kind of content entity.
pub(crate) trait InCourseState: ContentEntity {
    /// The entity in `state`. Always `None` for pages, which states hold as [`PageRecord`]s.
    fn find_in(state: &CourseState, id: Uuid) -> Option<&Self>;

    fn is_in(state: &CourseState, id: Uuid) -> bool {
        Self::find_in(state, id).is_some()
    }

    /// Adds the entity to `state`, or replaces it there.
    fn put_in(&self, state: &mut CourseState);

    /// Removes the entity from `state`; course settings stay, since a course always has them.
    fn remove_from(state: &mut CourseState, id: Uuid);
}

/// Replaces the item with `item`'s id, or appends `item`.
fn put_by_id<T>(items: &mut Vec<T>, item: T, id_of: impl Fn(&T) -> Uuid) {
    match items
        .iter_mut()
        .find(|existing| id_of(existing) == id_of(&item))
    {
        Some(existing) => *existing = item,
        None => items.push(item),
    }
}

/// Implements [`InCourseState`] for a kind a [`CourseState`] holds a list of.
macro_rules! listed_in_state {
    ($snapshot:ty, $list:ident) => {
        impl InCourseState for $snapshot {
            fn find_in(state: &CourseState, id: Uuid) -> Option<&Self> {
                state.$list.iter().find(|item| item.id == id)
            }

            fn put_in(&self, state: &mut CourseState) {
                put_by_id(&mut state.$list, self.clone(), |item| item.id)
            }

            fn remove_from(state: &mut CourseState, id: Uuid) {
                state.$list.retain(|item| item.id != id)
            }
        }
    };
}

listed_in_state!(ChapterSnapshot, chapters);
listed_in_state!(ModuleSnapshot, modules);
listed_in_state!(GlossaryTermSnapshot, glossary);
listed_in_state!(ReferenceSnapshot, references);

impl InCourseState for PageSnapshot {
    fn find_in(_state: &CourseState, _id: Uuid) -> Option<&Self> {
        None
    }

    fn is_in(state: &CourseState, id: Uuid) -> bool {
        state.page(id).is_some()
    }

    fn put_in(&self, state: &mut CourseState) {
        put_by_id(&mut state.pages, PageRecord::from(self), |page| page.id);
        state.set_page_exercises(self.id, Some(self));
        state.set_page_exercise_deadlines(self);
    }

    fn remove_from(state: &mut CourseState, id: Uuid) {
        state.pages.retain(|page| page.id != id);
        state.set_page_exercises(id, None);
    }
}

impl InCourseState for CourseSettingsSnapshot {
    fn find_in(state: &CourseState, id: Uuid) -> Option<&Self> {
        (state.settings.course_id == id).then_some(&state.settings)
    }

    fn put_in(&self, state: &mut CourseState) {
        state.settings = self.clone();
    }

    fn remove_from(_state: &mut CourseState, _id: Uuid) {}
}

impl InCourseState for CourseDefaultReviewConfigSnapshot {
    fn find_in(state: &CourseState, id: Uuid) -> Option<&Self> {
        state
            .course_default_review_config
            .as_ref()
            .filter(|config| config.id == id)
    }

    fn put_in(&self, state: &mut CourseState) {
        state.course_default_review_config = Some(self.clone());
    }

    fn remove_from(state: &mut CourseState, id: Uuid) {
        if Self::find_in(state, id).is_some() {
            state.course_default_review_config = None;
        }
    }
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
