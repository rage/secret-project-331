//! What one Suotar answer does to one ledger row.
//!
//! Pure decisions, separate from the phases that apply them, because this is where the design's
//! single most expensive mistake would live: a row whose import may have landed must never be sent
//! again. Nothing here can return a state that leads back to `import`.

use headless_lms_utils::error::util_error::SuotarErrorVariant;

use crate::credit_registrations::{CreditRegistrationErrorCode, CreditRegistrationState};
use crate::prelude::*;
use crate::suotar_api_calls::SuotarEndpoint;

use super::classification::{
    NO_USABLE_ENROLMENT_RECHECK_SECS, Retryability, UNCERTAIN_MAX_CHECKS, UNCERTAIN_RECHECK_SECS,
    VERIFY_GIVE_UP_POLL_SECS, retryability, submit_backoff_secs, submit_window_expired,
    verify_backoff_secs, verify_window_expired,
};

/// The row's own scheduling history, which is all the decision needs from it.
#[derive(Debug, Clone, PartialEq)]
pub struct RowFacts {
    pub now: DateTime<Utc>,
    pub first_failed_at: Option<DateTime<Utc>>,
    pub submit_retry_count: i32,
    pub verify_attempt_count: i32,
    pub submitted_at: Option<DateTime<Utc>>,
}

/// What the phase writes for this row.
#[derive(Debug, Clone, PartialEq)]
pub struct Outcome {
    pub to_state: CreditRegistrationState,
    pub error_code: Option<CreditRegistrationErrorCode>,
    /// `None` leaves the flag as it was, which is how a retry keeps an operator's earlier verdict.
    pub needs_admin_attention: Option<bool>,
    /// Seconds to wait before the row may be claimed again.
    pub delay_secs: Option<i64>,
    /// Suotar says the number names nobody, so it is wrong wherever we hold it.
    pub drop_verified_student_number: bool,
    pub increment_submit_retry_count: bool,
}

impl Outcome {
    fn to(to_state: CreditRegistrationState) -> Self {
        Self {
            to_state,
            error_code: None,
            needs_admin_attention: None,
            delay_secs: None,
            drop_verified_student_number: false,
            increment_submit_retry_count: false,
        }
    }

    fn with_code(self, error_code: CreditRegistrationErrorCode) -> Self {
        Self {
            error_code: Some(error_code),
            ..self
        }
    }

    fn needing_admin(self) -> Self {
        Self {
            needs_admin_attention: Some(true),
            ..self
        }
    }

    fn after(self, delay_secs: i64) -> Self {
        Self {
            delay_secs: Some(delay_secs),
            ..self
        }
    }
}

/// The one state whose only way out is `verify`. Every path that cannot prove nothing was created
/// ends here.
pub fn submission_uncertain() -> Outcome {
    Outcome::to(CreditRegistrationState::SubmissionUncertain)
        .with_code(CreditRegistrationErrorCode::SisuTimeout)
        .after(UNCERTAIN_RECHECK_SECS)
}

/// The outcome of a per-item error on the two calls that lead towards a submission.
///
/// `import` is the endpoint that creates attainments, so anything uncertain there is verify-only;
/// on `resolve-enrolments` the same code is plainly retryable, because a failed resolve created
/// nothing.
pub fn submit_error_outcome(
    endpoint: SuotarEndpoint,
    code: CreditRegistrationErrorCode,
    facts: &RowFacts,
) -> Outcome {
    use CreditRegistrationErrorCode as Code;
    // An answer we cannot classify is not evidence that nothing was created, and `failed_permanent`
    // is a state an admin retries from. On import that retry would be a second submission.
    if endpoint == SuotarEndpoint::ImportAttainments && code == Code::Unknown {
        return submission_uncertain();
    }
    match retryability(code) {
        Retryability::VerifyOnly if endpoint == SuotarEndpoint::ImportAttainments => {
            submission_uncertain()
        }
        Retryability::VerifyOnly | Retryability::RetryableTransient => {
            retry_or_expire(code, endpoint, facts)
        }
        Retryability::PermanentNeedsStudent => match code {
            // Our stored number names nobody in Sisu. Dropping it puts the student back in the
            // linking flow, which is the only thing that can fix it, and the row heals itself once
            // they link a working one.
            Code::PersonNotFound => Outcome {
                drop_verified_student_number: true,
                ..Outcome::to(CreditRegistrationState::PendingStudentNumber).with_code(code)
            },
            _ => Outcome::to(CreditRegistrationState::NoUsableEnrolment)
                .with_code(code)
                .after(NO_USABLE_ENROLMENT_RECHECK_SECS),
        },
        Retryability::PermanentNeedsConfig | Retryability::PermanentNeedsAdmin => {
            Outcome::to(CreditRegistrationState::FailedPermanent)
                .with_code(code)
                .needing_admin()
        }
    }
}

/// The outcome of a per-item error while polling `verify`.
///
/// Never a failure. The attainment may exist, and a row marked failed invites a second submission
/// later, which is the one thing this design must not allow.
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
    verify_not_registered_outcome(state, facts)
}

/// The outcome of a `verify` poll that Sisu has nothing to say about yet.
pub fn verify_not_registered_outcome(state: CreditRegistrationState, facts: &RowFacts) -> Outcome {
    let expired = verify_window_expired(facts.submitted_at, facts.now);
    let outcome = Outcome::to(state).after(if expired {
        VERIFY_GIVE_UP_POLL_SECS
    } else {
        verify_backoff_secs(facts.verify_attempt_count)
    });
    if expired {
        outcome.needing_admin()
    } else {
        outcome
    }
}

/// The outcome of a fruitless look through `existingAttainments` for an attainment we may have
/// created. After enough of them a human is asked to check Sisu by hand; the row still never
/// resubmits.
pub fn uncertain_recheck_outcome(facts: &RowFacts) -> Outcome {
    let outcome =
        Outcome::to(CreditRegistrationState::SubmissionUncertain).after(UNCERTAIN_RECHECK_SECS);
    if facts.verify_attempt_count >= UNCERTAIN_MAX_CHECKS {
        outcome.needing_admin()
    } else {
        outcome
    }
}

/// The outcome for every row of a batch Suotar rejected as a whole.
///
/// On `import` the only question that matters is whether the request could have been acted on.
/// A connection that never opened proves it was not; a timeout proves nothing.
pub fn request_level_outcome(
    endpoint: SuotarEndpoint,
    variant: SuotarErrorVariant,
    facts: &RowFacts,
) -> Outcome {
    if endpoint == SuotarEndpoint::ImportAttainments && variant.outcome_may_have_landed() {
        return submission_uncertain();
    }
    retry_or_expire(request_level_code(variant), endpoint, facts)
}

/// An item we sent and Suotar did not answer.
///
/// On `import` its attainment may or may not exist, which is the same position a timeout leaves us
/// in. Elsewhere the call simply did not happen for that row.
pub fn unanswered_item_outcome(
    endpoint: SuotarEndpoint,
    state: CreditRegistrationState,
    facts: &RowFacts,
) -> Outcome {
    // Import is the only call that creates an attainment, and an item it never answered has an
    // unknown outcome rather than a failed one.
    if endpoint == SuotarEndpoint::ImportAttainments {
        return submission_uncertain();
    }
    if endpoint == SuotarEndpoint::VerifyAttainments {
        return verify_not_registered_outcome(state, facts);
    }
    retry_or_expire(
        CreditRegistrationErrorCode::UnexpectedResponse,
        endpoint,
        facts,
    )
}

fn request_level_code(variant: SuotarErrorVariant) -> CreditRegistrationErrorCode {
    match variant {
        SuotarErrorVariant::Unauthorized => CreditRegistrationErrorCode::Unauthorized,
        SuotarErrorVariant::MalformedRequest => CreditRegistrationErrorCode::MalformedRequest,
        SuotarErrorVariant::Deserialization => CreditRegistrationErrorCode::UnexpectedResponse,
        SuotarErrorVariant::ServerError | SuotarErrorVariant::RequestLevelError => {
            CreditRegistrationErrorCode::SisuTemporarilyUnavailable
        }
        SuotarErrorVariant::TransportNotDelivered | SuotarErrorVariant::TransportUnknown => {
            CreditRegistrationErrorCode::TransportError
        }
    }
}

/// Retryable until the row has been failing for a week, and then a support case rather than an
/// endless one.
fn retry_or_expire(
    code: CreditRegistrationErrorCode,
    endpoint: SuotarEndpoint,
    facts: &RowFacts,
) -> Outcome {
    if submit_window_expired(facts.first_failed_at, facts.now) {
        return Outcome::to(CreditRegistrationState::FailedPermanent)
            .with_code(CreditRegistrationErrorCode::RetryWindowExpired)
            .needing_admin();
    }
    let delay = if endpoint == SuotarEndpoint::VerifyAttainments {
        verify_backoff_secs(facts.verify_attempt_count)
    } else {
        submit_backoff_secs(facts.submit_retry_count)
    };
    Outcome {
        increment_submit_retry_count: endpoint != SuotarEndpoint::VerifyAttainments,
        ..Outcome::to(CreditRegistrationState::FailedRetryable)
            .with_code(code)
            .after(delay)
    }
}

/// Where a successful `import` item lands the row. `sent` is the only code that is not an answer.
pub fn import_success_state(code: &str) -> Option<CreditRegistrationState> {
    match code {
        "sent" => Some(CreditRegistrationState::AwaitingVerification),
        "registered" => Some(CreditRegistrationState::Registered),
        "duplicateAttainment" => Some(CreditRegistrationState::Duplicate),
        "notImprovedAttainment" => Some(CreditRegistrationState::NotImproved),
        _ => None,
    }
}

/// Where a `failed_retryable` row goes when its backoff elapses.
///
/// Derived from how far the row had got rather than remembered, and deliberately never
/// `submitting`: only the import phase writes that, in the transaction before it sends.
pub fn resume_state(
    has_submitted_attainment_id: bool,
    has_payload_snapshot: bool,
) -> CreditRegistrationState {
    if has_submitted_attainment_id {
        CreditRegistrationState::AwaitingVerification
    } else if has_payload_snapshot {
        CreditRegistrationState::CheckingEnrolment
    } else {
        CreditRegistrationState::ReadyToSubmit
    }
}

#[cfg(test)]
mod tests {
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
        }
    }

    fn import(code: Code) -> Outcome {
        submit_error_outcome(SuotarEndpoint::ImportAttainments, code, &facts())
    }

    fn resolve(code: Code) -> Outcome {
        submit_error_outcome(SuotarEndpoint::ResolveEnrolments, code, &facts())
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

    #[test]
    fn the_documented_import_codes_land_where_the_state_machine_says() {
        let expected = [
            (Code::PersonNotFound, State::PendingStudentNumber),
            (Code::EnrolmentNotFound, State::NoUsableEnrolment),
            (Code::EnrolmentNotAccepted, State::NoUsableEnrolment),
            (Code::StudyRightNotValid, State::NoUsableEnrolment),
            (Code::CourseCodeNotFound, State::FailedPermanent),
            (Code::CourseNotAllowed, State::FailedPermanent),
            (Code::InvalidGradeForGradeScale, State::FailedPermanent),
            (Code::InvalidCredits, State::FailedPermanent),
            (Code::AcceptorNotFound, State::FailedPermanent),
            (Code::SisuValidationFailed, State::FailedPermanent),
            (Code::SisuTimeout, State::SubmissionUncertain),
            (Code::SisuTemporarilyUnavailable, State::FailedRetryable),
            (Code::Unauthorized, State::FailedRetryable),
            (Code::MalformedRequest, State::FailedRetryable),
            (Code::TransportError, State::FailedRetryable),
            (Code::UnexpectedResponse, State::FailedRetryable),
            (Code::NoGradeScaleMapping, State::FailedPermanent),
            (Code::MissingUhCourseCode, State::FailedPermanent),
            (Code::MissingEctsCredits, State::FailedPermanent),
            (Code::RetryWindowExpired, State::FailedPermanent),
            (Code::Misregistered, State::FailedPermanent),
            (Code::Unknown, State::SubmissionUncertain),
        ];
        assert_eq!(expected.len(), CreditRegistrationErrorCode::ALL.len());
        for (code, state) in expected {
            assert_eq!(import(code).to_state, state, "{code:?}");
        }
    }

    /// The same code means different things depending on whether the call could have created
    /// something. Resolve creates nothing, so a timeout there is a plain retry.
    /// The complete set of import answers after which the row may be sent again. Each is a refusal
    /// of the item before Sisu saw it rather than an outcome of it, so nothing was created; the
    /// transient code is on the list only because the phase never reaches here with it, having
    /// hardened it to a timeout first. Adding to this list is a decision about a real transcript.
    #[test]
    fn the_import_answers_that_allow_another_attempt_are_only_refusals() {
        let resendable: Vec<Code> = CreditRegistrationErrorCode::ALL
            .into_iter()
            .filter(|code| import(*code).to_state == State::FailedRetryable)
            .collect();
        assert_eq!(
            resendable,
            vec![
                Code::SisuTemporarilyUnavailable,
                Code::Unauthorized,
                Code::MalformedRequest,
                Code::TransportError,
                Code::UnexpectedResponse,
            ]
        );
        assert_eq!(
            crate::credit_registrations::map_code(
                SuotarEndpoint::ImportAttainments,
                "sisuTemporarilyUnavailable"
            ),
            Some(Code::SisuTimeout)
        );
    }

    /// The dangerous shape of an unknown answer: an admin retry from `failed_permanent` would send
    /// an import whose first outcome nobody knows.
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
        assert_eq!(outcome.to_state, State::PendingStudentNumber);
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
            Some(true)
        );
        assert_eq!(
            import(Code::SisuTemporarilyUnavailable).needs_admin_attention,
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
            SuotarEndpoint::ResolveEnrolments,
            Code::SisuTemporarilyUnavailable,
            &facts,
        );
        assert_eq!(outcome.to_state, State::FailedPermanent);
        assert_eq!(outcome.error_code, Some(Code::RetryWindowExpired));
    }

    /// The expiry must not reach a row whose outcome is unknown: `failed_permanent` is a state an
    /// admin retries from, and retrying an uncertain import is a second submission.
    #[test]
    fn an_expired_window_does_not_override_an_uncertain_import() {
        let facts = RowFacts {
            first_failed_at: Some(Utc::now() - chrono::Duration::days(8)),
            ..facts()
        };
        assert_eq!(
            submit_error_outcome(SuotarEndpoint::ImportAttainments, Code::SisuTimeout, &facts)
                .to_state,
            State::SubmissionUncertain
        );
    }

    #[test]
    fn only_a_connection_that_never_opened_lets_an_import_batch_retry() {
        let facts = facts();
        for variant in [
            SuotarErrorVariant::ServerError,
            SuotarErrorVariant::TransportUnknown,
            SuotarErrorVariant::Deserialization,
            SuotarErrorVariant::RequestLevelError,
        ] {
            assert_eq!(
                request_level_outcome(SuotarEndpoint::ImportAttainments, variant, &facts).to_state,
                State::SubmissionUncertain,
                "{variant:?}"
            );
        }
        for variant in [
            SuotarErrorVariant::TransportNotDelivered,
            SuotarErrorVariant::Unauthorized,
            SuotarErrorVariant::MalformedRequest,
        ] {
            assert_eq!(
                request_level_outcome(SuotarEndpoint::ImportAttainments, variant, &facts).to_state,
                State::FailedRetryable,
                "{variant:?}"
            );
        }
    }

    #[test]
    fn a_request_level_failure_elsewhere_is_always_a_plain_retry() {
        let facts = facts();
        for variant in [
            SuotarErrorVariant::ServerError,
            SuotarErrorVariant::TransportUnknown,
            SuotarErrorVariant::Unauthorized,
        ] {
            assert_eq!(
                request_level_outcome(SuotarEndpoint::ResolveEnrolments, variant, &facts).to_state,
                State::FailedRetryable,
                "{variant:?}"
            );
        }
    }

    #[test]
    fn an_import_item_suotar_never_answered_is_uncertain() {
        assert_eq!(
            unanswered_item_outcome(
                SuotarEndpoint::ImportAttainments,
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
            SuotarEndpoint::VerifyAttainments,
            State::AwaitingVerification,
            &facts(),
        );
        assert_eq!(outcome.to_state, State::AwaitingVerification);
        assert!(outcome.delay_secs.is_some());
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
        assert_eq!(outcome.needs_admin_attention, Some(true));
    }

    /// An unconfirmed attainment stays unconfirmed rather than becoming a failure, and the polling
    /// drops to daily so the queue does not carry it at full rate forever.
    #[test]
    fn an_expired_verify_window_slows_down_and_asks_for_a_human() {
        let facts = RowFacts {
            submitted_at: Some(Utc::now() - chrono::Duration::days(20)),
            verify_attempt_count: 40,
            ..facts()
        };
        let outcome = verify_not_registered_outcome(State::AwaitingVerification, &facts);
        assert_eq!(outcome.to_state, State::AwaitingVerification);
        assert_eq!(outcome.needs_admin_attention, Some(true));
        assert_eq!(outcome.delay_secs, Some(VERIFY_GIVE_UP_POLL_SECS));
    }

    #[test]
    fn an_uncertain_row_asks_for_a_human_only_after_the_documented_checks() {
        let before = uncertain_recheck_outcome(&RowFacts {
            verify_attempt_count: UNCERTAIN_MAX_CHECKS - 1,
            ..facts()
        });
        assert_eq!(before.needs_admin_attention, None);
        assert_eq!(before.to_state, State::SubmissionUncertain);

        let after = uncertain_recheck_outcome(&RowFacts {
            verify_attempt_count: UNCERTAIN_MAX_CHECKS,
            ..facts()
        });
        assert_eq!(after.needs_admin_attention, Some(true));
        assert_eq!(after.to_state, State::SubmissionUncertain);
    }

    #[test]
    fn the_import_success_codes_map_to_their_states() {
        assert_eq!(
            import_success_state("sent"),
            Some(State::AwaitingVerification)
        );
        assert_eq!(import_success_state("registered"), Some(State::Registered));
        assert_eq!(
            import_success_state("duplicateAttainment"),
            Some(State::Duplicate)
        );
        assert_eq!(
            import_success_state("notImprovedAttainment"),
            Some(State::NotImproved)
        );
        assert_eq!(import_success_state("somethingElse"), None);
    }

    #[test]
    fn a_retry_resumes_where_the_row_had_got_to() {
        assert_eq!(resume_state(false, false), State::ReadyToSubmit);
        assert_eq!(resume_state(false, true), State::CheckingEnrolment);
        assert_eq!(resume_state(true, true), State::AwaitingVerification);
    }
}
