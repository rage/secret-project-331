//! The credit registration pipeline: its twelve phases, the one-iteration dispatcher, the loop both
//! worker processes run, and the manual account-linking actions.
//!
//! Both the worker loops and the test tick endpoint go through [`run_phase_once`], so a phase cannot
//! behave differently depending on who ran it.

#[macro_use]
extern crate tracing;

mod domain;
pub mod error;
mod error_reports;
mod phase;
mod registry;
mod runtime;
#[cfg(test)]
mod test_fixtures;
mod use_cases;

pub use phase::{CreditRegistrationPhase, PhaseScope, PhaseSpec, ScopeSupport, WorkerProcess};
pub use runtime::{PhaseContext, PhaseSkipReason, PhaseTick, run_phase_once, worker_loop};

/// The account-linking actions an admin or a teacher sets off by hand, and what they answer.
pub mod account_linking {
    pub use crate::runtime::{ManualActionContext, resend_linking_mail_for_target, resolve_person};
    pub use crate::use_cases::linking_mail_resend::{
        LinkingMailResendOutcome, RateCapOverride, ResendAttempt, ResendDecision, ResendOutcome,
    };
    pub use crate::use_cases::person_lookup::{ResolvePersonError, ResolvedPerson};
}

/// The study registry's circuit breakers and limiter, for the dashboard and the test controls.
pub mod registry_health {
    pub use crate::runtime::{is_waiting_to_probe, reset_rate_limits};
}
