//! Staging, publishing and reverting AI agent changes to course content.
//!
//! Every agent write is staged into the user's open changeset for the course (see
//! [`stage_call`]); reads of the staged state overlay the changeset on the live content (see
//! [`course_state::load_view`]); [`publish`] writes the changeset through the web UI's save
//! paths.

pub mod course_state;
pub mod field_changes;
pub mod preview;
pub mod publishing;
pub mod reverting;
pub mod review;
pub mod risk;
pub mod staging;

pub use course_state::PublishBlocker;
pub use field_changes::{
    EntityField, ExerciseFieldOwner, FieldChange, FieldValue, ReviewConfigKind,
};
pub use preview::{
    PagePreview, PreviewClaim, PreviewExercise, PreviewPage, PreviewToken, mint_preview_token,
    preview_path, resolve_preview, validate_preview_token,
};
pub use publishing::{
    CreatedRedirect, PublishConflict, PublishOptions, PublishOutcome, PublishRejection, publish,
};
pub use reverting::{RevertPlan, plan_revert};
pub use review::{
    ChangesetReview, CourseDefaultReviewConfigChange, EntityChange, ExerciseChangeWarning,
    PageChange, ReviewEntity, get_review,
};
pub use risk::RiskBaseline;
pub use staging::{
    ChangedSinceReview, DiscardOutcome, DiscardRejection, StageCall, StageCallOutcome,
    StageCallResult, StagedEntity, StagedStateRead, discard, discard_entities, stage_call,
    stage_call_dry_run,
};

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
