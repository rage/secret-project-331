//! Audit log of agent write calls. A call is also the unit an agent reverts.

use std::collections::HashMap;

use utoipa::ToSchema;

use crate::{
    agent_changeset_entities::AgentChangesetEntityOperation,
    agent_changesets::AgentChangesetStatus,
    library::entity_snapshots::{ContentEntityType, EntityKey, EntityRef, EntitySnapshot},
    prelude::*,
};

/// One entity a call touched, as the audit log records it; see [`insert`].
#[derive(Debug, Clone, PartialEq)]
pub struct NewEntityChange {
    pub key: EntityKey,
    /// See [`EntityRef::label`]; of the entity after the call, or before it for deletes.
    pub label: String,
    /// The entity's snapshot JSON just before the call; `None` when it did not exist.
    pub before_json: Option<String>,
    /// [`EntitySnapshot::digest`] of the entity just after the call; `None` when the call deleted
    /// it.
    pub after_digest: Option<String>,
}

/// One entity a call touched, as reverting the call needs it.
#[derive(Debug, Clone, PartialEq)]
pub struct EntityChange {
    pub entity_type: ContentEntityType,
    pub entity_id: Uuid,
    pub label: String,
    /// `None` when the entity did not exist before the call.
    pub before: Option<EntitySnapshot>,
    /// [`EntitySnapshot::digest`] of the entity just after the call; `None` when the call deleted
    /// it.
    pub after_digest: Option<String>,
}

/// A call as reverting it needs it.
#[derive(Debug, Clone, PartialEq)]
pub struct AgentChangesetCall {
    pub id: Uuid,
    pub changeset_id: Uuid,
    pub tool_name: String,
    pub entity_changes: Vec<EntityChange>,
}

/// Who made a call: the user and the agent client acting for them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CallActor {
    pub user_id: Uuid,
    pub oauth_client_id: Uuid,
    pub oauth_grant_id: Uuid,
    pub client_name: String,
}

/// A call to record with [`insert`].
#[derive(Debug, Clone)]
pub struct NewAgentChangesetCall<'a> {
    pub changeset_id: Uuid,
    pub actor: &'a CallActor,
    pub tool_name: &'a str,
    pub ops: &'a serde_json::Value,
    pub summary: Option<&'a str>,
    pub entity_changes: &'a [NewEntityChange],
    pub revert_of_call_id: Option<Uuid>,
}

/// Records the call and the entities it touched, and returns its id.
pub async fn insert(conn: &mut PgConnection, call: NewAgentChangesetCall<'_>) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO agent_changeset_calls (
    changeset_id,
    oauth_client_id,
    oauth_grant_id,
    client_name,
    tool_name,
    ops,
    summary,
    revert_of_call_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id
        "#,
        call.changeset_id,
        call.actor.oauth_client_id,
        call.actor.oauth_grant_id,
        call.actor.client_name,
        call.tool_name,
        call.ops,
        call.summary,
        call.revert_of_call_id,
    )
    .fetch_one(&mut *conn)
    .await?;
    let mut entity_types = Vec::with_capacity(call.entity_changes.len());
    let mut entity_ids = Vec::with_capacity(call.entity_changes.len());
    let mut labels = Vec::with_capacity(call.entity_changes.len());
    let mut befores = Vec::with_capacity(call.entity_changes.len());
    let mut after_digests = Vec::with_capacity(call.entity_changes.len());
    for change in call.entity_changes {
        entity_types.push(change.key.entity_type);
        entity_ids.push(change.key.entity_id);
        labels.push(change.label.as_str());
        befores.push(change.before_json.as_deref());
        after_digests.push(change.after_digest.as_deref());
    }
    sqlx::query!(
        r#"
INSERT INTO agent_changeset_call_entities (
    call_id,
    entity_type,
    entity_id,
    label,
    before_snapshot,
    after_digest
  )
SELECT $1,
  k.entity_type,
  k.entity_id,
  k.label,
  k.before::jsonb,
  k.after_digest
FROM UNNEST(
    $2::content_entity_type [],
    $3::uuid [],
    $4::text [],
    $5::text [],
    $6::text []
  ) AS k(entity_type, entity_id, label, before, after_digest)
        "#,
        id,
        entity_types as Vec<ContentEntityType>,
        &entity_ids,
        &labels as &[&str],
        &befores as &[Option<&str>],
        &after_digests as &[Option<&str>],
    )
    .execute(conn)
    .await?;
    Ok(id)
}

/// The call with the entities it touched.
pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<AgentChangesetCall> {
    let call = sqlx::query!(
        r#"
SELECT id,
  changeset_id,
  tool_name
FROM agent_changeset_calls
WHERE id = $1
        "#,
        id,
    )
    .fetch_one(&mut *conn)
    .await?;
    let entity_changes = sqlx::query!(
        r#"
SELECT entity_type,
  entity_id,
  label,
  before_snapshot::text AS "before_snapshot?",
  after_digest
FROM agent_changeset_call_entities
WHERE call_id = $1
        "#,
        id,
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|row| {
        Ok(EntityChange {
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            label: row.label,
            before: row
                .before_snapshot
                .map(|json| EntitySnapshot::from_json(row.entity_type, &json))
                .transpose()?,
            after_digest: row.after_digest,
        })
    })
    .collect::<ModelResult<_>>()?;
    Ok(AgentChangesetCall {
        id: call.id,
        changeset_id: call.changeset_id,
        tool_name: call.tool_name,
        entity_changes,
    })
}

/// The latest call of the changeset that touched each of its entities, by entity.
pub async fn get_latest_by_entity(
    conn: &mut PgConnection,
    changeset_id: Uuid,
) -> ModelResult<HashMap<EntityKey, Uuid>> {
    let rows = sqlx::query!(
        r#"
SELECT DISTINCT ON (ce.entity_type, ce.entity_id) ce.entity_type,
  ce.entity_id,
  ce.call_id
FROM agent_changeset_call_entities ce
  JOIN agent_changeset_calls c ON c.id = ce.call_id
WHERE c.changeset_id = $1
ORDER BY ce.entity_type,
  ce.entity_id,
  c.created_at DESC,
  c.id DESC
        "#,
        changeset_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (EntityKey::new(row.entity_type, row.entity_id), row.call_id))
        .collect())
}

/// A call as the review page lists it, without its operations and snapshots.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct AgentChangesetCallSummary {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub client_name: String,
    pub tool_name: String,
    pub summary: Option<String>,
    pub revert_of_call_id: Option<Uuid>,
}

/// The changeset's calls, oldest first.
pub async fn get_summaries_by_changeset_id(
    conn: &mut PgConnection,
    changeset_id: Uuid,
) -> ModelResult<Vec<AgentChangesetCallSummary>> {
    let res = sqlx::query_as!(
        AgentChangesetCallSummary,
        r#"
SELECT id,
  created_at,
  client_name,
  tool_name,
  summary,
  revert_of_call_id
FROM agent_changeset_calls
WHERE changeset_id = $1
ORDER BY created_at,
  id
        "#,
        changeset_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// An entity a call touched, labelled from its snapshot after the call (before it, for deletes).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CallHistoryEntity {
    #[serde(flatten)]
    pub entity: EntityRef,
    pub operation: AgentChangesetEntityOperation,
}

/// One call in the user's agent history of a course.
#[derive(Debug, Clone, PartialEq)]
pub struct CallHistoryEntry {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub changeset_id: Uuid,
    pub changeset_status: AgentChangesetStatus,
    pub client_name: String,
    pub tool_name: String,
    pub summary: Option<String>,
    pub revert_of_call_id: Option<Uuid>,
    pub entities: Vec<CallHistoryEntity>,
}

/// The user's most recent calls in a course, newest first; only the calls that touched
/// `entity_id` when it is given.
pub async fn get_history(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    entity_id: Option<Uuid>,
    limit: i64,
) -> ModelResult<Vec<CallHistoryEntry>> {
    let calls = sqlx::query!(
        r#"
SELECT c.id,
  c.created_at,
  c.changeset_id,
  agent_changeset_current_status(cs.status, cs.expires_at) AS "changeset_status!",
  c.client_name,
  c.tool_name,
  c.summary,
  c.revert_of_call_id
FROM agent_changeset_calls c
  JOIN agent_changesets cs ON cs.id = c.changeset_id
WHERE cs.user_id = $1
  AND cs.course_id = $2
  AND (
    $3::uuid IS NULL
    OR EXISTS (
      SELECT 1
      FROM agent_changeset_call_entities ce
      WHERE ce.call_id = c.id
        AND ce.entity_id = $3
    )
  )
ORDER BY c.created_at DESC,
  c.id
LIMIT $4
        "#,
        user_id,
        course_id,
        entity_id,
        limit,
    )
    .fetch_all(&mut *conn)
    .await?;
    let call_ids: Vec<Uuid> = calls.iter().map(|call| call.id).collect();
    let mut entities_by_call: HashMap<Uuid, Vec<CallHistoryEntity>> = HashMap::new();
    for row in sqlx::query!(
        r#"
SELECT call_id,
  entity_type,
  entity_id,
  label,
  before_snapshot IS NOT NULL AS "has_before!",
  after_digest IS NOT NULL AS "has_after!"
FROM agent_changeset_call_entities
WHERE call_id = ANY($1)
ORDER BY entity_type,
  label,
  entity_id
        "#,
        &call_ids,
    )
    .fetch_all(conn)
    .await?
    {
        entities_by_call
            .entry(row.call_id)
            .or_default()
            .push(CallHistoryEntity {
                entity: EntityRef {
                    entity_type: row.entity_type,
                    entity_id: row.entity_id,
                    label: row.label,
                },
                operation: AgentChangesetEntityOperation::between(row.has_before, row.has_after),
            });
    }
    Ok(calls
        .into_iter()
        .map(|call| CallHistoryEntry {
            entities: entities_by_call.remove(&call.id).unwrap_or_default(),
            id: call.id,
            created_at: call.created_at,
            changeset_id: call.changeset_id,
            changeset_status: call.changeset_status,
            client_name: call.client_name,
            tool_name: call.tool_name,
            summary: call.summary,
            revert_of_call_id: call.revert_of_call_id,
        })
        .collect())
}
