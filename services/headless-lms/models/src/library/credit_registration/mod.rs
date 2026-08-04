//! The credit registration state machine: `credit_registrations::transition` owns the write, this
//! module owns the decision. A waiting row is only ever moved by the precondition recompute here or
//! by a worker phase applying one of this module's outcomes to an answer from the study registry.

pub mod account_linking;
pub mod classification;
pub mod enrolment_selection;
pub mod grade_mapping;
pub mod legacy_mirror;
pub mod materialize;
pub mod outcomes;
pub mod payload;
pub mod preconditions;
pub mod student_facing_status;
pub mod submission_context;
pub mod withdrawal;

pub use account_linking::{ClaimedLinkingMails, DiscoveredPerson, claim_linking_mails};
pub use classification::{Retryability, retryability};
pub use legacy_mirror::{SUOTAR_PUSH_REGISTRAR_ID, mirror_successes_to_legacy_ledger};
pub use materialize::ensure_registration_rows_for_eligible_completions;
pub use preconditions::recompute_preconditions;
pub use student_facing_status::StudentFacingCreditRegistrationStatus;
pub use submission_context::{SubmissionContext, get_submission_contexts};
pub use withdrawal::{apply_consent_change, withdrawal_target};
