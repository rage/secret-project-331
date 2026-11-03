//! The pages and entities an agent changeset changes, with their staged snapshots.

use std::collections::HashMap;

use sqlx::types::Json;
use utoipa::ToSchema;

use crate::{
    library::entity_snapshots::{ContentEntityType, EntityKey, EntityRef, EntitySnapshot},
    prelude::*,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AgentChangesetEntityOperation {
    Create,
    Update,
    Delete,
}

impl AgentChangesetEntityOperation {
    /// The operation implied by whether the entity exists before and after. Staged rows and logged
    /// calls always have one side, so neither-side counts as an update.
    pub fn between(exists_before: bool, exists_after: bool) -> Self {
        match (exists_before, exists_after) {
            (false, true) => Self::Create,
            (true, false) => Self::Delete,
            (true, true) | (false, false) => Self::Update,
        }
    }
}

/// Why a staged change needs the user's confirmation before it is published: a rule it breaks,
/// with the facts the rule found. It belongs to the entity the change is to, so it doesn't name
/// that entity again.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum RiskReason {
    /// The page loses an exercise that has submissions.
    ExerciseWithSubmissionsRemoved { exercise_id: Uuid },
    /// The page is removed, with exercises that have submissions.
    PageWithSubmissionsRemoved,
    /// The chapter is removed, with exercises that have submissions.
    ChapterWithSubmissionsRemoved,
    /// The page is removed while students can see it.
    VisiblePageRemoved,
    /// The chapter is removed while it is open.
    OpenChapterRemoved,
    /// The open chapter's deadline moves earlier.
    DeadlineMovedEarlier {
        before: DateTime<Utc>,
        after: DateTime<Utc>,
    },
    /// The open chapter gets a deadline.
    DeadlineAddedToOpenChapter { deadline: DateTime<Utc> },
    /// The deadline that applies to the exercise on the page, open to students, moves earlier
    /// through a change to the exercise's own deadline.
    ExerciseDeadlineMovedEarlier {
        exercise_id: Uuid,
        before: DateTime<Utc>,
        after: DateTime<Utc>,
    },
    /// The exercise on the page, open to students and without a deadline so far, gets its own.
    ExerciseDeadlineAdded {
        exercise_id: Uuid,
        deadline: DateTime<Utc>,
    },
    /// The open chapter opens again only later.
    OpeningMovedLater { opens_at: DateTime<Utc> },
    /// The module's completion policy changes after students have completed it.
    CompletionPolicyChangedAfterCompletions,
    /// The number of module completions the base module requires changes after modules have
    /// completions.
    CompletionRequirementChangedAfterCompletions,
    /// Chapter locking is turned on, or off.
    ChapterLockingToggled { is_enabled: bool },
}

/// One entity of a changeset with its staged state. Its state when first staged, which only
/// publishing and the review need, is read with [`get_bases`].
#[derive(Debug, Clone, PartialEq)]
pub struct AgentChangesetEntity {
    pub entity_type: ContentEntityType,
    pub entity_id: Uuid,
    /// Whether the entity existed live when it was first staged.
    pub has_base: bool,
    /// The staged entity; `None` for deletes.
    pub after_snapshot: Option<EntitySnapshot>,
    /// See [`EntityRef::label`].
    pub label: String,
    pub risk_reasons: Vec<RiskReason>,
    /// The changeset revision of the last write to this row.
    pub revision: i32,
}

impl AgentChangesetEntity {
    /// The row's entity as a key.
    pub fn key(&self) -> EntityKey {
        EntityKey::new(self.entity_type, self.entity_id)
    }

    /// The row's entity with its label.
    pub fn entity_ref(&self) -> EntityRef {
        EntityRef {
            entity_type: self.entity_type,
            entity_id: self.entity_id,
            label: self.label.clone(),
        }
    }

    /// What publishing does to the live entity.
    pub fn operation(&self) -> AgentChangesetEntityOperation {
        AgentChangesetEntityOperation::between(self.has_base, self.after_snapshot.is_some())
    }
}

struct AgentChangesetEntityRow {
    entity_type: ContentEntityType,
    entity_id: Uuid,
    has_base: bool,
    after_snapshot: Option<String>,
    label: String,
    risk_reasons: Json<Vec<RiskReason>>,
    revision: i32,
}

impl TryFrom<AgentChangesetEntityRow> for AgentChangesetEntity {
    type Error = ModelError;

    fn try_from(row: AgentChangesetEntityRow) -> Result<Self, Self::Error> {
        Ok(Self {
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            has_base: row.has_base,
            after_snapshot: row
                .after_snapshot
                .map(|json| EntitySnapshot::from_json(row.entity_type, &json))
                .transpose()?,
            label: row.label,
            risk_reasons: row.risk_reasons.0,
            revision: row.revision,
        })
    }
}

/// An entity a changeset stages for the first time; see [`insert`].
#[derive(Debug, Clone)]
pub struct NewStagedEntity {
    pub key: EntityKey,
    /// The snapshot JSON of the live entity the stage builds on; `None` for creates.
    pub base_json: Option<String>,
    /// The staged snapshot JSON; `None` for deletes.
    pub after_json: Option<String>,
    pub label: String,
}

/// A new staged state of an entity the changeset already has; see [`restage`].
#[derive(Debug, Clone)]
pub struct RestagedEntity {
    pub key: EntityKey,
    /// The staged snapshot JSON; `None` for deletes.
    pub after_json: Option<String>,
    pub label: String,
}

/// Adds the entities to the changeset, written at `revision`. Risk reasons are left to
/// [`set_risk_reasons`].
pub async fn insert(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    revision: i32,
    entities: &[NewStagedEntity],
) -> ModelResult<()> {
    if entities.is_empty() {
        return Ok(());
    }
    let mut entity_types = Vec::with_capacity(entities.len());
    let mut entity_ids = Vec::with_capacity(entities.len());
    let mut bases = Vec::with_capacity(entities.len());
    let mut afters = Vec::with_capacity(entities.len());
    let mut labels = Vec::with_capacity(entities.len());
    for entity in entities {
        entity_types.push(entity.key.entity_type);
        entity_ids.push(entity.key.entity_id);
        bases.push(entity.base_json.as_deref());
        afters.push(entity.after_json.as_deref());
        labels.push(entity.label.as_str());
    }
    sqlx::query!(
        r#"
INSERT INTO agent_changeset_entities (
    changeset_id,
    entity_type,
    entity_id,
    base_snapshot,
    after_snapshot,
    label,
    revision
  )
SELECT $1,
  k.entity_type,
  k.entity_id,
  k.base::jsonb,
  k.after::jsonb,
  k.label,
  $2
FROM UNNEST(
    $3::content_entity_type [],
    $4::uuid [],
    $5::text [],
    $6::text [],
    $7::text []
  ) AS k(entity_type, entity_id, base, after, label)
        "#,
        changeset_id,
        revision,
        entity_types as Vec<ContentEntityType>,
        &entity_ids,
        &bases as &[Option<&str>],
        &afters as &[Option<&str>],
        &labels as &[&str],
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Replaces the staged state of entities the changeset has, written at `revision`. Each row keeps
/// its base, the live state its first stage built on. Risk reasons are left to
/// [`set_risk_reasons`].
pub async fn restage(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    revision: i32,
    entities: &[RestagedEntity],
) -> ModelResult<()> {
    if entities.is_empty() {
        return Ok(());
    }
    let mut entity_types = Vec::with_capacity(entities.len());
    let mut entity_ids = Vec::with_capacity(entities.len());
    let mut afters = Vec::with_capacity(entities.len());
    let mut labels = Vec::with_capacity(entities.len());
    for entity in entities {
        entity_types.push(entity.key.entity_type);
        entity_ids.push(entity.key.entity_id);
        afters.push(entity.after_json.as_deref());
        labels.push(entity.label.as_str());
    }
    sqlx::query!(
        r#"
UPDATE agent_changeset_entities e
SET after_snapshot = k.after::jsonb,
  label = k.label,
  revision = $2
FROM UNNEST(
    $3::content_entity_type [],
    $4::uuid [],
    $5::text [],
    $6::text []
  ) AS k(entity_type, entity_id, after, label)
WHERE e.changeset_id = $1
  AND e.entity_type = k.entity_type
  AND e.entity_id = k.entity_id
        "#,
        changeset_id,
        revision,
        entity_types as Vec<ContentEntityType>,
        &entity_ids,
        &afters as &[Option<&str>],
        &labels as &[&str],
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Replaces the risk reasons of staged entities, leaving their staged state and revision as they
/// are.
pub async fn set_risk_reasons(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    reasons: &[(EntityKey, &[RiskReason])],
) -> ModelResult<()> {
    if reasons.is_empty() {
        return Ok(());
    }
    let mut entity_types = Vec::with_capacity(reasons.len());
    let mut entity_ids = Vec::with_capacity(reasons.len());
    let mut values = Vec::with_capacity(reasons.len());
    for (
        EntityKey {
            entity_type,
            entity_id,
        },
        entity_reasons,
    ) in reasons
    {
        entity_types.push(*entity_type);
        entity_ids.push(*entity_id);
        values.push(serde_json::to_value(entity_reasons)?);
    }
    sqlx::query!(
        r#"
UPDATE agent_changeset_entities e
SET risk_reasons = k.risk_reasons
FROM UNNEST($2::content_entity_type [], $3::uuid [], $4::jsonb []) AS k(entity_type, entity_id, risk_reasons)
WHERE e.changeset_id = $1
  AND e.entity_type = k.entity_type
  AND e.entity_id = k.entity_id
        "#,
        changeset_id,
        entity_types as Vec<ContentEntityType>,
        &entity_ids,
        &values,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Removes the entities from the changeset.
pub async fn delete(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    keys: &[EntityKey],
) -> ModelResult<()> {
    if keys.is_empty() {
        return Ok(());
    }
    let (entity_types, entity_ids) = EntityKey::unzip(keys);
    sqlx::query!(
        r#"
DELETE FROM agent_changeset_entities e USING UNNEST($2::content_entity_type [], $3::uuid []) AS k(entity_type, entity_id)
WHERE e.changeset_id = $1
  AND e.entity_type = k.entity_type
  AND e.entity_id = k.entity_id
        "#,
        changeset_id,
        entity_types as Vec<ContentEntityType>,
        &entity_ids,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// All staged rows of the changeset, oldest first.
pub async fn get_by_changeset_id(
    conn: &mut PgConnection,
    changeset_id: Uuid,
) -> ModelResult<Vec<AgentChangesetEntity>> {
    let rows = sqlx::query_as!(
        AgentChangesetEntityRow,
        r#"
SELECT entity_type,
  entity_id,
  base_snapshot IS NOT NULL AS "has_base!",
  after_snapshot::text AS "after_snapshot?",
  label,
  risk_reasons,
  revision
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

/// The changeset's rows for the given entities; entities it doesn't have are left out.
pub async fn get_by_keys(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    keys: &[EntityKey],
) -> ModelResult<Vec<AgentChangesetEntity>> {
    let (entity_types, entity_ids) = EntityKey::unzip(keys);
    let rows = sqlx::query_as!(
        AgentChangesetEntityRow,
        r#"
SELECT e.entity_type,
  e.entity_id,
  e.base_snapshot IS NOT NULL AS "has_base!",
  e.after_snapshot::text AS "after_snapshot?",
  e.label,
  e.risk_reasons,
  e.revision
FROM agent_changeset_entities e
  JOIN UNNEST($2::content_entity_type [], $3::uuid []) AS k(entity_type, entity_id)
    ON k.entity_type = e.entity_type
    AND k.entity_id = e.entity_id
WHERE e.changeset_id = $1
        "#,
        changeset_id,
        entity_types as Vec<ContentEntityType>,
        &entity_ids,
    )
    .fetch_all(conn)
    .await?;
    rows.into_iter().map(TryInto::try_into).collect()
}

/// The changeset's row for the entity; `None` if it doesn't stage it. See [`get_by_keys`].
pub async fn get_one(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    key: EntityKey,
) -> ModelResult<Option<AgentChangesetEntity>> {
    Ok(get_by_keys(conn, changeset_id, &[key]).await?.pop())
}

/// What publishing the changeset would do to the entity; `None` if the changeset doesn't stage
/// it.
pub async fn get_operation(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    EntityKey {
        entity_type,
        entity_id,
    }: EntityKey,
) -> ModelResult<Option<AgentChangesetEntityOperation>> {
    let row = sqlx::query!(
        r#"
SELECT base_snapshot IS NOT NULL AS "has_base!",
  after_snapshot IS NOT NULL AS "has_after!"
FROM agent_changeset_entities
WHERE changeset_id = $1
  AND entity_type = $2
  AND entity_id = $3
        "#,
        changeset_id,
        entity_type as ContentEntityType,
        entity_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(row.map(|row| AgentChangesetEntityOperation::between(row.has_base, row.has_after)))
}

/// The live state each of the given entities had when the changeset first staged it, by key;
/// creates and entities the changeset doesn't have are left out.
pub async fn get_bases(
    conn: &mut PgConnection,
    changeset_id: Uuid,
    keys: &[EntityKey],
) -> ModelResult<HashMap<EntityKey, EntitySnapshot>> {
    if keys.is_empty() {
        return Ok(HashMap::new());
    }
    let (entity_types, entity_ids) = EntityKey::unzip(keys);
    let rows = sqlx::query!(
        r#"
SELECT e.entity_type,
  e.entity_id,
  e.base_snapshot::text AS "base_snapshot!"
FROM agent_changeset_entities e
  JOIN UNNEST($2::content_entity_type [], $3::uuid []) AS k(entity_type, entity_id)
    ON k.entity_type = e.entity_type
    AND k.entity_id = e.entity_id
WHERE e.changeset_id = $1
  AND e.base_snapshot IS NOT NULL
        "#,
        changeset_id,
        entity_types as Vec<ContentEntityType>,
        &entity_ids,
    )
    .fetch_all(conn)
    .await?;
    rows.into_iter()
        .map(|row| {
            let snapshot = EntitySnapshot::from_json(row.entity_type, &row.base_snapshot)?;
            Ok((EntityKey::new(row.entity_type, row.entity_id), snapshot))
        })
        .collect()
}

/// One entity of a changeset, as listings and expiry warnings describe it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ChangesetEntitySummary {
    #[serde(flatten)]
    pub entity: EntityRef,
    pub operation: AgentChangesetEntityOperation,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub risk_reasons: Vec<RiskReason>,
}

impl From<&AgentChangesetEntity> for ChangesetEntitySummary {
    fn from(entity: &AgentChangesetEntity) -> Self {
        Self {
            entity: entity.entity_ref(),
            operation: entity.operation(),
            risk_reasons: entity.risk_reasons.clone(),
        }
    }
}

/// Every entity of the changesets as listings describe it, with the id of its changeset, oldest
/// first.
pub async fn get_summaries_by_changeset_ids(
    conn: &mut PgConnection,
    changeset_ids: &[Uuid],
) -> ModelResult<Vec<(Uuid, ChangesetEntitySummary)>> {
    let rows = sqlx::query!(
        r#"
SELECT changeset_id,
  entity_type,
  entity_id,
  base_snapshot IS NOT NULL AS "has_base!",
  after_snapshot IS NOT NULL AS "has_after!",
  label,
  risk_reasons
FROM agent_changeset_entities
WHERE changeset_id = ANY($1)
ORDER BY created_at,
  id
        "#,
        changeset_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            let summary = ChangesetEntitySummary {
                entity: EntityRef {
                    entity_type: row.entity_type,
                    entity_id: row.entity_id,
                    label: row.label,
                },
                operation: AgentChangesetEntityOperation::between(row.has_base, row.has_after),
                risk_reasons: row.risk_reasons.0,
            };
            (row.changeset_id, summary)
        })
        .collect())
}
