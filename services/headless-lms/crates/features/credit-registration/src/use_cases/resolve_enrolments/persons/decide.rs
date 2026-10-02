//! What a person lookup's answer does to its row.

use headless_lms_models::credit_registrations::{
    CreditRegistrationErrorCode, CreditRegistrationState,
};
use headless_lms_models::library::credit_registration::outcomes::{
    NextAttempt, Outcome, RowFacts, submit_error_outcome, unanswered_item_outcome,
};

use crate::registry::{BatchRequest, PersonLookup};
use crate::use_cases::resolve_enrolments::Lookup;
use crate::workflow::{ClaimedRegistration, Decision};

/// A person lookup Suotar left unanswered for the row.
pub(super) fn unanswered_person_decision(
    state: CreditRegistrationState,
    facts: &RowFacts,
) -> Decision<'static> {
    Decision::new(unanswered_item_outcome(
        PersonLookup::OPERATION,
        state,
        facts,
    ))
    .with_message("Sisu did not answer for this item.")
}

/// A person lookup Suotar answered with an error code, such as an unknown student number.
pub(super) fn refused_person_decision(
    code: CreditRegistrationErrorCode,
    facts: &RowFacts,
) -> Decision<'static> {
    Decision::new(submit_error_outcome(PersonLookup::OPERATION, code, facts))
}

/// What filling a found person in on the row's link came to.
pub(super) enum PersonFill {
    Filled,
    /// The link changed while its person was looked up.
    LinkChanged,
    /// Another account's link already holds the person; the clash is recorded.
    HeldByAnotherLink,
}

impl PersonFill {
    /// Where the found person sends the row. Another account's link to the same person wins, as it
    /// does for a conflicting number: the registrar's link is dropped and the clash recorded for an
    /// admin.
    pub(super) fn decision(self, claim: &ClaimedRegistration) -> Decision<'static> {
        match self {
            Self::Filled => Decision::new(found_person_outcome(claim))
                .with_message("Found the Sisu person the linked student number belongs to."),
            Self::LinkChanged => Decision::new(Outcome::to(CreditRegistrationState::Pending))
                .with_message(
                    "The linked student number changed while its Sisu person was looked up.",
                ),
            Self::HeldByAnotherLink => Decision::new(Outcome {
                drop_verified_student_number: true,
                ..Outcome::to(CreditRegistrationState::Pending)
            })
            .with_message(
                "Another account's link already holds the Sisu person this student number belongs \
                 to.",
            ),
        }
    }
}

/// Leaves the row due for the enrolment lookup: a first resolve back in `ready_to_submit`, a parked
/// row where it was, with its error code and last check time, since its enrolment was not checked.
fn found_person_outcome(claim: &ClaimedRegistration) -> Outcome {
    let registration = claim.registration();
    match Lookup::of(registration) {
        Lookup::FirstResolve => Outcome::to(CreditRegistrationState::ReadyToSubmit),
        Lookup::ParkedCheck => Outcome {
            error_code: registration.error_code,
            next: NextAttempt::At(registration.next_attempt_at),
            keeps_enrolment_checked_at: true,
            ..Outcome::to(CreditRegistrationState::NoUsableEnrolment)
        },
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeDelta;
    use headless_lms_models::credit_registrations::CreditRegistration;
    use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;

    use super::*;
    use crate::test_fixtures::{now, registration};

    fn parked_row() -> CreditRegistration {
        CreditRegistration {
            error_code: Some(Code::EnrolmentNotFound),
            no_usable_enrolment_since: Some(now() - TimeDelta::days(3)),
            next_attempt_at: now() + TimeDelta::days(1),
            ..registration(State::NoUsableEnrolment)
        }
    }

    fn unanswered(row: &CreditRegistration) -> Outcome {
        unanswered_person_decision(row.state, &RowFacts::of(row, now())).outcome
    }

    #[test]
    fn an_unanswered_first_resolve_retries_later() {
        let outcome = unanswered(&registration(State::ReadyToSubmit));
        assert_eq!(outcome.to_state, State::FailedRetryable);
        assert_eq!(outcome.error_code, Some(Code::UnexpectedResponse));
    }

    #[test]
    fn an_unanswered_parked_check_keeps_the_row_waiting_with_its_code() {
        let outcome = unanswered(&parked_row());
        assert_eq!(outcome.to_state, State::NoUsableEnrolment);
        assert_eq!(outcome.error_code, Some(Code::EnrolmentNotFound));
        assert!(outcome.keeps_enrolment_checked_at);
    }

    #[test]
    fn person_not_found_drops_the_linked_number() {
        let row = registration(State::ReadyToSubmit);
        let decision = refused_person_decision(Code::PersonNotFound, &RowFacts::of(&row, now()));
        let outcome = decision.outcome;
        assert_eq!(outcome.to_state, State::Pending);
        assert!(outcome.drop_verified_student_number);
    }

    fn fill(row: CreditRegistration, fill: PersonFill) -> Decision<'static> {
        fill.decision(&crate::use_cases::resolve_enrolments::claim_for_lookup(row))
    }

    #[test]
    fn a_filled_first_resolve_goes_on_to_the_enrolment_lookup() {
        let decision = fill(registration(State::ReadyToSubmit), PersonFill::Filled);
        assert_eq!(decision.outcome.to_state, State::ReadyToSubmit);
        assert!(decision.message.as_deref().is_some());
    }

    #[test]
    fn a_filled_parked_check_stays_parked_with_its_code_schedule_and_check_time() {
        let row = parked_row();
        let decision = fill(row.clone(), PersonFill::Filled);
        let outcome = decision.outcome;
        assert_eq!(outcome.to_state, State::NoUsableEnrolment);
        assert_eq!(outcome.error_code, Some(Code::EnrolmentNotFound));
        assert_eq!(outcome.next, NextAttempt::At(row.next_attempt_at));
        assert!(outcome.keeps_enrolment_checked_at);
    }

    #[test]
    fn a_link_that_changed_meanwhile_goes_back_to_pending_and_keeps_its_number() {
        let decision = fill(registration(State::ReadyToSubmit), PersonFill::LinkChanged);
        assert_eq!(decision.outcome.to_state, State::Pending);
        assert!(!decision.outcome.drop_verified_student_number);
    }

    #[test]
    fn a_person_held_by_another_link_drops_this_link() {
        for row in [registration(State::ReadyToSubmit), parked_row()] {
            let decision = fill(row, PersonFill::HeldByAnotherLink);
            assert_eq!(decision.outcome.to_state, State::Pending);
            assert!(decision.outcome.drop_verified_student_number);
        }
    }
}
