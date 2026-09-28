//! The application layer: one module per phase and per manual action, each reading its rows, asking
//! the study registry through its port, deciding, and writing the decision back.

mod batch_flow;
pub(crate) mod config_validation;
pub(crate) mod contexts;
pub(crate) mod enrolment_discovery;
pub(crate) mod import;
pub(crate) mod ledger_snapshot;
pub(crate) mod legacy_mirror;
pub(crate) mod link_emails;
pub(crate) mod linking_mail_resend;
mod mail_flow;
pub(crate) mod materialize;
mod persist;
pub(crate) mod person_lookup;
pub(crate) mod preconditions;
pub(crate) mod resolve_enrolments;
pub(crate) mod retention_sweep;
pub(crate) mod student_notifications;
pub(crate) mod verify;
