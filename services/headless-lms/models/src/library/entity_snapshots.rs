//! Full snapshots of course content entities.
//!
//! Agent changesets stage these, `entity_history` stores them, and publishing and restoring write
//! them back through the existing save paths. A snapshot holds every field its save path writes,
//! so writing back an unchanged snapshot is a no-op.

use std::collections::HashMap;
use std::sync::Arc;

use headless_lms_utils::{document_schema_processor::GutenbergBlock, stable_digest::stable_digest};
use sqlx::types::Json;
use utoipa::ToSchema;

use crate::{
    course_modules::{self, CompletionPolicy},
    courses::CourseAiPolicy,
    library::agent_changesets::course_state::{CourseState, PageRecord},
    pages::{
        CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask, CmsPageUpdate,
        fork_peer_or_self_review_config,
    },
    prelude::*,
};

/// A kind of course content entity that agent changesets stage and history records.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, Type, ToSchema,
)]
#[sqlx(type_name = "content_entity_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ContentEntityType {
    Page,
    Chapter,
    Module,
    CourseSettings,
    GlossaryTerm,
    Reference,
    CourseDefaultReviewConfig,
}

/// An entity kind and id.
pub type EntityKey = (ContentEntityType, Uuid);

/// A content entity and what people call it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct EntityRef {
    pub entity_type: ContentEntityType,
    /// The entity's id; the course id for course settings.
    pub entity_id: Uuid,
    /// A page title, chapter, module or course name, glossary term or citation key; empty for the
    /// default module and the course default review config.
    pub label: String,
}

impl EntityRef {
    /// The entity, labelled from `preferred` if it exists and from `fallback` otherwise; with an
    /// empty label if neither does.
    pub fn of(
        (entity_type, entity_id): EntityKey,
        preferred: Option<&EntitySnapshot>,
        fallback: Option<&EntitySnapshot>,
    ) -> Self {
        Self {
            entity_type,
            entity_id,
            label: preferred
                .or(fallback)
                .map(|snapshot| snapshot.label().to_string())
                .unwrap_or_default(),
        }
    }

    pub fn key(&self) -> EntityKey {
        (self.entity_type, self.entity_id)
    }
}

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
    /// Shared with the [`PageRecord`]s made from the snapshot.
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

    /// The page's exercises in exercise order, each with its slides and tasks; the inverse of
    /// [`PageSnapshot::from_record_and_bundles`].
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

    pub fn course_id(&self) -> Uuid {
        match_snapshot!(self, snapshot => snapshot.course_id())
    }

    pub fn key(&self) -> EntityKey {
        (self.entity_type(), self.entity_id())
    }

    /// See [`EntityRef::label`].
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

/// What models know about one kind of content entity, implemented by its snapshot type, so that
/// code over every kind dispatches on [`ContentEntityType`] once.
pub(crate) trait ContentEntity: Clone + PartialEq + Into<EntitySnapshot> {
    const ENTITY_TYPE: ContentEntityType;

    /// The entity's id; the course id for course settings.
    fn id(&self) -> Uuid;

    fn course_id(&self) -> Uuid;

    /// See [`EntityRef::label`].
    fn label(&self) -> &str;

    /// The chapter or module the entity is placed in; `None` for entities of the course itself.
    fn parent(&self) -> Option<EntityKey> {
        None
    }

    /// The snapshot, if it is of this kind.
    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self>;

    /// The live entities with the ids, as [`load_live_many`] has them, by id.
    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>>;

    /// Locks the live rows of the entities until the transaction ends. `ids` must be sorted, so
    /// that concurrent lockers take the rows in the same order.
    async fn lock_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()>;

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
pub(crate) fn put_by_id<T>(items: &mut Vec<T>, item: T, id_of: impl Fn(&T) -> Uuid) {
    match items
        .iter_mut()
        .find(|existing| id_of(existing) == id_of(&item))
    {
        Some(existing) => *existing = item,
        None => items.push(item),
    }
}

/// Implements the [`ContentEntity`] methods of a kind a [`CourseState`] holds a list of.
macro_rules! listed_in_state {
    ($list:ident) => {
        fn find_in(state: &CourseState, id: Uuid) -> Option<&Self> {
            state.$list.iter().find(|item| item.id == id)
        }

        fn put_in(&self, state: &mut CourseState) {
            put_by_id(&mut state.$list, self.clone(), |item| item.id)
        }

        fn remove_from(state: &mut CourseState, id: Uuid) {
            state.$list.retain(|item| item.id != id)
        }
    };
}

impl From<PageSnapshot> for EntitySnapshot {
    fn from(snapshot: PageSnapshot) -> Self {
        Self::Page(snapshot)
    }
}

impl ContentEntity for PageSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::Page;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.title
    }

    fn parent(&self) -> Option<EntityKey> {
        self.chapter_id
            .map(|chapter_id| (ContentEntityType::Chapter, chapter_id))
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::Page(page) => Some(page),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        load_pages(conn, ids).await
    }

    async fn lock_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM pages WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }

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

impl From<ChapterSnapshot> for EntitySnapshot {
    fn from(snapshot: ChapterSnapshot) -> Self {
        Self::Chapter(snapshot)
    }
}

impl ContentEntity for ChapterSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::Chapter;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.name
    }

    fn parent(&self) -> Option<EntityKey> {
        Some((ContentEntityType::Module, self.course_module_id))
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::Chapter(chapter) => Some(chapter),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let chapters = sqlx::query_as!(
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
WHERE id = ANY($1)
  AND deleted_at IS NULL
            "#,
            ids
        )
        .fetch_all(conn)
        .await?;
        Ok(chapters.into_iter().map(|c| (c.id, c)).collect())
    }

    async fn lock_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM chapters WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }

    listed_in_state!(chapters);
}

impl From<ModuleSnapshot> for EntitySnapshot {
    fn from(snapshot: ModuleSnapshot) -> Self {
        Self::Module(snapshot)
    }
}

impl ContentEntity for ModuleSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::Module;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        self.name.as_deref().unwrap_or_default()
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::Module(module) => Some(module),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        Ok(course_modules::get_by_ids(conn, ids)
            .await?
            .into_iter()
            .map(|module| (module.id, module.into()))
            .collect())
    }

    async fn lock_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM course_modules WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }

    listed_in_state!(modules);
}

impl From<CourseSettingsSnapshot> for EntitySnapshot {
    fn from(snapshot: CourseSettingsSnapshot) -> Self {
        Self::CourseSettings(snapshot)
    }
}

impl ContentEntity for CourseSettingsSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::CourseSettings;

    fn id(&self) -> Uuid {
        self.course_id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.name
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::CourseSettings(settings) => Some(settings),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        let mut settings = HashMap::with_capacity(ids.len());
        for course in crate::courses::get_by_ids(conn, ids).await? {
            settings.insert(course.id, course_settings_of(conn, &course).await?);
        }
        Ok(settings)
    }

    async fn lock_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM courses WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }

    fn find_in(state: &CourseState, id: Uuid) -> Option<&Self> {
        (state.settings.course_id == id).then_some(&state.settings)
    }

    fn put_in(&self, state: &mut CourseState) {
        state.settings = self.clone();
    }

    fn remove_from(_state: &mut CourseState, _id: Uuid) {}
}

impl From<GlossaryTermSnapshot> for EntitySnapshot {
    fn from(snapshot: GlossaryTermSnapshot) -> Self {
        Self::GlossaryTerm(snapshot)
    }
}

impl ContentEntity for GlossaryTermSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::GlossaryTerm;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.term
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::GlossaryTerm(term) => Some(term),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let terms = sqlx::query_as!(
            GlossaryTermSnapshot,
            r#"
SELECT id,
  course_id,
  term,
  definition
FROM glossary
WHERE id = ANY($1)
  AND deleted_at IS NULL
            "#,
            ids
        )
        .fetch_all(conn)
        .await?;
        Ok(terms.into_iter().map(|t| (t.id, t)).collect())
    }

    async fn lock_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM glossary WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }

    listed_in_state!(glossary);
}

impl From<ReferenceSnapshot> for EntitySnapshot {
    fn from(snapshot: ReferenceSnapshot) -> Self {
        Self::Reference(snapshot)
    }
}

impl ContentEntity for ReferenceSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::Reference;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        &self.citation_key
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::Reference(reference) => Some(reference),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let references = sqlx::query_as!(
            ReferenceSnapshot,
            r#"
SELECT id,
  course_id,
  citation_key,
  reference
FROM material_references
WHERE id = ANY($1)
  AND deleted_at IS NULL
            "#,
            ids
        )
        .fetch_all(conn)
        .await?;
        Ok(references.into_iter().map(|r| (r.id, r)).collect())
    }

    async fn lock_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM material_references WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }

    listed_in_state!(references);
}

impl From<CourseDefaultReviewConfigSnapshot> for EntitySnapshot {
    fn from(snapshot: CourseDefaultReviewConfigSnapshot) -> Self {
        Self::CourseDefaultReviewConfig(snapshot)
    }
}

impl ContentEntity for CourseDefaultReviewConfigSnapshot {
    const ENTITY_TYPE: ContentEntityType = ContentEntityType::CourseDefaultReviewConfig;

    fn id(&self) -> Uuid {
        self.id
    }

    fn course_id(&self) -> Uuid {
        self.course_id
    }

    fn label(&self) -> &str {
        ""
    }

    fn narrow(snapshot: &EntitySnapshot) -> Option<&Self> {
        match snapshot {
            EntitySnapshot::CourseDefaultReviewConfig(config) => Some(config),
            _ => None,
        }
    }

    async fn load_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<HashMap<Uuid, Self>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let configs = sqlx::query_as!(
            CourseDefaultReviewConfigSnapshot,
            r#"
SELECT id,
  course_id,
  review_instructions
FROM peer_or_self_review_configs
WHERE id = ANY($1)
  AND exercise_id IS NULL
  AND deleted_at IS NULL
            "#,
            ids
        )
        .fetch_all(conn)
        .await?;
        Ok(configs.into_iter().map(|c| (c.id, c)).collect())
    }

    async fn lock_live(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
        if !ids.is_empty() {
            sqlx::query!(
                "SELECT id FROM peer_or_self_review_configs WHERE id = ANY($1) ORDER BY id FOR UPDATE",
                ids
            )
            .fetch_all(conn)
            .await?;
        }
        Ok(())
    }

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

/// The course's default review config, if it has one.
pub async fn load_course_default_review_config(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Option<CourseDefaultReviewConfigSnapshot>> {
    Ok(sqlx::query_as!(
        CourseDefaultReviewConfigSnapshot,
        r#"
SELECT id,
  course_id,
  review_instructions
FROM peer_or_self_review_configs
WHERE course_id = $1
  AND exercise_id IS NULL
  AND deleted_at IS NULL
        "#,
        course_id
    )
    .fetch_optional(conn)
    .await?)
}

/// The live state of each entity, `None` for one that does not exist or is deleted. Pages that
/// belong to an exam are treated as not existing: changesets only hold course content.
pub async fn load_live_many(
    conn: &mut PgConnection,
    keys: &[EntityKey],
) -> ModelResult<HashMap<EntityKey, Option<EntitySnapshot>>> {
    let mut snapshots: HashMap<EntityKey, Option<EntitySnapshot>> =
        keys.iter().map(|key| (*key, None)).collect();
    let mut ids_by_type: HashMap<ContentEntityType, Vec<Uuid>> = HashMap::new();
    for (entity_type, entity_id) in snapshots.keys() {
        ids_by_type
            .entry(*entity_type)
            .or_default()
            .push(*entity_id);
    }
    for (entity_type, ids) in ids_by_type {
        with_snapshot_type!(entity_type, T => {
            for (id, snapshot) in T::load_live(conn, &ids).await? {
                snapshots.insert((entity_type, id), Some(snapshot.into()));
            }
        });
    }
    Ok(snapshots)
}

/// [`load_live_many`] of one entity.
pub async fn load_live(
    conn: &mut PgConnection,
    key: EntityKey,
) -> ModelResult<Option<EntitySnapshot>> {
    Ok(load_live_many(conn, &[key]).await?.remove(&key).flatten())
}

/// The live page, as [`load_live_many`] has it.
pub async fn load_page(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Option<PageSnapshot>> {
    Ok(load_pages(conn, &[page_id]).await?.remove(&page_id))
}

/// The live pages, as [`load_live_many`] has them, by id; the pages that don't exist are left out.
pub async fn load_pages(
    conn: &mut PgConnection,
    page_ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, PageSnapshot>> {
    if page_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let pages = sqlx::query!(
        r#"
SELECT id,
  course_id AS "course_id!",
  chapter_id,
  url_path,
  title,
  hidden,
  order_number,
  content AS "content: Json<Vec<GutenbergBlock>>"
FROM pages
WHERE id = ANY($1)
  AND course_id IS NOT NULL
  AND exam_id IS NULL
  AND deleted_at IS NULL
        "#,
        page_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut exercises = crate::pages::exercises_of_pages(
        conn,
        &pages.iter().map(|page| page.id).collect::<Vec<_>>(),
    )
    .await?;
    let mut snapshots = HashMap::with_capacity(pages.len());
    for page in pages {
        let page_exercises = exercises.remove(&page.id).unwrap_or_default();
        let mut snapshot = PageSnapshot {
            id: page.id,
            course_id: page.course_id,
            chapter_id: page.chapter_id,
            url_path: page.url_path,
            title: page.title,
            hidden: page.hidden,
            order_number: page.order_number,
            content: Arc::new(page.content.0),
            exercises: page_exercises.exercises,
            exercise_slides: page_exercises.exercise_slides,
            exercise_tasks: page_exercises.exercise_tasks,
            joins_page_language_group_id: None,
        };
        snapshot.sort();
        snapshots.insert(snapshot.id, snapshot);
    }
    Ok(snapshots)
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

/// The settings of a fetched course; only its audiences are read.
pub async fn course_settings_of(
    conn: &mut PgConnection,
    course: &crate::courses::Course,
) -> ModelResult<CourseSettingsSnapshot> {
    let mut audiences: Vec<CourseAudienceSnapshot> =
        crate::course_audiences::get_edit_course_audiences_by_course_id(conn, course.id)
            .await?
            .into_iter()
            .map(|audience| CourseAudienceSnapshot {
                id: audience.id,
                audience: audience.audience,
            })
            .collect();
    audiences.sort_by_key(|audience| audience.id);
    Ok(CourseSettingsSnapshot {
        course_id: course.id,
        name: course.name.clone(),
        description: course.description.clone(),
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
        closed_additional_message: course.closed_additional_message.clone(),
        closed_course_successor_id: course.closed_course_successor_id,
        chapter_locking_enabled: course.chapter_locking_enabled,
        ai_policy: course.ai_policy,
        course_material_ai_instructions: course.course_material_ai_instructions,
        base_module_completion_requires_n_submodule_completions: course
            .base_module_completion_requires_n_submodule_completions,
        audiences,
    })
}

impl From<crate::glossary::Term> for GlossaryTermSnapshot {
    fn from(term: crate::glossary::Term) -> Self {
        Self {
            id: term.id,
            course_id: term.course_id,
            term: term.term,
            definition: term.definition,
        }
    }
}

impl From<crate::material_references::MaterialReference> for ReferenceSnapshot {
    fn from(reference: crate::material_references::MaterialReference) -> Self {
        Self {
            id: reference.id,
            course_id: reference.course_id,
            citation_key: reference.citation_key,
            reference: reference.reference,
        }
    }
}
