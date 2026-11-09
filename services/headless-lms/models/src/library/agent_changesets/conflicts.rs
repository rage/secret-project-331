//! Staged entities whose live state changed after they were staged.

use std::collections::HashMap;

use utoipa::ToSchema;

use crate::{
    agent_changeset_entities::AgentChangesetEntity,
    entity_history,
    library::entity_snapshots::{self, EntityKey, EntityRef, EntitySnapshot},
    prelude::*,
};

/// A staged entity whose live state changed after it was staged.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PublishConflict {
    #[serde(flatten)]
    pub entity: EntityRef,
    /// When the live entity was last changed, if its history knows.
    pub last_changed_at: Option<DateTime<Utc>>,
    pub last_changed_by_user_id: Option<Uuid>,
    /// The agent client of the last change; `None` for the web UI or when unknown.
    pub last_changed_via_client: Option<String>,
}

/// The staged entities whose live state no longer matches `bases`, the states they were staged
/// on.
pub(super) async fn conflicts_of(
    conn: &mut PgConnection,
    entities: &[AgentChangesetEntity],
    bases: &HashMap<EntityKey, EntitySnapshot>,
) -> ModelResult<Vec<PublishConflict>> {
    let keys: Vec<_> = entities.iter().map(AgentChangesetEntity::key).collect();
    let mut live = entity_snapshots::load_live_many(conn, &keys).await?;
    let mut conflicts = Vec::new();
    for key in keys {
        let live = live.remove(&key).flatten();
        conflicts.extend(conflict_with_live(conn, key, bases.get(&key), live.as_ref()).await?);
    }
    Ok(conflicts)
}

/// The conflict of a staged entity whose live state, `live`, no longer matches `base`, the state
/// it was staged on; `None` if it still matches.
async fn conflict_with_live(
    conn: &mut PgConnection,
    key: EntityKey,
    base: Option<&EntitySnapshot>,
    live: Option<&EntitySnapshot>,
) -> ModelResult<Option<PublishConflict>> {
    if base == live {
        return Ok(None);
    }
    let version = entity_history::latest_version(conn, key.entity_id, None).await?;
    Ok(Some(PublishConflict {
        entity: EntityRef::of(key, live, base),
        last_changed_at: version.as_ref().map(|v| v.created_at),
        last_changed_by_user_id: version.as_ref().map(|v| v.author_user_id),
        last_changed_via_client: version.and_then(|v| v.agent_client_name),
    }))
}
