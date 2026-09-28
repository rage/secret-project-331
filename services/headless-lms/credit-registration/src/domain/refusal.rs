//! What a row of a request the study registry refused as a whole is written as.

use chrono::{DateTime, Utc};
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, isolated_malformed_request_outcome, request_level_outcome,
};
use headless_lms_models::suotar_api_calls::SuotarEndpoint;

use super::claim::ClaimedRegistration;
use super::decision::Decision;
use crate::registry::RegistryError;

/// What a flow's rows get when the whole request was refused.
pub(crate) enum Refusal {
    /// The shared request-level outcome. A malformed-request refusal proves nothing was acted on,
    /// and may be down to one row alone, so the batch is split in halves until the rows it keeps
    /// refusing are alone in theirs.
    RequestLevel,
    /// Whatever the refusal, the row keeps waiting where it is, as `outcome` says: a failure to ask
    /// proves nothing about a submission that may have landed. Never split.
    KeepWaiting {
        outcome: Outcome,
        message: &'static str,
    },
}

/// The decision for one row of a refused request. `is_isolated` when a malformed request was
/// refused even with the row alone in it, which resending cannot fix, so it needs a human.
pub(crate) fn refusal_decision<'a>(
    endpoint: SuotarEndpoint,
    claim: &ClaimedRegistration,
    refusal: Refusal,
    error: &'a RegistryError,
    is_isolated: bool,
    now: DateTime<Utc>,
) -> Decision<'a> {
    let (outcome, message) = match refusal {
        Refusal::RequestLevel if is_isolated => (
            isolated_malformed_request_outcome(),
            "Sisu did not accept this row even when it was sent alone.",
        ),
        Refusal::RequestLevel => (
            request_level_outcome(endpoint, error.kind(), &claim.facts(now)),
            "Sisu did not accept the whole request.",
        ),
        Refusal::KeepWaiting { outcome, message } => (outcome, message),
    };
    Decision::new(outcome)
        .with_message(message)
        .with_row_error(Some(error.message()))
}

#[cfg(test)]
mod tests {
    use chrono::TimeDelta;
    use headless_lms_models::credit_registrations::CreditRegistration;
    use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;
    use headless_lms_models::library::credit_registration::study_registry::RegistryErrorKind as Kind;

    use super::*;
    use crate::test_fixtures::{now, registration};

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

    fn claim(state: State, in_flight: State) -> ClaimedRegistration {
        ClaimedRegistration::moved_to(registration(state), in_flight)
    }

    fn waiting_claim() -> ClaimedRegistration {
        let row = CreditRegistration {
            error_code: Some(Code::EnrolmentNotFound),
            no_usable_enrolment_since: Some(now() - TimeDelta::days(3)),
            ..registration(State::NoUsableEnrolment)
        };
        ClaimedRegistration::left_in_place(row)
    }

    fn decide<'a>(
        endpoint: SuotarEndpoint,
        claim: &ClaimedRegistration,
        error: &'a RegistryError,
        is_isolated: bool,
    ) -> Decision<'a> {
        refusal_decision(
            endpoint,
            claim,
            Refusal::RequestLevel,
            error,
            is_isolated,
            now(),
        )
    }

    #[test]
    fn a_refused_import_is_uncertain_exactly_when_it_may_have_been_acted_on() {
        let claim = claim(State::CheckingEnrolment, State::Submitting);
        for kind in KINDS {
            let error = RegistryError::new(kind, "refused");
            let decision = decide(SuotarEndpoint::ImportAttainments, &claim, &error, false);
            let is_uncertain = decision.outcome().to_state == State::SubmissionUncertain;
            assert_eq!(is_uncertain, kind.may_have_been_acted_on(), "{kind:?}");
            if !is_uncertain {
                assert_eq!(
                    decision.outcome().to_state,
                    State::FailedRetryable,
                    "{kind:?}"
                );
            }
            assert_eq!(decision.row_error(), Some("refused"));
            assert_eq!(
                decision.message(),
                Some("Sisu did not accept the whole request.")
            );
        }
    }

    #[test]
    fn a_row_refused_even_alone_needs_an_admin() {
        let error = RegistryError::new(Kind::MalformedRequest, "bad row");
        for endpoint in [
            SuotarEndpoint::ImportAttainments,
            SuotarEndpoint::ResolveEnrolments,
            SuotarEndpoint::ResolvePersons,
        ] {
            let decision = decide(
                endpoint,
                &claim(State::ReadyToSubmit, State::ResolvingEnrolment),
                &error,
                true,
            );
            assert_eq!(decision.outcome().to_state, State::FailedPermanent);
            assert_eq!(decision.outcome().error_code, Some(Code::MalformedRequest));
            assert_eq!(decision.outcome().needs_admin_attention, Some(true));
            assert_eq!(decision.row_error(), Some("bad row"));
            assert_eq!(
                decision.message(),
                Some("Sisu did not accept this row even when it was sent alone.")
            );
        }
    }

    #[test]
    fn a_lookup_refused_in_an_outage_keeps_a_waiting_row_waiting() {
        let claim = waiting_claim();
        for kind in KINDS {
            let error = RegistryError::new(kind, "refused");
            let outcome = decide(SuotarEndpoint::ResolveEnrolments, &claim, &error, false)
                .outcome()
                .clone();
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
        let outcome = decide(SuotarEndpoint::ResolveEnrolments, &claim, &error, false)
            .outcome()
            .clone();
        assert_eq!(outcome.to_state, State::FailedRetryable);
        assert_eq!(outcome.error_code, Some(Code::TransportError));
        assert!(outcome.increment_submit_retry_count);
    }

    #[test]
    fn a_row_that_keeps_waiting_takes_the_flows_own_outcome_and_the_refusal() {
        let claim = claim(State::AwaitingVerification, State::AwaitingVerification);
        let error = RegistryError::new(Kind::MalformedRequest, "refused");
        for is_isolated in [false, true] {
            let decision = refusal_decision(
                SuotarEndpoint::VerifyAttainments,
                &claim,
                Refusal::KeepWaiting {
                    outcome: Outcome::to(State::AwaitingVerification),
                    message: "still waiting",
                },
                &error,
                is_isolated,
                now(),
            );
            assert_eq!(decision.outcome().to_state, State::AwaitingVerification);
            assert_eq!(decision.message(), Some("still waiting"));
            assert_eq!(decision.row_error(), Some("refused"));
        }
    }
}
