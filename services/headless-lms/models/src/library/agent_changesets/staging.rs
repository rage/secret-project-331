use crate::{
    agent_changeset_calls::{
        self, AgentChangesetCall, CallActor, EntityChange, NewAgentChangesetCall,
    },
    agent_changeset_entities::{
        self, AgentChangesetEntity, AgentChangesetEntityOperation, AgentChangesetEntityType,
        EntityUpsert, RiskReason,
    },
    agent_changesets::{self, AgentChangeset},
    library::entity_snapshots::{self, EntitySnapshot},
    prelude::*,
};

/// The state one entity has after an agent write call.
#[derive(Debug, Clone)]
pub struct StagedEntity {
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    /// The entity's full snapshot after the call, in the shape of `entity_type`; `None` when the
    /// call deletes it. Ids of new entities are assigned by the caller.
    pub after: Option<serde_json::Value>,
    /// Why publishing the entity's staged state needs the user's confirmation; empty if routine.
    /// Replaces the reasons of earlier calls, so it must describe the whole staged change, not
    /// only this call's part.
    pub risk_reasons: Vec<RiskReason>,
}

#[derive(Debug, Clone)]
pub struct StageCall<'a> {
    pub actor: &'a CallActor,
    pub course_id: Uuid,
    pub tool_name: &'a str,
    /// The operations as the agent sent them, for the audit log.
    pub ops: &'a serde_json::Value,
    pub summary: Option<&'a str>,
    pub entities: Vec<StagedEntity>,
    pub revert_of_call_id: Option<Uuid>,
}

#[derive(Debug, Clone)]
pub struct StageCallResult {
    pub changeset: AgentChangeset,
    pub call: AgentChangesetCall,
    /// The changeset's rows for the entities the call touched; an entity back at its live state
    /// has no row.
    pub entities: Vec<AgentChangesetEntity>,
}

/// Stages one agent write call into the actor's open changeset for the course, creating the
/// changeset if needed, and records the call in the audit log.
///
/// Each entity's first stage records the live state as the base the publish conflict check
/// compares against. An entity staged back to its base state leaves the changeset. Errors with
/// `PreconditionFailed` if a snapshot is not in the shape of its entity type, names another
/// entity or course, or deletes course settings.
pub async fn stage_call(
    conn: &mut PgConnection,
    call: StageCall<'_>,
) -> ModelResult<StageCallResult> {
    let mut tx = conn.begin().await?;
    let changeset =
        agent_changesets::get_or_create_open(&mut tx, call.actor.user_id, call.course_id).await?;
    let changeset = agent_changesets::get_by_id_for_update(&mut tx, changeset.id).await?;

    let mut entity_changes = Vec::with_capacity(call.entities.len());
    let mut staged_rows = Vec::with_capacity(call.entities.len());
    for staged in call.entities {
        let after = staged
            .after
            .as_ref()
            .map(|value| {
                parse_snapshot(staged.entity_type, staged.entity_id, call.course_id, value)
            })
            .transpose()?;
        if after.is_none() && staged.entity_type == AgentChangesetEntityType::CourseSettings {
            return Err(model_err!(
                PreconditionFailed,
                "Course settings cannot be deleted".to_string()
            ));
        }

        let existing = agent_changeset_entities::get_one(
            &mut tx,
            changeset.id,
            staged.entity_type,
            staged.entity_id,
        )
        .await?;
        let (before, base, base_version_id) = match &existing {
            Some(row) => (
                row.after_snapshot
                    .as_ref()
                    .map(|value| EntitySnapshot::from_value(row.entity_type, value))
                    .transpose()?,
                row.base_snapshot
                    .as_ref()
                    .map(|value| EntitySnapshot::from_value(row.entity_type, value))
                    .transpose()?,
                row.base_version_id,
            ),
            None => {
                let live =
                    entity_snapshots::load_live(&mut tx, staged.entity_type, staged.entity_id)
                        .await?;
                let version =
                    entity_snapshots::latest_version(&mut tx, staged.entity_type, staged.entity_id)
                        .await?;
                (live.clone(), live, version.map(|v| v.history_id))
            }
        };

        if let Some(operation) =
            AgentChangesetEntityOperation::between(before.as_ref(), after.as_ref())
            && before != after
        {
            entity_changes.push(EntityChange {
                entity_type: staged.entity_type,
                entity_id: staged.entity_id,
                operation,
                before: before.as_ref().map(EntitySnapshot::to_value).transpose()?,
                after: after.as_ref().map(EntitySnapshot::to_value).transpose()?,
            });
        }

        let operation = AgentChangesetEntityOperation::between(base.as_ref(), after.as_ref());
        match operation {
            Some(operation) if base != after => {
                let base_value = base.as_ref().map(EntitySnapshot::to_value).transpose()?;
                let after_value = after.as_ref().map(EntitySnapshot::to_value).transpose()?;
                let row = agent_changeset_entities::upsert(
                    &mut tx,
                    EntityUpsert {
                        changeset_id: changeset.id,
                        entity_type: staged.entity_type,
                        entity_id: staged.entity_id,
                        operation,
                        base_snapshot: base_value.as_ref(),
                        after_snapshot: after_value.as_ref(),
                        base_version_id,
                        risk_reasons: &staged.risk_reasons,
                    },
                )
                .await?;
                staged_rows.push(row);
            }
            _ => {
                if existing.is_some() {
                    agent_changeset_entities::delete(
                        &mut tx,
                        changeset.id,
                        staged.entity_type,
                        staged.entity_id,
                    )
                    .await?;
                }
            }
        }
    }

    let recorded_call = agent_changeset_calls::insert(
        &mut tx,
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
    agent_changesets::extend_expiry(&mut tx, changeset.id).await?;
    let changeset = agent_changesets::get_by_id(&mut tx, changeset.id).await?;
    tx.commit().await?;
    Ok(StageCallResult {
        changeset,
        call: recorded_call,
        entities: staged_rows,
    })
}

fn parse_snapshot(
    entity_type: AgentChangesetEntityType,
    entity_id: Uuid,
    course_id: Uuid,
    value: &serde_json::Value,
) -> ModelResult<EntitySnapshot> {
    let snapshot = EntitySnapshot::from_value(entity_type, value).map_err(|err| {
        model_err!(
            PreconditionFailed,
            format!("Staged {entity_type:?} snapshot is malformed: {err}")
        )
    })?;
    if snapshot.entity_id() != entity_id {
        return Err(model_err!(
            PreconditionFailed,
            format!(
                "Staged snapshot is for {} instead of {entity_id}",
                snapshot.entity_id()
            )
        ));
    }
    if snapshot.course_id() != course_id {
        return Err(model_err!(
            PreconditionFailed,
            "Staged snapshot belongs to another course".to_string()
        ));
    }
    Ok(snapshot)
}
