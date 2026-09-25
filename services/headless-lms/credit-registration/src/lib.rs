//! The credit registration pipeline: its twelve phases, the one-iteration dispatcher, the loop both
//! worker processes run, and the manual linking-mail resend.
//!
//! Both the worker loops and the test tick endpoint go through [`run_phase_once`], so a phase cannot
//! behave differently depending on who ran it.

#[macro_use]
extern crate tracing;

mod apply;
mod batch_phase;
pub mod breaker;
mod dispatch;
pub mod error;
pub mod linking_mail_resend;
mod mail_queue;
mod phase;
mod phases;
mod process_local;
pub mod rate_limit;
pub mod worker_loop;

pub use dispatch::{PhaseContext, PhaseSkipReason, PhaseTick, run_phase_once};
pub use phase::{CreditRegistrationPhase, PhaseScope, ScopeSupport};
