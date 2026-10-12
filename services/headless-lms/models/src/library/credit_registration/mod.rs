//! The credit registration pipeline's rules, which the worker crate's phases apply.
//!
//! The pure half decides what each move does to a row (`outcomes`), how long to wait and what may
//! be retried (`backoff`, `classification`), what gets registered (`payload`, `grade_mapping`,
//! `enrolment_selection`), and what of an exchange may be kept (`scrub`). The rest are database steps
//! the phases run, such as `materialize`, `preconditions`, `enrolment_checks` and `account_linking`.
//! Every state change goes through `credit_registrations::transition`.

pub mod account_linking;
pub mod backoff;
pub mod classification;
pub mod config_validation;
pub mod enrolment_check_schedule;
pub mod enrolment_checks;
pub mod enrolment_selection;
pub mod grade_mapping;
pub mod legacy_mirror;
pub mod materialize;
pub mod outcomes;
pub mod payload;
pub mod pending_reason;
pub mod preconditions;
pub mod scrub;
pub mod sisu_day_gap;
pub mod student_facing_status;
pub mod student_notifications;
pub mod student_number;
pub mod student_number_change;
pub mod study_registry;
pub mod submission_context;
pub mod timeline;

// Only symbols reached from outside this module in more than one place are hoisted here; everything
// else goes through its submodule's own path (`credit_registration::submodule::Item`).
pub use pending_reason::{
    CreditRegistrationPendingReason, PendingPreconditions, PendingReasonCounts,
};
pub use student_facing_status::{StageMatch, StudentFacingCreditRegistrationStatus};
