//! One module per phase body, bar the database-only ones, which share one.

pub(crate) mod config_validation;
pub(crate) mod database_phases;
pub(crate) mod enrolment_discovery;
pub(crate) mod import;
pub(crate) mod link_emails;
pub(crate) mod resolve_enrolments;
pub(crate) mod student_notifications;
pub(crate) mod verify;
