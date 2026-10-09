//! The credit registration pipeline: the phases that take a course module completion to a credit
//! in Sisu through Suotar, the worker loops that run them, and the account-linking actions an
//! admin or teacher sets off by hand.
//!
//! Modules:
//! - `runtime`: composition. The worker loop, the one-iteration dispatcher and the manual actions
//!   build a study registry and hand it to a use case.
//! - `use_cases`: one module per phase, and `account_linking` for the linking mail resend. They
//!   claim rows, ask the study registry, decide and write, calling the models crate directly.
//! - `registry`: the study registry as use cases see it: the `StudyRegistry` port a phase asks, the
//!   `InteractiveStudyRegistry` a manual action asks, their requests and their answers.
//! - `workflow`: the claim, the decision and its guarded write, and the accounting every phase
//!   shares.
//! - `phase`: which phases exist, which process owns each, and what each may be narrowed to.
//!
//! Dependencies point from `runtime` to `use_cases` to `registry` and `workflow`, and from
//! `workflow` to `registry`. `runtime::suotar` implements both registry traits and is the only code
//! that names Suotar's wire types and codes or sends through its client; the rest of `runtime` only
//! builds and passes the client, and nothing outside `runtime` can reach it.
//!
//! Where to look:
//! - phase list, spec, scope support, owning process: `phase.rs`
//! - one iteration's lifecycle and the phase dispatch: `runtime/dispatch.rs`
//! - worker loops: `runtime/worker_loop.rs`
//! - study registry operations: `registry/`
//! - Suotar encoding, decoding, limiter and breakers: `runtime/suotar/`, what each Suotar item code
//!   means in `runtime/suotar/codes.rs`, and the adapter's contract tests in
//!   `runtime/suotar/contract_tests.rs`
//! - what each move does to a row (state, error code, admin flag, backoff, timeline line): models'
//!   `library::credit_registration::outcomes`
//! - batch phase lifecycle (claim, send, split, apply, shutdown): `use_cases/batch_flow.rs`
//! - a decision and writing it to its row: `workflow/decision.rs`
//! - import: `use_cases/import/`
//! - enrolment resolution: `use_cases/resolve_enrolments/`
//! - verification: `use_cases/verify/`
//! - roster listing and account-linking mails: `use_cases/enrolment_discovery/`
//! - mail queue phases: `use_cases/link_emails.rs`, `use_cases/student_notifications.rs`, sharing
//!   `use_cases/mail_queue.rs`
//! - manual account-linking actions: `runtime/manual.rs`, and the resend in
//!   `use_cases/account_linking.rs`
//! - the admin "materialize now" button: [`materialize_now`], the `materialize` phase's own body
//! - an iteration's error: `error.rs`; what reaches the admin Errors page: `error_reports.rs`
//!
//! Both the worker loops and the test tick endpoint go through [`run_phase_once`], so a phase cannot
//! behave differently depending on who ran it.

#[macro_use]
extern crate tracing;

pub mod attention;
pub mod error;
mod error_reports;
mod phase;
mod registry;
mod runtime;
#[cfg(test)]
mod test_fixtures;
mod use_cases;
mod workflow;

pub use phase::{CreditRegistrationPhase, PhaseSpec, ScopeSupport, WorkerProcess};
pub use runtime::{
    PhaseContext, PhaseSkipReason, PhaseTick, Runner, is_waiting_item, run_phase_once, worker_loop,
};
pub use use_cases::materialize::{Materialized, materialize_now};

/// The account-linking actions an admin or a teacher sets off by hand, and what they answer.
pub mod account_linking {
    pub use crate::registry::{PersonLookupError, RegistryPerson};
    pub use crate::runtime::{
        ManualActionContext, list_unlinked_enrolled_before, look_up_person,
        resend_linking_mail_for_target,
    };
    pub use crate::use_cases::account_linking::{RateCapOverride, ResendAttempt, ResendOutcome};
}

/// What the dashboard and the test controls read of the study registry, or reset: its circuit
/// breakers and limiter, and the Suotar endpoints each phase calls.
pub mod registry_health {
    pub use crate::runtime::{
        endpoints_paused_by, is_waiting_to_probe, max_study_registry_wait, reset_rate_limits,
    };
}
