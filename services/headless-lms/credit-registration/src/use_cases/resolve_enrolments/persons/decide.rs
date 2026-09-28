//! What a person lookup's answer does to its row.

use headless_lms_models::credit_registrations::{CreditRegistration, CreditRegistrationState};
use headless_lms_models::library::credit_registration::outcomes::{
    NextAttempt, Outcome, RowFacts, submit_error_outcome, unanswered_item_outcome,
};

use super::ENDPOINT;
use crate::domain::Decision;
use crate::registry::{FoundPerson, PersonAnswer, PersonReading};
use crate::use_cases::resolve_enrolments::Lookup;

/// What a person lookup's answer comes to before the link is written.
pub(super) enum PersonNextStep<'a> {
    Decided(Decision<'static>),
    /// The person to fill in on the link, which decides where the row goes.
    Found(&'a FoundPerson),
}

pub(super) fn decide_person_answer<'a>(
    state: CreditRegistrationState,
    answer: Option<&'a PersonAnswer>,
    facts: &RowFacts,
) -> PersonNextStep<'a> {
    match answer.map(|answer| &answer.reading) {
        None => PersonNextStep::Decided(
            Decision::new(unanswered_item_outcome(ENDPOINT, state, facts))
                .with_message("Sisu did not answer for this item."),
        ),
        Some(PersonReading::Refused { code }) => {
            PersonNextStep::Decided(Decision::new(submit_error_outcome(ENDPOINT, *code, facts)))
        }
        Some(PersonReading::Found(person)) => PersonNextStep::Found(person),
    }
}

/// What filling a found person in on the row's link came to.
pub(super) enum PersonFill {
    Filled,
    /// The link changed while its person was looked up.
    LinkChanged,
    /// Another account's link already holds the person; the clash is recorded.
    HeldByAnotherLink,
}

/// Where a found person sends the row. Another account's link to the same person wins, as it does
/// for a conflicting number: the registrar's link is dropped and the clash recorded for an admin.
pub(super) fn person_fill_decision(
    registration: &CreditRegistration,
    lookup: Lookup,
    fill: PersonFill,
) -> Decision<'static> {
    match fill {
        PersonFill::Filled => Decision::new(found_person_outcome(registration, lookup))
            .with_message("Found the Sisu person the linked student number belongs to."),
        PersonFill::LinkChanged => Decision::new(Outcome::to(CreditRegistrationState::Pending))
            .with_message("The linked student number changed while its Sisu person was looked up."),
        PersonFill::HeldByAnotherLink => Decision::new(Outcome {
            drop_verified_student_number: true,
            ..Outcome::to(CreditRegistrationState::Pending)
        })
        .with_message(
            "Another account's link already holds the Sisu person this student number belongs to.",
        ),
    }
}

/// Leaves the row due for the enrolment lookup: a first resolve back in `ready_to_submit`, a parked
/// row where it was, with its error code and last check time, since its enrolment was not checked.
fn found_person_outcome(registration: &CreditRegistration, lookup: Lookup) -> Outcome {
    match lookup {
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
    use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;
    use secrecy::SecretString;

    use super::*;
    use crate::test_fixtures::{now, registration};

    fn answer(reading: PersonReading) -> PersonAnswer {
        PersonAnswer {
            reading,
            error_message: None,
        }
    }

    fn parked_row() -> CreditRegistration {
        CreditRegistration {
            error_code: Some(Code::EnrolmentNotFound),
            no_usable_enrolment_since: Some(now() - TimeDelta::days(3)),
            next_attempt_at: now() + TimeDelta::days(1),
            ..registration(State::NoUsableEnrolment)
        }
    }

    fn decided(row: &CreditRegistration, answer: Option<&PersonAnswer>) -> Outcome {
        match decide_person_answer(row.state, answer, &RowFacts::of(row, now())) {
            PersonNextStep::Decided(decision) => decision.outcome().clone(),
            PersonNextStep::Found(_) => panic!("found a person"),
        }
    }

    #[test]
    fn an_unanswered_first_resolve_retries_later() {
        let outcome = decided(&registration(State::ReadyToSubmit), None);
        assert_eq!(outcome.to_state, State::FailedRetryable);
        assert_eq!(outcome.error_code, Some(Code::UnexpectedResponse));
    }

    #[test]
    fn an_unanswered_parked_check_keeps_the_row_waiting_with_its_code() {
        let outcome = decided(&parked_row(), None);
        assert_eq!(outcome.to_state, State::NoUsableEnrolment);
        assert_eq!(outcome.error_code, Some(Code::EnrolmentNotFound));
        assert!(outcome.keeps_enrolment_checked_at);
    }

    #[test]
    fn person_not_found_drops_the_linked_number() {
        let answer = answer(PersonReading::Refused {
            code: Code::PersonNotFound,
        });
        let outcome = decided(&registration(State::ReadyToSubmit), Some(&answer));
        assert_eq!(outcome.to_state, State::Pending);
        assert!(outcome.drop_verified_student_number);
    }

    #[test]
    fn a_found_person_is_left_for_the_link_to_be_filled() {
        let answer = answer(PersonReading::Found(FoundPerson {
            person_id: SecretString::from("person-1"),
            first_names: None,
            last_name: None,
        }));
        let row = registration(State::ReadyToSubmit);
        assert!(matches!(
            decide_person_answer(row.state, Some(&answer), &RowFacts::of(&row, now())),
            PersonNextStep::Found(_)
        ));
    }

    #[test]
    fn a_filled_first_resolve_goes_on_to_the_enrolment_lookup() {
        let decision = person_fill_decision(
            &registration(State::ReadyToSubmit),
            Lookup::FirstResolve,
            PersonFill::Filled,
        );
        assert_eq!(decision.outcome().to_state, State::ReadyToSubmit);
        assert!(decision.message().is_some());
    }

    #[test]
    fn a_filled_parked_check_stays_parked_with_its_code_schedule_and_check_time() {
        let row = parked_row();
        let decision = person_fill_decision(&row, Lookup::ParkedCheck, PersonFill::Filled);
        let outcome = decision.outcome();
        assert_eq!(outcome.to_state, State::NoUsableEnrolment);
        assert_eq!(outcome.error_code, Some(Code::EnrolmentNotFound));
        assert_eq!(outcome.next, NextAttempt::At(row.next_attempt_at));
        assert!(outcome.keeps_enrolment_checked_at);
    }

    #[test]
    fn a_link_that_changed_meanwhile_goes_back_to_pending_and_keeps_its_number() {
        let decision = person_fill_decision(
            &registration(State::ReadyToSubmit),
            Lookup::FirstResolve,
            PersonFill::LinkChanged,
        );
        assert_eq!(decision.outcome().to_state, State::Pending);
        assert!(!decision.outcome().drop_verified_student_number);
    }

    #[test]
    fn a_person_held_by_another_link_drops_this_link() {
        for lookup in [Lookup::FirstResolve, Lookup::ParkedCheck] {
            let decision =
                person_fill_decision(&parked_row(), lookup, PersonFill::HeldByAnotherLink);
            assert_eq!(decision.outcome().to_state, State::Pending);
            assert!(decision.outcome().drop_verified_student_number);
        }
    }
}
