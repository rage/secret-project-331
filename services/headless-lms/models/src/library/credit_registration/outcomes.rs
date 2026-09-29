//! Every move the pipeline makes on one ledger row, decided apart from the phases that apply it:
//! what an answer from the study registry does to its row, and the moves a phase makes without
//! asking. No outcome here may return a state that leads back to `import`: a row whose import may
//! have landed must never be sent again. The one exception is verify's `notRegistered`, which is
//! the registry itself saying the submission did not land.

use crate::credit_registrations::{
    AdminAttention, CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState,
    Transition,
};
use crate::prelude::*;
use chrono::TimeDelta;

use super::backoff::{
    NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD, PARTIAL_REGISTRATION_ADMIN_AFTER, UNCERTAIN_RECHECK,
    VERIFY_FIRST_DELAY, VERIFY_GIVE_UP_POLL, next_attempt_at, submit_backoff,
    submit_window_expired, uncertain_needs_admin, uncertain_recheck_delay, verify_backoff,
    verify_window_expired,
};
use super::classification::{Retryability, is_waiting_error, retryability};
use super::enrolment_check_schedule::TRANSIENT_FAILURE_RETRY;
use super::study_registry::{RegistryErrorKind, RegistryOperation};

/// The row's scheduling history, which is all these decisions need from it.
#[derive(Debug, Clone, PartialEq)]
pub struct RowFacts {
    pub now: DateTime<Utc>,
    pub first_failed_at: Option<DateTime<Utc>>,
    pub submit_retry_count: i32,
    pub verify_attempt_count: i32,
    pub submitted_at: Option<DateTime<Utc>>,
    /// The row is waiting for an enrolment, so a lookup that fails in transit leaves it waiting.
    pub is_waiting_for_enrolment: bool,
    /// The code the row carries now, which a waiting row keeps through a failed lookup.
    pub error_code: Option<CreditRegistrationErrorCode>,
}

impl RowFacts {
    /// The facts of `row` as they stand at `now`.
    pub fn of(row: &CreditRegistration, now: DateTime<Utc>) -> Self {
        Self {
            now,
            first_failed_at: row.first_failed_at,
            submit_retry_count: row.submit_retry_count,
            verify_attempt_count: row.verify_attempt_count,
            submitted_at: row.submitted_at,
            is_waiting_for_enrolment: row.is_waiting_for_enrolment(),
            error_code: row.error_code,
        }
    }
}

/// When the pipeline may claim the row again.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum NextAttempt {
    /// The target state's default cadence; see [`Transition::next_attempt_at`].
    StateDefault,
    /// After a backoff, which gets the jitter that spreads a batch that failed together.
    After(TimeDelta),
    At(DateTime<Utc>),
    /// When the row's enrolment check schedule says, which only a row entering
    /// `no_usable_enrolment` has; see [`super::enrolment_checks::schedule_next_check`].
    NextEnrolmentRung,
}

/// What the phase writes for this row.
#[derive(Debug, Clone, PartialEq)]
pub struct Outcome {
    pub to_state: CreditRegistrationState,
    pub error_code: Option<CreditRegistrationErrorCode>,
    /// `None` leaves the flag as it was, so a retry keeps an operator's earlier verdict.
    pub needs_admin_attention: Option<AdminAttention>,
    pub next: NextAttempt,
    /// Set when Suotar says the stored number names nobody, so it is wrong wherever we hold it.
    pub drop_verified_student_number: bool,
    pub increment_submit_retry_count: bool,
    /// A lookup that failed in transit, or only found the Sisu person: it was no check, so the row's
    /// last check time stands.
    pub keeps_enrolment_checked_at: bool,
}

impl Outcome {
    pub fn to(to_state: CreditRegistrationState) -> Self {
        Self {
            to_state,
            error_code: None,
            needs_admin_attention: None,
            next: NextAttempt::StateDefault,
            drop_verified_student_number: false,
            increment_submit_retry_count: false,
            keeps_enrolment_checked_at: false,
        }
    }

    /// Whether the row counts against the iteration's `items_failed`: an error code that is no
    /// waiting answer, so a verify poll that is still waiting is not one. Not the same question as
    /// [`CreditRegistrationState::is_failed_state`].
    pub fn is_failure(&self) -> bool {
        self.error_code.is_some_and(|code| !is_waiting_error(code))
    }

    /// Whether the row only awaits something outside the pipeline, such as the student's
    /// enrolment: counted apart from failures.
    pub fn is_waiting(&self) -> bool {
        self.error_code.is_some_and(is_waiting_error)
    }

    /// The ledger write this outcome asks for, without the audit fields of the exchange behind it.
    /// `expected_from_state` is as [`Transition::expected_from_state`]; a backoff counts from `now`.
    pub fn transition(
        &self,
        expected_from_state: Option<CreditRegistrationState>,
        now: DateTime<Utc>,
    ) -> Transition {
        Transition {
            error_code: self.error_code,
            needs_admin_attention: self.needs_admin_attention,
            expected_from_state,
            next_attempt_at: match self.next {
                NextAttempt::StateDefault | NextAttempt::NextEnrolmentRung => None,
                NextAttempt::After(delay) => Some(next_attempt_at(now, delay)),
                NextAttempt::At(at) => Some(at),
            },
            keeps_enrolment_checked_at: self.keeps_enrolment_checked_at,
            ..Transition::to(self.to_state)
        }
    }

    pub(super) fn with_code(self, error_code: CreditRegistrationErrorCode) -> Self {
        Self {
            error_code: Some(error_code),
            ..self
        }
    }

    pub(super) fn needing_admin(self) -> Self {
        Self {
            needs_admin_attention: Some(AdminAttention::Raise),
            ..self
        }
    }

    fn after(self, delay: TimeDelta) -> Self {
        Self {
            next: NextAttempt::After(delay),
            ..self
        }
    }
}

/// The one state whose only way out is `verify`; every path that cannot prove nothing was created
/// ends here.
pub fn submission_uncertain() -> Outcome {
    Outcome::to(CreditRegistrationState::SubmissionUncertain)
        .with_code(CreditRegistrationErrorCode::SisuTimeout)
        .after(UNCERTAIN_RECHECK)
}

/// A per-item error on the calls leading towards a submission. Only `import` creates attainments,
/// so anything uncertain there is verify-only, while the same code on `resolve-enrolments` retries.
pub fn submit_error_outcome(
    operation: RegistryOperation,
    code: CreditRegistrationErrorCode,
    facts: &RowFacts,
) -> Outcome {
    use CreditRegistrationErrorCode as Code;
    // An unclassifiable answer is no evidence that nothing was created, and an admin retry from
    // `failed_permanent` would then be a second submission.
    if operation.creates_attainments() && code == Code::Unknown {
        return submission_uncertain();
    }
    match retryability(code) {
        Retryability::VerifyOnly if operation.creates_attainments() => submission_uncertain(),
        Retryability::VerifyOnly | Retryability::RetryableTransient => {
            retry_or_expire(code, operation, facts, Failure::Transient)
        }
        Retryability::PermanentNeedsStudent => match code {
            // Dropping the number puts the student back in the linking flow, the only thing that
            // can fix this, and the row heals itself once they link a working one.
            Code::PersonNotFound => Outcome {
                drop_verified_student_number: true,
                ..Outcome::to(CreditRegistrationState::Pending).with_code(code)
            },
            _ => Outcome {
                next: NextAttempt::NextEnrolmentRung,
                ..Outcome::to(CreditRegistrationState::NoUsableEnrolment).with_code(code)
            },
        },
        Retryability::PermanentNeedsConfig | Retryability::PermanentNeedsAdmin => {
            Outcome::to(CreditRegistrationState::FailedPermanent)
                .with_code(code)
                .needing_admin()
        }
    }
}

/// A per-item error while polling `verify`. Never a failure: the attainment may exist, and a row
/// marked failed invites a second submission later. `notRegistered` is not an error here; see
/// [`verify_not_registered_outcome`].
pub fn verify_error_outcome(
    state: CreditRegistrationState,
    code: CreditRegistrationErrorCode,
    facts: &RowFacts,
) -> Outcome {
    if code == CreditRegistrationErrorCode::Misregistered {
        return Outcome::to(CreditRegistrationState::Misregistered)
            .with_code(code)
            .needing_admin();
    }
    verify_inconclusive_outcome(state, facts)
}

/// A `verify` poll with no usable answer: nothing came back, or nothing we act on.
pub fn verify_inconclusive_outcome(state: CreditRegistrationState, facts: &RowFacts) -> Outcome {
    let expired = verify_window_expired(facts.submitted_at, facts.now);
    let outcome = Outcome::to(state).after(if expired {
        VERIFY_GIVE_UP_POLL
    } else {
        verify_backoff(facts.verify_attempt_count)
    });
    if expired {
        outcome.needing_admin()
    } else {
        outcome
    }
}

/// A `verify` poll that found only the assessment item attainment. The submission landed, so an
/// uncertain row stops being uncertain, but the row is not registered until the course unit
/// attainment appears. `partially_registered_at` is when a poll first saw this.
pub fn verify_partial_outcome(facts: &RowFacts, partially_registered_at: DateTime<Utc>) -> Outcome {
    let outcome = Outcome::to(CreditRegistrationState::AwaitingVerification)
        .after(verify_backoff(facts.verify_attempt_count));
    if facts.now - partially_registered_at >= PARTIAL_REGISTRATION_ADMIN_AFTER {
        outcome.needing_admin()
    } else {
        outcome
    }
}

/// A `verify` poll answered `notRegistered`: Suotar has no trace of the submission, so the row is
/// new work again and goes back through resolve-enrolments and import. `reimport_count` counts
/// this resend too.
pub fn verify_not_registered_outcome(facts: &RowFacts, reimport_count: i32) -> Outcome {
    let outcome = Outcome {
        increment_submit_retry_count: true,
        ..Outcome::to(CreditRegistrationState::FailedRetryable)
            .with_code(CreditRegistrationErrorCode::NotRegistered)
            .after(submit_backoff(facts.submit_retry_count))
    };
    if reimport_count >= NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD {
        outcome.needing_admin()
    } else {
        outcome
    }
}

/// A fruitless look through `existingAttainments` for an attainment we may have created. Once the
/// attainment has had a day to show up a human checks Sisu by hand; the row still never resubmits.
pub fn uncertain_recheck_outcome(facts: &RowFacts) -> Outcome {
    let outcome = Outcome::to(CreditRegistrationState::SubmissionUncertain)
        .after(uncertain_recheck_delay(facts.verify_attempt_count));
    if uncertain_needs_admin(facts.submitted_at, facts.now) {
        outcome.needing_admin()
    } else {
        outcome
    }
}

/// The outcome for every row of a batch Suotar rejected as a whole. On `import` all that matters is
/// whether the request could have been acted on: a connection that never opened proves it was not.
/// A waiting row's lookup keeps waiting only through an outage; a refusal of the request itself
/// would come back every retry, so it ages out like any other failure.
pub fn request_level_outcome(
    operation: RegistryOperation,
    kind: RegistryErrorKind,
    facts: &RowFacts,
) -> Outcome {
    if operation.creates_attainments() && kind.may_have_been_acted_on() {
        return submission_uncertain();
    }
    let failure = if kind.is_outage() {
        Failure::Transient
    } else {
        Failure::Lasting
    };
    retry_or_expire(request_level_code(kind), operation, facts, failure)
}

/// A lookup for a row waiting for an enrolment that failed in transit: the row keeps waiting and
/// retries the same check shortly, with none of a failure's retry window or count, which over a
/// schedule of months would expire it. `None` for any other row or operation.
fn waiting_lookup_failed(operation: RegistryOperation, facts: &RowFacts) -> Option<Outcome> {
    let is_lookup = matches!(
        operation,
        RegistryOperation::ResolveEnrolments | RegistryOperation::ResolvePersons
    );
    (is_lookup && facts.is_waiting_for_enrolment).then(|| Outcome {
        error_code: facts.error_code,
        keeps_enrolment_checked_at: true,
        ..Outcome::to(CreditRegistrationState::NoUsableEnrolment).after(TRANSIENT_FAILURE_RETRY)
    })
}

/// A row Suotar refused as a malformed request even in a batch of its own: resending the same
/// request is refused the same way, so it needs a human.
pub fn isolated_malformed_request_outcome() -> Outcome {
    Outcome::to(CreditRegistrationState::FailedPermanent)
        .with_code(CreditRegistrationErrorCode::MalformedRequest)
        .needing_admin()
}

/// An item we sent and Suotar did not answer. On `import` that leaves us where a timeout does;
/// elsewhere the call simply did not happen for that row.
pub fn unanswered_item_outcome(
    operation: RegistryOperation,
    state: CreditRegistrationState,
    facts: &RowFacts,
) -> Outcome {
    if operation.creates_attainments() {
        return submission_uncertain();
    }
    if operation == RegistryOperation::VerifyAttainments {
        return verify_inconclusive_outcome(state, facts);
    }
    retry_or_expire(
        CreditRegistrationErrorCode::UnexpectedResponse,
        operation,
        facts,
        Failure::Transient,
    )
}

/// The ledger error code for a request the study registry rejected, or never answered, as a whole.
pub fn request_level_code(kind: RegistryErrorKind) -> CreditRegistrationErrorCode {
    match kind {
        RegistryErrorKind::AuthenticationFailure => CreditRegistrationErrorCode::Unauthorized,
        RegistryErrorKind::MalformedRequest => CreditRegistrationErrorCode::MalformedRequest,
        RegistryErrorKind::ProtocolViolation | RegistryErrorKind::RejectedRequest => {
            CreditRegistrationErrorCode::UnexpectedResponse
        }
        // A bare 5xx may not be Suotar's unavailability, but a retry is all either one gets.
        RegistryErrorKind::TemporarilyUnavailable | RegistryErrorKind::ServerError => {
            CreditRegistrationErrorCode::ServiceTemporarilyUnavailable
        }
        RegistryErrorKind::NotDelivered | RegistryErrorKind::NoAnswer => {
            CreditRegistrationErrorCode::TransportError
        }
    }
}

/// Whether a failure could go away on its own.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Failure {
    Transient,
    /// The same request would fail the same way on every retry.
    Lasting,
}

/// Retryable until the row has been failing for a week, and then a support case rather than an
/// endless one. A transient failure of a waiting row's lookup is not counted as one at all; see
/// [`waiting_lookup_failed`].
fn retry_or_expire(
    code: CreditRegistrationErrorCode,
    operation: RegistryOperation,
    facts: &RowFacts,
    failure: Failure,
) -> Outcome {
    if failure == Failure::Transient
        && let Some(outcome) = waiting_lookup_failed(operation, facts)
    {
        return outcome;
    }
    if submit_window_expired(facts.first_failed_at, facts.now) {
        return Outcome::to(CreditRegistrationState::FailedPermanent)
            .with_code(CreditRegistrationErrorCode::RetryWindowExpired)
            .needing_admin();
    }
    let delay = if operation == RegistryOperation::VerifyAttainments {
        verify_backoff(facts.verify_attempt_count)
    } else {
        submit_backoff(facts.submit_retry_count)
    };
    Outcome {
        increment_submit_retry_count: operation != RegistryOperation::VerifyAttainments,
        ..Outcome::to(CreditRegistrationState::FailedRetryable)
            .with_code(code)
            .after(delay)
    }
}

/// What an `import` answer that settled the row does to it, including the wait Sisu needs before
/// the first verify poll can find anything.
pub fn import_success_outcome(state: CreditRegistrationState) -> Outcome {
    let outcome = Outcome::to(state);
    if state == CreditRegistrationState::AwaitingVerification {
        return outcome.after(VERIFY_FIRST_DELAY);
    }
    outcome
}

/// How long a verify poll pushes the row out of reach while its request is out, so a concurrent
/// iteration cannot poll it twice. The poll's own outcome overwrites this. `calls` is the longest
/// the iteration's registry calls may take together: the poll and the recovery lookup after it.
pub fn verify_poll_lease_until(
    now: DateTime<Utc>,
    attempt: i32,
    calls: TimeDelta,
) -> DateTime<Utc> {
    next_attempt_at(
        now,
        verify_backoff(attempt).max(calls + TimeDelta::minutes(5)),
    )
}

/// A move a phase makes on a claimed row without an answer to decide from: the outcome, and the
/// timeline line that explains it.
#[derive(Debug, Clone, PartialEq)]
pub struct UnaskedMove {
    pub outcome: Outcome,
    pub message: Option<String>,
}

impl UnaskedMove {
    pub(super) fn new(outcome: Outcome, message: impl Into<String>) -> Self {
        Self {
            outcome,
            message: Some(message.into()),
        }
    }

    pub(super) fn silent(outcome: Outcome) -> Self {
        Self {
            outcome,
            message: None,
        }
    }

    /// The ledger write, guarded and timed as [`Outcome::transition`].
    pub fn transition(
        &self,
        expected_from_state: Option<CreditRegistrationState>,
        now: DateTime<Utc>,
    ) -> Transition {
        Transition {
            event_message: self.message.clone(),
            ..self.outcome.transition(expected_from_state, now)
        }
    }
}

/// The timeline line for a row waiting on a student number, whichever phase found it missing.
pub const NO_VERIFIED_STUDENT_NUMBER_MESSAGE: &str =
    "No verified student number is linked to the account.";

/// Committed before the import request leaves: a row found in `submitting` after a restart has an
/// unknown outcome and is never sent again.
pub fn submitting() -> UnaskedMove {
    UnaskedMove::silent(Outcome::to(CreditRegistrationState::Submitting))
}

/// Import found the completion already registered by another registrar.
pub fn duplicate_of_other_registrar() -> UnaskedMove {
    UnaskedMove::new(
        Outcome::to(CreditRegistrationState::Duplicate),
        "Another registrar had already registered this completion, so nothing was submitted.",
    )
}

/// The frozen payload lacks a field, so the enrolment is resolved again.
pub fn incomplete_payload() -> UnaskedMove {
    UnaskedMove::new(
        Outcome::to(CreditRegistrationState::ReadyToSubmit),
        "The frozen payload is incomplete, so the enrolment is resolved again.",
    )
}

/// The frozen grade is not one Sisu accepts.
pub fn unknown_grade() -> UnaskedMove {
    UnaskedMove::new(
        Outcome::to(CreditRegistrationState::FailedPermanent)
            .with_code(CreditRegistrationErrorCode::NoGradeScaleMapping)
            .needing_admin(),
        "Sisu does not accept this grade.",
    )
}

/// `field` of the frozen payload is one Sisu would refuse, and the whole batch with it.
pub fn invalid_payload_field(field: &str) -> UnaskedMove {
    UnaskedMove::new(
        Outcome::to(CreditRegistrationState::FailedPermanent)
            .with_code(CreditRegistrationErrorCode::Unknown)
            .needing_admin(),
        format!("Sisu does not accept the {field} we would send, so nothing was sent."),
    )
}

/// An import row a split still held unsent when a shutdown or an error stopped the split.
pub fn released_unsent_split_half() -> UnaskedMove {
    UnaskedMove::new(
        Outcome::to(CreditRegistrationState::Pending),
        "The split batch this row was in stopped before its part was sent, so nothing was \
         submitted.",
    )
}

/// No verified student number to resolve the enrolment with.
pub fn no_verified_student_number() -> UnaskedMove {
    UnaskedMove::new(
        Outcome::to(CreditRegistrationState::Pending),
        NO_VERIFIED_STUDENT_NUMBER_MESSAGE,
    )
}

/// The module lacks what the enrolment lookup needs; `code` says what.
pub fn module_not_configured(code: CreditRegistrationErrorCode) -> UnaskedMove {
    UnaskedMove::new(
        Outcome::to(CreditRegistrationState::FailedPermanent)
            .with_code(code)
            .needing_admin(),
        "The module is not configured for credit registration.",
    )
}

/// Holds a first resolve out of `import`'s claim while its lookup is out.
pub fn resolving_enrolment() -> UnaskedMove {
    UnaskedMove::silent(Outcome::to(CreditRegistrationState::ResolvingEnrolment))
}

/// A row `resolve-enrolments` claimed but has no completion or module to ask about. Retryable like
/// any other failure, and it accrues retry age, so a row whose context never comes back expires
/// instead of being repolled forever.
pub fn missing_context(facts: &RowFacts) -> UnaskedMove {
    UnaskedMove::new(
        retry_or_expire(
            CreditRegistrationErrorCode::Unknown,
            RegistryOperation::ResolveEnrolments,
            facts,
            Failure::Lasting,
        ),
        "There is no completion or module to submit for.",
    )
}

#[cfg(test)]
mod tests {
    use super::super::backoff::UNCERTAIN_MAX_RECHECK;
    use super::*;
    use CreditRegistrationErrorCode as Code;
    use CreditRegistrationState as State;

    fn facts() -> RowFacts {
        RowFacts {
            now: Utc::now(),
            first_failed_at: None,
            submit_retry_count: 0,
            verify_attempt_count: 0,
            submitted_at: None,
            is_waiting_for_enrolment: false,
            error_code: None,
        }
    }

    fn import(code: Code) -> Outcome {
        submit_error_outcome(RegistryOperation::ImportAttainments, code, &facts())
    }

    fn resolve(code: Code) -> Outcome {
        submit_error_outcome(RegistryOperation::ResolveEnrolments, code, &facts())
    }

    #[test]
    fn every_error_code_has_an_import_outcome_that_never_resends() {
        for code in CreditRegistrationErrorCode::ALL {
            let outcome = import(code);
            assert!(
                !matches!(
                    outcome.to_state,
                    State::Submitting | State::CheckingEnrolment
                ),
                "{code:?} would put the row back in front of import"
            );
        }
    }

    /// Pins each code to the exact state import() routes it to, so a future edit that misroutes one
    /// code fails here even though the match stays exhaustive to the compiler.
    #[test]
    fn import_routes_every_code_to_its_documented_state() {
        let cases = [
            (Code::ServiceTemporarilyUnavailable, State::FailedRetryable),
            (Code::NotRegistered, State::FailedRetryable),
            (Code::TransportError, State::FailedRetryable),
            (Code::Unauthorized, State::FailedRetryable),
            (Code::MalformedRequest, State::FailedRetryable),
            (Code::UnexpectedResponse, State::FailedRetryable),
            (Code::SisuTimeout, State::SubmissionUncertain),
            (Code::PersonNotFound, State::Pending),
            (Code::EnrolmentNotFound, State::NoUsableEnrolment),
            (Code::EnrolmentNotAccepted, State::NoUsableEnrolment),
            (Code::StudyRightNotValid, State::NoUsableEnrolment),
            (Code::CourseCodeNotFound, State::FailedPermanent),
            (Code::CourseNotAllowed, State::FailedPermanent),
            (Code::InvalidGradeForGradeScale, State::FailedPermanent),
            (Code::GradeScaleMismatch, State::FailedPermanent),
            (Code::InvalidCredits, State::FailedPermanent),
            (Code::NoGradeScaleMapping, State::FailedPermanent),
            (Code::MissingUhCourseCode, State::FailedPermanent),
            (Code::MissingEctsCredits, State::FailedPermanent),
            (Code::SisuValidationFailed, State::FailedPermanent),
            (Code::Misregistered, State::FailedPermanent),
            (Code::RetryWindowExpired, State::FailedPermanent),
            (Code::Unknown, State::SubmissionUncertain),
        ];
        assert_eq!(
            cases.len(),
            CreditRegistrationErrorCode::ALL.len(),
            "every code must be covered"
        );
        for (code, expected) in cases {
            assert_eq!(import(code).to_state, expected, "{code:?}");
        }
    }

    /// Each of these is a refusal of the item before Sisu saw it, so nothing was created. Adding to
    /// the list is a decision about a real transcript.
    #[test]
    fn the_import_answers_that_allow_another_attempt_are_only_refusals() {
        let resendable: Vec<Code> = CreditRegistrationErrorCode::ALL
            .into_iter()
            .filter(|code| import(*code).to_state == State::FailedRetryable)
            .collect();
        assert_eq!(
            resendable,
            vec![
                Code::ServiceTemporarilyUnavailable,
                Code::NotRegistered,
                Code::Unauthorized,
                Code::MalformedRequest,
                Code::TransportError,
                Code::UnexpectedResponse,
            ]
        );
    }

    /// An admin retry from `failed_permanent` would send an import whose outcome nobody knows.
    #[test]
    fn an_import_answer_we_cannot_classify_is_uncertain_rather_than_failed() {
        assert_eq!(import(Code::Unknown).to_state, State::SubmissionUncertain);
        assert_eq!(resolve(Code::Unknown).to_state, State::FailedPermanent);
    }

    #[test]
    fn a_timeout_is_uncertain_on_import_and_retryable_on_resolve() {
        assert_eq!(
            import(Code::SisuTimeout).to_state,
            State::SubmissionUncertain
        );
        assert_eq!(resolve(Code::SisuTimeout).to_state, State::FailedRetryable);
    }

    #[test]
    fn a_person_suotar_does_not_know_costs_the_stored_student_number() {
        let outcome = import(Code::PersonNotFound);
        assert!(outcome.drop_verified_student_number);
        assert_eq!(outcome.to_state, State::Pending);
        for code in CreditRegistrationErrorCode::ALL {
            if code != Code::PersonNotFound {
                assert!(!import(code).drop_verified_student_number, "{code:?}");
            }
        }
    }

    #[test]
    fn a_config_error_asks_for_a_human_and_a_transient_one_does_not() {
        assert_eq!(
            import(Code::InvalidGradeForGradeScale).needs_admin_attention,
            Some(AdminAttention::Raise)
        );
        assert_eq!(
            import(Code::ServiceTemporarilyUnavailable).needs_admin_attention,
            None
        );
    }

    #[test]
    fn a_row_that_has_been_failing_for_a_week_stops_being_retried() {
        let facts = RowFacts {
            first_failed_at: Some(Utc::now() - chrono::Duration::days(8)),
            ..facts()
        };
        let outcome = submit_error_outcome(
            RegistryOperation::ResolveEnrolments,
            Code::ServiceTemporarilyUnavailable,
            &facts,
        );
        assert_eq!(outcome.to_state, State::FailedPermanent);
        assert_eq!(outcome.error_code, Some(Code::RetryWindowExpired));
    }

    #[test]
    fn an_expired_window_does_not_override_an_uncertain_import() {
        let facts = RowFacts {
            first_failed_at: Some(Utc::now() - chrono::Duration::days(8)),
            ..facts()
        };
        assert_eq!(
            submit_error_outcome(
                RegistryOperation::ImportAttainments,
                Code::SisuTimeout,
                &facts
            )
            .to_state,
            State::SubmissionUncertain
        );
    }

    #[test]
    fn only_a_request_that_may_have_reached_business_logic_leaves_an_import_batch_uncertain() {
        let facts = facts();
        for kind in [
            RegistryErrorKind::ServerError,
            RegistryErrorKind::NoAnswer,
            RegistryErrorKind::ProtocolViolation,
        ] {
            assert_eq!(
                request_level_outcome(RegistryOperation::ImportAttainments, kind, &facts).to_state,
                State::SubmissionUncertain,
                "{kind:?}"
            );
        }
        for kind in [
            RegistryErrorKind::NotDelivered,
            RegistryErrorKind::AuthenticationFailure,
            RegistryErrorKind::MalformedRequest,
            RegistryErrorKind::RejectedRequest,
            RegistryErrorKind::TemporarilyUnavailable,
        ] {
            assert_eq!(
                request_level_outcome(RegistryOperation::ImportAttainments, kind, &facts).to_state,
                State::FailedRetryable,
                "{kind:?}"
            );
        }
    }

    #[test]
    fn a_request_level_failure_elsewhere_is_always_a_plain_retry() {
        let facts = facts();
        for kind in [
            RegistryErrorKind::ServerError,
            RegistryErrorKind::NoAnswer,
            RegistryErrorKind::AuthenticationFailure,
        ] {
            assert_eq!(
                request_level_outcome(RegistryOperation::ResolveEnrolments, kind, &facts).to_state,
                State::FailedRetryable,
                "{kind:?}"
            );
        }
    }

    #[test]
    fn an_import_item_suotar_never_answered_is_uncertain() {
        assert_eq!(
            unanswered_item_outcome(
                RegistryOperation::ImportAttainments,
                State::Submitting,
                &facts()
            )
            .to_state,
            State::SubmissionUncertain
        );
    }

    #[test]
    fn an_unanswered_verify_item_just_polls_again() {
        let outcome = unanswered_item_outcome(
            RegistryOperation::VerifyAttainments,
            State::AwaitingVerification,
            &facts(),
        );
        assert_eq!(outcome.to_state, State::AwaitingVerification);
        assert!(matches!(outcome.next, NextAttempt::After(_)));
    }

    #[test]
    fn verify_never_fails_a_row() {
        let facts = RowFacts {
            submitted_at: Some(Utc::now() - chrono::Duration::days(30)),
            ..facts()
        };
        for code in CreditRegistrationErrorCode::ALL {
            let outcome = verify_error_outcome(State::AwaitingVerification, code, &facts);
            assert!(
                !matches!(
                    outcome.to_state,
                    State::FailedPermanent | State::FailedRetryable
                ),
                "{code:?}"
            );
        }
    }

    #[test]
    fn a_reversal_in_sisu_needs_a_human() {
        let outcome =
            verify_error_outcome(State::AwaitingVerification, Code::Misregistered, &facts());
        assert_eq!(outcome.to_state, State::Misregistered);
        assert_eq!(outcome.needs_admin_attention, Some(AdminAttention::Raise));
    }

    #[test]
    fn an_expired_verify_window_slows_down_and_asks_for_a_human() {
        let facts = RowFacts {
            submitted_at: Some(Utc::now() - chrono::Duration::days(20)),
            verify_attempt_count: 40,
            ..facts()
        };
        let outcome = verify_inconclusive_outcome(State::AwaitingVerification, &facts);
        assert_eq!(outcome.to_state, State::AwaitingVerification);
        assert_eq!(outcome.needs_admin_attention, Some(AdminAttention::Raise));
        assert_eq!(outcome.next, NextAttempt::After(VERIFY_GIVE_UP_POLL));
    }

    /// A row the phase can build no request for has to accrue retry age like any other failure, or
    /// nothing ever stops it being claimed again.
    #[test]
    fn a_row_with_nothing_to_submit_for_ages_out_of_the_retry_window() {
        let fresh = missing_context(&facts()).outcome;
        assert_eq!(fresh.to_state, State::FailedRetryable);
        assert!(fresh.increment_submit_retry_count);

        let old = missing_context(&RowFacts {
            first_failed_at: Some(Utc::now() - chrono::Duration::days(8)),
            ..facts()
        })
        .outcome;
        assert_eq!(old.to_state, State::FailedPermanent);
        assert_eq!(old.error_code, Some(Code::RetryWindowExpired));
    }

    #[test]
    fn an_uncertain_row_backs_off_and_asks_for_a_human_only_after_a_day() {
        let first = uncertain_recheck_outcome(&RowFacts {
            verify_attempt_count: 1,
            submitted_at: Some(Utc::now() - chrono::Duration::hours(1)),
            ..facts()
        });
        assert_eq!(first.needs_admin_attention, None);
        assert_eq!(first.to_state, State::SubmissionUncertain);
        assert_eq!(first.next, NextAttempt::After(UNCERTAIN_RECHECK * 2));

        let late = uncertain_recheck_outcome(&RowFacts {
            verify_attempt_count: 30,
            submitted_at: Some(Utc::now() - chrono::Duration::hours(25)),
            ..facts()
        });
        assert_eq!(late.needs_admin_attention, Some(AdminAttention::Raise));
        assert_eq!(late.next, NextAttempt::After(UNCERTAIN_MAX_RECHECK));
    }
}
