use std::collections::HashMap;

use crate::{
    agent_changeset_calls, agent_changesets,
    library::{
        agent_changesets::{course_state::CourseView, staging::StagedEntity},
        entity_snapshots::{ContentEntityType, EntityKey, EntityRef, EntitySnapshot},
    },
    prelude::*,
};

#[derive(Debug, Clone)]
pub enum RevertPlan {
    /// Stage these with [`super::stage_call`] (with `revert_of_call_id` set) to revert the call.
    Ready {
        /// The tool the reverted call was made with.
        tool_name: String,
        entities: Vec<StagedEntity>,
        /// The state each entity has now, staged or live, which the revert builds on.
        current: HashMap<EntityKey, Option<EntitySnapshot>>,
    },
    /// Entities that changed again after the call; nothing can be reverted.
    Conflicts(Vec<EntityRef>),
}

/// Works out how to revert one of the user's agent write calls in the course: every entity it
/// touched goes back to its state just before the call. The revert is a new change staged in the
/// user's open changeset, so it goes through the normal risk rules and publishing.
///
/// The current state is the user's staged state in `view`, which must hold every part of the
/// course. If any entity's current state is not what the call left behind, the plan lists those
/// entities instead. Errors with `NotFound` if the call is not the user's or not in the course.
pub async fn plan_revert(
    conn: &mut PgConnection,
    view: &CourseView,
    call_id: Uuid,
    user_id: Uuid,
) -> ModelResult<RevertPlan> {
    let call = agent_changeset_calls::get_by_id(conn, call_id).await?;
    let changeset = agent_changesets::get_by_id_for_user(conn, call.changeset_id, user_id).await?;
    if changeset.course_id != view.course.id {
        return Err(model_err!(NotFound, "No such call".to_string()));
    }
    let page_ids: Vec<Uuid> = call
        .entity_changes
        .iter()
        .filter(|change| change.entity_type == ContentEntityType::Page)
        .map(|change| change.entity_id)
        .collect();
    let mut current_pages = view.current_page_snapshots(conn, &page_ids).await?;
    let mut current_states: HashMap<EntityKey, Option<EntitySnapshot>> = HashMap::new();
    for change in &call.entity_changes {
        let key = (change.entity_type, change.entity_id);
        let current = match key.0 {
            ContentEntityType::Page => current_pages.remove(&key.1).map(EntitySnapshot::Page),
            _ => view.staged.entity_snapshot(key),
        };
        current_states.entry(key).or_insert(current);
    }

    let mut conflicts = Vec::new();
    let mut entities = Vec::with_capacity(call.entity_changes.len());
    for change in call.entity_changes {
        let key = (change.entity_type, change.entity_id);
        let current = current_states.get(&key).and_then(Option::as_ref);
        let current_digest = current.map(EntitySnapshot::digest).transpose()?;
        if current_digest != change.after_digest {
            conflicts.push(EntityRef {
                entity_type: change.entity_type,
                entity_id: change.entity_id,
                label: current.map_or(change.label, |current| current.label().to_string()),
            });
            continue;
        }
        entities.push(StagedEntity::new(key, change.before));
    }
    if conflicts.is_empty() {
        Ok(RevertPlan::Ready {
            tool_name: call.tool_name,
            entities,
            current: current_states,
        })
    } else {
        Ok(RevertPlan::Conflicts(conflicts))
    }
}
