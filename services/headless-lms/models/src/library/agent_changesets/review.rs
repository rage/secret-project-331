//! What the review page shows of a changeset.

use std::collections::HashMap;

use utoipa::ToSchema;

use crate::{
    agent_changeset_calls::{self, AgentChangesetCallSummary},
    agent_changeset_entities::{
        self, AgentChangesetEntity, AgentChangesetEntityOperation, RiskReason,
    },
    agent_changesets::AgentChangeset,
    library::{
        agent_changesets::{
            conflicts::{PublishConflict, conflicts_of},
            course_state::{ExerciseRecord, ReviewConfigKind},
            field_changes::{EntityField, FieldChange, FieldValue, field_changes},
            preview::PreviewPage,
        },
        entity_snapshots::{
            self, ChapterSnapshot, ContentEntity, ContentEntityType, EntityKey, EntityRef,
            EntitySnapshot, PageSnapshot,
        },
    },
    prelude::*,
};

/// What a change does to one entity, apart from a page's content.
#[derive(Debug, Clone, PartialEq, Serialize, ToSchema)]
pub struct EntityChange {
    #[serde(flatten)]
    pub entity: EntityRef,
    pub operation: AgentChangesetEntityOperation,
    pub risk_reasons: Vec<RiskReason>,
    /// The fields that differ between the entity when it was staged and as staged.
    pub field_changes: Vec<FieldChange>,
}

/// What a change does to a page: its fields, and its content as students see it.
#[derive(Debug, Clone, PartialEq, Serialize, ToSchema)]
pub struct PageChange {
    #[serde(flatten)]
    pub change: EntityChange,
    /// Whether the blocks or exercises differ; always for creates and deletes.
    pub is_content_changed: bool,
    /// The page when it was staged; `None` for creates.
    pub base: Option<PreviewPage>,
    /// The page as staged; `None` for deletes.
    pub after: Option<PreviewPage>,
    /// What the reviewer should know before publishing the page's exercise changes.
    pub warnings: Vec<ExerciseChangeWarning>,
}

/// A consequence of an exercise change the reviewer should know of. Never makes the change risky.
#[derive(Debug, Clone, PartialEq, Serialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ExerciseChangeWarning {
    /// The exercise switches between the course default review config and its own while students
    /// have already given reviews under the old one.
    ReviewConfigSwitchedWithReviews {
        exercise_id: Uuid,
        exercise_name: String,
        to: ReviewConfigKind,
        review_count: i64,
    },
}

/// A change to the course default review config, which every exercise without its own uses.
#[derive(Debug, Clone, PartialEq, Serialize, ToSchema)]
pub struct CourseDefaultReviewConfigChange {
    #[serde(flatten)]
    pub change: EntityChange,
    /// How many published exercises with peer or self reviews use the course default.
    pub exercise_count: i64,
}

/// One staged entity on the review page.
#[derive(Debug, Clone, PartialEq, Serialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ReviewEntity {
    Page(Box<PageChange>),
    CourseDefaultReviewConfig(Box<CourseDefaultReviewConfigChange>),
    /// Any other entity, which changes only field by field.
    Fields(EntityChange),
}

/// Everything the review page shows for a changeset.
#[derive(Debug, Clone, PartialEq, Serialize, ToSchema)]
pub struct ChangesetReview {
    pub changeset: AgentChangeset,
    pub entities: Vec<ReviewEntity>,
    /// The agent calls that staged the changes, oldest first.
    pub calls: Vec<AgentChangesetCallSummary>,
    /// Staged entities whose live state changed after they were staged, which blocks publishing.
    pub conflicts: Vec<PublishConflict>,
    pub is_expiring_soon: bool,
    /// The pages that are their chapter's front page, as staged while the changeset is open and
    /// as live after.
    pub chapter_front_page_ids: Vec<Uuid>,
}

/// The review of a changeset, with every reference in a field change labelled.
pub async fn get_review(
    conn: &mut PgConnection,
    changeset: AgentChangeset,
) -> ModelResult<ChangesetReview> {
    let rows = agent_changeset_entities::get_by_changeset_id(conn, changeset.id).await?;
    let keys: Vec<EntityKey> = rows.iter().map(AgentChangesetEntity::key).collect();
    let mut bases = agent_changeset_entities::get_bases(conn, changeset.id, &keys).await?;
    let conflicts = if changeset.is_open() {
        conflicts_of(conn, &rows, &bases).await?
    } else {
        Vec::new()
    };
    let chapter_front_page_ids = chapter_front_page_ids(conn, &changeset, &rows).await?;
    let mut labels: HashMap<EntityKey, String> = rows
        .iter()
        .map(|row| (row.key(), row.label.clone()))
        .collect();
    let exercises_before: HashMap<Uuid, ExerciseRecord> = bases
        .values()
        .filter_map(PageSnapshot::narrow)
        .flat_map(ExerciseRecord::of_page)
        .map(|exercise| (exercise.id, exercise))
        .collect();
    let mut entities: Vec<ReviewEntity> = rows
        .into_iter()
        .map(|row| review_entity(bases.remove(&row.key()), row, &exercises_before))
        .collect();
    add_review_config_warnings(conn, &mut entities).await?;
    for entity in entities.iter_mut() {
        if let ReviewEntity::CourseDefaultReviewConfig(config) = entity {
            config.exercise_count = crate::exercises::count_using_course_default_review_config(
                conn,
                changeset.course_id,
            )
            .await?;
        }
    }

    let unlabelled: Vec<EntityKey> = references_mut(&mut entities)
        .map(|entity| entity.key())
        .filter(|key| !labels.contains_key(key))
        .collect();
    for (key, snapshot) in entity_snapshots::load_live_many(conn, &unlabelled).await? {
        labels.insert(
            key,
            snapshot.map(|s| s.label().to_string()).unwrap_or_default(),
        );
    }
    for entity in references_mut(&mut entities) {
        entity.label = labels.get(&entity.key()).cloned().unwrap_or_default();
    }

    let calls = agent_changeset_calls::get_summaries_by_changeset_id(conn, changeset.id).await?;
    Ok(ChangesetReview {
        is_expiring_soon: changeset.is_expiring_soon(Utc::now()),
        changeset,
        entities,
        calls,
        conflicts,
        chapter_front_page_ids,
    })
}

async fn chapter_front_page_ids(
    conn: &mut PgConnection,
    changeset: &AgentChangeset,
    rows: &[AgentChangesetEntity],
) -> ModelResult<Vec<Uuid>> {
    let mut front_pages: HashMap<Uuid, Option<Uuid>> =
        crate::chapters::get_course_chapters(conn, changeset.course_id)
            .await?
            .into_iter()
            .map(|chapter| (chapter.id, chapter.front_page_id))
            .collect();
    if changeset.is_open() {
        for row in rows
            .iter()
            .filter(|row| row.entity_type == ContentEntityType::Chapter)
        {
            let front_page = row
                .after_snapshot
                .as_ref()
                .and_then(ChapterSnapshot::narrow)
                .and_then(|chapter| chapter.front_page_id);
            front_pages.insert(row.entity_id, front_page);
        }
    }
    Ok(front_pages.into_values().flatten().collect())
}

/// The entities the field changes point at.
fn references_mut(entities: &mut [ReviewEntity]) -> impl Iterator<Item = &mut EntityRef> {
    entities
        .iter_mut()
        .flat_map(|entity| match entity {
            ReviewEntity::Page(page) => page.change.field_changes.iter_mut(),
            ReviewEntity::CourseDefaultReviewConfig(config) => {
                config.change.field_changes.iter_mut()
            }
            ReviewEntity::Fields(change) => change.field_changes.iter_mut(),
        })
        .flat_map(FieldChange::references_mut)
}

/// Warns of each exercise whose review config switch drops reviews students have given.
async fn add_review_config_warnings(
    conn: &mut PgConnection,
    entities: &mut [ReviewEntity],
) -> ModelResult<()> {
    let switches = |page: &PageChange| -> Vec<(Uuid, String, ReviewConfigKind)> {
        page.change
            .field_changes
            .iter()
            .filter(|change| change.field == EntityField::ReviewConfig)
            .filter_map(|change| {
                let owner = change.exercise.as_ref()?;
                let Some(FieldValue::ReviewConfig(to)) = change.after else {
                    return None;
                };
                Some((owner.exercise_id, owner.exercise_name.clone(), to))
            })
            .collect()
    };
    let exercise_ids: Vec<Uuid> = entities
        .iter()
        .filter_map(|entity| match entity {
            ReviewEntity::Page(page) => Some(switches(page)),
            _ => None,
        })
        .flatten()
        .map(|(id, _, _)| id)
        .collect();
    let review_counts =
        crate::peer_or_self_review_submissions::count_by_exercise_ids(conn, &exercise_ids).await?;
    for entity in entities.iter_mut() {
        if let ReviewEntity::Page(page) = entity {
            for (exercise_id, exercise_name, to) in switches(page) {
                if let Some(review_count) = review_counts.get(&exercise_id) {
                    page.warnings
                        .push(ExerciseChangeWarning::ReviewConfigSwitchedWithReviews {
                            exercise_id,
                            exercise_name,
                            to,
                            review_count: *review_count,
                        });
                }
            }
        }
    }
    Ok(())
}

fn review_entity(
    base: Option<EntitySnapshot>,
    row: AgentChangesetEntity,
    exercises_before: &HashMap<Uuid, ExerciseRecord>,
) -> ReviewEntity {
    let change = EntityChange {
        entity: row.entity_ref(),
        operation: row.operation(),
        field_changes: field_changes(base.as_ref(), row.after_snapshot.as_ref(), exercises_before),
        risk_reasons: row.risk_reasons,
    };
    if row.entity_type == ContentEntityType::CourseDefaultReviewConfig {
        return ReviewEntity::CourseDefaultReviewConfig(Box::new(
            CourseDefaultReviewConfigChange {
                change,
                exercise_count: 0,
            },
        ));
    }
    let as_page = |snapshot: Option<EntitySnapshot>| match snapshot {
        Some(EntitySnapshot::Page(page)) => Some(page),
        _ => None,
    };
    let (base, after) = (as_page(base), as_page(row.after_snapshot));
    if base.is_none() && after.is_none() {
        return ReviewEntity::Fields(change);
    }
    let is_content_changed = match (&base, &after) {
        (Some(base), Some(after)) => {
            base.content != after.content
                || base.exercises != after.exercises
                || base.exercise_slides != after.exercise_slides
                || base.exercise_tasks != after.exercise_tasks
        }
        _ => true,
    };
    ReviewEntity::Page(Box::new(PageChange {
        change,
        is_content_changed,
        base: base.map(PreviewPage::from),
        after: after.map(PreviewPage::from),
        warnings: Vec::new(),
    }))
}
