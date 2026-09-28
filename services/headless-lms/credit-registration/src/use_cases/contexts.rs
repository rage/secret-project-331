//! What each kind of use case is handed: its fields are everything the use case may touch.

use sqlx::PgPool;
use tokio_util::sync::CancellationToken;

use crate::error_reports::ErrorReporter;
use crate::phase::{CreditRegistrationPhase, PhaseScope};

/// The database and the rows a phase may touch: all a database-only phase gets, and all
/// `config-validation` gets beside the registry.
pub(crate) struct DatabaseContext<'a> {
    pub pool: &'a PgPool,
    pub scope: &'a PhaseScope,
}

/// For a phase built from [`super::batch_flow::RegistryBatchFlow`]s.
pub(crate) struct BatchFlowContext<'a> {
    pub pool: &'a PgPool,
    pub scope: &'a PhaseScope,
    pub phase: CreditRegistrationPhase,
    pub errors: ErrorReporter<'a>,
    /// The worker's SIGTERM; `None` for a run no signal can stop, such as an on-demand one.
    pub shutdown: Option<&'a CancellationToken>,
}

/// For a phase built on [`super::mail_flow::MailFlow`].
pub(crate) struct MailContext<'a> {
    pub pool: &'a PgPool,
    pub scope: &'a PhaseScope,
    /// Absolute base for links in queued mail, which outlive the process that wrote them.
    pub base_url: &'a str,
}

/// For `enrolment-discovery`.
pub(crate) struct DiscoveryContext<'a> {
    pub pool: &'a PgPool,
    pub scope: &'a PhaseScope,
    /// With linking off, a roster still wakes linked students' registrations, and only the mails
    /// are left out.
    pub is_account_linking_enabled: bool,
}
