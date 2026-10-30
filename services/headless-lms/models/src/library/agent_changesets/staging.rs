//! Staging agent write calls into the open changeset.

use std::collections::{HashMap, HashSet};

use crate::{
    agent_changeset_calls::{self, CallActor, NewAgentChangesetCall, NewEntityChange},
    agent_changeset_entities::{self, AgentChangesetEntity, NewStagedEntity, RestagedEntity},
    agent_changesets::{self, AgentChangeset},
    library::{
        agent_changesets::{
            course_state::{PublishBlocker, StagedEntity},
            risk::{RiskBaseline, reclassify},
        },
        entity_snapshots::{
            self, ContentEntityType, EntityKey, EntityRef, EntitySnapshot, json_digest,
        },
    },
    prelude::*,
};

/// The staged state a write call built its changes on.
#[derive(Debug, Clone, Default)]
pub struct StagedStateRead {
    /// The open changeset the call read; `None` if there was none.
    pub changeset_id: Option<Uuid>,
    /// The `revision` of each changeset row the call read; entities it read live are left out.
    pub entity_revisions: HashMap<EntityKey, i32>,
    /// The live state of each entity the call read live, `None` for one that didn't exist. It
    /// becomes the entity's base; a live change made while the call ran makes the read stale.
    pub live_snapshots: HashMap<EntityKey, Option<EntitySnapshot>>,
}

impl StagedStateRead {
    /// The user's staged state of the entities now, for a caller that writes without reading
    /// first.
    pub async fn current(
        conn: &mut PgConnection,
        user_id: Uuid,
        course_id: Uuid,
        keys: &[EntityKey],
    ) -> ModelResult<Self> {
        let changeset = agent_changesets::get_open(conn, user_id, course_id).await?;
        let mut entity_revisions = HashMap::new();
        if let Some(changeset) = &changeset {
            for row in agent_changeset_entities::get_by_keys(conn, changeset.id, keys).await? {
                entity_revisions.insert(row.key(), row.revision);
            }
        }
        let live_keys: Vec<EntityKey> = keys
            .iter()
            .filter(|key| !entity_revisions.contains_key(key))
            .copied()
            .collect();
        Ok(Self {
            changeset_id: changeset.map(|changeset| changeset.id),
            entity_revisions,
            live_snapshots: entity_snapshots::load_live_many(conn, &live_keys).await?,
        })
    }
}

/// A write call to stage with [`stage_call`].
#[derive(Clone)]
pub struct StageCall<'a> {
    pub actor: &'a CallActor,
    pub course_id: Uuid,
    pub tool_name: &'a str,
    /// The operations as the agent sent them, for the audit log.
    pub ops: &'a serde_json::Value,
    pub summary: Option<&'a str>,
    pub entities: Vec<StagedEntity>,
    pub revert_of_call_id: Option<Uuid>,
    /// What the call read of the staged state.
    pub read: &'a StagedStateRead,
    /// What the caller has loaded of the course the changeset's risk is classified on.
    pub risk: &'a RiskBaseline<'a>,
}

/// Whether [`stage_call`] staged the call.
#[derive(Debug, Clone)]
pub enum StageCallOutcome {
    Staged(Box<StageCallResult>),
    /// The changeset the call read was published, discarded or expired meanwhile. Nothing was
    /// staged.
    ChangesetClosed,
    /// Another call restaged or dropped these entities, or their live state changed, after this
    /// call read them. Nothing was staged.
    StaleRead {
        entities: Vec<EntityKey>,
    },
    /// The call is a revert that would make the changeset break these rules of publishing, which
    /// held before. Nothing was staged.
    WouldAddBlockers(Vec<PublishBlocker>),
}

/// What a staged call left in the changeset.
#[derive(Debug, Clone)]
pub struct StageCallResult {
    pub changeset: AgentChangeset,
    pub call_id: Uuid,
    /// The changeset's rows for the entities the call touched, in the order the call listed them;
    /// an entity back at its live state has no row.
    pub entities: Vec<AgentChangesetEntity>,
    /// How many risk reasons the whole changeset holds after the call.
    pub risk_reason_count: usize,
}

/// Stages one agent write call into the actor's open changeset for the course, creating the
/// changeset if needed, records the call in the audit log and classifies the risk of the whole
/// changeset again.
///
/// Each entity's first stage records the live state the call read as the base the publish
/// conflict check compares against. An entity staged back to its base state leaves the changeset.
/// Nothing is staged if the staged or live state changed after the call read it, or if a revert
/// would add publish blockers; see [`StageCallOutcome`]. Errors with `PreconditionFailed` if a
/// snapshot is of another course or references another course's chapter or module, or if the call
/// deletes course settings.
pub async fn stage_call(
    conn: &mut PgConnection,
    call: StageCall<'_>,
) -> ModelResult<StageCallOutcome> {
    let mut tx = conn.begin().await?;
    let outcome = stage(&mut tx, call).await?;
    if matches!(outcome, StageCallOutcome::Staged(_)) {
        tx.commit().await?;
    } else {
        tx.rollback().await?;
    }
    Ok(outcome)
}

/// What [`stage_call`] would do, without staging anything: the call staged and rolled back. The
/// result's call id and changeset revision are never stored.
pub async fn stage_call_dry_run(
    conn: &mut PgConnection,
    call: StageCall<'_>,
) -> ModelResult<StageCallOutcome> {
    let mut tx = conn.begin().await?;
    let outcome = stage(&mut tx, call).await?;
    tx.rollback().await?;
    Ok(outcome)
}

/// [`stage_call`] in the caller's transaction, which the caller commits only when the call was
/// staged.
async fn stage(conn: &mut PgConnection, call: StageCall<'_>) -> ModelResult<StageCallOutcome> {
    let changeset_id = match call.read.changeset_id {
        Some(changeset_id) => changeset_id,
        None => {
            agent_changesets::get_or_create_open(conn, call.actor.user_id, call.course_id)
                .await?
                .id
        }
    };
    let changeset = agent_changesets::get_by_id_for_update(conn, changeset_id).await?;
    if !changeset.is_open() {
        return Ok(StageCallOutcome::ChangesetClosed);
    }
    let keys: Vec<EntityKey> = call.entities.iter().map(StagedEntity::key).collect();
    let mut existing_rows: HashMap<EntityKey, AgentChangesetEntity> =
        agent_changeset_entities::get_by_keys(conn, changeset.id, &keys)
            .await?
            .into_iter()
            .map(|row| (row.key(), row))
            .collect();
    let stale: Vec<EntityKey> = keys
        .iter()
        .filter(|key| {
            existing_rows.get(key).map(|row| row.revision)
                != call.read.entity_revisions.get(key).copied()
        })
        .copied()
        .collect();
    if !stale.is_empty() {
        return Ok(StageCallOutcome::StaleRead { entities: stale });
    }
    let existing_keys: Vec<EntityKey> = existing_rows.keys().copied().collect();
    let mut bases = agent_changeset_entities::get_bases(conn, changeset.id, &existing_keys).await?;
    let new_keys: Vec<EntityKey> = keys
        .iter()
        .filter(|key| !existing_rows.contains_key(key))
        .copied()
        .collect();
    let mut live_bases = entity_snapshots::load_live_many(conn, &new_keys).await?;
    let stale_live: Vec<EntityKey> = new_keys
        .iter()
        .filter(|key| {
            call.read
                .live_snapshots
                .get(key)
                .is_some_and(|read_live| live_bases.get(key) != Some(read_live))
        })
        .copied()
        .collect();
    if !stale_live.is_empty() {
        return Ok(StageCallOutcome::StaleRead {
            entities: stale_live,
        });
    }
    let mut state = call.risk.changeset_state(conn, &changeset).await?;
    // Old snapshots a revert restores can clash with what was staged after them.
    let staged_before = call.revert_of_call_id.map(|_| state.staged.clone());
    let changeset = agent_changesets::record_write(conn, changeset.id).await?;

    let foreign_parents = foreign_parents(conn, &call.entities, call.course_id).await?;
    let mut entity_changes = Vec::with_capacity(call.entities.len());
    let mut new_rows = Vec::new();
    let mut restaged_rows = Vec::new();
    let mut dropped_rows = Vec::new();
    for staged in call.entities {
        let key = staged.key();
        let mut after = staged.into_after();
        match &mut after {
            Some(snapshot) => {
                if let EntitySnapshot::Page(page) = snapshot {
                    page.normalize_for_storage();
                }
                check_snapshot(snapshot, call.course_id, &foreign_parents)?;
            }
            None if key.entity_type == ContentEntityType::CourseSettings => {
                return Err(model_err!(
                    PreconditionFailed,
                    "Course settings cannot be deleted".to_string()
                ));
            }
            None => {}
        }
        let prior = match existing_rows.remove(&key) {
            Some(row) => PriorState::Staged {
                before: row.after_snapshot,
                base: bases.remove(&key),
            },
            None => PriorState::Live(live_bases.remove(&key).flatten()),
        };
        let has_row = match plan_entity(key, after.as_ref(), prior)? {
            EntityPlan::Unchanged => false,
            EntityPlan::New { row, change } => {
                entity_changes.push(change);
                new_rows.push(row);
                true
            }
            EntityPlan::Restaged { row, change } => {
                entity_changes.extend(change);
                restaged_rows.push(row);
                true
            }
            EntityPlan::Dropped { change } => {
                entity_changes.extend(change);
                dropped_rows.push(key);
                false
            }
        };
        if has_row {
            state.stored_reasons.entry(key).or_default();
            state.staged.to_mut().set_entity(key, after.as_ref());
        } else {
            state.stored_reasons.remove(&key);
            state.staged.to_mut().copy_entity_from(&state.live, key);
        }
    }
    if let Some(staged_before) = staged_before {
        let blockers = state.staged.blockers_added_since(&staged_before);
        if !blockers.is_empty() {
            return Ok(StageCallOutcome::WouldAddBlockers(blockers));
        }
    }
    agent_changeset_entities::insert(conn, changeset.id, changeset.revision, &new_rows).await?;
    agent_changeset_entities::restage(conn, changeset.id, changeset.revision, &restaged_rows)
        .await?;
    agent_changeset_entities::delete(conn, changeset.id, &dropped_rows).await?;

    let call_id = agent_changeset_calls::insert(
        conn,
        NewAgentChangesetCall {
            changeset_id: changeset.id,
            actor: call.actor,
            tool_name: call.tool_name,
            ops: call.ops,
            summary: call.summary,
            entity_changes: &entity_changes,
            revert_of_call_id: call.revert_of_call_id,
        },
    )
    .await?;
    let reclassified = reclassify(conn, changeset.id, &state).await?;
    let mut rows: HashMap<EntityKey, AgentChangesetEntity> =
        agent_changeset_entities::get_by_keys(conn, changeset.id, &keys)
            .await?
            .into_iter()
            .map(|row| (row.key(), row))
            .collect();
    let entities = keys.iter().filter_map(|key| rows.remove(key)).collect();
    Ok(StageCallOutcome::Staged(Box::new(StageCallResult {
        changeset,
        call_id,
        entities,
        risk_reason_count: reclassified.reason_count(),
    })))
}

/// What the changeset held of an entity before a call staged it.
enum PriorState {
    /// The changeset stages it: `before` is its staged snapshot, `base` the live state it was first
    /// staged on.
    Staged {
        before: Option<EntitySnapshot>,
        base: Option<EntitySnapshot>,
    },
    /// The changeset doesn't have it; this is its live state.
    Live(Option<EntitySnapshot>),
}

/// What staging one entity writes: its changeset row and its audit log entry. An entity's entry
/// is `None` when the call leaves its staged state as it was.
enum EntityPlan {
    /// The entity stays out of the changeset: the call leaves it at its live state.
    Unchanged,
    New {
        row: NewStagedEntity,
        change: NewEntityChange,
    },
    Restaged {
        row: RestagedEntity,
        change: Option<NewEntityChange>,
    },
    /// The call puts the entity back at its base, so its row is removed.
    Dropped { change: Option<NewEntityChange> },
}

/// Plans staging `after` (`None` deletes) over the entity's `prior` state.
fn plan_entity(
    key: EntityKey,
    after: Option<&EntitySnapshot>,
    prior: PriorState,
) -> ModelResult<EntityPlan> {
    let after_json = after.map(serde_json::to_string).transpose()?;
    let after_digest = after_json.as_deref().map(json_digest);
    match prior {
        PriorState::Staged { before, base } => {
            let change = if before.as_ref() != after {
                Some(NewEntityChange {
                    key,
                    label: EntityRef::of(key, after, before.as_ref()).label,
                    before_json: before.as_ref().map(serde_json::to_string).transpose()?,
                    after_digest,
                })
            } else {
                None
            };
            if base.as_ref() == after {
                Ok(EntityPlan::Dropped { change })
            } else {
                Ok(EntityPlan::Restaged {
                    row: RestagedEntity {
                        key,
                        after_json,
                        label: EntityRef::of(key, after, base.as_ref()).label,
                    },
                    change,
                })
            }
        }
        PriorState::Live(before) => {
            if before.as_ref() == after {
                return Ok(EntityPlan::Unchanged);
            }
            let label = EntityRef::of(key, after, before.as_ref()).label;
            let before_json = before.as_ref().map(serde_json::to_string).transpose()?;
            Ok(EntityPlan::New {
                change: NewEntityChange {
                    key,
                    label: label.clone(),
                    before_json: before_json.clone(),
                    after_digest,
                },
                row: NewStagedEntity {
                    key,
                    base_json: before_json,
                    after_json,
                    label,
                },
            })
        }
    }
}

/// The chapters and modules the written snapshots are placed in that belong to another course.
async fn foreign_parents(
    conn: &mut PgConnection,
    entities: &[StagedEntity],
    course_id: Uuid,
) -> ModelResult<HashSet<Uuid>> {
    let mut chapter_ids = Vec::new();
    let mut module_ids = Vec::new();
    for parent in entities
        .iter()
        .filter_map(|entity| entity.after()?.parent())
    {
        match parent {
            EntityKey {
                entity_type: ContentEntityType::Chapter,
                entity_id: id,
            } => chapter_ids.push(id),
            EntityKey { entity_id: id, .. } => module_ids.push(id),
        }
    }
    if chapter_ids.is_empty() && module_ids.is_empty() {
        return Ok(HashSet::new());
    }
    let mut foreign: HashSet<Uuid> = crate::chapters::get_course_ids(conn, &chapter_ids)
        .await?
        .into_iter()
        .filter(|(_, chapter_course)| *chapter_course != course_id)
        .map(|(chapter_id, _)| chapter_id)
        .collect();
    foreign.extend(
        crate::course_modules::get_by_ids(conn, &module_ids)
            .await?
            .into_iter()
            .filter(|module| module.course_id != course_id)
            .map(|module| module.id),
    );
    Ok(foreign)
}

fn check_snapshot(
    snapshot: &EntitySnapshot,
    course_id: Uuid,
    foreign_parents: &HashSet<Uuid>,
) -> ModelResult<()> {
    if snapshot.course_id() != course_id {
        return Err(model_err!(
            PreconditionFailed,
            "Staged snapshot belongs to another course".to_string()
        ));
    }
    if snapshot
        .parent()
        .is_some_and(|parent| foreign_parents.contains(&parent.entity_id))
    {
        return Err(model_err!(
            PreconditionFailed,
            "Staged snapshot references another course's chapter or module".to_string()
        ));
    }
    Ok(())
}
