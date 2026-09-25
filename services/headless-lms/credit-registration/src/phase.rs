//! Which phases exist, which process runs each, and what each may be narrowed on.

use headless_lms_models::credit_registrations::CreditRegistrationState;
use headless_lms_utils::services::suotar::SuotarEndpoint;
use std::time::Duration;

/// Which rows one iteration may touch.
pub use headless_lms_models::credit_registrations::RegistrationScope as PhaseScope;

/// A pipeline phase. [`CreditRegistrationPhase::as_str`] is canonical: it is
/// `credit_registration_phase_state.phase`, the tick endpoint's `?phase=` and the audit log's
/// `target_phase`.
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
    ConfigValidation,
    RetentionSweep,
    LedgerSnapshot,
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
        Self::ConfigValidation,
        Self::RetentionSweep,
        Self::LedgerSnapshot,
    ];

    /// The phases `run-registrar-tick` runs, in pipeline order. Not every `credit-registrar` phase:
    /// `legacy-mirror` and `student-notifications` are driven explicitly by specs that need them.
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
            Self::ConfigValidation => "config-validation",
            Self::RetentionSweep => "retention-sweep",
            Self::LedgerSnapshot => "ledger-snapshot",
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
            | Self::ConfigValidation
            | Self::RetentionSweep
            | Self::LedgerSnapshot => "suotar-syncer",
        }
    }

    /// Whether the phase talks to the study registry, and so shares the study registry circuit
    /// breaker with the other such phases of its own worker process (`breaker::BREAKERS` is
    /// process-local, not shared between `credit-registrar` and `suotar-syncer`).
    pub fn calls_study_registry(self) -> bool {
        !self.study_registry_endpoints().is_empty()
    }

    /// Whether the phase is the one that sends attainments on to Sisu, and so the one a Sisu outage
    /// pauses while Suotar itself keeps answering.
    pub fn submits_to_sisu(self) -> bool {
        self == Self::Import
    }

    /// The study registry endpoints one iteration calls, one after the other.
    pub fn study_registry_endpoints(self) -> &'static [SuotarEndpoint] {
        match self {
            // The person lookup for links that lack one, then the enrolment lookup.
            Self::ResolveEnrolments => &[
                SuotarEndpoint::ResolvePersons,
                SuotarEndpoint::ResolveEnrolments,
            ],
            Self::Import => &[SuotarEndpoint::ImportAttainments],
            // The poll, then the recovery lookup for rows with nothing to poll by.
            Self::Verify => &[
                SuotarEndpoint::VerifyAttainments,
                SuotarEndpoint::ResolveEnrolments,
            ],
            Self::EnrolmentDiscovery => &[SuotarEndpoint::ListByCourse],
            Self::ConfigValidation => &[SuotarEndpoint::ValidateCourseCodes],
            Self::Materialize
            | Self::Preconditions
            | Self::LegacyMirror
            | Self::StudentNotifications
            | Self::LinkEmails
            | Self::RetentionSweep
            | Self::LedgerSnapshot => &[],
        }
    }

    /// The longest one iteration may wait on the study registry before its calls time out.
    pub fn max_study_registry_wait(self) -> Duration {
        self.study_registry_endpoints()
            .iter()
            .map(|endpoint| endpoint.request_timeout())
            .sum()
    }

    /// Whether the phase does nothing but account linking, and so is skipped while the deployment
    /// has linking switched off. `enrolment-discovery` is not one: with linking off it still wakes
    /// linked students' registrations and only leaves out the mails.
    pub fn is_account_linking_only(self) -> bool {
        self == Self::LinkEmails
    }

    /// The ledger states this phase is the one to move a row out of.
    ///
    /// Empty for the phases whose work is not a ledger state at all: `materialize`'s queue is
    /// completions with no row yet, and the syncer's phases work on course modules. Narrower than
    /// what `preconditions` may claim, which is every non-terminal row: these are the states nothing
    /// else advances. How many of their rows are waiting on the phase is [`Self::queue_depth`].
    pub fn owned_states(self) -> &'static [CreditRegistrationState] {
        match self {
            Self::Preconditions => &[
                CreditRegistrationState::Pending,
                CreditRegistrationState::FailedRetryable,
                CreditRegistrationState::Blocked,
            ],
            Self::ResolveEnrolments => &[
                CreditRegistrationState::ReadyToSubmit,
                CreditRegistrationState::ResolvingEnrolment,
                CreditRegistrationState::NoUsableEnrolment,
            ],
            Self::Import => &[
                CreditRegistrationState::CheckingEnrolment,
                CreditRegistrationState::Submitting,
            ],
            Self::Verify => &[
                CreditRegistrationState::AwaitingVerification,
                CreditRegistrationState::SubmissionUncertain,
            ],
            _ => &[],
        }
    }

    /// The live rows waiting on this phase: the Workers tab's "queue depth it is responsible for",
    /// and the depth the failing-phase alert asks about before calling a quiet phase wedged.
    ///
    /// `depth_of` is the live count of a state. `due_enrolment_checks` stands in for
    /// `no_usable_enrolment`, whose other rows wait for their schedule rather than for the phase.
    pub fn queue_depth(
        self,
        depth_of: impl Fn(CreditRegistrationState) -> i64,
        due_enrolment_checks: i64,
    ) -> i64 {
        self.owned_states()
            .iter()
            .map(|&state| {
                if state == CreditRegistrationState::NoUsableEnrolment {
                    due_enrolment_checks
                } else {
                    depth_of(state)
                }
            })
            .sum()
    }

    pub fn scope_support(self) -> ScopeSupport {
        match self {
            Self::Preconditions
            | Self::ResolveEnrolments
            | Self::Import
            | Self::Verify
            | Self::LegacyMirror
            | Self::StudentNotifications => ScopeSupport::LEDGER,
            // No ledger row exists yet, so there is no registration id to narrow on.
            Self::Materialize => ScopeSupport {
                course: true,
                user: true,
                registration_ids: false,
            },
            // These reach their rows through the course module, which has no user dimension: a
            // roster and a module configuration are facts about a course, not about one of our
            // accounts.
            Self::EnrolmentDiscovery | Self::LinkEmails | Self::ConfigValidation => ScopeSupport {
                course: true,
                user: false,
                registration_ids: false,
            },
            // Sweeps whole tables by age; there is nothing in them to narrow on.
            Self::RetentionSweep => ScopeSupport::NONE,
            // Counts every row in the ledger for the day; a scoped run would write that as if it
            // were everyone's snapshot.
            Self::LedgerSnapshot => ScopeSupport::NONE,
        }
    }
}

/// Which of the scope's dimensions a phase's claim query can apply. Declared rather than assumed,
/// so a phase added later cannot quietly ignore a scope and sweep the whole database.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScopeSupport {
    pub course: bool,
    pub user: bool,
    pub registration_ids: bool,
}

impl ScopeSupport {
    pub const NONE: Self = Self {
        course: false,
        user: false,
        registration_ids: false,
    };
    /// The phases that claim ledger rows, which carry all three keys themselves.
    pub const LEDGER: Self = Self {
        course: true,
        user: true,
        registration_ids: true,
    };

    pub(crate) fn covers(self, scope: &PhaseScope) -> bool {
        let requested_unsupported = (scope.course_id.is_some() && !self.course)
            || (scope.user_id.is_some() && !self.user)
            || (!scope.credit_registration_ids.is_empty() && !self.registration_ids);
        !requested_unsupported
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registration_phase_state::PHASES;
    use uuid::Uuid;

    use super::*;

    /// A mismatch with the seeded `credit_registration_phase_state` rows makes a tick or a
    /// heartbeat silently target a row that does not exist.
    #[test]
    fn phase_names_match_the_seeded_rows() {
        let from_enum: Vec<&str> = CreditRegistrationPhase::ALL
            .iter()
            .map(|phase| phase.as_str())
            .collect();
        assert_eq!(from_enum, PHASES);
        assert_eq!(from_enum.len(), 12);
    }

    /// A phase that cannot honour the narrowing it was handed has to say so, or a caller that
    /// believes it narrowed the run gets a silently wrong answer.
    #[test]
    fn a_phase_refuses_a_scope_it_cannot_apply() {
        let ids = PhaseScope {
            credit_registration_ids: vec![Uuid::new_v4()],
            ..PhaseScope::default()
        };
        assert!(
            !CreditRegistrationPhase::Materialize
                .scope_support()
                .covers(&ids)
        );
        assert!(CreditRegistrationPhase::Import.scope_support().covers(&ids));
        assert!(
            !CreditRegistrationPhase::RetentionSweep
                .scope_support()
                .covers(&PhaseScope::for_course(Uuid::new_v4()))
        );
    }
}
