//! The composition root: the worker loop, the one-iteration dispatcher, the manual actions, and the
//! Suotar adapter behind the study registry port, which nothing outside this module can name.

mod dispatch;
mod heartbeat;
mod manual;
mod process_local;
mod suotar;
pub mod worker_loop;

pub use dispatch::{PhaseContext, PhaseSkipReason, PhaseTick, Runner, run_phase_once};
pub use manual::{
    ManualActionContext, list_unlinked_enrolled_before, look_up_person,
    resend_linking_mail_for_target,
};
pub use suotar::{
    endpoints_paused_by, is_waiting_item, is_waiting_to_probe, max_study_registry_wait,
    reset_rate_limits,
};
