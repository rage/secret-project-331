//! The ledger's states and error codes, the edges between states, and which rows a human may
//! move by hand.

use crate::prelude::*;
use chrono::TimeDelta;
use utoipa::ToSchema;

/// What the pipeline does next with a ledger row.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(type_name = "credit_registration_state", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationState {
    /// Waiting on a precondition: the completion or a linked student number. Which one is derived
    /// at read time, never stored.
    Pending,
    ReadyToSubmit,
    ResolvingEnrolment,
    CheckingEnrolment,
    NoUsableEnrolment,
    Submitting,
    SubmissionUncertain,
    AwaitingVerification,
    /// Sisu holds the assessment item attainment, and verify keeps polling for the course unit
    /// attainment that makes the credit count.
    PartiallyRegistered,
    Registered,
    Duplicate,
    NotImproved,
    Misregistered,
    FailedRetryable,
    FailedPermanent,
    Blocked,
    Cancelled,
}

impl CreditRegistrationState {
    /// Every state, so a classification can be proven exhaustive at runtime too.
    pub const ALL: [Self; 17] = [
        Self::Pending,
        Self::ReadyToSubmit,
        Self::ResolvingEnrolment,
        Self::CheckingEnrolment,
        Self::NoUsableEnrolment,
        Self::Submitting,
        Self::SubmissionUncertain,
        Self::AwaitingVerification,
        Self::PartiallyRegistered,
        Self::Registered,
        Self::Duplicate,
        Self::NotImproved,
        Self::Misregistered,
        Self::FailedRetryable,
        Self::FailedPermanent,
        Self::Blocked,
        Self::Cancelled,
    ];

    /// States the pipeline never leaves on its own. `terminal_at` tracks membership, cleared on
    /// exit so an admin retry becomes visible to the stuck queries again.
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Registered
                | Self::Duplicate
                | Self::NotImproved
                | Self::FailedPermanent
                | Self::Cancelled
        )
    }

    /// Entry to one of these anchors the retry window in `first_failed_at`. Not the same question
    /// as whether a move carries an error code.
    pub fn is_failed_state(self) -> bool {
        matches!(self, Self::FailedRetryable | Self::FailedPermanent)
    }

    /// Used for reporting and for the double-registration guard.
    pub fn is_success(self) -> bool {
        matches!(self, Self::Registered | Self::Duplicate | Self::NotImproved)
    }

    /// [`Self::is_success`]'s states, for binding as `= ANY($n::credit_registration_state[])` in
    /// queries that would otherwise hand-retype the same set as a SQL literal. Order-independent;
    /// kept in `is_success`'s own order for readability.
    pub const SUCCESS_STATES: [Self; 3] = [Self::Registered, Self::Duplicate, Self::NotImproved];

    /// [`Self::SUCCESS_STATES`] minus `Registered`: the credit exists but we did not put it there.
    pub const OTHER_SUCCESS_STATES: [Self; 2] = [Self::Duplicate, Self::NotImproved];

    /// The states of a row whose submission may be in Sisu with its outcome not yet known: a
    /// request may be out, or its answer is still to be verified.
    pub const IN_FLIGHT_STATES: [Self; 4] = [
        Self::Submitting,
        Self::SubmissionUncertain,
        Self::AwaitingVerification,
        Self::PartiallyRegistered,
    ];

    /// The two states a "failed" count means across the admin reports: a permanent submit failure
    /// and a reversal the study registry made after the fact.
    pub const HARD_FAILURE_STATES: [Self; 2] = [Self::FailedPermanent, Self::Misregistered];

    /// The states the pipeline itself may move a row from `self` to, staying put excluded.
    ///
    /// The one place the shape of the machine is written down: every edge here is one a phase, the
    /// precondition recompute or the grade-improvement materialiser actually takes, and
    /// [`transition`](super::transition::transition) refuses anything else. Admin-only edges live in
    /// [`ADMIN_ONLY_TARGETS`] instead, kept out of reach of a phase that could take one by mistake.
    pub fn allowed_targets(self) -> &'static [Self] {
        use CreditRegistrationState as S;
        match self {
            // The way out of the wait is every precondition being met, into the first enrolment
            // check or straight to resolving; the other two edges are eligibility or the
            // completion going away.
            S::Pending => &[
                S::ReadyToSubmit,
                S::NoUsableEnrolment,
                S::Blocked,
                S::Cancelled,
            ],
            // `resolving_enrolment` is resolve-enrolments claiming the row and `failed_retryable`
            // is it finding nothing to ask about; the rest is that phase's preflight and the
            // preconditions.
            S::ReadyToSubmit => &[
                S::Pending,
                S::ResolvingEnrolment,
                S::FailedRetryable,
                S::FailedPermanent,
                S::Blocked,
                S::Cancelled,
            ],
            // `ready_to_submit` only once the recovery grace has passed: while a resolve call is
            // out, only that phase's own commit may move the row, or import could claim it before
            // the enrolment is resolved.
            S::ResolvingEnrolment => &[
                S::Pending,
                S::ReadyToSubmit,
                S::CheckingEnrolment,
                S::NoUsableEnrolment,
                S::Duplicate,
                S::FailedRetryable,
                S::FailedPermanent,
                S::Blocked,
                S::Cancelled,
            ],
            // `submitting` is import's, and the only edge into it.
            S::CheckingEnrolment => &[
                S::Pending,
                S::ReadyToSubmit,
                S::Submitting,
                S::Duplicate,
                S::FailedPermanent,
                S::Blocked,
                S::Cancelled,
            ],
            // Checked where it stands, so resolve-enrolments' answers leave from here too.
            S::NoUsableEnrolment => &[
                S::Pending,
                S::CheckingEnrolment,
                S::Duplicate,
                S::FailedRetryable,
                S::FailedPermanent,
                S::Blocked,
                S::Cancelled,
            ],
            // A request is in flight: every edge out is an answer to it. Nothing leads back to a
            // state import claims.
            S::Submitting => &[
                S::Pending,
                S::NoUsableEnrolment,
                S::AwaitingVerification,
                S::SubmissionUncertain,
                S::Registered,
                S::Duplicate,
                S::NotImproved,
                S::FailedRetryable,
                S::FailedPermanent,
            ],
            // The poller states: verify is the only path to `registered`. `failed_retryable` leads
            // back to import, and only Suotar's own `notRegistered` may take it.
            S::AwaitingVerification => &[
                S::PartiallyRegistered,
                S::Registered,
                S::Duplicate,
                S::Misregistered,
                S::FailedRetryable,
            ],
            S::PartiallyRegistered => &[
                S::Registered,
                S::Duplicate,
                S::Misregistered,
                S::FailedRetryable,
            ],
            // `awaiting_verification` or `partially_registered` once verify finds evidence that the
            // submission landed.
            S::SubmissionUncertain => &[
                S::AwaitingVerification,
                S::PartiallyRegistered,
                S::Registered,
                S::Duplicate,
                S::Misregistered,
                S::FailedRetryable,
            ],
            // The backoff elapsing resumes the row at whichever state matches how far it had got.
            S::FailedRetryable => &[
                S::Pending,
                S::ReadyToSubmit,
                S::CheckingEnrolment,
                S::AwaitingVerification,
                S::FailedPermanent,
                S::Blocked,
                S::Cancelled,
            ],
            S::Blocked => &[
                S::Pending,
                S::ReadyToSubmit,
                S::NoUsableEnrolment,
                S::Cancelled,
            ],
            // Terminal, and `misregistered` waits for a human: the pipeline leaves all of these
            // where they are.
            S::Registered
            | S::Duplicate
            | S::NotImproved
            | S::Misregistered
            | S::FailedPermanent
            | S::Cancelled => &[],
        }
    }

    /// Whether a row that has been sent may be sent again from this state. The outcomes lead a
    /// possibly landed import back towards `import` only on Suotar's `notRegistered`, so the
    /// pipeline states here mean nothing landed.
    fn may_resend_after_sending(self, strictness: ResubmissionStrictness) -> bool {
        match self {
            Self::Pending
            | Self::ReadyToSubmit
            | Self::ResolvingEnrolment
            | Self::CheckingEnrolment
            | Self::NoUsableEnrolment
            | Self::FailedRetryable
            | Self::FailedPermanent
            | Self::Blocked => true,
            // Whether the attainment landed, or Sisu voided it, is for someone looking at this one
            // row to have checked.
            Self::SubmissionUncertain | Self::Misregistered => {
                strictness == ResubmissionStrictness::Any
            }
            // `cancelled` may be a hand cancellation of a row still awaiting verification.
            Self::Submitting
            | Self::AwaitingVerification
            | Self::PartiallyRegistered
            | Self::Registered
            | Self::Duplicate
            | Self::NotImproved
            | Self::Cancelled => false,
        }
    }

    /// What an attempt entering `self` does to the rows it was sent to replace; see
    /// [`mark_pending_superseded`](super::mark_pending_superseded).
    pub(super) fn pending_supersession_effect(self) -> PendingSupersessionEffect {
        use PendingSupersessionEffect as Effect;
        match self {
            Self::Registered | Self::Duplicate => Effect::Complete,
            // Frozen and still headed for Sisu, or already in the person-module slot. A
            // `not_improved` row keeps the slot, so the row it was meant to replace stays out of
            // it.
            Self::CheckingEnrolment
            | Self::Submitting
            | Self::SubmissionUncertain
            | Self::AwaitingVerification
            | Self::PartiallyRegistered
            | Self::FailedRetryable
            | Self::NotImproved => Effect::Keep,
            // Nothing of this attempt is in Sisu, and it goes through resolve-enrolments again,
            // which weighs it afresh, before anything more is sent.
            Self::Pending
            | Self::ReadyToSubmit
            | Self::ResolvingEnrolment
            | Self::NoUsableEnrolment
            | Self::Misregistered
            | Self::FailedPermanent
            | Self::Blocked
            | Self::Cancelled => Effect::Abandon,
        }
    }

    /// The states of the wait for an enrolment: `no_usable_enrolment`, and those a first check or a
    /// retried lookup passes through on its way there. Entering any other clears the check
    /// schedule.
    pub fn keeps_enrolment_check_schedule(self) -> bool {
        matches!(
            self,
            Self::NoUsableEnrolment
                | Self::ReadyToSubmit
                | Self::ResolvingEnrolment
                | Self::FailedRetryable
        )
    }

    /// How long a row entering this state waits before the pipeline may claim it again, when the
    /// caller of [`transition`](super::transition::transition) names no time of its own. Zero leaves it
    /// claimable at once.
    ///
    /// Only the states a claim query reads, or a precondition arm holds a row in, need a nonzero
    /// one: a phase that forgot to defer would otherwise spin on the row, since every claim orders
    /// by `next_attempt_at`. A caller with a real backoff to apply passes it and overrides this.
    pub(super) fn default_attempt_delay(self) -> TimeDelta {
        use crate::credit_registration_policy::backoff::{
            SUBMIT_BASE_BACKOFF, UNCERTAIN_RECHECK, VERIFY_FIRST_DELAY,
        };
        use crate::credit_registration_policy::enrolment_check_schedule::REGISTRY_LAG;
        match self {
            Self::AwaitingVerification | Self::PartiallyRegistered => VERIFY_FIRST_DELAY,
            Self::SubmissionUncertain => UNCERTAIN_RECHECK,
            Self::NoUsableEnrolment => REGISTRY_LAG,
            Self::FailedRetryable => SUBMIT_BASE_BACKOFF,
            _ => TimeDelta::zero(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PendingSupersessionEffect {
    Keep,
    /// The replaced rows become superseded by this one.
    Complete,
    /// The replaced rows are the live credit again.
    Abandon,
}

/// What decides whether a row may be moved by hand, read off whichever row type the caller has.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ResubmissionFacts {
    pub state: CreditRegistrationState,
    /// A later attempt replaced this one.
    pub is_superseded: bool,
    pub resubmit_not_before: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
}

impl ResubmissionFacts {
    /// Whether the row may move back to `ready_to_submit`, and why not if it may not.
    ///
    /// One precedence shared by the teacher-facing retry and the admin ledger's hand transitions;
    /// `strictness` is how far outside a failure a caller may move a row from. A row that has been
    /// sent is refused at every strictness unless its state says the submission cannot count twice,
    /// so `awaiting_verification` -> `cancelled` -> `ready_to_submit` cannot launder a resend.
    pub fn resubmission_refusal(
        &self,
        strictness: ResubmissionStrictness,
    ) -> Option<ResubmissionRefusal> {
        use CreditRegistrationState as State;
        let state = self.state;
        if self.is_superseded {
            return Some(ResubmissionRefusal::Superseded);
        }
        if state.is_success() {
            return Some(ResubmissionRefusal::AlreadySucceeded);
        }
        if matches!(
            state,
            State::Submitting | State::AwaitingVerification | State::PartiallyRegistered
        ) {
            return Some(ResubmissionRefusal::AlreadySubmitted);
        }
        if strictness != ResubmissionStrictness::Any && state == State::SubmissionUncertain {
            return Some(ResubmissionRefusal::SubmissionUncertain);
        }
        if self.submitted_at.is_some() && !state.may_resend_after_sending(strictness) {
            return Some(ResubmissionRefusal::AlreadySubmitted);
        }
        if strictness == ResubmissionStrictness::OnlyFailedPermanent
            && state != State::FailedPermanent
        {
            return Some(ResubmissionRefusal::NotFailedPermanent);
        }
        if self
            .resubmit_not_before
            .is_some_and(|not_before| Utc::now() < not_before)
        {
            return Some(ResubmissionRefusal::SubmissionPending);
        }
        None
    }

    /// Why a hand transition of the row to `target` is refused, or `None` if it may go ahead.
    ///
    /// The safety half of the admin path, next to the structural half in [`ADMIN_ONLY_TARGETS`]: the
    /// edge table says the move exists, this decides whether this row may take it. A success state
    /// is refused outright, since `cancelled` -> `ready_to_submit` would launder a second submission
    /// for a credit Sisu already has. Cancelling a `submitting` row is refused too, its request still
    /// in flight. `ready_to_submit` itself is decided by [`Self::resubmission_refusal`].
    pub fn admin_transition_refusal(
        &self,
        target: CreditRegistrationState,
        strictness: ResubmissionStrictness,
    ) -> Option<ResubmissionRefusal> {
        use CreditRegistrationState as State;
        if self.is_superseded {
            return Some(ResubmissionRefusal::Superseded);
        }
        if self.state.is_success() {
            return Some(ResubmissionRefusal::AlreadySucceeded);
        }
        if target == State::Cancelled && self.state == State::Submitting {
            return Some(ResubmissionRefusal::AlreadySubmitted);
        }
        if target != State::ReadyToSubmit {
            return None;
        }
        self.resubmission_refusal(strictness)
    }
}

/// The edges only a hand transition may take, from any state
/// [`ResubmissionFacts::admin_transition_refusal`] does not refuse: putting a row back on the
/// pipeline, and writing one off.
///
/// Kept out of [`CreditRegistrationState::allowed_targets`] so no phase can take one by mistake.
pub const ADMIN_ONLY_TARGETS: [CreditRegistrationState; 2] = [
    CreditRegistrationState::ReadyToSubmit,
    CreditRegistrationState::Cancelled,
];

/// How far outside a failure [`ResubmissionFacts::resubmission_refusal`] will still allow a row to
/// move back to `ready_to_submit`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResubmissionStrictness {
    /// The automatic teacher retry: only a row that failed for good may go back on the pipeline,
    /// because a row this always refuses would otherwise occupy a slot of the bulk cap forever.
    OnlyFailedPermanent,
    /// An admin's bulk hand transition: [`Self::Any`] minus `submission_uncertain`, which
    /// re-importing could put a second attainment on a real transcript over, so it needs a human
    /// looking at that one row rather than a checkbox in a list.
    AnyExceptSubmissionUncertain,
    /// An admin's single-row hand transition: a human is already looking at this one row, so even
    /// `submission_uncertain` may be resubmitted.
    Any,
}

/// Why [`ResubmissionFacts::resubmission_refusal`] would not move a row.
///
/// Rendered by the teacher and admin surfaces, which decide from it which buttons a row gets, so it
/// travels to them as it is rather than being re-mapped per surface.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ResubmissionRefusal {
    /// A later attempt replaced this one; act on that.
    Superseded,
    /// The study registry already holds an outcome for this attempt, so there is nothing to submit
    /// again.
    AlreadySucceeded,
    /// The submission may have landed, so only a human looking at this one row may move it.
    SubmissionUncertain,
    /// Not a failure at all: [`ResubmissionStrictness::OnlyFailedPermanent`] only.
    NotFailedPermanent,
    /// Suotar still holds the earlier submission open, and may yet turn it into an attainment.
    SubmissionPending,
    /// Already sent to Suotar with no final answer on this row: acting again risks a second Sisu
    /// attainment before the first is resolved.
    AlreadySubmitted,
}

/// Why a ledger row is where it is; `state` says what happens to it next.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(
    type_name = "credit_registration_error_code",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationErrorCode {
    PersonNotFound,
    CourseCodeNotFound,
    EnrolmentNotFound,
    EnrolmentNotAccepted,
    InvalidGradeForGradeScale,
    GradeScaleMismatch,
    CourseNotAllowed,
    InvalidCredits,
    StudyRightNotValid,
    SisuValidationFailed,
    SisuTimeout,
    ServiceTemporarilyUnavailable,
    Misregistered,
    NotRegistered,
    Unauthorized,
    MalformedRequest,
    TransportError,
    UnexpectedResponse,
    NoGradeScaleMapping,
    MissingUhCourseCode,
    MissingEctsCredits,
    RetryWindowExpired,
    Unknown,
}

impl CreditRegistrationErrorCode {
    /// Every code, so the retryability classification can be proven total at runtime too.
    pub const ALL: [Self; 23] = [
        Self::PersonNotFound,
        Self::CourseCodeNotFound,
        Self::EnrolmentNotFound,
        Self::EnrolmentNotAccepted,
        Self::InvalidGradeForGradeScale,
        Self::GradeScaleMismatch,
        Self::CourseNotAllowed,
        Self::InvalidCredits,
        Self::StudyRightNotValid,
        Self::SisuValidationFailed,
        Self::SisuTimeout,
        Self::ServiceTemporarilyUnavailable,
        Self::Misregistered,
        Self::NotRegistered,
        Self::Unauthorized,
        Self::MalformedRequest,
        Self::TransportError,
        Self::UnexpectedResponse,
        Self::NoGradeScaleMapping,
        Self::MissingUhCourseCode,
        Self::MissingEctsCredits,
        Self::RetryWindowExpired,
        Self::Unknown,
    ];
}
