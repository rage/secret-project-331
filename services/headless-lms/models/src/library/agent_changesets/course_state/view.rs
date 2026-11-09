use std::collections::{BTreeMap, HashMap, HashSet};

use super::{CourseParts, CourseState, ExerciseRecord, load_live_course};
use crate::{
    agent_changeset_entities::{self, AgentChangesetEntity},
    agent_changesets::{self, AgentChangeset},
    courses::Course,
    library::entity_snapshots::{
        self, ContentEntity, ContentEntityType, EntityKey, PageSnapshot, exercise_bundles,
    },
    prelude::*,
};

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
    /// The changeset's row for the entity; `None` if it isn't staged.
    pub fn staged_row(&self, key: EntityKey) -> Option<&AgentChangesetEntity> {
        self.staged_entities.get(&key)
    }

    /// The page holding the exercise as the user sees it, else the one its live record names.
    pub fn exercise_page_id(&self, exercise_id: Uuid) -> Option<Uuid> {
        self.staged.exercise_page_id(exercise_id).or_else(|| {
            self.live
                .exercise(exercise_id)
                .map(|exercise| exercise.page_id)
        })
    }

    /// The page's full staged snapshot: `Some(None)` when the changeset deletes it, `None` when
    /// the changeset doesn't have it.
    pub fn staged_page_snapshot(&self, page_id: Uuid) -> Option<Option<&PageSnapshot>> {
        let row = self.staged_row(EntityKey::new(ContentEntityType::Page, page_id))?;
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
        if self.live.exercises.is_some() {
            return Ok(());
        }
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
