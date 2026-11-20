//! Changesets listed with the entities they change.

use std::collections::HashMap;

use utoipa::ToSchema;

use crate::{
    agent_changeset_entities::{self, ChangesetEntitySummary},
    agent_changesets::{self, AgentChangeset},
    prelude::*,
};

/// A changeset with what it changes. While it is open and close to expiry, `is_expiring_soon` is
/// set and `entities` is what expiry would drop.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ChangesetSummary {
    pub changeset: AgentChangeset,
    pub entities: Vec<ChangesetEntitySummary>,
    pub has_risky_changes: bool,
    pub is_expiring_soon: bool,
}

/// The changesets with their entities, in the given order.
pub async fn get_summaries(
    conn: &mut PgConnection,
    changesets: Vec<AgentChangeset>,
) -> ModelResult<Vec<ChangesetSummary>> {
    let ids: Vec<Uuid> = changesets.iter().map(|changeset| changeset.id).collect();
    let mut entities_by_changeset: HashMap<Uuid, Vec<ChangesetEntitySummary>> = HashMap::new();
    for (changeset_id, entity) in
        agent_changeset_entities::get_summaries_by_changeset_ids(conn, &ids).await?
    {
        entities_by_changeset
            .entry(changeset_id)
            .or_default()
            .push(entity);
    }
    let now = Utc::now();
    Ok(changesets
        .into_iter()
        .map(|changeset| {
            let entities = entities_by_changeset
                .remove(&changeset.id)
                .unwrap_or_default();
            ChangesetSummary {
                has_risky_changes: entities.iter().any(|e| !e.risk_reasons.is_empty()),
                is_expiring_soon: changeset.is_expiring_soon(now),
                changeset,
                entities,
            }
        })
        .collect())
}

/// The user's changesets in the course with their entities, newest first.
pub async fn get_summaries_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<ChangesetSummary>> {
    let changesets = agent_changesets::get_by_user_and_course(conn, user_id, course_id).await?;
    get_summaries(conn, changesets).await
}
