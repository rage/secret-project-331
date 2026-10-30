//! Staging, publishing and reverting AI agent changes to course content.
//!
//! Every agent write is staged into the user's open changeset for the course (see
//! [`stage_call`]); reads of the staged state overlay the changeset on the live content (see
//! [`course_state::load_view`]); [`publish`] writes the changeset through the web UI's save
//! paths.

pub mod conflicts;
pub mod course_state;
pub mod field_changes;
pub mod locking;
pub mod preview;
pub mod publishing;
pub mod reverting;
pub mod review;
pub mod risk;
pub mod staging;
pub mod summary;

pub use conflicts::PublishConflict;

pub use course_state::{PublishBlocker, ReviewConfigKind, StagedEntity};
pub use field_changes::{EntityField, ExerciseFieldOwner, FieldChange, FieldValue};
pub use locking::{
    ChangedSinceReview, DiscardOutcome, DiscardRejection, discard, discard_entities,
};
pub use preview::{
    PagePreview, PreviewClaim, PreviewExercise, PreviewPage, PreviewPageLink, PreviewReference,
    PreviewToken, changed_page_links, mint_preview_token, preview_path, resolve_changeset_preview,
    resolve_preview, validate_preview_token,
};
pub use publishing::{PublishOptions, PublishOutcome, PublishRejection, publish};
pub use reverting::{RevertPlan, plan_revert};
pub use review::{
    ChangesetReview, CourseDefaultReviewConfigChange, EntityChange, ExerciseChangeWarning,
    PageChange, ReviewEntity, get_review,
};
pub use risk::RiskBaseline;
pub use staging::{
    StageCall, StageCallOutcome, StageCallResult, StagedStateRead, stage_call, stage_call_dry_run,
};
pub use summary::{ChangesetSummary, get_summaries, get_summaries_for_user};
