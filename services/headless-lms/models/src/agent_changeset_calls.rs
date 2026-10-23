//! Audit log of agent write calls. A call is also the unit an agent reverts.

use utoipa::ToSchema;

use crate::{
    agent_changeset_entities::{AgentChangesetEntityOperation, AgentChangesetEntityType},
    prelude::*,
};

/// One entity a call touched, with its full snapshot just before and just after the call.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct EntityChange {
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    pub operation: AgentChangesetEntityOperation,
    /// `None` when the entity did not exist before the call.
    pub before: Option<serde_json::Value>,
    /// `None` when the call deleted the entity.
    pub after: Option<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct AgentChangesetCall {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub changeset_id: Uuid,
    pub user_id: Uuid,
    pub oauth_client_id: Option<Uuid>,
    pub oauth_grant_id: Option<Uuid>,
    pub client_name: String,
    pub tool_name: String,
    pub ops: serde_json::Value,
    pub summary: Option<String>,
    pub entity_changes: Vec<EntityChange>,
    pub revert_of_call_id: Option<Uuid>,
}

struct AgentChangesetCallRow {
    id: Uuid,
    created_at: DateTime<Utc>,
    changeset_id: Uuid,
    user_id: Uuid,
    oauth_client_id: Option<Uuid>,
    oauth_grant_id: Option<Uuid>,
    client_name: String,
    tool_name: String,
    ops: serde_json::Value,
    summary: Option<String>,
    entity_changes: serde_json::Value,
    revert_of_call_id: Option<Uuid>,
}

impl TryFrom<AgentChangesetCallRow> for AgentChangesetCall {
    type Error = ModelError;

    fn try_from(row: AgentChangesetCallRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            created_at: row.created_at,
            changeset_id: row.changeset_id,
            user_id: row.user_id,
            oauth_client_id: row.oauth_client_id,
            oauth_grant_id: row.oauth_grant_id,
            client_name: row.client_name,
            tool_name: row.tool_name,
            ops: row.ops,
            summary: row.summary,
            entity_changes: serde_json::from_value(row.entity_changes)?,
            revert_of_call_id: row.revert_of_call_id,
        })
    }
}

/// Who made a call: the user and the agent client acting for them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CallActor {
    pub user_id: Uuid,
    pub oauth_client_id: Option<Uuid>,
    pub oauth_grant_id: Option<Uuid>,
    pub client_name: String,
}

#[derive(Debug, Clone)]
pub struct NewAgentChangesetCall<'a> {
    pub changeset_id: Uuid,
    pub actor: &'a CallActor,
    pub tool_name: &'a str,
    pub ops: &'a serde_json::Value,
    pub summary: Option<&'a str>,
    pub entity_changes: &'a [EntityChange],
    pub revert_of_call_id: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    call: NewAgentChangesetCall<'_>,
) -> ModelResult<AgentChangesetCall> {
    let row = sqlx::query_as!(
        AgentChangesetCallRow,
        r#"
INSERT INTO agent_changeset_calls (
    changeset_id,
    user_id,
    oauth_client_id,
    oauth_grant_id,
    client_name,
    tool_name,
    ops,
    summary,
    entity_changes,
    revert_of_call_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id,
  created_at,
  changeset_id,
  user_id,
  oauth_client_id,
  oauth_grant_id,
  client_name,
  tool_name,
  ops,
  summary,
  entity_changes,
  revert_of_call_id
        "#,
        call.changeset_id,
        call.actor.user_id,
        call.actor.oauth_client_id,
        call.actor.oauth_grant_id,
        call.actor.client_name,
        call.tool_name,
        call.ops,
        call.summary,
        serde_json::to_value(call.entity_changes)?,
        call.revert_of_call_id,
    )
    .fetch_one(conn)
    .await?;
    row.try_into()
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<AgentChangesetCall> {
    let row = sqlx::query_as!(
        AgentChangesetCallRow,
        r#"
SELECT id,
  created_at,
  changeset_id,
  user_id,
  oauth_client_id,
  oauth_grant_id,
  client_name,
  tool_name,
  ops,
  summary,
  entity_changes,
  revert_of_call_id
FROM agent_changeset_calls
WHERE id = $1
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    row.try_into()
}

/// The changeset's calls, oldest first.
pub async fn get_by_changeset_id(
    conn: &mut PgConnection,
    changeset_id: Uuid,
) -> ModelResult<Vec<AgentChangesetCall>> {
    let rows = sqlx::query_as!(
        AgentChangesetCallRow,
        r#"
SELECT id,
  created_at,
  changeset_id,
  user_id,
  oauth_client_id,
  oauth_grant_id,
  client_name,
  tool_name,
  ops,
  summary,
  entity_changes,
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
    rows.into_iter().map(TryInto::try_into).collect()
}

/// The user's most recent calls in a course, newest first, for reading agent history.
pub async fn get_recent_by_user_and_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    limit: i64,
) -> ModelResult<Vec<AgentChangesetCall>> {
    let rows = sqlx::query_as!(
        AgentChangesetCallRow,
        r#"
SELECT c.id,
  c.created_at,
  c.changeset_id,
  c.user_id,
  c.oauth_client_id,
  c.oauth_grant_id,
  c.client_name,
  c.tool_name,
  c.ops,
  c.summary,
  c.entity_changes,
  c.revert_of_call_id
FROM agent_changeset_calls c
  JOIN agent_changesets cs ON cs.id = c.changeset_id
WHERE c.user_id = $1
  AND cs.course_id = $2
  AND cs.deleted_at IS NULL
ORDER BY c.created_at DESC,
  c.id
LIMIT $3
        "#,
        user_id,
        course_id,
        limit,
    )
    .fetch_all(conn)
    .await?;
    rows.into_iter().map(TryInto::try_into).collect()
}
