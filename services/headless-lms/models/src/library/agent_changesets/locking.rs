//! Locking an open changeset for a publish or discard, and discarding it.

use utoipa::ToSchema;

use crate::{
    agent_changeset_entities::{self, AgentChangesetEntity},
    agent_changesets::{self, AgentChangeset, AgentChangesetStatus},
    library::{
        agent_changesets::{
            course_state::PublishBlocker,
            risk::{RiskBaseline, reclassify},
        },
        entity_snapshots::{EntityKey, EntityRef},
    },
    prelude::*,
};

/// The staged changes changed after the revision the user based a publish or discard on. Nothing
/// was written.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct ChangedSinceReview {
    /// The changeset's revision now.
    pub revision: i32,
}

/// Why a publish or discard couldn't act on the changeset.
pub(super) enum LockRejection {
    NotOpen(AgentChangesetStatus),
    ChangedSinceReview(ChangedSinceReview),
}

/// Locks the changeset until the transaction ends and checks that it is open and, with
/// `reviewed_revision`, still at that revision.
pub(super) async fn lock_open_changeset(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    reviewed_revision: Option<i32>,
) -> ModelResult<Result<AgentChangeset, LockRejection>> {
    let changeset = agent_changesets::get_by_id_for_update(conn, changeset_id).await?;
    if !changeset.is_open() {
        return Ok(Err(LockRejection::NotOpen(changeset.status)));
    }
    if reviewed_revision.is_some_and(|reviewed| reviewed != changeset.revision) {
        return Ok(Err(LockRejection::ChangedSinceReview(ChangedSinceReview {
            revision: changeset.revision,
        })));
    }
    Ok(Ok(changeset))
}

/// Why a discard was refused. Nothing was dropped.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "reason", rename_all = "snake_case")]
pub enum DiscardRejection {
    /// The changeset was published, discarded or expired before.
    NotOpen { status: AgentChangesetStatus },
    /// The staged changes changed after the revision the discard was based on.
    ChangedSinceReview(ChangedSinceReview),
    /// Without the entities to drop, the rest of the changeset would break these rules of
    /// publishing.
    Blockers { blockers: Vec<PublishBlocker> },
}

impl From<LockRejection> for DiscardRejection {
    fn from(rejection: LockRejection) -> Self {
        match rejection {
            LockRejection::NotOpen(status) => Self::NotOpen { status },
            LockRejection::ChangedSinceReview(changed) => Self::ChangedSinceReview(changed),
        }
    }
}

/// What discarding a whole changeset did.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum DiscardOutcome {
    Discarded { changeset: AgentChangeset },
    Rejected { rejection: DiscardRejection },
}

/// Drops every staged change of an open changeset. With `reviewed_revision`, refuses if the
/// changeset is at another revision, so that changes staged after the user looked are not dropped
/// unseen.
pub async fn discard(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    reviewed_revision: Option<i32>,
) -> ModelResult<DiscardOutcome> {
    let mut tx = conn.begin().await?;
    if let Err(rejection) = lock_open_changeset(&mut tx, changeset_id, reviewed_revision).await? {
        tx.rollback().await?;
        return Ok(DiscardOutcome::Rejected {
            rejection: rejection.into(),
        });
    }
    let changeset = agent_changesets::discard(&mut tx, changeset_id).await?;
    tx.commit().await?;
    Ok(DiscardOutcome::Discarded { changeset })
}

/// Drops the entities from an open changeset, so the user sees them live again, classifies the
/// risk of the rest again and returns the entities it dropped. Entities the changeset doesn't
/// have are skipped. Refuses like [`discard`], and if the rest would break rules of publishing
/// the whole changeset didn't.
pub async fn discard_entities(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    entities: &[EntityKey],
    reviewed_revision: Option<i32>,
    risk: &RiskBaseline<'_>,
) -> ModelResult<Result<Vec<EntityRef>, DiscardRejection>> {
    let mut tx = conn.begin().await?;
    let changeset = match lock_open_changeset(&mut tx, changeset_id, reviewed_revision).await? {
        Ok(changeset) => changeset,
        Err(rejection) => {
            tx.rollback().await?;
            return Ok(Err(rejection.into()));
        }
    };
    let mut state = risk.changeset_state(&mut tx, &changeset).await?;
    let dropped: Vec<EntityKey> = entities
        .iter()
        .filter(|key| state.stored_reasons.contains_key(key))
        .copied()
        .collect();
    if dropped.is_empty() {
        tx.rollback().await?;
        return Ok(Ok(Vec::new()));
    }
    let staged_before = state.staged.clone();
    for key in &dropped {
        state.stored_reasons.remove(key);
        state.staged.to_mut().copy_entity_from(&state.live, *key);
    }
    let blockers = state.staged.blockers_added_since(&staged_before);
    if !blockers.is_empty() {
        tx.rollback().await?;
        return Ok(Err(DiscardRejection::Blockers { blockers }));
    }
    let dropped_entities = agent_changeset_entities::get_by_keys(&mut tx, changeset_id, &dropped)
        .await?
        .iter()
        .map(AgentChangesetEntity::entity_ref)
        .collect();
    agent_changeset_entities::delete(&mut tx, changeset_id, &dropped).await?;
    agent_changesets::increment_revision(&mut tx, changeset_id).await?;
    reclassify(&mut tx, changeset_id, &state).await?;
    tx.commit().await?;
    Ok(Ok(dropped_entities))
}
