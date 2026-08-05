//! The credit registration state machine: `credit_registrations::transition` owns the write, this
//! module owns the decision. A waiting row is only ever moved by the precondition recompute here or
//! by a worker phase applying one of this module's outcomes to an answer from the study registry.

pub mod account_linking;
pub mod backoff;
pub mod classification;
pub mod enrolment_selection;
pub mod grade_mapping;
pub mod legacy_mirror;
pub mod materialize;
pub mod outcomes;
pub mod payload;
pub mod preconditions;
pub mod student_facing_status;
pub mod student_number_change;
pub mod submission_context;
pub mod withdrawal;

// Only symbols reached from outside this module in more than one place are hoisted here; everything
// else goes through its submodule's own path (`credit_registration::submodule::Item`).
pub use legacy_mirror::SUOTAR_PUSH_REGISTRAR_ID;
pub use student_facing_status::StudentFacingCreditRegistrationStatus;
