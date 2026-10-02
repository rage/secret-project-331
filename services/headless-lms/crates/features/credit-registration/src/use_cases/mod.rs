//! The application layer: one module per phase, and [`account_linking`] for the linking mail
//! resend, each reading its rows, asking the study registry through its port, deciding, and writing
//! the decision back.
//!
//! Use cases call the models crate directly and reach the study registry only through
//! [`crate::registry::StudyRegistry`] or [`crate::registry::InteractiveStudyRegistry`]: Suotar's
//! client, wire types, request ids, limiter and breakers are `runtime::suotar`'s.

pub(crate) mod account_linking;
pub(crate) mod batch_flow;
pub(crate) mod config_validation;
pub(crate) mod enrolment_discovery;
pub(crate) mod import;
pub(crate) mod ledger_snapshot;
pub(crate) mod legacy_mirror;
pub(crate) mod link_emails;
mod mail_queue;
pub(crate) mod materialize;
pub(crate) mod preconditions;
pub(crate) mod resolve_enrolments;
pub(crate) mod retention_sweep;
pub(crate) mod student_notifications;
pub(crate) mod verify;
