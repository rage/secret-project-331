//! The twelve credit-registration pipeline phases and the one-iteration dispatcher.
//!
//! Phases, not worker processes, are the unit of observation and control: the dashboard lists them,
//! `credit_registration_phase_state` heartbeats them, and the system tests tick them individually.
//! Both the worker loops and the test tick endpoint go through [`run_phase_once`], so a phase cannot
//! behave differently depending on who ran it.

use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use sqlx::PgPool;

/// A pipeline phase. The string forms are canonical: `credit_registration_phase_state.phase`, the
/// tick endpoint's `?phase=`, the dashboard's Workers tab labels and the audit log's `target_phase`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CreditRegistrationPhase {
    Materialize,
    Preconditions,
    ResolveEnrolments,
    Import,
    Verify,
    LegacyMirror,
    StudentNotifications,
    EnrolmentDiscovery,
    LinkEmails,
    ProductTokenRefresh,
    ConfigValidation,
    RetentionSweep,
}

impl CreditRegistrationPhase {
    /// Every phase, in pipeline order.
    pub const ALL: [Self; 12] = [
        Self::Materialize,
        Self::Preconditions,
        Self::ResolveEnrolments,
        Self::Import,
        Self::Verify,
        Self::LegacyMirror,
        Self::StudentNotifications,
        Self::EnrolmentDiscovery,
        Self::LinkEmails,
        Self::ProductTokenRefresh,
        Self::ConfigValidation,
        Self::RetentionSweep,
    ];

    /// The phases `run-registrar-tick` runs, in pipeline order.
    ///
    /// Not every `credit-registrar` phase: `legacy-mirror` and `student-notifications` are
    /// after-effects a spec drives explicitly when it cares about them.
    pub const REGISTRAR_TICK_SEQUENCE: [Self; 5] = [
        Self::Materialize,
        Self::Preconditions,
        Self::ResolveEnrolments,
        Self::Import,
        Self::Verify,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Materialize => "materialize",
            Self::Preconditions => "preconditions",
            Self::ResolveEnrolments => "resolve-enrolments",
            Self::Import => "import",
            Self::Verify => "verify",
            Self::LegacyMirror => "legacy-mirror",
            Self::StudentNotifications => "student-notifications",
            Self::EnrolmentDiscovery => "enrolment-discovery",
            Self::LinkEmails => "link-emails",
            Self::ProductTokenRefresh => "product-token-refresh",
            Self::ConfigValidation => "config-validation",
            Self::RetentionSweep => "retention-sweep",
        }
    }

    pub fn from_phase_name(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|phase| phase.as_str() == name)
    }

    /// Which worker process owns the phase's loop.
    pub fn process_name(self) -> &'static str {
        match self {
            Self::Materialize
            | Self::Preconditions
            | Self::ResolveEnrolments
            | Self::Import
            | Self::Verify
            | Self::LegacyMirror
            | Self::StudentNotifications => "credit-registrar",
            Self::EnrolmentDiscovery
            | Self::LinkEmails
            | Self::ProductTokenRefresh
            | Self::ConfigValidation
            | Self::RetentionSweep => "suotar-syncer",
        }
    }
}

/// What one dispatch attempt did.
#[derive(Debug, Clone, PartialEq)]
pub enum PhaseTick {
    Ran(PhaseRunOutcome),
    NotImplemented,
}

/// Runs exactly one iteration of one phase.
///
/// The match below is the single place a phase implementation is registered: the tick endpoint, the
/// worker loops and the dashboard all run phases through here.
///
/// Takes the pool rather than a connection so an unimplemented phase costs no connection.
pub async fn run_phase_once(
    _pool: &PgPool,
    phase: CreditRegistrationPhase,
) -> anyhow::Result<PhaseTick> {
    match phase {
        CreditRegistrationPhase::Materialize
        | CreditRegistrationPhase::Preconditions
        | CreditRegistrationPhase::ResolveEnrolments
        | CreditRegistrationPhase::Import
        | CreditRegistrationPhase::Verify
        | CreditRegistrationPhase::LegacyMirror
        | CreditRegistrationPhase::StudentNotifications
        | CreditRegistrationPhase::EnrolmentDiscovery
        | CreditRegistrationPhase::LinkEmails
        | CreditRegistrationPhase::ProductTokenRefresh
        | CreditRegistrationPhase::ConfigValidation
        | CreditRegistrationPhase::RetentionSweep => Ok(PhaseTick::NotImplemented),
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registration_phase_state::PHASES;

    use super::*;

    /// A mismatch with the rows the migration seeded into `credit_registration_phase_state` makes a
    /// tick or a heartbeat silently target a row that does not exist.
    #[test]
    fn phase_names_match_the_seeded_rows() {
        let from_enum: Vec<&str> = CreditRegistrationPhase::ALL
            .iter()
            .map(|phase| phase.as_str())
            .collect();
        assert_eq!(from_enum, PHASES);
        assert_eq!(from_enum.len(), 12);
    }

    #[test]
    fn phase_names_round_trip() {
        for phase in CreditRegistrationPhase::ALL {
            assert_eq!(
                CreditRegistrationPhase::from_phase_name(phase.as_str()),
                Some(phase)
            );
        }
        assert_eq!(
            CreditRegistrationPhase::from_phase_name("materialise"),
            None
        );
        assert_eq!(CreditRegistrationPhase::from_phase_name(""), None);
    }
}
