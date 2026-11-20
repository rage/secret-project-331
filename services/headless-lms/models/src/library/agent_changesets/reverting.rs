//! Planning the revert of an agent write call.

use std::collections::HashMap;

use crate::{
    agent_changeset_calls, agent_changesets,
    course_modules::{CompletionPolicy, CreditRegistrationRoute, ExamRequirement},
    library::{
        agent_changesets::course_state::{CourseView, StagedEntity},
        entity_snapshots::{
            ContentEntityType, EntityKey, EntityRef, EntitySnapshot, ModuleSnapshot, json_digest,
        },
    },
    prelude::*,
};

/// How a call can be reverted.
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
        let key = EntityKey::new(change.entity_type, change.entity_id);
        let current = match key.entity_type {
            ContentEntityType::Page => current_pages
                .remove(&key.entity_id)
                .map(EntitySnapshot::Page),
            _ => view.staged.entity_snapshot(key),
        };
        current_states.entry(key).or_insert(current);
    }

    let mut conflicts = Vec::new();
    let mut entities = Vec::with_capacity(call.entity_changes.len());
    for change in call.entity_changes {
        let key = EntityKey::new(change.entity_type, change.entity_id);
        let current = current_states.get(&key).and_then(Option::as_ref);
        let current_digest = current.map(EntitySnapshot::digest).transpose()?;
        let is_unchanged_since_call = current_digest == change.after_digest
            || match current {
                Some(EntitySnapshot::Module(module)) => {
                    change.after_digest.is_some()
                        && pre_completion_settings_digest(module)? == change.after_digest
                }
                _ => false,
            };
        if !is_unchanged_since_call {
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

/// [`EntitySnapshot::digest`] of `module` in the module snapshot shape from before explicit
/// completion settings, which the after-digests of calls made before them hold; `None` when that
/// shape can't express the module's settings.
fn pre_completion_settings_digest(module: &ModuleSnapshot) -> ModelResult<Option<String>> {
    #[derive(Serialize)]
    #[serde(tag = "policy", rename_all = "kebab-case")]
    enum PreviousCompletionPolicy {
        Automatic {
            course_module_id: Uuid,
            number_of_exercises_attempted_treshold: Option<i32>,
            number_of_points_treshold: Option<i32>,
            requires_exam: bool,
        },
        Manual,
    }

    // Field order is part of the digest.
    #[derive(Serialize)]
    struct PreviousModuleSnapshot<'a> {
        id: Uuid,
        course_id: Uuid,
        name: &'a Option<String>,
        order_number: i32,
        completion_policy: PreviousCompletionPolicy,
        certification_enabled: bool,
        uh_course_code: &'a Option<String>,
        ects_credits: Option<f32>,
        completion_registration_link_override: &'a Option<String>,
        completions_can_be_registered_to_sisu: bool,
    }

    let automatic = |requirements: &crate::course_modules::CompletionRequirements,
                     requires_exam| PreviousCompletionPolicy::Automatic {
        course_module_id: requirements.course_module_id,
        number_of_exercises_attempted_treshold: requirements.number_of_exercises_attempted_treshold,
        number_of_points_treshold: requirements.number_of_points_treshold,
        requires_exam,
    };
    let completion_policy = match (&module.completion_policy, module.exam_requirement) {
        (CompletionPolicy::ByRequirements(requirements), ExamRequirement::None) => {
            automatic(requirements, false)
        }
        (CompletionPolicy::ByExam(requirements), ExamRequirement::Platform) => {
            automatic(requirements, true)
        }
        (CompletionPolicy::TeacherAdds, ExamRequirement::None) => PreviousCompletionPolicy::Manual,
        _ => return Ok(None),
    };
    let completions_can_be_registered_to_sisu = match module.credit_registration_route {
        CreditRegistrationRoute::Platform => true,
        CreditRegistrationRoute::CertificateOnly => false,
        CreditRegistrationRoute::External => return Ok(None),
    };
    if module.exam_location_description.is_some() {
        return Ok(None);
    }
    let previous = PreviousModuleSnapshot {
        id: module.id,
        course_id: module.course_id,
        name: &module.name,
        order_number: module.order_number,
        completion_policy,
        certification_enabled: module.certification_enabled,
        uh_course_code: &module.uh_course_code,
        ects_credits: module.ects_credits,
        completion_registration_link_override: &module.completion_registration_link_override,
        completions_can_be_registered_to_sisu,
    };
    Ok(Some(json_digest(&serde_json::to_string(&previous)?)))
}
