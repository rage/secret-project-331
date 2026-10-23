//! Staging, publishing and reverting AI agent changes to course content.
//!
//! Every agent write is staged into the user's open changeset for the course (see
//! [`stage_call`]); reads of the staged state overlay the changeset on the live content (see
//! [`load_current`]); [`publish`] writes the changeset through the web UI's save paths.

pub mod preview;
pub mod publishing;
pub mod reverting;
pub mod staging;

pub use preview::{
    PREVIEW_TOKEN_LIFETIME_MINUTES, PagePreview, PreviewClaim, mint_preview_token, resolve_preview,
    validate_preview_token,
};
pub use publishing::{
    CreatedRedirect, PublishConflict, PublishOptions, PublishOutcome, PublishRejection,
    RiskyEntity, entity_label, find_conflicts, publish,
};
pub use reverting::{RevertConflict, RevertPlan, plan_revert};
pub use staging::{StageCall, StageCallResult, StagedEntity, stage_call};

use utoipa::ToSchema;

use crate::{
    agent_changeset_calls::{self, AgentChangesetCall},
    agent_changeset_entities::{
        self, AgentChangesetEntity, AgentChangesetEntityOperation, AgentChangesetEntityType,
        RiskReason,
    },
    agent_changesets::{self, AgentChangeset},
    library::entity_snapshots::{self, EntitySnapshot},
    prelude::*,
};

/// The entity as the user sees it: staged in their open changeset for the course if it is there,
/// live otherwise. `None` if it does not exist or the changeset deletes it.
pub async fn load_current(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    entity_type: AgentChangesetEntityType,
    entity_id: Uuid,
) -> ModelResult<Option<EntitySnapshot>> {
    if let Some(changeset) = agent_changesets::get_open(conn, user_id, course_id).await?
        && let Some(entity) =
            agent_changeset_entities::get_one(conn, changeset.id, entity_type, entity_id).await?
    {
        return entity
            .after_snapshot
            .as_ref()
            .map(|value| EntitySnapshot::from_value(entity_type, value))
            .transpose();
    }
    entity_snapshots::load_live(conn, entity_type, entity_id).await
}

/// One entity of a changeset, as listings and expiry warnings describe it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ChangesetEntitySummary {
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    pub operation: AgentChangesetEntityOperation,
    pub label: String,
    pub risk_reasons: Vec<RiskReason>,
}

impl From<&AgentChangesetEntity> for ChangesetEntitySummary {
    fn from(entity: &AgentChangesetEntity) -> Self {
        Self {
            entity_type: entity.entity_type,
            entity_id: entity.entity_id,
            operation: entity.operation,
            label: entity_label(entity),
            risk_reasons: entity.risk_reasons.clone(),
        }
    }
}

/// A changeset with what it changes. While it is open and close to expiry, `is_expiring_soon` is
/// set and `entities` is what expiry would drop.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ChangesetSummary {
    pub changeset: AgentChangeset,
    pub entities: Vec<ChangesetEntitySummary>,
    pub has_risky_changes: bool,
    pub is_expiring_soon: bool,
}

pub async fn get_summary(
    conn: &mut PgConnection,
    changeset: AgentChangeset,
) -> ModelResult<ChangesetSummary> {
    let entities: Vec<ChangesetEntitySummary> =
        agent_changeset_entities::get_by_changeset_id(conn, changeset.id)
            .await?
            .iter()
            .map(ChangesetEntitySummary::from)
            .collect();
    Ok(ChangesetSummary {
        has_risky_changes: entities.iter().any(|e| !e.risk_reasons.is_empty()),
        is_expiring_soon: changeset.is_expiring_soon(Utc::now()),
        changeset,
        entities,
    })
}

/// The user's changesets with their entities, newest first; all courses when `course_id` is
/// `None`.
pub async fn get_summaries_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Option<Uuid>,
) -> ModelResult<Vec<ChangesetSummary>> {
    let changesets = agent_changesets::get_by_user(conn, user_id, course_id).await?;
    let mut summaries = Vec::with_capacity(changesets.len());
    for changeset in changesets {
        summaries.push(get_summary(conn, changeset).await?);
    }
    Ok(summaries)
}

/// One entity on the review page: its base, staged and current live state, so the page can render
/// the diff and flag conflicts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ReviewEntity {
    pub entity: AgentChangesetEntity,
    pub label: String,
    /// The live entity now; `None` if it does not exist.
    pub live_snapshot: Option<serde_json::Value>,
    /// Whether the live entity changed after it was staged, which blocks publishing.
    pub has_conflict: bool,
}

/// Everything the review page shows for a changeset.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ChangesetReview {
    pub changeset: AgentChangeset,
    pub entities: Vec<ReviewEntity>,
    /// The agent calls that staged the changes, oldest first.
    pub calls: Vec<AgentChangesetCall>,
    pub conflicts: Vec<PublishConflict>,
    pub has_risky_changes: bool,
    pub is_expiring_soon: bool,
}

pub async fn get_review(
    conn: &mut PgConnection,
    changeset: AgentChangeset,
) -> ModelResult<ChangesetReview> {
    let entities = agent_changeset_entities::get_by_changeset_id(conn, changeset.id).await?;
    let conflicts = if changeset.is_open() {
        find_conflicts(conn, changeset.id).await?
    } else {
        vec![]
    };
    let mut review_entities = Vec::with_capacity(entities.len());
    for entity in entities {
        let live = entity_snapshots::load_live(conn, entity.entity_type, entity.entity_id).await?;
        review_entities.push(ReviewEntity {
            label: entity_label(&entity),
            live_snapshot: live.as_ref().map(EntitySnapshot::to_value).transpose()?,
            has_conflict: conflicts
                .iter()
                .any(|c| c.entity_type == entity.entity_type && c.entity_id == entity.entity_id),
            entity,
        });
    }
    let calls = agent_changeset_calls::get_by_changeset_id(conn, changeset.id).await?;
    Ok(ChangesetReview {
        has_risky_changes: review_entities.iter().any(|e| e.entity.is_risky()),
        is_expiring_soon: changeset.is_expiring_soon(Utc::now()),
        changeset,
        entities: review_entities,
        calls,
        conflicts,
    })
}

/// The user's open changeset that changes the page, if any.
pub async fn get_open_changeset_changing_page(
    conn: &mut PgConnection,
    user_id: Uuid,
    page_id: Uuid,
) -> ModelResult<Option<AgentChangeset>> {
    let changeset_id = sqlx::query_scalar!(
        r#"
SELECT cs.id
FROM agent_changesets cs
  JOIN agent_changeset_entities e ON e.changeset_id = cs.id
WHERE cs.user_id = $1
  AND cs.status = 'open'
  AND cs.deleted_at IS NULL
  AND e.entity_type = 'page'
  AND e.entity_id = $2
        "#,
        user_id,
        page_id,
    )
    .fetch_optional(&mut *conn)
    .await?;
    match changeset_id {
        Some(id) => Ok(Some(agent_changesets::get_by_id(conn, id).await?)),
        None => Ok(None),
    }
}
