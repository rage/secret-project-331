//! Which phases exist, which process runs each, and what each may be narrowed on.

use headless_lms_models::credit_registrations::CreditRegistrationState;
use headless_lms_utils::services::suotar::SuotarEndpoint;
use std::time::Duration;

use crate::breaker::BreakerTarget;

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

/// The worker process that runs a phase's loop. The two are separate OS processes, each with its
/// own circuit breakers and limiter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum WorkerProcess {
    /// Owns the ledger.
    CreditRegistrar,
    /// Owns everything about credit registration except the ledger.
    SuotarSyncer,
}

impl WorkerProcess {
    pub const ALL: [Self; 2] = [Self::CreditRegistrar, Self::SuotarSyncer];

    /// `credit_registration_phase_state.process_name`, and the caller the audit log names.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CreditRegistrar => "credit-registrar",
            Self::SuotarSyncer => "suotar-syncer",
        }
    }
}

/// Everything fixed about one phase, declared in one place.
#[derive(Debug)]
pub struct PhaseSpec {
    /// See [`CreditRegistrationPhase::as_str`].
    pub name: &'static str,
    pub process: WorkerProcess,
    pub scope: ScopeSupport,
    /// The study registry endpoints one iteration calls, one after the other. Empty for a
    /// database-only phase, which no breaker ever holds back.
    pub endpoints: &'static [SuotarEndpoint],
    /// The circuit breakers that pause the phase.
    pub breakers: &'static [BreakerTarget],
    /// The ledger states this phase is the one to move a row out of; see
    /// [`CreditRegistrationPhase::owned_states`].
    pub owned_states: &'static [CreditRegistrationState],
    /// The phase does nothing but account linking, and so is skipped while the deployment has
    /// linking switched off. `enrolment-discovery` is not one: with linking off it still wakes
    /// linked students' registrations and only leaves out the mails.
    pub is_account_linking_only: bool,
}

/// What a spec below leaves as it is: a `credit-registrar` phase over ledger rows that calls no
/// study registry.
const DEFAULTS: PhaseSpec = PhaseSpec {
    name: "",
    process: WorkerProcess::CreditRegistrar,
    scope: ScopeSupport::LEDGER,
    endpoints: &[],
    breakers: &[],
    owned_states: &[],
    is_account_linking_only: false,
};

const STUDY_REGISTRY: &[BreakerTarget] = &[BreakerTarget::StudyRegistry];

/// These reach their rows through the course module, which has no user dimension: a roster and a
/// module configuration are facts about a course, not about one of our accounts.
const COURSE_MODULES: ScopeSupport = ScopeSupport {
    course: true,
    user: false,
    registration_ids: false,
};

const MATERIALIZE: PhaseSpec = PhaseSpec {
    name: "materialize",
    // No ledger row exists yet, so there is no registration id to narrow on.
    scope: ScopeSupport {
        course: true,
        user: true,
        registration_ids: false,
    },
    ..DEFAULTS
};
const PRECONDITIONS: PhaseSpec = PhaseSpec {
    name: "preconditions",
    owned_states: &[
        CreditRegistrationState::Pending,
        CreditRegistrationState::FailedRetryable,
        CreditRegistrationState::Blocked,
    ],
    ..DEFAULTS
};
const RESOLVE_ENROLMENTS: PhaseSpec = PhaseSpec {
    name: "resolve-enrolments",
    // The person lookup for links that lack one, then the enrolment lookup.
    endpoints: &[
        SuotarEndpoint::ResolvePersons,
        SuotarEndpoint::ResolveEnrolments,
    ],
    breakers: STUDY_REGISTRY,
    owned_states: &[
        CreditRegistrationState::ReadyToSubmit,
        CreditRegistrationState::ResolvingEnrolment,
        CreditRegistrationState::NoUsableEnrolment,
    ],
    ..DEFAULTS
};
const IMPORT: PhaseSpec = PhaseSpec {
    name: "import",
    endpoints: &[SuotarEndpoint::ImportAttainments],
    // Sisu timing out on submissions says nothing about the rest of Suotar, so only this phase
    // stops for it.
    breakers: &[BreakerTarget::StudyRegistry, BreakerTarget::SisuSubmissions],
    owned_states: &[
        CreditRegistrationState::CheckingEnrolment,
        CreditRegistrationState::Submitting,
    ],
    ..DEFAULTS
};
const VERIFY: PhaseSpec = PhaseSpec {
    name: "verify",
    // The poll, then the recovery lookup for rows with nothing to poll by.
    endpoints: &[
        SuotarEndpoint::VerifyAttainments,
        SuotarEndpoint::ResolveEnrolments,
    ],
    breakers: STUDY_REGISTRY,
    owned_states: &[
        CreditRegistrationState::AwaitingVerification,
        CreditRegistrationState::SubmissionUncertain,
    ],
    ..DEFAULTS
};
const LEGACY_MIRROR: PhaseSpec = PhaseSpec {
    name: "legacy-mirror",
    ..DEFAULTS
};
const STUDENT_NOTIFICATIONS: PhaseSpec = PhaseSpec {
    name: "student-notifications",
    ..DEFAULTS
};
const ENROLMENT_DISCOVERY: PhaseSpec = PhaseSpec {
    name: "enrolment-discovery",
    process: WorkerProcess::SuotarSyncer,
    scope: COURSE_MODULES,
    endpoints: &[SuotarEndpoint::ListByCourse],
    breakers: STUDY_REGISTRY,
    ..DEFAULTS
};
const LINK_EMAILS: PhaseSpec = PhaseSpec {
    name: "link-emails",
    process: WorkerProcess::SuotarSyncer,
    scope: COURSE_MODULES,
    is_account_linking_only: true,
    ..DEFAULTS
};
const CONFIG_VALIDATION: PhaseSpec = PhaseSpec {
    name: "config-validation",
    process: WorkerProcess::SuotarSyncer,
    scope: COURSE_MODULES,
    endpoints: &[SuotarEndpoint::ValidateCourseCodes],
    breakers: STUDY_REGISTRY,
    ..DEFAULTS
};
const RETENTION_SWEEP: PhaseSpec = PhaseSpec {
    name: "retention-sweep",
    process: WorkerProcess::SuotarSyncer,
    // Sweeps whole tables by age; there is nothing in them to narrow on.
    scope: ScopeSupport::NONE,
    ..DEFAULTS
};
const LEDGER_SNAPSHOT: PhaseSpec = PhaseSpec {
    name: "ledger-snapshot",
    process: WorkerProcess::SuotarSyncer,
    // Counts every row in the ledger for the day; a scoped run would write that as if it were
    // everyone's snapshot.
    scope: ScopeSupport::NONE,
    ..DEFAULTS
};

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

    pub fn spec(self) -> &'static PhaseSpec {
        match self {
            Self::Materialize => &MATERIALIZE,
            Self::Preconditions => &PRECONDITIONS,
            Self::ResolveEnrolments => &RESOLVE_ENROLMENTS,
            Self::Import => &IMPORT,
            Self::Verify => &VERIFY,
            Self::LegacyMirror => &LEGACY_MIRROR,
            Self::StudentNotifications => &STUDENT_NOTIFICATIONS,
            Self::EnrolmentDiscovery => &ENROLMENT_DISCOVERY,
            Self::LinkEmails => &LINK_EMAILS,
            Self::ConfigValidation => &CONFIG_VALIDATION,
            Self::RetentionSweep => &RETENTION_SWEEP,
            Self::LedgerSnapshot => &LEDGER_SNAPSHOT,
        }
    }

    pub fn as_str(self) -> &'static str {
        self.spec().name
    }

    pub fn from_phase_name(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|phase| phase.as_str() == name)
    }

    /// The longest one iteration may wait on the study registry before its calls time out.
    pub fn max_study_registry_wait(self) -> Duration {
        self.spec()
            .endpoints
            .iter()
            .map(|endpoint| endpoint.request_timeout())
            .sum()
    }

    /// The ledger states this phase is the one to move a row out of.
    ///
    /// Empty for the phases whose work is not a ledger state at all: `materialize`'s queue is
    /// completions with no row yet, and the syncer's phases work on course modules. Narrower than
    /// what `preconditions` may claim, which is every non-terminal row: these are the states nothing
    /// else advances. How many of their rows are waiting on the phase is [`Self::queue_depth`].
    pub fn owned_states(self) -> &'static [CreditRegistrationState] {
        self.spec().owned_states
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
                .spec()
                .scope
                .covers(&ids)
        );
        assert!(CreditRegistrationPhase::Import.spec().scope.covers(&ids));
        assert!(
            !CreditRegistrationPhase::RetentionSweep
                .spec()
                .scope
                .covers(&PhaseScope::for_course(Uuid::new_v4()))
        );
    }
}
