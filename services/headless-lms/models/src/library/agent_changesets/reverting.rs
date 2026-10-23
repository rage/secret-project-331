use utoipa::ToSchema;

use crate::{
    agent_changeset_calls::{self, AgentChangesetCall},
    agent_changeset_entities::AgentChangesetEntityType,
    agent_changesets,
    library::{
        agent_changesets::{load_current, staging::StagedEntity},
        entity_snapshots::EntitySnapshot,
    },
    prelude::*,
};

/// An entity a call touched that changed again afterwards, so the call can no longer be reverted.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct RevertConflict {
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    pub label: String,
}

#[derive(Debug, Clone)]
pub enum RevertPlan {
    /// Stage these with [`super::stage_call`] (with `revert_of_call_id` set) to revert the call.
    /// `risk_reasons` are left empty for the caller to classify.
    Ready {
        call: Box<AgentChangesetCall>,
        entities: Vec<StagedEntity>,
    },
    /// Entities that changed after the call; nothing can be reverted.
    Conflicts(Vec<RevertConflict>),
}

/// Works out how to revert one of the user's agent write calls: every entity it touched goes back
/// to its state just before the call. The revert is a new change staged in the user's open
/// changeset, so it goes through the normal risk rules and publishing.
///
/// The current state is the user's staged state where the open changeset has the entity, and the
/// live state otherwise. If any entity's current state is not what the call left behind, the plan
/// lists those entities instead. Errors with `NotFound` if the call is not the user's.
pub async fn plan_revert(
    conn: &mut PgConnection,
    call_id: Uuid,
    user_id: Uuid,
) -> ModelResult<RevertPlan> {
    let call = agent_changeset_calls::get_by_id(conn, call_id).await?;
    if call.user_id != user_id {
        return Err(model_err!(NotFound, "No such call".to_string()));
    }
    let changeset = agent_changesets::get_by_id(conn, call.changeset_id).await?;

    let mut conflicts = Vec::new();
    let mut entities = Vec::with_capacity(call.entity_changes.len());
    for change in &call.entity_changes {
        let after = change
            .after
            .as_ref()
            .map(|value| EntitySnapshot::from_value(change.entity_type, value))
            .transpose()?;
        let current = load_current(
            conn,
            user_id,
            changeset.course_id,
            change.entity_type,
            change.entity_id,
        )
        .await?;
        if current != after {
            conflicts.push(RevertConflict {
                entity_type: change.entity_type,
                entity_id: change.entity_id,
                label: current
                    .as_ref()
                    .or(after.as_ref())
                    .map(EntitySnapshot::label)
                    .unwrap_or_default(),
            });
            continue;
        }
        entities.push(StagedEntity {
            entity_type: change.entity_type,
            entity_id: change.entity_id,
            after: change.before.clone(),
            risk_reasons: vec![],
        });
    }
    if conflicts.is_empty() {
        Ok(RevertPlan::Ready {
            call: Box::new(call),
            entities,
        })
    } else {
        Ok(RevertPlan::Conflicts(conflicts))
    }
}
