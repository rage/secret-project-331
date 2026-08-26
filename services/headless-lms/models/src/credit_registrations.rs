//! The credit registration ledger.
//!
//! [`transition`], and its batched twin [`transition_batch`], are the only writers of `state`,
//! stamping `state_entered_at`, the lifecycle timestamps and the audit event in one transaction.
//! Which transition to make is the caller's decision; whether it is one the machine has is decided
//! here, from [`CreditRegistrationState::allowed_targets`].
use std::collections::HashMap;

use chrono::NaiveDate;
use utoipa::ToSchema;

use crate::credit_registration_events::{CreditRegistrationEventKind, NewCreditRegistrationEvent};
use crate::library::credit_registration::{
    CreditRegistrationPendingReason, PendingPreconditions, PendingReasonCounts,
};
use crate::library::students_view::escape_like_pattern;
use crate::prelude::*;
use crate::verified_student_numbers::StudentNumberVerificationMethod;

/// What the pipeline does next with a ledger row.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(type_name = "credit_registration_state", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationState {
    /// Waiting on a precondition: the completion, the student's consent or a linked student number.
    /// Which one is derived at read time, never stored.
    Pending,
    ReadyToSubmit,
    ResolvingEnrolment,
    CheckingEnrolment,
    NoUsableEnrolment,
    Submitting,
    SubmissionUncertain,
    AwaitingVerification,
    Registered,
    Duplicate,
    NotImproved,
    Misregistered,
    FailedRetryable,
    FailedPermanent,
    Blocked,
    Cancelled,
    AbandonedByConsentWithdrawal,
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
        Self::Registered,
        Self::Duplicate,
        Self::NotImproved,
        Self::Misregistered,
        Self::FailedRetryable,
        Self::FailedPermanent,
        Self::Blocked,
        Self::Cancelled,
        Self::AbandonedByConsentWithdrawal,
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
                | Self::AbandonedByConsentWithdrawal
        )
    }

    /// Entry to one of these anchors the retry window in `first_failed_at`.
    pub fn is_failure(self) -> bool {
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

    /// The two states a "failed" count means across the admin reports: a permanent submit failure
    /// and a reversal the study registry made after the fact.
    pub const HARD_FAILURE_STATES: [Self; 2] = [Self::FailedPermanent, Self::Misregistered];

    /// The states the pipeline itself may move a row from `self` to, staying put excluded.
    ///
    /// The one place the shape of the machine is written down: every edge here is one a phase, the
    /// precondition recompute or the grade-improvement materialiser actually takes, and
    /// [`transition`] refuses anything else. A hand transition also gets [`ADMIN_ONLY_TARGETS`],
    /// which is why they are not in here: an edge only a human may take must stay out of reach of a
    /// phase that gets its target wrong.
    pub fn allowed_targets(self) -> &'static [Self] {
        use CreditRegistrationState as S;
        match self {
            // The way out of the wait is every precondition being met; the other two edges are the
            // consent or the completion going away.
            S::Pending => &[S::ReadyToSubmit, S::Blocked, S::Cancelled],
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
            // No `ready_to_submit`: a resolve call is out, and only that phase's own commit may
            // move the row, or import could claim it before the enrolment is resolved.
            S::ResolvingEnrolment => &[
                S::Pending,
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
            S::NoUsableEnrolment => &[S::Pending, S::ReadyToSubmit, S::Blocked, S::Cancelled],
            // A request is in flight: every edge out is an answer to it, or withdrawal giving up on
            // one. Nothing leads back to a state import claims.
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
                S::AbandonedByConsentWithdrawal,
            ],
            // Both poller states: verify is the only path to `registered`, and neither may reach a
            // state that leads back to import.
            S::AwaitingVerification | S::SubmissionUncertain => &[
                S::Registered,
                S::Duplicate,
                S::Misregistered,
                S::AbandonedByConsentWithdrawal,
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
            S::Blocked => &[S::Pending, S::ReadyToSubmit, S::Cancelled],
            // Terminal, and `misregistered` waits for a human: the pipeline leaves all of these
            // where they are.
            S::Registered
            | S::Duplicate
            | S::NotImproved
            | S::Misregistered
            | S::FailedPermanent
            | S::Cancelled
            | S::AbandonedByConsentWithdrawal => &[],
        }
    }

    /// Whether a row in `self` may move back to `ready_to_submit`, and why not if it may not.
    ///
    /// One precedence shared by the teacher-facing retry and the admin ledger's hand transitions,
    /// which otherwise refuse the same rows for the same reasons in three independently maintained
    /// copies. `strictness` is the one real difference between the callers: how far outside a
    /// failure a row may still be moved from. Superseded is checked first regardless, since acting
    /// on a replaced attempt is never right, and an outcome the registry already holds next, since
    /// no strictness may resubmit over one; consent is checked last, since it is cheapest to be
    /// wrong about first (every other check is a fact about `self`, not a lookup).
    pub fn resubmission_refusal(
        self,
        superseded: bool,
        consented: bool,
        strictness: ResubmissionStrictness,
    ) -> Option<ResubmissionRefusal> {
        if superseded {
            return Some(ResubmissionRefusal::Superseded);
        }
        if self.is_success() {
            return Some(ResubmissionRefusal::AlreadySucceeded);
        }
        if strictness != ResubmissionStrictness::Any && self == Self::SubmissionUncertain {
            return Some(ResubmissionRefusal::SubmissionUncertain);
        }
        if strictness == ResubmissionStrictness::OnlyFailedPermanent {
            match self {
                Self::FailedPermanent => {}
                Self::AbandonedByConsentWithdrawal => {
                    return Some(ResubmissionRefusal::ConsentWithdrawn);
                }
                _ => return Some(ResubmissionRefusal::NotFailedPermanent),
            }
        }
        if !consented {
            return Some(ResubmissionRefusal::WithoutConsent);
        }
        None
    }

    /// Why a hand transition of this row to `target` is refused, or `None` if it may go ahead.
    ///
    /// The safety half of the admin path, next to the structural half in [`ADMIN_ONLY_TARGETS`]:
    /// the edge table says the move exists, this says whether this row may take it. A row whose
    /// outcome the study registry already holds is refused whatever the target, because `cancelled`
    /// is a legal step on to `ready_to_submit` and would otherwise launder a second submission for
    /// a credit Sisu has. `consented` is the account's standing consent for this row's course;
    /// `strictness` is how the caller treats `submission_uncertain`.
    pub fn admin_transition_refusal(
        self,
        target: Self,
        superseded: bool,
        consented: bool,
        strictness: ResubmissionStrictness,
    ) -> Option<ResubmissionRefusal> {
        if superseded {
            return Some(ResubmissionRefusal::Superseded);
        }
        if self.is_success() {
            return Some(ResubmissionRefusal::AlreadySucceeded);
        }
        if target != Self::ReadyToSubmit {
            return None;
        }
        self.resubmission_refusal(false, consented, strictness)
    }

    /// How long a row entering this state waits before the pipeline may claim it again, when the
    /// caller of [`transition`] names no time of its own. Zero leaves it claimable at once.
    ///
    /// Only the states a claim query reads, or a precondition arm holds a row in, need a nonzero
    /// one: a phase that forgot to defer would otherwise spin on the row, since `claim_due` orders
    /// by `next_attempt_at`. A caller with a real backoff to apply passes it and overrides this.
    fn default_attempt_delay_secs(self) -> i64 {
        use crate::library::credit_registration::backoff::{
            NO_USABLE_ENROLMENT_RECHECK_SECS, SUBMIT_BASE_BACKOFF_SECS, UNCERTAIN_RECHECK_SECS,
            VERIFY_FIRST_DELAY_SECS,
        };
        match self {
            Self::AwaitingVerification => VERIFY_FIRST_DELAY_SECS,
            Self::SubmissionUncertain => UNCERTAIN_RECHECK_SECS,
            Self::NoUsableEnrolment => NO_USABLE_ENROLMENT_RECHECK_SECS,
            Self::FailedRetryable => SUBMIT_BASE_BACKOFF_SECS,
            _ => 0,
        }
    }
}

/// The edges only a hand transition may take, from any state [`admin_transition_refusal`] does not
/// refuse: putting a row back on the pipeline, and writing one off.
///
/// Kept out of [`CreditRegistrationState::allowed_targets`] so no phase can take one by mistake.
pub const ADMIN_ONLY_TARGETS: [CreditRegistrationState; 2] = [
    CreditRegistrationState::ReadyToSubmit,
    CreditRegistrationState::Cancelled,
];

/// How far outside a failure [`CreditRegistrationState::resubmission_refusal`] will still allow a
/// row to move back to `ready_to_submit`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResubmissionStrictness {
    /// The automatic teacher retry: only a row that failed for good may go back on the pipeline,
    /// because a row this always refuses would otherwise occupy a slot of the bulk cap forever.
    OnlyFailedPermanent,
    /// An admin's bulk hand transition: any state may move, except `submission_uncertain`, which
    /// re-importing could put a second attainment on a real transcript over, so it needs a human
    /// looking at that one row rather than a checkbox in a list.
    AnyExceptSubmissionUncertain,
    /// An admin's single-row hand transition: a human is already looking at this one row, so even
    /// `submission_uncertain` may be resubmitted.
    Any,
}

/// Why [`CreditRegistrationState::resubmission_refusal`] would not move a row.
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
    /// The student withdrew consent while the registration was in flight.
    ConsentWithdrawn,
    /// Not a failure at all: [`ResubmissionStrictness::OnlyFailedPermanent`] only.
    NotFailedPermanent,
    /// The student has no standing consent for this course.
    WithoutConsent,
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
    CourseNotAllowed,
    InvalidCredits,
    StudyRightNotValid,
    AcceptorNotFound,
    SisuValidationFailed,
    SisuTimeout,
    SisuTemporarilyUnavailable,
    Misregistered,
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
    pub const ALL: [Self; 22] = [
        Self::PersonNotFound,
        Self::CourseCodeNotFound,
        Self::EnrolmentNotFound,
        Self::EnrolmentNotAccepted,
        Self::InvalidGradeForGradeScale,
        Self::CourseNotAllowed,
        Self::InvalidCredits,
        Self::StudyRightNotValid,
        Self::AcceptorNotFound,
        Self::SisuValidationFailed,
        Self::SisuTimeout,
        Self::SisuTemporarilyUnavailable,
        Self::Misregistered,
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_module_completion_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub course_instance_id: Uuid,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub error_message: Option<String>,
    pub needs_admin_attention: bool,
    pub enrolment_banner_dismissed_at: Option<DateTime<Utc>>,
    pub student_number: Option<String>,
    pub sisu_person_id: Option<String>,
    pub uh_course_code: Option<String>,
    pub selected_enrolment_id: Option<String>,
    pub selected_enrolment_kind: Option<String>,
    pub selected_enrolment_realisation_id: Option<String>,
    pub attainment_date: Option<NaiveDate>,
    pub attainment_language: Option<String>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub request_item_id: String,
    pub submitted_attainment_id: Option<String>,
    pub submitted_attainment_type: Option<String>,
    pub sisu_attainment_id: Option<String>,
    pub sisu_attainment_type: Option<String>,
    pub submit_retry_count: i32,
    pub verify_attempt_count: i32,
    pub next_attempt_at: DateTime<Utc>,
    pub first_failed_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    pub superseded_at: Option<DateTime<Utc>>,
    pub enrolment_checked_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub registered_at: Option<DateTime<Utc>>,
    pub terminal_at: Option<DateTime<Utc>>,
    /// Set once the student mail for that outcome is queued, and never cleared: these two are the
    /// idempotency guard for the `student-notifications` phase.
    pub action_needed_email_delivery_id: Option<Uuid>,
    pub registered_email_delivery_id: Option<Uuid>,
    /// The completion revision the grade-improvement scan last found no improvement against. See
    /// [`mark_improvement_checked`].
    pub improvement_checked_completion_updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewCreditRegistration {
    pub course_module_completion_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub course_instance_id: Uuid,
    pub attempt_number: i32,
}

/// The item id Suotar sees for the import and resolve calls. Deterministic, so a Suotar log line
/// maps to one ledger row without an id allocation table.
pub fn import_request_item_id(registration_id: Uuid) -> String {
    format!("cr-{registration_id}")
}

/// The item id Suotar sees for one verify poll.
pub fn verify_request_item_id(registration_id: Uuid, verify_attempt_count: i32) -> String {
    format!("vf-{registration_id}-{verify_attempt_count}")
}

/// The item id Suotar sees for one look through a student's attainments for a submission we lost
/// track of.
pub fn recovery_request_item_id(registration_id: Uuid, verify_attempt_count: i32) -> String {
    format!("rc-{registration_id}-{verify_attempt_count}")
}

/// Which call a request item id addresses a row for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequestPurpose {
    /// Carrying the row's payload forward: `resolve-enrolments` and then `import`. The row's own
    /// stored id, unchanged across retries, because it is the handle Suotar's log and ours share on
    /// one registration.
    Submission,
    VerifyPoll(i32),
    /// A recovery lookup, which goes to `resolve-enrolments` too: under the submission id it would
    /// be indistinguishable from the row's own resolve call in the registry's log.
    UncertainRecovery(i32),
}

/// What one registration is called in a request. The one place a sender picks an item id, so two
/// calls about one row stay tellable apart in both logs.
pub fn request_item_id(row: &CreditRegistration, purpose: RequestPurpose) -> String {
    match purpose {
        RequestPurpose::Submission => row.request_item_id.clone(),
        RequestPurpose::VerifyPoll(attempt) => verify_request_item_id(row.id, attempt),
        RequestPurpose::UncertainRecovery(attempt) => recovery_request_item_id(row.id, attempt),
    }
}

/// Creates a ledger row at `pending` with a `created` event. The id is allocated here
/// because `request_item_id` derives from it.
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new: &NewCreditRegistration,
    event_message: Option<&str>,
) -> ModelResult<Uuid> {
    let id = pkey_policy.into_uuid();
    let mut tx = conn.begin().await?;
    sqlx::query!(
        r#"
INSERT INTO credit_registrations (
    id,
    course_module_completion_id,
    user_id,
    course_id,
    course_module_id,
    course_instance_id,
    attempt_number,
    request_item_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        id,
        new.course_module_completion_id,
        new.user_id,
        new.course_id,
        new.course_module_id,
        new.course_instance_id,
        new.attempt_number,
        import_request_item_id(id),
    )
    .execute(&mut *tx)
    .await?;

    crate::credit_registration_events::insert(
        &mut tx,
        &NewCreditRegistrationEvent {
            message: event_message.map(str::to_string),
            ..NewCreditRegistrationEvent::new(id, CreditRegistrationEventKind::Created)
        },
    )
    .await?;

    tx.commit().await?;
    Ok(id)
}

#[derive(Debug, Clone, PartialEq)]
pub struct Transition {
    pub to_state: CreditRegistrationState,
    pub error_code: Option<CreditRegistrationErrorCode>,
    /// Scrub before passing: this is persisted.
    pub error_message: Option<String>,
    pub needs_admin_attention: Option<bool>,
    pub event_kind: CreditRegistrationEventKind,
    pub event_message: Option<String>,
    pub actor_user_id: Option<Uuid>,
    pub suotar_api_call_id: Option<Uuid>,
    /// Already scrubbed `{request, response}` payload for the event row.
    pub event_details: Option<serde_json::Value>,
    /// Set by a caller that computed `to_state` from a row snapshot taken before an `await` (an
    /// external call, or a gap before its own transaction) during which some other writer could
    /// have moved the row on. `None` skips the check, for callers writing from a snapshot taken
    /// under the same transaction's lock.
    pub expected_from_state: Option<CreditRegistrationState>,
    /// Which (from → to) edges this write may take; see [`TransitionPolicy`].
    pub policy: TransitionPolicy,
    /// When the pipeline may claim the row next. `None` takes the target state's default cadence,
    /// which is what keeps a caller that forgets from leaving the row spinning.
    pub next_attempt_at: Option<DateTime<Utc>>,
}

/// Which (from → to) edges [`transition`] will write.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransitionPolicy {
    /// [`CreditRegistrationState::allowed_targets`] only: what the phases and the precondition
    /// recompute may take.
    Pipeline,
    /// Also [`ADMIN_ONLY_TARGETS`], for a teacher's retry or an admin's hand transition. Whether
    /// this particular row may take the edge is [`admin_transition_refusal`]'s question.
    Admin,
    /// No edge check. Fixtures only: seeds and tests plant a row in a state the pipeline could not
    /// have reached from where it stands in one move.
    Planted,
}

impl TransitionPolicy {
    fn allows(self, from: CreditRegistrationState, to: CreditRegistrationState) -> bool {
        match self {
            Self::Pipeline => from.allowed_targets().contains(&to),
            Self::Admin => from.allowed_targets().contains(&to) || ADMIN_ONLY_TARGETS.contains(&to),
            Self::Planted => true,
        }
    }
}

impl Transition {
    pub fn to(to_state: CreditRegistrationState) -> Self {
        Self {
            to_state,
            error_code: None,
            error_message: None,
            needs_admin_attention: None,
            event_kind: CreditRegistrationEventKind::StateChanged,
            event_message: None,
            actor_user_id: None,
            suotar_api_call_id: None,
            event_details: None,
            expected_from_state: None,
            policy: TransitionPolicy::Pipeline,
            next_attempt_at: None,
        }
    }

    /// A move a human asked for, which may also take the [`ADMIN_ONLY_TARGETS`] edges.
    pub fn by_hand(to_state: CreditRegistrationState) -> Self {
        Self {
            policy: TransitionPolicy::Admin,
            ..Self::to(to_state)
        }
    }

    /// A fixture planting a row in a state directly; see [`TransitionPolicy::Planted`].
    pub fn planted(to_state: CreditRegistrationState) -> Self {
        Self {
            policy: TransitionPolicy::Planted,
            ..Self::to(to_state)
        }
    }
}

/// Moves a ledger row to a new state and appends the matching audit event, atomically.
///
/// The only writer of `state`, and the one place (from → to) legality is decided: an edge outside
/// the transition's [`TransitionPolicy`] is refused as `InvalidRequest` rather than written.
/// Deliberately not `PreconditionFailed`, which the phases read as "another writer got here first"
/// and skip over.
///
/// Owns the lifecycle stamps, so callers must not touch them: `state_entered_at`, `terminal_at`,
/// `first_failed_at`, `registered_at`, `submitted_at`, `enrolment_checked_at`,
/// `enrolment_banner_dismissed_at`, which entering `no_usable_enrolment` clears, and
/// `next_attempt_at`, which takes the target state's default cadence unless the caller names a time.
pub async fn transition(
    conn: &mut PgConnection,
    id: Uuid,
    transition: &Transition,
) -> ModelResult<CreditRegistration> {
    let mut tx = conn.begin().await?;

    let before = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE id = $1
  AND deleted_at IS NULL
FOR UPDATE
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await?;

    if let Some(expected) = transition.expected_from_state
        && before.state != expected
    {
        return Err(model_err!(
            PreconditionFailed,
            format!(
                "Credit registration {id} is in {:?}, not the expected {expected:?}: refusing to overwrite it.",
                before.state
            )
        ));
    }

    let to_state = transition.to_state;
    check_edge(id, before.state, to_state, transition.policy)?;

    let after = sqlx::query_as!(
        CreditRegistration,
        r#"
UPDATE credit_registrations
SET state = $2::credit_registration_state,
  -- clock_timestamp(), not now(): now() is the transaction timestamp, so several state changes in
  -- one transaction would share an instant and the timeline would lose their order.
  state_entered_at = clock_timestamp(),
  error_code = $3,
  error_message = $4,
  needs_admin_attention = COALESCE($5, needs_admin_attention),
  -- ELSE NULL: without it an admin retry stays invisible to every terminal_at IS NULL query.
  terminal_at = CASE
    WHEN $6 THEN COALESCE(terminal_at, now())
    ELSE NULL
  END,
  first_failed_at = CASE
    WHEN $7 THEN COALESCE(first_failed_at, now())
    ELSE first_failed_at
  END,
  registered_at = CASE
    WHEN $2::credit_registration_state = 'registered' THEN COALESCE(registered_at, now())
    ELSE registered_at
  END,
  submitted_at = CASE
    WHEN $2::credit_registration_state = 'submitting' THEN now()
    ELSE submitted_at
  END,
  enrolment_checked_at = CASE
    WHEN state = 'checking_enrolment'
    AND $2::credit_registration_state <> 'checking_enrolment' THEN now()
    ELSE enrolment_checked_at
  END,
  enrolment_banner_dismissed_at = CASE
    WHEN $2::credit_registration_state = 'no_usable_enrolment' THEN NULL
    ELSE enrolment_banner_dismissed_at
  END,
  next_attempt_at = COALESCE(
    $8::timestamptz,
    now() + ($9::bigint * INTERVAL '1 second')
  )
WHERE id = $1
  AND deleted_at IS NULL
RETURNING *
        "#,
        id,
        to_state as CreditRegistrationState,
        transition.error_code as Option<CreditRegistrationErrorCode>,
        transition.error_message,
        transition.needs_admin_attention,
        to_state.is_terminal(),
        to_state.is_failure(),
        transition.next_attempt_at,
        to_state.default_attempt_delay_secs(),
    )
    .fetch_one(&mut *tx)
    .await?;

    crate::credit_registration_events::insert(
        &mut tx,
        &NewCreditRegistrationEvent {
            credit_registration_id: id,
            kind: transition.event_kind,
            from_state: Some(before.state),
            to_state: Some(to_state),
            error_code: transition.error_code,
            message: transition.event_message.clone(),
            suotar_api_call_id: transition.suotar_api_call_id,
            actor_user_id: transition.actor_user_id,
            details: transition.event_details.clone(),
        },
    )
    .await?;

    tx.commit().await?;
    Ok(after)
}

/// Refuses an edge outside the policy. The one place (from → to) legality is decided, for the
/// single-row [`transition`] and the batched [`transition_batch`] alike.
fn check_edge(
    id: Uuid,
    from: CreditRegistrationState,
    to: CreditRegistrationState,
    policy: TransitionPolicy,
) -> ModelResult<()> {
    // Staying put is not a move: the verify poller rewrites its own state on every poll.
    if from == to || policy.allows(from, to) {
        return Ok(());
    }
    Err(model_err!(
        InvalidRequest,
        format!("Credit registration {id} may not move from {from:?} to {to:?} under {policy:?}.")
    ))
}

/// One row's move in a [`transition_batch`].
#[derive(Debug, Clone, PartialEq)]
pub struct BatchMove {
    pub id: Uuid,
    pub transition: Transition,
}

/// [`transition`] for a whole batch: one lock, one update, one insert of events, whatever the size.
///
/// For the phases that decide many rows from one query and have no per-row exchange to record.
/// Same edge table and policy as [`transition`], and the same event rows; the one difference is
/// that a row whose state no longer matches `expected_from_state` is left alone rather than
/// refused, since a batch has no single caller to hand the refusal to. Returns how many moved.
pub async fn transition_batch(conn: &mut PgConnection, moves: &[BatchMove]) -> ModelResult<i64> {
    if moves.is_empty() {
        return Ok(0);
    }
    let mut tx = conn.begin().await?;
    let ids: Vec<Uuid> = moves.iter().map(|batch_move| batch_move.id).collect();
    let locked = sqlx::query!(
        r#"
SELECT id,
  state AS "state: CreditRegistrationState"
FROM credit_registrations
WHERE id = ANY($1)
  AND deleted_at IS NULL
ORDER BY id FOR
UPDATE
        "#,
        &ids
    )
    .fetch_all(&mut *tx)
    .await?;
    let states: HashMap<Uuid, CreditRegistrationState> =
        locked.into_iter().map(|row| (row.id, row.state)).collect();

    let mut writes = Vec::new();
    let mut events = Vec::new();
    for batch_move in moves {
        let Some(&from) = states.get(&batch_move.id) else {
            continue;
        };
        let to = batch_move.transition.to_state;
        if batch_move
            .transition
            .expected_from_state
            .is_some_and(|expected| expected != from)
        {
            continue;
        }
        check_edge(batch_move.id, from, to, batch_move.transition.policy)?;
        writes.push(batch_move);
        events.push(NewCreditRegistrationEvent {
            credit_registration_id: batch_move.id,
            kind: batch_move.transition.event_kind,
            from_state: Some(from),
            to_state: Some(to),
            error_code: batch_move.transition.error_code,
            message: batch_move.transition.event_message.clone(),
            suotar_api_call_id: batch_move.transition.suotar_api_call_id,
            actor_user_id: batch_move.transition.actor_user_id,
            details: batch_move.transition.event_details.clone(),
        });
    }
    if writes.is_empty() {
        tx.commit().await?;
        return Ok(0);
    }

    let ids: Vec<Uuid> = writes.iter().map(|write| write.id).collect();
    let to_states: Vec<CreditRegistrationState> = writes
        .iter()
        .map(|write| write.transition.to_state)
        .collect();
    let error_codes: Vec<Option<CreditRegistrationErrorCode>> = writes
        .iter()
        .map(|write| write.transition.error_code)
        .collect();
    let error_messages: Vec<Option<String>> = writes
        .iter()
        .map(|write| write.transition.error_message.clone())
        .collect();
    let needs_admin: Vec<Option<bool>> = writes
        .iter()
        .map(|write| write.transition.needs_admin_attention)
        .collect();
    let terminal: Vec<bool> = to_states.iter().map(|state| state.is_terminal()).collect();
    let failure: Vec<bool> = to_states.iter().map(|state| state.is_failure()).collect();
    let next_attempts: Vec<Option<DateTime<Utc>>> = writes
        .iter()
        .map(|write| write.transition.next_attempt_at)
        .collect();
    let default_delays: Vec<i64> = to_states
        .iter()
        .map(|state| state.default_attempt_delay_secs())
        .collect();
    sqlx::query!(
        r#"
UPDATE credit_registrations cr
SET state = move.to_state,
  -- clock_timestamp(), not now(): now() is the transaction timestamp, so several state changes in
  -- one transaction would share an instant and the timeline would lose their order.
  state_entered_at = clock_timestamp(),
  error_code = move.error_code,
  error_message = move.error_message,
  needs_admin_attention = COALESCE(move.needs_admin_attention, cr.needs_admin_attention),
  -- ELSE NULL: without it an admin retry stays invisible to every terminal_at IS NULL query.
  terminal_at = CASE
    WHEN move.terminal THEN COALESCE(cr.terminal_at, now())
    ELSE NULL
  END,
  first_failed_at = CASE
    WHEN move.failure THEN COALESCE(cr.first_failed_at, now())
    ELSE cr.first_failed_at
  END,
  registered_at = CASE
    WHEN move.to_state = 'registered' THEN COALESCE(cr.registered_at, now())
    ELSE cr.registered_at
  END,
  submitted_at = CASE
    WHEN move.to_state = 'submitting' THEN now()
    ELSE cr.submitted_at
  END,
  enrolment_checked_at = CASE
    WHEN cr.state = 'checking_enrolment'
    AND move.to_state <> 'checking_enrolment' THEN now()
    ELSE cr.enrolment_checked_at
  END,
  enrolment_banner_dismissed_at = CASE
    WHEN move.to_state = 'no_usable_enrolment' THEN NULL
    ELSE cr.enrolment_banner_dismissed_at
  END,
  next_attempt_at = COALESCE(
    move.next_attempt_at,
    now() + (move.default_delay_secs * INTERVAL '1 second')
  )
FROM UNNEST(
    $1::uuid [],
    $2::credit_registration_state [],
    $3::credit_registration_error_code [],
    $4::text [],
    $5::boolean [],
    $6::boolean [],
    $7::boolean [],
    $8::timestamptz [],
    $9::bigint []
  ) AS move(
    id,
    to_state,
    error_code,
    error_message,
    needs_admin_attention,
    terminal,
    failure,
    next_attempt_at,
    default_delay_secs
  )
WHERE cr.id = move.id
  AND cr.deleted_at IS NULL
        "#,
        &ids,
        &to_states as &[CreditRegistrationState],
        &error_codes as &[Option<CreditRegistrationErrorCode>],
        &error_messages as &[Option<String>],
        &needs_admin as &[Option<bool>],
        &terminal,
        &failure,
        &next_attempts as &[Option<DateTime<Utc>>],
        &default_delays,
    )
    .execute(&mut *tx)
    .await?;

    crate::credit_registration_events::insert_batch(&mut tx, &events).await?;
    tx.commit().await?;
    Ok(i64::try_from(writes.len()).unwrap_or(i64::MAX))
}

/// Backdates `state_entered_at` for a registration, so a test can simulate a row that has been
/// sitting in its state long enough for a backoff or timeout to fire.
///
/// Exists only for test setup: [`transition`] owns this stamp, and calling this from a live path
/// would desynchronize it from the state it is supposed to describe.
pub async fn set_state_entered_at_for_testing(
    conn: &mut PgConnection,
    id: Uuid,
    state_entered_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE credit_registrations
SET state_entered_at = $2
WHERE id = $1
        ",
        id,
        state_entered_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Backdates `first_failed_at` for a registration, so a test can simulate a retry window that
/// started long enough ago for its retry limit to have elapsed.
///
/// Exists only for test setup: [`transition`] owns this stamp, and calling this from a live path
/// would desynchronize it from the failure it is supposed to describe.
pub async fn set_first_failed_at_for_testing(
    conn: &mut PgConnection,
    id: Uuid,
    first_failed_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE credit_registrations
SET first_failed_at = $2
WHERE id = $1
        ",
        id,
        first_failed_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Excuses every one of a user's rows (or, with `course_id`, just that course's) from unscoped
/// `claim_due` calls until `held_until`; a scoped call ignores every hold regardless (see
/// `claim_due`). Keyed on identity rather than a row id so a spec can hold before materialize
/// creates the row it means to protect, closing the window a row-id hold could only ever narrow:
/// the live background worker ticks every 10s regardless of any single test, so a hold applied
/// after the row exists still races the worker's own next tick.
///
/// Exists only for test setup: nothing in the product ever needs to hide a user's rows from the
/// worker that owns them.
pub async fn set_test_exclusive_hold_for_testing(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Option<Uuid>,
    held_until: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO credit_registration_test_exclusive_holds (user_id, course_id, held_until)
VALUES ($1, $2, $3)
        ",
        user_id,
        course_id,
        held_until,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Which rows a phase iteration may touch. Empty means every row, which is what production runs; a
/// narrowed scope lets a test drive the pipeline for its own course on a shared database.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct RegistrationScope {
    pub course_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    /// The precision escape hatch, for a caller that already knows its ledger rows.
    pub credit_registration_ids: Vec<Uuid>,
}

impl RegistrationScope {
    pub fn is_unscoped(&self) -> bool {
        self.course_id.is_none()
            && self.user_id.is_none()
            && self.credit_registration_ids.is_empty()
    }

    pub fn for_course(course_id: Uuid) -> Self {
        Self {
            course_id: Some(course_id),
            ..Self::default()
        }
    }
}

/// Claims up to `limit` due rows in the given states for this worker.
///
/// The row locks live until the caller's transaction ends, so callers must pass a transaction. Rows
/// on a paused course module, or on one whose credit registration has been switched off, are never
/// claimed: enforced here so no phase can forget it. Both freeze a row where it stands rather than
/// cancelling it, so switching the module back on resumes the rows that were already in flight.
///
/// An unscoped call (the live background worker) also skips a row whose user (and, if the hold
/// names one, course) has a live row in `credit_registration_test_exclusive_holds`. A scoped call
/// always ignores holds, so a spec driving its own rows through explicit ticks is unaffected
/// either way.
pub async fn claim_due(
    conn: &mut PgConnection,
    states: &[CreditRegistrationState],
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<CreditRegistration>> {
    let is_scoped_call = !scope.is_unscoped();
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
WITH due AS (
  SELECT cr.id
  FROM credit_registrations cr
    JOIN credit_registration_active_course_modules acm ON acm.course_module_id = cr.course_module_id
  WHERE cr.deleted_at IS NULL
    AND cr.superseded_by_id IS NULL
    AND cr.state = ANY($1::credit_registration_state [])
    AND cr.next_attempt_at <= now()
    AND ($3::uuid IS NULL OR cr.course_id = $3)
    AND ($4::uuid IS NULL OR cr.user_id = $4)
    AND (
      cardinality($5::uuid []) = 0
      OR cr.id = ANY($5::uuid [])
    )
    AND (
      $6::boolean
      OR NOT EXISTS (
        SELECT 1
        FROM credit_registration_test_exclusive_holds h
        WHERE h.user_id = cr.user_id
          AND (
            h.course_id IS NULL
            OR h.course_id = cr.course_id
          )
          AND h.held_until > now()
      )
    )
  ORDER BY cr.next_attempt_at
  FOR UPDATE OF cr SKIP LOCKED
  LIMIT $2
)
UPDATE credit_registrations cr
SET last_attempt_at = now()
FROM due
WHERE cr.id = due.id
RETURNING cr.*
        "#,
        states as &[CreditRegistrationState],
        limit,
        scope.course_id,
        scope.user_id,
        &scope.credit_registration_ids,
        is_scoped_call,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<CreditRegistration> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The named rows, locked until the caller's transaction ends. Must be called inside one.
///
/// For a caller that judges each row and then transitions it: holding the lock is what keeps the
/// judgement true, so [`transition`]'s `expected_from_state` cannot fail halfway and roll the whole
/// batch back. Locks in id order, which every batch caller shares, so two of them cannot deadlock.
pub async fn get_by_ids_for_update(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE id = ANY($1::uuid [])
  AND deleted_at IS NULL
ORDER BY id FOR UPDATE
        "#,
        ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
        "#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

#[cfg(test)]
pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT *
FROM credit_registrations
WHERE course_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One ledger row with the course, module and enrolment facts every student view needs, so a status
/// page is one query rather than a fan-out per row.
#[derive(Debug, Clone, PartialEq)]
pub struct StudentCreditRegistration {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_slug: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub next_attempt_at: DateTime<Utc>,
    pub registered_at: Option<DateTime<Utc>>,
    pub sisu_attainment_id: Option<String>,
    pub credits: Option<f32>,
    pub grade_id: Option<String>,
    /// Needed to read `grade_id`: "1" is a pass on the pass/fail scale and a one out of five on the
    /// numeric one.
    pub grade_scale_id: Option<String>,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    pub superseded_at: Option<DateTime<Utc>>,
    pub enrolment_checked_at: Option<DateTime<Utc>>,
    /// The teacher's label for the realisation we submitted against, not a Sisu id.
    pub enrolment_realisation_name: Option<String>,
    /// Needed to build the enrolment link a student with no usable enrolment is sent to.
    pub open_university_product_id: Option<String>,
    pub completion_eligible: bool,
    pub consented: bool,
    pub has_verified_student_number: bool,
}

impl StudentCreditRegistration {
    /// What a `pending` row is waiting on, which is what its student-facing status is derived from.
    pub fn preconditions(&self) -> PendingPreconditions {
        PendingPreconditions {
            completion_eligible: self.completion_eligible,
            consented: self.consented,
            has_verified_student_number: self.has_verified_student_number,
        }
    }
}

/// Narrows [`get_student_facing_by_user_id`]; the default returns every row of the user's.
#[derive(Debug, Default, Clone, Copy)]
pub struct StudentRegistrationFilter {
    pub course_module_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    /// Only rows the in-course re-enrol banner is owed: parked on a missing enrolment and not yet
    /// dismissed.
    pub enrolment_banner_due: bool,
}

/// The user's registrations as the student surfaces show them, newest completion first. Superseded
/// attempts are included: the student is entitled to see an earlier attempt Sisu may still hold.
pub async fn get_student_facing_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    filter: StudentRegistrationFilter,
) -> ModelResult<Vec<StudentCreditRegistration>> {
    let res = sqlx::query_as!(
        StudentCreditRegistration,
        r#"
SELECT cr.id,
  cr.course_id,
  c.name AS course_name,
  c.slug AS course_slug,
  cr.course_module_id,
  cm.name AS course_module_name,
  cm.uh_course_code,
  cm.ects_credits,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state,
  cr.error_code AS "error_code?",
  cr.next_attempt_at,
  cr.registered_at,
  cr.sisu_attainment_id,
  cr.credits,
  cr.grade_id,
  cr.grade_scale_id,
  cr.attempt_number,
  cr.superseded_by_id,
  cr.superseded_at,
  cr.enrolment_checked_at,
  r.label AS "enrolment_realisation_name?",
  conf.open_university_product_id AS "open_university_product_id?",
  p.completion_eligible AS "completion_eligible!",
  p.consented AS "consented!",
  p.has_verified_student_number AS "has_verified_student_number!"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cr.course_module_id
  AND conf.deleted_at IS NULL
  LEFT JOIN course_module_suotar_realisations r ON r.course_module_id = cr.course_module_id
  AND r.course_unit_realisation_id = cr.selected_enrolment_realisation_id
  AND r.deleted_at IS NULL
WHERE cr.user_id = $1
  AND cr.deleted_at IS NULL
  AND ($2::uuid IS NULL OR cr.course_module_id = $2)
  AND ($3::uuid IS NULL OR cr.course_id = $3)
  AND (
    NOT $4::boolean
    OR (
      cr.state = 'no_usable_enrolment'
      AND cr.enrolment_banner_dismissed_at IS NULL
    )
  )
ORDER BY cmc.completion_date DESC,
  cr.attempt_number DESC
        "#,
        user_id,
        filter.course_module_id,
        filter.course_id,
        filter.enrolment_banner_due,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Frozen copy of what we are about to submit. Written once, before the row leaves
/// `checking_enrolment`: a later regrade must not alter a submitted row.
#[derive(Debug, Clone, PartialEq)]
pub struct PayloadSnapshot {
    pub student_number: String,
    pub sisu_person_id: String,
    pub uh_course_code: String,
    pub selected_enrolment_id: Option<String>,
    pub selected_enrolment_kind: Option<String>,
    pub selected_enrolment_realisation_id: Option<String>,
    pub attainment_date: NaiveDate,
    pub attainment_language: String,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub credits: f32,
}

pub async fn set_payload_snapshot(
    conn: &mut PgConnection,
    id: Uuid,
    snapshot: &PayloadSnapshot,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET student_number = $2,
  sisu_person_id = $3,
  uh_course_code = $4,
  selected_enrolment_id = $5,
  selected_enrolment_kind = $6,
  selected_enrolment_realisation_id = $7,
  attainment_date = $8,
  attainment_language = $9,
  grade_scale_id = $10,
  grade_id = $11,
  credits = $12
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        snapshot.student_number,
        snapshot.sisu_person_id,
        snapshot.uh_course_code,
        snapshot.selected_enrolment_id,
        snapshot.selected_enrolment_kind,
        snapshot.selected_enrolment_realisation_id,
        snapshot.attainment_date,
        snapshot.attainment_language,
        snapshot.grade_scale_id,
        snapshot.grade_id,
        snapshot.credits,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_submitted_attainment(
    conn: &mut PgConnection,
    id: Uuid,
    submitted_attainment_id: &str,
    submitted_attainment_type: Option<&str>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET submitted_attainment_id = $2,
  submitted_attainment_type = $3
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        submitted_attainment_id,
        submitted_attainment_type,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records the attainment the study registry holds, unless another live row already claims it.
///
/// Two rows may legitimately be told about one attainment — a grade improvement Sisu declines names
/// the attainment the first attempt registered — so this returns `false` instead of failing.
pub async fn set_sisu_attainment_if_unclaimed(
    conn: &mut PgConnection,
    id: Uuid,
    sisu_attainment_id: &str,
    sisu_attainment_type: Option<&str>,
) -> ModelResult<bool> {
    let updated = sqlx::query_scalar!(
        r#"
UPDATE credit_registrations
SET sisu_attainment_id = $2,
  sisu_attainment_type = $3
WHERE id = $1
  AND deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registrations other
    WHERE other.sisu_attainment_id = $2
      AND other.deleted_at IS NULL
      AND other.id <> $1
  )
RETURNING id
        "#,
        id,
        sisu_attainment_id,
        sisu_attainment_type,
    )
    .fetch_optional(conn)
    .await;
    match updated {
        Ok(updated) => Ok(updated.is_some()),
        // The NOT EXISTS guard above isn't atomic against a concurrent caller claiming the
        // same sisu_attainment_id for a different row; the loser hits this unique index instead.
        Err(err) => {
            let err: ModelError = err.into();
            match err.error_type() {
                ModelErrorType::DatabaseConstraint { constraint, .. }
                    if constraint == "uq_credit_registrations_sisu_attainment" =>
                {
                    Ok(false)
                }
                _ => Err(err),
            }
        }
    }
}

/// Defers when the pipeline may next claim this row; the delay is the caller's policy.
///
/// Deliberately leaves `first_failed_at` alone: a state that waits on a human defers too, and
/// anchoring the retry window here would expire it.
pub async fn schedule_next_attempt(
    conn: &mut PgConnection,
    id: Uuid,
    next_attempt_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        next_attempt_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Makes rows claimable again now, whatever backoff parked them.
///
/// Uses the database clock: an app-clock value sampled after `BEGIN` is still in the future when
/// the same transaction compares it against `now()`.
pub async fn make_due_now_batch(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = now()
WHERE id = ANY($1)
  AND next_attempt_at > now()
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        ids,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Brings forward the recheck of rows parked for want of an enrolment, for students the study
/// registry now lists as enrolled.
///
/// Only the clock moves: the enrolment is re-resolved by the precondition recompute rather than
/// assumed from a roster entry.
pub async fn recheck_no_usable_enrolment_now(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_ids: &[Uuid],
) -> ModelResult<u64> {
    let res = sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = now()
WHERE course_id = $1
  AND user_id = ANY($2::uuid [])
  AND state = 'no_usable_enrolment'
  AND next_attempt_at > now()
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        course_id,
        user_ids,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

pub async fn increment_submit_retry_count(conn: &mut PgConnection, id: Uuid) -> ModelResult<i32> {
    let res = sqlx::query!(
        r#"
UPDATE credit_registrations
SET submit_retry_count = submit_retry_count + 1
WHERE id = $1
  AND deleted_at IS NULL
RETURNING submit_retry_count
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.submit_retry_count)
}

/// Counts one verify poll for every row of a batch and returns each row's new count. The count is
/// part of the poll's request item id, so it has to be taken before the request goes out.
pub async fn increment_verify_attempt_counts(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, i32>> {
    let rows = sqlx::query!(
        r#"
UPDATE credit_registrations
SET verify_attempt_count = verify_attempt_count + 1
WHERE id = ANY($1)
  AND deleted_at IS NULL
RETURNING id,
  verify_attempt_count
        "#,
        ids
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.id, row.verify_attempt_count))
        .collect())
}

/// [`schedule_next_attempt`] for a whole batch, each row with its own time.
pub async fn schedule_next_attempts(
    conn: &mut PgConnection,
    scheduled: &[(Uuid, DateTime<Utc>)],
) -> ModelResult<()> {
    let (ids, times): (Vec<Uuid>, Vec<DateTime<Utc>>) = scheduled.iter().copied().unzip();
    sqlx::query!(
        r#"
UPDATE credit_registrations cr
SET next_attempt_at = scheduled.at
FROM UNNEST($1::uuid [], $2::timestamptz []) AS scheduled(id, at)
WHERE cr.id = scheduled.id
  AND cr.deleted_at IS NULL
        "#,
        &ids,
        &times,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_needs_admin_attention(
    conn: &mut PgConnection,
    id: Uuid,
    needs_admin_attention: bool,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET needs_admin_attention = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        needs_admin_attention,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The student dismissed the in-course-material re-enrol banner for this registration.
pub async fn dismiss_enrolment_banner(
    conn: &mut PgConnection,
    id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET enrolment_banner_dismissed_at = now()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
        "#,
        id,
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Points an old attempt at the newer one that replaced it. The old row keeps its state and
/// `terminal_at`: it really was registered.
///
/// `superseded_by_id` may name a row that does not exist yet, as long as it is inserted before the
/// caller's transaction commits: the foreign key is deferred, which is what lets the successor take
/// the completion's one live slot without the old attempt ever pointing at itself.
pub async fn mark_superseded(
    conn: &mut PgConnection,
    id: Uuid,
    superseded_by_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET superseded_by_id = $2,
  superseded_at = now()
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        superseded_by_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Whether this account has any attempt, live or replaced, on this course.
///
/// For course-scoped handlers that take a user id from a request body: without it, holding one
/// course lets a teacher ask questions about accounts that have nothing to do with it.
pub async fn exists_for_user_and_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<bool> {
    let exists = sqlx::query_scalar!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM credit_registrations
    WHERE user_id = $1
      AND course_id = $2
      AND deleted_at IS NULL
  ) AS "exists!"
        "#,
        user_id,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(exists)
}

/// Records that the grade-improvement scan looked at this accepted attempt against a completion in
/// the given revision and found nothing better.
///
/// `completion_updated_at` must be the `updated_at` the scan actually read, not `now()`: the point is
/// that the row stops being a candidate until the completion changes again.
pub async fn mark_improvement_checked(
    conn: &mut PgConnection,
    id: Uuid,
    completion_updated_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET improvement_checked_completion_updated_at = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        completion_updated_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The course's live rows a bulk retry can actually move: failed for good, and with a standing
/// consent. Oldest first, capped by `limit`.
///
/// Deliberately only these. A row a retry always refuses keeps matching for as long as it exists, so
/// letting one into the batch would spend a slot of the cap on it forever: a course holding `limit`
/// of them could never retry anything again. [`count_unretryable_by_course_id`] is what reports them.
pub async fn get_retryable_ids_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    limit: i64,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT id
FROM credit_registrations cr
WHERE cr.course_id = $1
  AND cr.state = 'failed_permanent'
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM course_credit_registration_consents consent
    WHERE consent.user_id = cr.user_id
      AND consent.course_id = cr.course_id
      AND consent.consent_given
      AND consent.deleted_at IS NULL
  )
ORDER BY cr.state_entered_at
LIMIT $2
        "#,
        course_id,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// How many of a course's live rows a bulk retry has to refuse, by reason.
///
/// Counts the whole course, not a capped window: these are the rows
/// [`get_retryable_ids_by_course_id`] leaves out, and a teacher clicking again will never work
/// through them. Each count is one verdict of
/// [`CreditRegistrationState::resubmission_refusal`], reproduced in SQL because asking it per row
/// would mean walking every registration of the course; the two are kept in step only by
/// `tests::the_unretryable_counts_match_the_resubmission_verdicts`.
pub async fn count_unretryable_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<(ResubmissionRefusal, i64)>> {
    let row = sqlx::query!(
        r#"
SELECT COUNT(*) FILTER (
    WHERE cr.state = 'submission_uncertain'
  ) AS "submission_uncertain!",
  COUNT(*) FILTER (
    WHERE cr.state = 'failed_permanent'
  ) AS "without_consent!"
FROM credit_registrations cr
WHERE cr.course_id = $1
  AND cr.state IN ('failed_permanent', 'submission_uncertain')
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND (
    cr.state = 'submission_uncertain'
    OR NOT EXISTS (
      SELECT 1
      FROM course_credit_registration_consents consent
      WHERE consent.user_id = cr.user_id
        AND consent.course_id = cr.course_id
        AND consent.consent_given
        AND consent.deleted_at IS NULL
    )
  )
        "#,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok([
        (
            ResubmissionRefusal::SubmissionUncertain,
            row.submission_uncertain,
        ),
        (ResubmissionRefusal::WithoutConsent, row.without_consent),
    ]
    .into_iter()
    .filter(|(_, count)| *count > 0)
    .collect())
}

/// Live rows per state, for the dashboard funnel. Superseded attempts are excluded, as in the
/// per-course sibling, or a course that regrades counts every student twice.
pub async fn count_by_state(
    conn: &mut PgConnection,
) -> ModelResult<Vec<(CreditRegistrationState, i64)>> {
    let rows = sqlx::query!(
        r#"
SELECT state,
  COUNT(*) AS "count!"
FROM credit_registrations
WHERE superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY state
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(|r| (r.state, r.count)).collect())
}

/// Live `pending` rows per blocker, for the surfaces that used to read the three collapsed states
/// off the ledger. Derived from `credit_registration_preconditions`, so it cannot disagree with what
/// the recompute is waiting for or with what the student is shown.
pub async fn count_pending_by_reason(conn: &mut PgConnection) -> ModelResult<PendingReasonCounts> {
    let row = sqlx::query!(
        r#"
SELECT COUNT(*) FILTER (
    WHERE NOT p.completion_eligible
  ) AS "completion_count!",
  COUNT(*) FILTER (
    WHERE p.completion_eligible
      AND NOT p.consented
  ) AS "consent_count!",
  COUNT(*) FILTER (
    WHERE p.completion_eligible
      AND p.consented
      AND NOT p.has_verified_student_number
  ) AS "student_number_count!"
FROM credit_registrations cr
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
WHERE cr.state = 'pending'
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(PendingReasonCounts {
        completion_count: row.completion_count,
        consent_count: row.consent_count,
        student_number_count: row.student_number_count,
    })
}

/// This account's live rows on this course that consent is the thing holding up. What the consent
/// screen counts before and after the answer, so the difference is what consenting unblocked.
pub async fn count_waiting_for_consent(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registrations cr
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
WHERE cr.user_id = $1
  AND cr.course_id = $2
  AND cr.state = 'pending'
  AND p.completion_eligible
  AND NOT p.consented
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
        "#,
        user_id,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Live rows of one course per module and state, for the teacher's per-module summary, with how many
/// of each need a human folded in: both counts are read off the same scan, since the summary always
/// wants them together.
pub async fn count_by_module_and_state_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<(Uuid, CreditRegistrationState, i64, i64)>> {
    let rows = sqlx::query!(
        r#"
SELECT course_module_id,
  state,
  COUNT(*) AS "count!",
  COUNT(*) FILTER (WHERE needs_admin_attention) AS "needs_admin_attention_count!"
FROM credit_registrations
WHERE course_id = $1
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY course_module_id,
  state
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            (
                r.course_module_id,
                r.state,
                r.count,
                r.needs_admin_attention_count,
            )
        })
        .collect())
}

/// One ledger row as a teacher sees it: the raw state, the student's identity and the unmasked
/// verified student number, but never the study registry's own error text.
#[derive(Debug, Clone, PartialEq)]
pub struct TeacherCreditRegistration {
    pub id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_instance_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub registered_at: Option<DateTime<Utc>>,
    pub sisu_attainment_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    /// Live only: a soft-deleted link is no longer a number we hold for this student.
    pub student_number: Option<String>,
    pub student_number_verified_at: Option<DateTime<Utc>>,
    pub student_number_verified_via: Option<StudentNumberVerificationMethod>,
    /// Needed to find the account's linking mails, which are keyed on the Sisu person.
    pub sisu_person_id: Option<String>,
    pub enrolment_realisation_name: Option<String>,
    pub completion_eligible: bool,
    pub consented: bool,
    /// The page's total row count, so a caller can read it off the first row instead of a second query.
    pub total_count: i64,
}

impl TeacherCreditRegistration {
    /// What a `pending` row is waiting on. The linked number is the row's own `student_number`,
    /// which is the live link rather than the one a submitted payload froze.
    pub fn preconditions(&self) -> PendingPreconditions {
        PendingPreconditions {
            completion_eligible: self.completion_eligible,
            consented: self.consented,
            has_verified_student_number: self.student_number.is_some(),
        }
    }
}

/// The optional narrowings a teacher surface applies, all of them in SQL.
#[derive(Debug, Clone, Default)]
pub struct TeacherCreditRegistrationFilters<'a> {
    pub id: Option<Uuid>,
    pub user_ids: Option<&'a [Uuid]>,
    pub state: Option<CreditRegistrationState>,
    /// Matched against the student's name, email or verified student number.
    pub search: Option<&'a str>,
    pub course_instance_id: Option<Uuid>,
    /// Narrows to every attempt of one completion.
    pub course_module_completion_id: Option<Uuid>,
}

/// The one query behind every teacher-facing read, so a filter wired into a page cannot be missed
/// in its count. `total_count` is computed before the limit, which is why the count reads it with
/// `limit = 1`.
async fn teacher_facing_page(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    filters: &TeacherCreditRegistrationFilters<'_>,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<TeacherCreditRegistration>> {
    let search_pattern = filters.search.map(search_pattern_of);
    let res = sqlx::query_as!(
        TeacherCreditRegistration,
        r#"
SELECT cr.id,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  cr.course_module_id,
  cm.name AS course_module_name,
  cr.course_instance_id,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state,
  cr.state_entered_at,
  cr.error_code AS "error_code?",
  cr.needs_admin_attention,
  cr.next_attempt_at,
  cr.registered_at,
  cr.sisu_attainment_id,
  cr.grade_id,
  cr.credits,
  cr.attempt_number,
  cr.superseded_by_id,
  vsn.student_number AS "student_number?",
  vsn.verified_at AS "student_number_verified_at?",
  vsn.verified_via AS "student_number_verified_via?",
  vsn.sisu_person_id AS "sisu_person_id?",
  r.label AS "enrolment_realisation_name?",
  p.completion_eligible AS "completion_eligible!",
  p.consented AS "consented!",
  COUNT(*) OVER () AS "total_count!"
FROM credit_registrations cr
  JOIN course_modules cm ON cm.id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL
  LEFT JOIN course_module_suotar_realisations r ON r.course_module_id = cr.course_module_id
  AND r.course_unit_realisation_id = cr.selected_enrolment_realisation_id
  AND r.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND ($1::uuid IS NULL OR cr.course_id = $1)
  AND ($2::uuid IS NULL OR cr.id = $2)
  AND ($3::uuid [] IS NULL OR cr.user_id = ANY($3))
  AND (
    $4::credit_registration_state IS NULL
    OR cr.state = $4
  )
  AND (
    $5::text IS NULL
    OR ud.name_search_helper LIKE '%' || $5 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $5 || '%' ESCAPE '\'
    OR LOWER(vsn.student_number) LIKE '%' || $5 || '%' ESCAPE '\'
  )
  AND ($6::uuid IS NULL OR cr.course_instance_id = $6)
  AND ($7::uuid IS NULL OR cr.course_module_completion_id = $7)
ORDER BY cmc.completion_date DESC,
  cr.attempt_number DESC,
  cr.id
LIMIT $8 OFFSET $9
        "#,
        course_id,
        filters.id,
        filters.user_ids,
        filters.state as Option<CreditRegistrationState>,
        search_pattern.as_deref(),
        filters.course_instance_id,
        filters.course_module_completion_id,
        limit,
        offset,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The course's ledger rows as the teacher surfaces show them, newest completion first.
pub async fn get_teacher_facing_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    filters: &TeacherCreditRegistrationFilters<'_>,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<TeacherCreditRegistration>> {
    teacher_facing_page(conn, Some(course_id), filters, limit, offset).await
}

/// How many rows [`get_teacher_facing_by_course_id`] would return without a page limit.
pub async fn count_teacher_facing_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    filters: &TeacherCreditRegistrationFilters<'_>,
) -> ModelResult<i64> {
    let rows = teacher_facing_page(conn, Some(course_id), filters, 1, 0).await?;
    Ok(rows.first().map_or(0, |row| row.total_count))
}

/// Lowercased and with metacharacters escaped, so a search for `%` matches a literal one.
fn search_pattern_of(search: &str) -> String {
    escape_like_pattern(&search.to_lowercase())
}

/// One row for a teacher surface, by id. `None` when no such live row exists.
pub async fn get_teacher_facing_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Option<TeacherCreditRegistration>> {
    let rows = teacher_facing_page(
        conn,
        None,
        &TeacherCreditRegistrationFilters {
            id: Some(id),
            ..TeacherCreditRegistrationFilters::default()
        },
        1,
        0,
    )
    .await?;
    Ok(rows.into_iter().next())
}

/// Every attempt for the same completion as `row`, that one included, newest attempt first.
pub async fn get_teacher_facing_attempts_for_completion(
    conn: &mut PgConnection,
    row: &TeacherCreditRegistration,
) -> ModelResult<Vec<TeacherCreditRegistration>> {
    get_teacher_facing_by_course_id(
        conn,
        row.course_id,
        &TeacherCreditRegistrationFilters {
            user_ids: Some(&[row.user_id]),
            course_module_completion_id: Some(row.course_module_completion_id),
            ..TeacherCreditRegistrationFilters::default()
        },
        i64::MAX,
        0,
    )
    .await
}

/// One ledger row as an admin sees it: every identifier support needs to answer "what happened to
/// this student", across courses.
///
/// Not the study registry's own error text: it is written for an integrator, may name a person and
/// is untranslated. The error code and the scrubbed call bodies stand in for it.
#[derive(Debug, Clone, PartialEq)]
pub struct AdminCreditRegistration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// In full: the admin view exists to resolve support cases, which starts from the address.
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_instance_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub registered_at: Option<DateTime<Utc>>,
    pub terminal_at: Option<DateTime<Utc>>,
    /// Frozen on the row when it left `checking_enrolment`, so it is what we actually sent.
    pub student_number: Option<String>,
    pub sisu_person_id: Option<String>,
    pub uh_course_code: Option<String>,
    pub selected_enrolment_id: Option<String>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub request_item_id: String,
    pub submitted_attainment_id: Option<String>,
    pub sisu_attainment_id: Option<String>,
    pub submit_retry_count: i32,
    pub verify_attempt_count: i32,
    pub attempt_number: i32,
    pub superseded_by_id: Option<Uuid>,
    /// The account's live link now, which may differ from the number frozen on the row.
    pub verified_student_number: Option<String>,
    pub verified_student_number_at: Option<DateTime<Utc>>,
    pub verified_student_number_via: Option<StudentNumberVerificationMethod>,
    pub completion_eligible: bool,
    pub consented: bool,
    pub has_verified_student_number: bool,
    /// The page's total row count, so a caller can read it off the first row instead of a second query.
    pub total_count: i64,
}

impl AdminCreditRegistration {
    /// What this row is waiting on, or `None` where it is not waiting at all: outside `pending` the
    /// preconditions say nothing about why the row is where it is.
    pub fn pending_reason(&self) -> Option<CreditRegistrationPendingReason> {
        (self.state == CreditRegistrationState::Pending)
            .then(|| {
                PendingPreconditions {
                    completion_eligible: self.completion_eligible,
                    consented: self.consented,
                    has_verified_student_number: self.has_verified_student_number,
                }
                .reason()
            })
            .flatten()
    }
}

/// How the explorer orders a page. Descending only: an ops table is read newest-worst first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AdminCreditRegistrationSort {
    #[default]
    LastActivity,
    Created,
    TimeInState,
    Attempts,
}

impl AdminCreditRegistrationSort {
    /// Bound into the query's `ORDER BY` as a `text` parameter.
    fn as_str(self) -> &'static str {
        match self {
            Self::LastActivity => "last_activity",
            Self::Created => "created",
            Self::TimeInState => "time_in_state",
            Self::Attempts => "attempts",
        }
    }
}

/// The narrowings the admin explorer applies, all of them in SQL.
#[derive(Debug, Clone, Default)]
pub struct AdminCreditRegistrationFilters<'a> {
    pub states: Option<&'a [CreditRegistrationState]>,
    pub error_codes: Option<&'a [CreditRegistrationErrorCode]>,
    pub course_id: Option<Uuid>,
    pub course_module_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub student_number: Option<&'a str>,
    pub needs_admin_attention: bool,
    pub submitted_after: Option<DateTime<Utc>>,
    pub submitted_before: Option<DateTime<Utc>>,
    /// Matched against the student's name and email, either student number, the attainment ids and
    /// the stored error text. Searching that text is not rendering it.
    pub search: Option<&'a str>,
    /// A uuid typed into the search box: a registration, a user or a completion id. Ambiguous by
    /// design, for a human's paste. A caller that already knows which single field it means should
    /// use `id` or `course_module_completion_id` instead, not this plus a Rust-side filter.
    pub search_id: Option<Uuid>,
    /// Exactly one registration.
    pub id: Option<Uuid>,
    /// Every attempt against one completion.
    pub course_module_completion_id: Option<Uuid>,
    /// An exact set of rows, for a caller that already knows which ones it wants.
    pub credit_registration_ids: Option<&'a [Uuid]>,
    /// Off by default, or a course that regrades shows two rows per student.
    pub include_superseded: bool,
}

/// The one query behind both [`get_admin_facing`] and [`count_admin_facing`], so a filter wired
/// into one cannot be missed in the other. `total_count` is computed before the limit, which is why
/// `count_admin_facing` reads it with `limit = 1`.
async fn admin_facing_page(
    conn: &mut PgConnection,
    filters: &AdminCreditRegistrationFilters<'_>,
    sort: AdminCreditRegistrationSort,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<AdminCreditRegistration>> {
    let search_pattern = filters.search.map(search_pattern_of);
    let res = sqlx::query_as!(
        AdminCreditRegistration,
        r#"
SELECT cr.id,
  cr.created_at,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  c.name AS course_name,
  cr.course_module_id,
  cm.name AS course_module_name,
  cr.course_instance_id,
  cr.course_module_completion_id,
  cmc.completion_date,
  cr.state,
  cr.state_entered_at,
  cr.error_code AS "error_code?",
  cr.needs_admin_attention,
  cr.next_attempt_at,
  cr.last_attempt_at,
  cr.submitted_at,
  cr.registered_at,
  cr.terminal_at,
  cr.student_number,
  cr.sisu_person_id,
  cr.uh_course_code,
  cr.selected_enrolment_id,
  cr.grade_scale_id,
  cr.grade_id,
  cr.credits,
  cr.request_item_id,
  cr.submitted_attainment_id,
  cr.sisu_attainment_id,
  cr.submit_retry_count,
  cr.verify_attempt_count,
  cr.attempt_number,
  cr.superseded_by_id,
  vsn.student_number AS "verified_student_number?",
  vsn.verified_at AS "verified_student_number_at?",
  vsn.verified_via AS "verified_student_number_via?",
  p.completion_eligible AS "completion_eligible!",
  p.consented AS "consented!",
  p.has_verified_student_number AS "has_verified_student_number!",
  COUNT(*) OVER () AS "total_count!"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND ($1::bool OR cr.superseded_by_id IS NULL)
  AND (
    $2::credit_registration_state [] IS NULL
    OR cr.state = ANY($2)
  )
  AND (
    $3::credit_registration_error_code [] IS NULL
    OR cr.error_code = ANY($3)
  )
  AND ($4::uuid IS NULL OR cr.course_id = $4)
  AND ($5::uuid IS NULL OR cr.course_module_id = $5)
  AND ($6::uuid IS NULL OR cr.user_id = $6)
  AND (
    $7::text IS NULL
    OR cr.student_number = $7
    OR vsn.student_number = $7
  )
  AND (NOT $8::bool OR cr.needs_admin_attention)
  AND ($9::timestamptz IS NULL OR cr.submitted_at >= $9)
  AND ($10::timestamptz IS NULL OR cr.submitted_at <= $10)
  AND (
    $11::text IS NULL
    OR ud.name_search_helper LIKE '%' || $11 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.student_number) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(vsn.student_number) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.submitted_attainment_id) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.sisu_attainment_id) LIKE '%' || $11 || '%' ESCAPE '\'
    OR LOWER(cr.error_message) LIKE '%' || $11 || '%' ESCAPE '\'
  )
  AND (
    $12::uuid IS NULL
    OR cr.id = $12
    OR cr.user_id = $12
    OR cr.course_module_completion_id = $12
  )
  AND (
    $13::uuid [] IS NULL
    OR cr.id = ANY($13)
  )
  AND ($17::uuid IS NULL OR cr.id = $17)
  AND (
    $18::uuid IS NULL
    OR cr.course_module_completion_id = $18
  )
ORDER BY CASE
    WHEN $14::text = 'attempts' THEN cr.submit_retry_count + cr.verify_attempt_count
  END DESC NULLS LAST,
  CASE $14::text
    WHEN 'created' THEN cr.created_at
    WHEN 'time_in_state' THEN cr.state_entered_at
    ELSE COALESCE(cr.last_attempt_at, cr.state_entered_at)
  END DESC,
  cr.id
LIMIT $15 OFFSET $16
        "#,
        filters.include_superseded,
        filters.states as Option<&[CreditRegistrationState]>,
        filters.error_codes as Option<&[CreditRegistrationErrorCode]>,
        filters.course_id,
        filters.course_module_id,
        filters.user_id,
        filters.student_number,
        filters.needs_admin_attention,
        filters.submitted_after,
        filters.submitted_before,
        search_pattern.as_deref(),
        filters.search_id,
        filters.credit_registration_ids as Option<&[Uuid]>,
        sort.as_str(),
        limit,
        offset,
        filters.id,
        filters.course_module_completion_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// A page of the ledger for the admin explorer, cross-course.
pub async fn get_admin_facing(
    conn: &mut PgConnection,
    filters: &AdminCreditRegistrationFilters<'_>,
    sort: AdminCreditRegistrationSort,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<AdminCreditRegistration>> {
    admin_facing_page(conn, filters, sort, limit, offset).await
}

/// How many rows [`get_admin_facing`] would return without a page limit.
pub async fn count_admin_facing(
    conn: &mut PgConnection,
    filters: &AdminCreditRegistrationFilters<'_>,
) -> ModelResult<i64> {
    let rows =
        admin_facing_page(conn, filters, AdminCreditRegistrationSort::default(), 1, 0).await?;
    Ok(rows.first().map_or(0, |row| row.total_count))
}

/// Live rows carrying an error code, split by whether the pipeline is still working on them.
#[derive(Debug, Clone, PartialEq)]
pub struct CreditRegistrationErrorCodeCount {
    pub error_code: CreditRegistrationErrorCode,
    pub in_flight_count: i64,
    pub terminal_failure_count: i64,
}

/// The error-code breakdown the Overview shows. A row abandoned by a consent withdrawal carries no
/// failure of ours, so it is in neither column.
pub async fn count_by_error_code(
    conn: &mut PgConnection,
) -> ModelResult<Vec<CreditRegistrationErrorCodeCount>> {
    let rows = sqlx::query!(
        r#"
SELECT error_code AS "error_code!",
  COUNT(*) FILTER (WHERE terminal_at IS NULL) AS "in_flight_count!",
  COUNT(*) FILTER (
    WHERE state = ANY($1::credit_registration_state [])
  ) AS "terminal_failure_count!"
FROM credit_registrations
WHERE error_code IS NOT NULL
  AND state <> 'abandoned_by_consent_withdrawal'
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY error_code
ORDER BY COUNT(*) DESC
        "#,
        &CreditRegistrationState::HARD_FAILURE_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| CreditRegistrationErrorCodeCount {
            error_code: row.error_code,
            in_flight_count: row.in_flight_count,
            terminal_failure_count: row.terminal_failure_count,
        })
        .collect())
}

pub async fn count_needing_admin_attention(conn: &mut PgConnection) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registrations
WHERE needs_admin_attention
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// The row that has been waiting longest for the pipeline to do something with it.
#[derive(Debug, Clone, PartialEq)]
pub struct OldestNonTerminalRegistration {
    pub id: Uuid,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
}

pub async fn get_oldest_non_terminal(
    conn: &mut PgConnection,
) -> ModelResult<Option<OldestNonTerminalRegistration>> {
    let row = sqlx::query_as!(
        OldestNonTerminalRegistration,
        r#"
SELECT id,
  state,
  state_entered_at
FROM credit_registrations
WHERE terminal_at IS NULL
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
ORDER BY state_entered_at
LIMIT 1
        "#,
    )
    .fetch_optional(conn)
    .await?;
    Ok(row)
}

/// One day of terminal outcomes, for the throughput series.
#[derive(Debug, Clone, PartialEq)]
pub struct CreditRegistrationThroughputDay {
    pub day: DateTime<Utc>,
    pub registered_count: i64,
    pub other_success_count: i64,
    pub failed_count: i64,
}

/// Daily terminal outcomes over the window. Withdrawn rows are in no column: they are neither a
/// success nor a failure.
pub async fn get_throughput_by_day(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<Vec<CreditRegistrationThroughputDay>> {
    let rows = sqlx::query_as!(
        CreditRegistrationThroughputDay,
        r#"
SELECT DATE_TRUNC('day', terminal_at) AS "day!",
  COUNT(*) FILTER (WHERE state = 'registered') AS "registered_count!",
  COUNT(*) FILTER (
    WHERE state = ANY($2::credit_registration_state [])
  ) AS "other_success_count!",
  COUNT(*) FILTER (WHERE state = 'failed_permanent') AS "failed_count!"
FROM credit_registrations
WHERE terminal_at >= $1
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY 1
ORDER BY 1
        "#,
        since,
        &CreditRegistrationState::OTHER_SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// What the pipeline finished in a window. Rows abandoned by a consent withdrawal are in no column
/// and in no total: they are neither a success nor a failure of ours.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct TerminalOutcomeTotals {
    /// `registered`, `duplicate` and `not_improved`.
    pub success_count: i64,
    /// The subset we put in the registry ourselves.
    pub registered_count: i64,
    pub failed_permanent_count: i64,
    pub cancelled_count: i64,
    pub abandoned_count: i64,
    /// The denominator of the success rate: everything above except the abandoned.
    pub total_count: i64,
}

pub async fn count_terminal_outcomes_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<TerminalOutcomeTotals> {
    let res = sqlx::query_as!(
        TerminalOutcomeTotals,
        r#"
SELECT COUNT(*) FILTER (
    WHERE state = ANY($2::credit_registration_state [])
  ) AS "success_count!",
  COUNT(*) FILTER (WHERE state = 'registered') AS "registered_count!",
  COUNT(*) FILTER (WHERE state = 'failed_permanent') AS "failed_permanent_count!",
  COUNT(*) FILTER (WHERE state = 'cancelled') AS "cancelled_count!",
  COUNT(*) FILTER (
    WHERE state = 'abandoned_by_consent_withdrawal'
  ) AS "abandoned_count!",
  COUNT(*) FILTER (
    WHERE state <> 'abandoned_by_consent_withdrawal'
  ) AS "total_count!"
FROM credit_registrations
WHERE terminal_at >= $1
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        since,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Live rows that entered one state within the window. `misregistered` is not terminal, so
/// `terminal_at` cannot answer this.
pub async fn count_entered_state_since(
    conn: &mut PgConnection,
    state: CreditRegistrationState,
    since: DateTime<Utc>,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registrations
WHERE state = $1
  AND state_entered_at >= $2
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        state as CreditRegistrationState,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// How long registration took, in seconds, for rows that reached `registered` in a window.
#[derive(Debug, Clone, PartialEq)]
pub struct RegistrationLatency {
    pub registered_count: i64,
    /// `terminal_at - created_at`: the student's wait, most of which is theirs to end.
    pub p50_end_to_end_secs: Option<i64>,
    pub p95_end_to_end_secs: Option<i64>,
    /// `registered_at - submitted_at`: how long the study registry took, which is the number to
    /// quote at them.
    pub p50_confirmation_secs: Option<i64>,
    pub p95_confirmation_secs: Option<i64>,
}

pub async fn get_registration_latency_between(
    conn: &mut PgConnection,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> ModelResult<RegistrationLatency> {
    let res = sqlx::query_as!(
        RegistrationLatency,
        r#"
SELECT COUNT(*) AS "registered_count!",
  CEIL(
    EXTRACT(
      EPOCH
      FROM PERCENTILE_DISC(0.5) WITHIN GROUP (
          ORDER BY terminal_at - created_at
        )
    )
  )::bigint AS "p50_end_to_end_secs",
  CEIL(
    EXTRACT(
      EPOCH
      FROM PERCENTILE_DISC(0.95) WITHIN GROUP (
          ORDER BY terminal_at - created_at
        )
    )
  )::bigint AS "p95_end_to_end_secs",
  CEIL(
    EXTRACT(
      EPOCH
      FROM PERCENTILE_DISC(0.5) WITHIN GROUP (
          ORDER BY registered_at - submitted_at
        )
    )
  )::bigint AS "p50_confirmation_secs",
  CEIL(
    EXTRACT(
      EPOCH
      FROM PERCENTILE_DISC(0.95) WITHIN GROUP (
          ORDER BY registered_at - submitted_at
        )
    )
  )::bigint AS "p95_confirmation_secs"
FROM credit_registrations
WHERE state = 'registered'
  AND terminal_at >= $1
  AND terminal_at < $2
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        from,
        to,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Live volumes per course module, for the Courses tab's one row per module.
#[derive(Debug, Clone, PartialEq)]
pub struct ModuleRegistrationTotals {
    pub course_module_id: Uuid,
    pub total_count: i64,
    pub success_count: i64,
    pub in_flight_count: i64,
    pub failed_count: i64,
    pub abandoned_count: i64,
    pub needs_admin_attention_count: i64,
    pub awaiting_consent_count: i64,
    pub last_registered_at: Option<DateTime<Utc>>,
    /// The code most of the module's failing rows carry, which is usually the whole diagnosis.
    pub top_error_code: Option<CreditRegistrationErrorCode>,
}

/// `failed_count` is `failed_permanent` and `misregistered` only; a withdrawal is in neither that
/// column nor the success one, so both are shown and the two never add up to the total by design.
pub async fn count_by_module(
    conn: &mut PgConnection,
) -> ModelResult<Vec<ModuleRegistrationTotals>> {
    let res = sqlx::query_as!(
        ModuleRegistrationTotals,
        r#"
SELECT cr.course_module_id,
  COUNT(*) AS "total_count!",
  COUNT(*) FILTER (
    WHERE cr.state = ANY($1::credit_registration_state [])
  ) AS "success_count!",
  COUNT(*) FILTER (WHERE cr.terminal_at IS NULL) AS "in_flight_count!",
  COUNT(*) FILTER (
    WHERE cr.state = ANY($2::credit_registration_state [])
  ) AS "failed_count!",
  COUNT(*) FILTER (
    WHERE cr.state = 'abandoned_by_consent_withdrawal'
  ) AS "abandoned_count!",
  COUNT(*) FILTER (WHERE cr.needs_admin_attention) AS "needs_admin_attention_count!",
  COUNT(*) FILTER (
    WHERE cr.state = 'pending'
      AND NOT p.consented
  ) AS "awaiting_consent_count!",
  MAX(cr.registered_at) AS "last_registered_at",
  (
    SELECT inner_cr.error_code
    FROM credit_registrations inner_cr
    WHERE inner_cr.course_module_id = cr.course_module_id
      AND inner_cr.error_code IS NOT NULL
      AND inner_cr.state <> 'abandoned_by_consent_withdrawal'
      AND inner_cr.superseded_by_id IS NULL
      AND inner_cr.deleted_at IS NULL
    GROUP BY inner_cr.error_code
    ORDER BY COUNT(*) DESC,
      inner_cr.error_code
    LIMIT 1
  ) AS "top_error_code?: CreditRegistrationErrorCode"
FROM credit_registrations cr
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
WHERE superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY cr.course_module_id
        "#,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
        &CreditRegistrationState::HARD_FAILURE_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One row the Errors tab wants a human to look at, with the detectors that picked it.
#[derive(Debug, Clone, PartialEq)]
pub struct AttentionRegistration {
    pub id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub attempt_count: i32,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub student_number: Option<String>,
    pub stuck_in_state: bool,
    pub permanent_error: bool,
    pub retry_window_expired: bool,
    pub misregistered: bool,
    pub too_many_attempts: bool,
    pub outcome_uncertain: bool,
    pub flagged_by_pipeline: bool,
}

/// Rows at least one attention detector picked, worst-waiting first.
///
/// Superseded rows and `abandoned_by_consent_withdrawal` are excluded in the query rather than left
/// to a predicate elsewhere: a false positive here costs an operator's attention directly.
/// `thresholds` are the same seconds [`count_stuck`] uses, so the table and the alert cannot
/// disagree about what stuck means.
pub async fn get_attention_items(
    conn: &mut PgConnection,
    thresholds: &StuckThresholds,
    too_many_attempts: i32,
    limit: i64,
) -> ModelResult<Vec<AttentionRegistration>> {
    let (state_thresholds, threshold_secs) = thresholds.state_seconds_arrays();
    let res = sqlx::query_as!(
        AttentionRegistration,
        r#"
SELECT cr.id,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  c.name AS course_name,
  cr.course_module_id,
  cm.name AS course_module_name,
  cr.state,
  cr.state_entered_at,
  cr.error_code AS "error_code?",
  cr.submit_retry_count + cr.verify_attempt_count AS "attempt_count!",
  cr.needs_admin_attention,
  cr.next_attempt_at,
  cr.student_number,
  d.stuck_in_state AS "stuck_in_state!",
  d.permanent_error AS "permanent_error!",
  d.retry_window_expired AS "retry_window_expired!",
  d.misregistered AS "misregistered!",
  d.too_many_attempts AS "too_many_attempts!",
  d.outcome_uncertain AS "outcome_uncertain!",
  d.flagged_by_pipeline AS "flagged_by_pipeline!"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN LATERAL (
    SELECT u.threshold_secs
    FROM UNNEST($1::credit_registration_state [], $2::double precision []) AS u(state, threshold_secs)
    WHERE u.state = cr.state
  ) t ON TRUE
  CROSS JOIN LATERAL (
    SELECT cr.terminal_at IS NULL
      AND t.threshold_secs IS NOT NULL
      AND now() - cr.state_entered_at > MAKE_INTERVAL(secs => t.threshold_secs) AS stuck_in_state,
      cr.state = 'failed_permanent'
      AND cr.needs_admin_attention AS permanent_error,
      -- Coalesced because error_code is nullable and this is selected into a plain `bool`: a row
      -- another detector picked while holding no error code would otherwise fail to decode and take
      -- the whole table down with it.
      COALESCE(cr.error_code = 'retry_window_expired', FALSE) AS retry_window_expired,
      cr.state = 'misregistered' AS misregistered,
      cr.submit_retry_count + cr.verify_attempt_count >= $3 AS too_many_attempts,
      cr.state = 'submission_uncertain' AS outcome_uncertain,
      cr.needs_admin_attention AS flagged_by_pipeline
  ) d
WHERE cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND cr.state <> 'abandoned_by_consent_withdrawal'
  AND (
    d.stuck_in_state
    OR d.permanent_error
    OR d.retry_window_expired
    OR d.misregistered
    OR d.too_many_attempts
    OR d.outcome_uncertain
    OR d.flagged_by_pipeline
  )
ORDER BY cr.state_entered_at
LIMIT $4
        "#,
        &state_thresholds as &[CreditRegistrationState],
        &threshold_secs as &[f64],
        too_many_attempts,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Live rows in each of the given states, newest activity first within each state, for the
/// Reconciliation lists. `limit_per_state` caps every state independently, via `ROW_NUMBER`, so one
/// state with many rows cannot crowd another out of a shared `LIMIT`.
pub async fn get_live_by_states(
    conn: &mut PgConnection,
    states: &[CreditRegistrationState],
    limit_per_state: i64,
) -> ModelResult<Vec<CreditRegistration>> {
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
SELECT cr.*
FROM credit_registrations cr
  JOIN (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY state
        ORDER BY state_entered_at DESC
      ) AS rn
    FROM credit_registrations
    WHERE state = ANY($1)
      AND superseded_by_id IS NULL
      AND deleted_at IS NULL
  ) ranked ON ranked.id = cr.id
WHERE ranked.rn <= $2
ORDER BY cr.state_entered_at DESC
        "#,
        states as &[CreditRegistrationState],
        limit_per_state,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Makes every due-later `failed_retryable` row due now; returns how many. The button pressed once
/// the study registry says an outage is over.
///
/// Only `failed_retryable`: no other state's backoff means "waiting out an outage", and
/// `submission_uncertain` must never be swept forward in bulk.
pub async fn requeue_retryable_now(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    course_module_id: Option<Uuid>,
    limit: i64,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
WITH due AS (
  SELECT id
  FROM credit_registrations
  WHERE state = 'failed_retryable'
    AND next_attempt_at > now()
    AND superseded_by_id IS NULL
    AND deleted_at IS NULL
    AND ($2::uuid IS NULL OR course_id = $2)
    AND ($3::uuid IS NULL OR course_module_id = $3)
  ORDER BY next_attempt_at
  LIMIT $1
),
updated AS (
  UPDATE credit_registrations cr
  SET next_attempt_at = now()
  FROM due
  WHERE cr.id = due.id
  RETURNING cr.id
)
SELECT COUNT(*) AS "count!"
FROM updated
        "#,
        limit,
        course_id,
        course_module_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// How long a row may sit in one state before it counts as stuck. Seconds, per state.
///
/// Also the wire payload the health endpoint reports as thresholds: field names are the
/// `stuck_*_secs` keys the frontend reads, so do not rename without updating it.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct StuckThresholds {
    pub stuck_ready_to_submit_secs: i64,
    pub stuck_submitting_secs: i64,
    pub stuck_awaiting_verification_secs: i64,
    pub stuck_failed_retryable_secs: i64,
}

impl StuckThresholds {
    /// The four states this covers, paired with their threshold in seconds, in a fixed order both
    /// `get_attention_items` and `count_stuck` bind the same way: `UNNEST`ed into a
    /// state -> threshold lookup rather than each carrying its own copy of the `CASE`.
    fn state_seconds_arrays(&self) -> ([CreditRegistrationState; 4], [f64; 4]) {
        (
            [
                CreditRegistrationState::ReadyToSubmit,
                CreditRegistrationState::Submitting,
                CreditRegistrationState::AwaitingVerification,
                CreditRegistrationState::FailedRetryable,
            ],
            [
                self.stuck_ready_to_submit_secs as f64,
                self.stuck_submitting_secs as f64,
                self.stuck_awaiting_verification_secs as f64,
                self.stuck_failed_retryable_secs as f64,
            ],
        )
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct StuckRegistrationCount {
    pub state: CreditRegistrationState,
    pub count: i64,
    /// Over three times the threshold, which is what makes the alert critical.
    pub severely_stuck_count: i64,
    pub oldest_state_entered_at: Option<DateTime<Utc>>,
}

/// Rows the pipeline should have moved by now, per state. Only the four states with a threshold
/// count: the rest wait on a student or a human, where an alert would fire on normal operation.
pub async fn count_stuck(
    conn: &mut PgConnection,
    thresholds: &StuckThresholds,
) -> ModelResult<Vec<StuckRegistrationCount>> {
    let (state_thresholds, threshold_secs) = thresholds.state_seconds_arrays();
    let rows = sqlx::query_as!(
        StuckRegistrationCount,
        r#"
SELECT cr.state AS "state!",
  COUNT(*) AS "count!",
  COUNT(*) FILTER (
    WHERE now() - cr.state_entered_at > MAKE_INTERVAL(secs => t.threshold_secs * 3)
  ) AS "severely_stuck_count!",
  MIN(cr.state_entered_at) AS "oldest_state_entered_at"
FROM credit_registrations cr
  JOIN UNNEST($1::credit_registration_state [], $2::double precision []) AS t(state, threshold_secs) ON t.state = cr.state
WHERE cr.terminal_at IS NULL
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND now() - cr.state_entered_at > MAKE_INTERVAL(secs => t.threshold_secs)
GROUP BY cr.state
        "#,
        &state_thresholds as &[CreditRegistrationState],
        &threshold_secs as &[f64],
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::course_module_completions::{
        CourseModuleCompletionGranter, NewCourseModuleCompletion,
    };
    use crate::credit_registration_events::CreditRegistrationEventKind;
    use crate::test_helper::*;

    /// Checked over every pair the table allows rather than read off each arm: these are the
    /// properties the pipeline is built on, and an edge added in the wrong arm breaks one of them
    /// while still looking plausible where it was written.
    #[test]
    fn the_edge_table_keeps_the_machines_invariants() {
        use CreditRegistrationState as State;
        let import_claims = [State::CheckingEnrolment, State::Submitting];
        for from in State::ALL {
            if from.is_terminal() || from == State::Misregistered {
                assert!(
                    from.allowed_targets().is_empty(),
                    "{from:?} is not the pipeline's to move"
                );
            }
            for &to in from.allowed_targets() {
                assert_ne!(from, to, "{from:?}: staying put is not an edge");
                if matches!(
                    from,
                    State::Submitting | State::SubmissionUncertain | State::AwaitingVerification
                ) {
                    assert!(
                        !import_claims.contains(&to),
                        "{from:?} -> {to:?} would let a second request out for a submission the \
                         study registry may already hold"
                    );
                }
                if to == State::Submitting {
                    assert_eq!(from, State::CheckingEnrolment, "only import may submit");
                }
                if to == State::Registered {
                    assert!(
                        matches!(
                            from,
                            State::Submitting
                                | State::AwaitingVerification
                                | State::SubmissionUncertain
                        ),
                        "{from:?} -> registered: only an answer about a sent submission registers a \
                         row"
                    );
                }
            }
        }
    }

    /// The two `FILTER`s of [`count_unretryable_by_course_id`], asked of the shared precedence
    /// instead: the SQL counts rows a retry refuses, and this is what it must agree with.
    #[test]
    fn the_unretryable_counts_match_the_resubmission_verdicts() {
        let verdict = |state: CreditRegistrationState, consented| {
            state.resubmission_refusal(
                false,
                consented,
                ResubmissionStrictness::OnlyFailedPermanent,
            )
        };
        for consented in [true, false] {
            assert_eq!(
                verdict(CreditRegistrationState::SubmissionUncertain, consented),
                Some(ResubmissionRefusal::SubmissionUncertain),
                "counted whatever the consent"
            );
        }
        assert_eq!(
            verdict(CreditRegistrationState::FailedPermanent, false),
            Some(ResubmissionRefusal::WithoutConsent)
        );
        // Retryable, so counted by neither filter: this is what the batch query picks up instead.
        assert_eq!(
            verdict(CreditRegistrationState::FailedPermanent, true),
            None
        );
    }

    #[test]
    fn success_states_const_matches_is_success() {
        let from_const: Vec<CreditRegistrationState> =
            CreditRegistrationState::SUCCESS_STATES.to_vec();
        let from_predicate: Vec<CreditRegistrationState> = CreditRegistrationState::ALL
            .into_iter()
            .filter(|state| state.is_success())
            .collect();
        assert_eq!(from_const, from_predicate);
    }

    async fn insert_registration(
        conn: &mut PgConnection,
        user: Uuid,
        course: Uuid,
        course_instance: Uuid,
        course_module: Uuid,
    ) -> Uuid {
        let completion = crate::course_module_completions::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module,
                user_id: user,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en".to_string(),
                eligible_for_ects: true,
                email: "student@example.com".to_string(),
                grade: Some(4),
                passed: true,
            },
            CourseModuleCompletionGranter::Automatic,
        )
        .await
        .unwrap();

        insert(
            conn,
            PKeyPolicy::Generate,
            &NewCreditRegistration {
                course_module_completion_id: completion.id,
                user_id: user,
                course_id: course,
                course_module_id: course_module,
                course_instance_id: course_instance,
                attempt_number: 1,
            },
            None,
        )
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn transition_stamps_state_entered_at_and_writes_an_event() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;
        let before = get_by_id(tx.as_mut(), id).await.unwrap();

        let after = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::ReadyToSubmit),
        )
        .await
        .unwrap();

        assert_eq!(after.state, CreditRegistrationState::ReadyToSubmit);
        assert!(after.state_entered_at > before.state_entered_at);

        let events = crate::credit_registration_events::get_by_registration_id(tx.as_mut(), id)
            .await
            .unwrap();
        // The `created` event from insert plus this state change, newest first.
        assert_eq!(events.len(), 2);
        assert_eq!(events[1].kind, CreditRegistrationEventKind::Created);
        assert_eq!(events[0].kind, CreditRegistrationEventKind::StateChanged);
        assert_eq!(events[0].from_state, Some(CreditRegistrationState::Pending));
        assert_eq!(
            events[0].to_state,
            Some(CreditRegistrationState::ReadyToSubmit)
        );
    }

    #[tokio::test]
    async fn consecutive_state_changes_stay_ordered_inside_one_transaction() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

        let first = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::ReadyToSubmit),
        )
        .await
        .unwrap();
        let second = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::CheckingEnrolment),
        )
        .await
        .unwrap();
        assert!(second.state_entered_at > first.state_entered_at);
    }

    #[tokio::test]
    async fn transition_stamps_lifecycle_timestamps() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

        let checking = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::CheckingEnrolment),
        )
        .await
        .unwrap();
        assert!(checking.enrolment_checked_at.is_none());
        assert!(checking.submitted_at.is_none());
        assert!(checking.terminal_at.is_none());

        // Leaving checking_enrolment is what stamps enrolment_checked_at.
        let submitting = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::Submitting),
        )
        .await
        .unwrap();
        assert!(submitting.enrolment_checked_at.is_some());
        assert!(submitting.submitted_at.is_some());
        assert!(submitting.registered_at.is_none());
        assert!(submitting.terminal_at.is_none());

        let registered = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::Registered),
        )
        .await
        .unwrap();
        assert!(registered.registered_at.is_some());
        assert!(registered.terminal_at.is_some());
        assert_eq!(registered.submitted_at, submitting.submitted_at);
        assert_eq!(
            registered.enrolment_checked_at,
            submitting.enrolment_checked_at
        );
    }

    #[tokio::test]
    async fn terminal_at_holds_between_terminal_states_and_clears_on_a_retry() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

        let first = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::Cancelled),
        )
        .await
        .unwrap();
        let terminal_at = first.terminal_at.unwrap();

        let second = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::FailedPermanent),
        )
        .await
        .unwrap();
        assert_eq!(second.terminal_at, Some(terminal_at));

        let retried = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::ReadyToSubmit),
        )
        .await
        .unwrap();
        assert_eq!(retried.terminal_at, None);
    }

    #[tokio::test]
    async fn entering_no_usable_enrolment_clears_a_dismissed_banner() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

        transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::NoUsableEnrolment),
        )
        .await
        .unwrap();
        dismiss_enrolment_banner(tx.as_mut(), id, user)
            .await
            .unwrap();
        assert!(
            get_by_id(tx.as_mut(), id)
                .await
                .unwrap()
                .enrolment_banner_dismissed_at
                .is_some()
        );

        transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::ReadyToSubmit),
        )
        .await
        .unwrap();
        // Still dismissed: only a fresh enrolment problem brings the banner back.
        assert!(
            get_by_id(tx.as_mut(), id)
                .await
                .unwrap()
                .enrolment_banner_dismissed_at
                .is_some()
        );

        let back = transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::NoUsableEnrolment),
        )
        .await
        .unwrap();
        assert_eq!(back.enrolment_banner_dismissed_at, None);
    }

    #[tokio::test]
    async fn transition_carries_the_error_and_leaves_the_admin_flag_alone_unless_asked() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;
        set_needs_admin_attention(tx.as_mut(), id, true)
            .await
            .unwrap();

        let failed = transition(
            tx.as_mut(),
            id,
            &Transition {
                error_code: Some(CreditRegistrationErrorCode::EnrolmentNotFound),
                error_message: Some("no accepted enrolment".to_string()),
                ..Transition::planted(CreditRegistrationState::FailedPermanent)
            },
        )
        .await
        .unwrap();
        assert_eq!(
            failed.error_code,
            Some(CreditRegistrationErrorCode::EnrolmentNotFound)
        );
        assert!(failed.needs_admin_attention);

        let resolved = transition(
            tx.as_mut(),
            id,
            &Transition {
                needs_admin_attention: Some(false),
                ..Transition::planted(CreditRegistrationState::ReadyToSubmit)
            },
        )
        .await
        .unwrap();
        assert!(!resolved.needs_admin_attention);
        assert_eq!(resolved.error_code, None);
    }

    #[tokio::test]
    async fn a_transition_expecting_a_stale_prior_state_is_refused() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let id =
            insert_registration(tx.as_mut(), user, course, instance.id, course_module.id).await;

        transition(
            tx.as_mut(),
            id,
            &Transition::planted(CreditRegistrationState::Blocked),
        )
        .await
        .unwrap();

        // As if a caller had claimed the row into `resolving_enrolment` and, after an await, is
        // writing back based on that now-stale snapshot: the row moved to `blocked` in between.
        let refused = transition(
            tx.as_mut(),
            id,
            &Transition {
                expected_from_state: Some(CreditRegistrationState::ResolvingEnrolment),
                ..Transition::planted(CreditRegistrationState::CheckingEnrolment)
            },
        )
        .await;
        assert!(refused.is_err());
        assert_eq!(
            get_by_id(tx.as_mut(), id).await.unwrap().state,
            CreditRegistrationState::Blocked
        );
    }
}
