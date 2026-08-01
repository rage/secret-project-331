//! The credit registration state machine: the policy the ledger's primitives are driven by.
//!
//! `credit_registrations::transition` owns the write; this module owns the decision. The decisions
//! that do not need a database are pure functions, because one of them — never sending an import
//! twice for the same row — is the property the whole feature rests on.
//!
//! The states a row can be waiting in are only ever left in one of two ways: this module's
//! precondition recompute, which reads the database alone, and a worker phase applying one of the
//! outcomes here to an answer from the study registry.

pub mod classification;
pub mod enrolment_selection;
pub mod grade_mapping;
pub mod legacy_mirror;
pub mod materialize;
pub mod outcomes;
pub mod payload;
pub mod preconditions;
pub mod student_facing_status;
pub mod withdrawal;

pub use classification::{Retryability, retryability};
pub use legacy_mirror::{SUOTAR_PUSH_REGISTRAR_ID, mirror_successes_to_legacy_ledger};
pub use materialize::ensure_registration_rows_for_eligible_completions;
pub use preconditions::recompute_preconditions;
pub use student_facing_status::StudentFacingCreditRegistrationStatus;
pub use withdrawal::withdrawal_target;
