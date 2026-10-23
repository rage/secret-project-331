//! The pages and entities an agent changeset changes, with their staged snapshots.

use utoipa::ToSchema;

use crate::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type, ToSchema)]
#[sqlx(type_name = "agent_changeset_entity_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AgentChangesetEntityType {
    Page,
    Chapter,
    Module,
    CourseSettings,
    GlossaryTerm,
    Reference,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, ToSchema)]
#[sqlx(
    type_name = "agent_changeset_entity_operation",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum AgentChangesetEntityOperation {
    Create,
    Update,
    Delete,
}

impl AgentChangesetEntityOperation {
    /// The operation that turns `base` into `after`, or `None` when neither exists.
    pub fn between<T>(base: Option<&T>, after: Option<&T>) -> Option<Self> {
        match (base, after) {
            (None, Some(_)) => Some(Self::Create),
            (Some(_), Some(_)) => Some(Self::Update),
            (Some(_), None) => Some(Self::Delete),
            (None, None) => None,
        }
    }
}

/// Why a staged change needs the user's confirmation before it is published.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct RiskReason {
    /// Stable machine-readable identifier of the rule, e.g. `exercise_with_submissions_removed`.
    pub code: String,
    pub message: String,
    /// What happens to students if the change is published.
    pub consequence: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct AgentChangesetEntity {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub changeset_id: Uuid,
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    pub operation: AgentChangesetEntityOperation,
    /// The live entity when it was first staged; `None` for creates.
    pub base_snapshot: Option<serde_json::Value>,
    /// The staged entity; `None` for deletes.
    pub after_snapshot: Option<serde_json::Value>,
    pub base_version_id: Option<Uuid>,
    pub risk_reasons: Vec<RiskReason>,
}

impl AgentChangesetEntity {
    pub fn is_risky(&self) -> bool {
        !self.risk_reasons.is_empty()
    }
}

struct AgentChangesetEntityRow {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    changeset_id: Uuid,
    entity_type: AgentChangesetEntityType,
    entity_id: Uuid,
    operation: AgentChangesetEntityOperation,
    base_snapshot: Option<serde_json::Value>,
    after_snapshot: Option<serde_json::Value>,
    base_version_id: Option<Uuid>,
    risk_reasons: serde_json::Value,
}

impl TryFrom<AgentChangesetEntityRow> for AgentChangesetEntity {
    type Error = ModelError;

    fn try_from(row: AgentChangesetEntityRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            changeset_id: row.changeset_id,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            operation: row.operation,
            base_snapshot: row.base_snapshot,
            after_snapshot: row.after_snapshot,
            base_version_id: row.base_version_id,
            risk_reasons: serde_json::from_value(row.risk_reasons)?,
        })
    }
}

/// A staged row to write; see [`upsert`].
#[derive(Debug, Clone)]
pub struct EntityUpsert<'a> {
    pub changeset_id: Uuid,
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    pub operation: AgentChangesetEntityOperation,
    pub base_snapshot: Option<&'a serde_json::Value>,
    pub after_snapshot: Option<&'a serde_json::Value>,
    pub base_version_id: Option<Uuid>,
    pub risk_reasons: &'a [RiskReason],
}

/// Inserts the entity row, or replaces the staged state of an existing one. The base snapshot and
/// base version of an existing row are kept: they describe the live state the first stage built on.
pub async fn upsert(
    conn: &mut PgConnection,
    entity: EntityUpsert<'_>,
) -> ModelResult<AgentChangesetEntity> {
    let row = sqlx::query_as!(
        AgentChangesetEntityRow,
        r#"
INSERT INTO agent_changeset_entities (
    changeset_id,
    entity_type,
    entity_id,
    operation,
    base_snapshot,
    after_snapshot,
    base_version_id,
    risk_reasons
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (changeset_id, entity_type, entity_id) DO
UPDATE
SET operation = EXCLUDED.operation,
  after_snapshot = EXCLUDED.after_snapshot,
  risk_reasons = EXCLUDED.risk_reasons
RETURNING id,
  created_at,
  updated_at,
  changeset_id,
  entity_type AS "entity_type: AgentChangesetEntityType",
  entity_id,
  operation AS "operation: AgentChangesetEntityOperation",
  base_snapshot,
  after_snapshot,
  base_version_id,
  risk_reasons
        "#,
        entity.changeset_id,
        entity.entity_type as AgentChangesetEntityType,
        entity.entity_id,
        entity.operation as AgentChangesetEntityOperation,
        entity.base_snapshot,
        entity.after_snapshot,
        entity.base_version_id,
        serde_json::to_value(entity.risk_reasons)?,
    )
    .fetch_one(conn)
    .await?;
    row.try_into()
}

/// Removes the entity from the changeset, for a staged state that is back to its base.
pub async fn delete(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    entity_type: AgentChangesetEntityType,
    entity_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
DELETE FROM agent_changeset_entities
WHERE changeset_id = $1
  AND entity_type = $2
  AND entity_id = $3
        "#,
        changeset_id,
        entity_type as AgentChangesetEntityType,
        entity_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_by_changeset_id(
    conn: &mut PgConnection,
    changeset_id: Uuid,
) -> ModelResult<Vec<AgentChangesetEntity>> {
    let rows = sqlx::query_as!(
        AgentChangesetEntityRow,
        r#"
SELECT id,
  created_at,
  updated_at,
  changeset_id,
  entity_type AS "entity_type: AgentChangesetEntityType",
  entity_id,
  operation AS "operation: AgentChangesetEntityOperation",
  base_snapshot,
  after_snapshot,
  base_version_id,
  risk_reasons
FROM agent_changeset_entities
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

pub async fn get_one(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    entity_type: AgentChangesetEntityType,
    entity_id: Uuid,
) -> ModelResult<Option<AgentChangesetEntity>> {
    let row = sqlx::query_as!(
        AgentChangesetEntityRow,
        r#"
SELECT id,
  created_at,
  updated_at,
  changeset_id,
  entity_type AS "entity_type: AgentChangesetEntityType",
  entity_id,
  operation AS "operation: AgentChangesetEntityOperation",
  base_snapshot,
  after_snapshot,
  base_version_id,
  risk_reasons
FROM agent_changeset_entities
WHERE changeset_id = $1
  AND entity_type = $2
  AND entity_id = $3
        "#,
        changeset_id,
        entity_type as AgentChangesetEntityType,
        entity_id,
    )
    .fetch_optional(conn)
    .await?;
    row.map(TryInto::try_into).transpose()
}
