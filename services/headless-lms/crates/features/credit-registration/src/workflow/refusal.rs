//! What a row of a request the study registry refused as a whole is written as.

use chrono::{DateTime, Utc};
use headless_lms_data_operations::library::credit_registration::outcomes::{
    Outcome, isolated_malformed_request_outcome, request_level_outcome,
};

use super::claim::Claimed;
use super::decision::Decision;
use crate::registry::{RefusedFor, RegistryError, RegistryOperation};

/// What a flow's rows get when the whole request was refused. One per flow, so whether its batches
/// may be split is known before any row is looked at.
pub(crate) enum RefusalPolicy<Extra> {
    /// The shared request-level outcome. A malformed-request refusal proves nothing was acted on,
    /// and may be down to one row alone, so the batch is split in halves until the rows it keeps
    /// refusing are alone in theirs.
    RequestLevel,
    /// Whatever the refusal, the row keeps waiting where it is, as `outcome` says for it: a failure
    /// to ask proves nothing about a submission that may have landed. Never split.
    KeepWaiting {
        outcome: fn(&Claimed<Extra>, DateTime<Utc>) -> Outcome,
        message: &'static str,
    },
}

impl<Extra> RefusalPolicy<Extra> {
    /// Whether a malformed-request refusal of several rows may be split to find the one to blame.
    pub(crate) fn may_split(&self) -> bool {
        matches!(self, Self::RequestLevel)
    }

    /// The decision for `row` of a request of `operation` the registry refused. A row refused alone
    /// needs a human, since resending cannot fix it.
    pub(crate) fn decision<'a>(
        &self,
        row: &Claimed<Extra>,
        operation: RegistryOperation,
        error: &'a RegistryError,
        refused_for: RefusedFor,
        now: DateTime<Utc>,
    ) -> Decision<'a> {
        let (outcome, message) = match (self, refused_for) {
            (Self::RequestLevel, RefusedFor::RowAlone) => (
                isolated_malformed_request_outcome(),
                "Sisu did not accept this row even when it was sent alone.",
            ),
            (Self::RequestLevel, RefusedFor::WholeBatch) => (
                request_level_outcome(operation, error.kind, &row.claim.facts(now)),
                "Sisu did not accept the whole request.",
            ),
            (Self::KeepWaiting { outcome, message }, _) => (outcome(row, now), *message),
        };
        Decision::new(outcome)
            .with_message(message)
            .with_row_error(Some(&error.message))
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeDelta;
    use headless_lms_data_operations::library::credit_registration::study_registry::RegistryErrorKind as Kind;
    use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;
    use headless_lms_models::credit_registrations::{AdminAttention, CreditRegistration};

    use super::*;
    use crate::test_fixtures::{now, registration};
    use crate::workflow::ClaimedRegistration;

    const KINDS: [Kind; 8] = [
        Kind::AuthenticationFailure,
        Kind::MalformedRequest,
        Kind::RejectedRequest,
        Kind::TemporarilyUnavailable,
        Kind::ServerError,
        Kind::NotDelivered,
        Kind::NoAnswer,
        Kind::ProtocolViolation,
    ];

    fn claim(state: State, in_flight: State) -> Claimed<()> {
        Claimed {
            claim: ClaimedRegistration::moved_to(registration(state), in_flight),
            extra: (),
        }
    }

    fn waiting_claim() -> Claimed<()> {
        let row = CreditRegistration {
            error_code: Some(Code::EnrolmentNotFound),
            no_usable_enrolment_since: Some(now() - TimeDelta::days(3)),
            ..registration(State::NoUsableEnrolment)
        };
        Claimed {
            claim: ClaimedRegistration::left_in_place(row),
            extra: (),
        }
    }

    fn decide<'a>(
        operation: RegistryOperation,
        row: &Claimed<()>,
        error: &'a RegistryError,
        refused_for: RefusedFor,
    ) -> Decision<'a> {
        RefusalPolicy::RequestLevel.decision(row, operation, error, refused_for, now())
    }

    #[test]
    fn a_refused_import_is_uncertain_exactly_when_it_may_have_been_acted_on() {
        let claim = claim(State::CheckingEnrolment, State::Submitting);
        for kind in KINDS {
            let error = RegistryError::new(kind, "refused");
            let decision = decide(
                RegistryOperation::ImportAttainments,
                &claim,
                &error,
                RefusedFor::WholeBatch,
            );
            let is_uncertain = decision.outcome.to_state == State::SubmissionUncertain;
            assert_eq!(is_uncertain, kind.may_have_been_acted_on(), "{kind:?}");
            if !is_uncertain {
                assert_eq!(
                    decision.outcome.to_state,
                    State::FailedRetryable,
                    "{kind:?}"
                );
            }
            assert_eq!(decision.row_error, Some("refused"));
            assert_eq!(
                decision.message.as_deref(),
                Some("Sisu did not accept the whole request.")
            );
        }
    }

    #[test]
    fn a_row_refused_even_alone_needs_an_admin() {
        let error = RegistryError::new(Kind::MalformedRequest, "bad row");
        for operation in [
            RegistryOperation::ImportAttainments,
            RegistryOperation::ResolveEnrolments,
            RegistryOperation::ResolvePersons,
        ] {
            let decision = decide(
                operation,
                &claim(State::ReadyToSubmit, State::ResolvingEnrolment),
                &error,
                RefusedFor::RowAlone,
            );
            assert_eq!(decision.outcome.to_state, State::FailedPermanent);
            assert_eq!(decision.outcome.error_code, Some(Code::MalformedRequest));
            assert_eq!(
                decision.outcome.needs_admin_attention,
                Some(AdminAttention::Raise)
            );
            assert_eq!(decision.row_error, Some("bad row"));
            assert_eq!(
                decision.message.as_deref(),
                Some("Sisu did not accept this row even when it was sent alone.")
            );
        }
    }

    #[test]
    fn a_lookup_refused_in_an_outage_keeps_a_waiting_row_waiting() {
        let claim = waiting_claim();
        for kind in KINDS {
            let error = RegistryError::new(kind, "refused");
            let outcome = decide(
                RegistryOperation::ResolveEnrolments,
                &claim,
                &error,
                RefusedFor::WholeBatch,
            )
            .outcome;
            if kind.is_outage() {
                assert_eq!(outcome.to_state, State::NoUsableEnrolment, "{kind:?}");
                assert_eq!(outcome.error_code, Some(Code::EnrolmentNotFound));
                assert!(outcome.keeps_enrolment_checked_at);
            } else {
                assert_eq!(outcome.to_state, State::FailedRetryable, "{kind:?}");
            }
        }
    }

    #[test]
    fn a_refused_first_lookup_retries_with_the_request_level_code() {
        let claim = claim(State::ReadyToSubmit, State::ResolvingEnrolment);
        let error = RegistryError::new(Kind::NotDelivered, "refused");
        let outcome = decide(
            RegistryOperation::ResolveEnrolments,
            &claim,
            &error,
            RefusedFor::WholeBatch,
        )
        .outcome;
        assert_eq!(outcome.to_state, State::FailedRetryable);
        assert_eq!(outcome.error_code, Some(Code::TransportError));
        assert!(outcome.increment_submit_retry_count);
    }

    #[test]
    fn a_row_that_keeps_waiting_takes_the_flows_own_outcome_and_the_refusal() {
        let claim = claim(State::AwaitingVerification, State::AwaitingVerification);
        let error = RegistryError::new(Kind::MalformedRequest, "refused");
        for refused_for in [RefusedFor::WholeBatch, RefusedFor::RowAlone] {
            let policy: RefusalPolicy<()> = RefusalPolicy::KeepWaiting {
                outcome: |_, _| Outcome::to(State::AwaitingVerification),
                message: "still waiting",
            };
            assert!(!policy.may_split());
            let decision = policy.decision(
                &claim,
                RegistryOperation::VerifyAttainments,
                &error,
                refused_for,
                now(),
            );
            assert_eq!(decision.outcome.to_state, State::AwaitingVerification);
            assert_eq!(decision.message.as_deref(), Some("still waiting"));
            assert_eq!(decision.row_error, Some("refused"));
        }
    }
}
