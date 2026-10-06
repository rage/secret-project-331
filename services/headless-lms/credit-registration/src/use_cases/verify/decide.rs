//! What a verify answer does to its row.

use chrono::{DateTime, Utc};
use headless_lms_models::credit_registrations::{
    AdminAttention, CreditRegistration, CreditRegistrationState,
};
use headless_lms_models::library::credit_registration::backoff::{
    VERIFY_MAX_AGE, verify_window_expired,
};
use headless_lms_models::library::credit_registration::enrolment_selection::attainment_matching_submission;
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, uncertain_recheck_outcome, verify_error_outcome,
    verify_inconclusive_outcome, verify_not_registered_outcome, verify_partial_outcome,
};

use crate::registry::{EnrolmentAnswer, VerificationAnswer, VerificationReading};
use crate::workflow::Decision;

/// What a poll's answer comes to, where that needs no more than the answer.
pub(super) enum PollAnswer<'a> {
    Decided(Box<Decision<'a>>),
    /// Only the assessment item attainment is there yet; the outcome depends on when a poll first
    /// saw that.
    PartiallyRegistered,
    /// Suotar has no trace of the submission; the outcome depends on how often that happened.
    NotRegistered,
}

/// Only a course unit attainment registers the row, and only `notRegistered` sends it back towards
/// import; anything else keeps it polling.
pub(super) fn decide_poll<'a>(
    state: CreditRegistrationState,
    answer: Option<&'a VerificationAnswer>,
    facts: &RowFacts,
) -> PollAnswer<'a> {
    let Some(answer) = answer else {
        return PollAnswer::Decided(Box::new(still_polling_decision(state, facts, None)));
    };
    let decision = match &answer.reading {
        VerificationReading::Registered { attainment } => Decision::new(Outcome {
            // Confirmed, so whatever an operator was asked to look at is settled.
            needs_admin_attention: Some(AdminAttention::Clear),
            ..Outcome::to(CreditRegistrationState::Registered)
        })
        .with_sisu_attainment(Some(attainment)),
        VerificationReading::PartiallyRegistered => return PollAnswer::PartiallyRegistered,
        // `submissionPending`: polled on as usual, since the attainment usually shows up long
        // before `retryAfter`, which only bounds when a resubmission becomes safe.
        VerificationReading::Pending {
            resubmit_not_before,
        } => still_polling_decision(
            state,
            facts,
            Some("Sisu is still processing the submission."),
        )
        .with_resubmit_not_before(*resubmit_not_before),
        VerificationReading::NotRegistered => return PollAnswer::NotRegistered,
        VerificationReading::Failed { code } => {
            Decision::new(verify_error_outcome(state, *code, facts))
        }
        VerificationReading::Inconclusive => still_polling_decision(state, facts, None),
    };
    PollAnswer::Decided(Box::new(decision))
}

/// Keeps polling in place; past the verify window the expiry is the news, so it replaces
/// `message`.
fn still_polling_decision<'a>(
    state: CreditRegistrationState,
    facts: &RowFacts,
    message: Option<&'static str>,
) -> Decision<'a> {
    let decision = Decision::new(verify_inconclusive_outcome(state, facts));
    if verify_window_expired(facts.submitted_at, facts.now) {
        decision.with_message(format!(
            "Not confirmed within {} days of sending; now checked once a day.",
            VERIFY_MAX_AGE.num_days()
        ))
    } else if let Some(message) = message {
        decision.with_message(message)
    } else {
        decision
    }
}

/// A poll that found only the assessment item attainment, which a poll first saw at
/// `partially_registered_at`.
pub(super) fn partially_registered_decision(
    facts: &RowFacts,
    partially_registered_at: DateTime<Utc>,
) -> Decision<'static> {
    Decision::new(verify_partial_outcome(facts, partially_registered_at)).with_message(
        "Sisu has the assessment item attainment; waiting for the course unit attainment before \
         counting it registered.",
    )
}

/// A poll that found no trace of the submission.
pub(super) fn not_registered_decision(facts: &RowFacts, reimport_count: i32) -> Decision<'static> {
    Decision::new(verify_not_registered_outcome(facts, reimport_count))
        .with_message("Sisu has no trace of the submission, so it will be sent again.")
}

/// Settles an uncertain row as `duplicate` if the lookup found the attainment it would have created,
/// and otherwise leaves it uncertain.
pub(super) fn decide_recovery<'a>(
    row: &CreditRegistration,
    facts: &RowFacts,
    answer: Option<&'a EnrolmentAnswer>,
) -> Decision<'a> {
    // An enrolment error still lists the attainments, and the enrolment may be gone by now.
    let found = answer
        .zip(row.attained_at.map(|instant| instant.date_naive()))
        .zip(row.frozen_grade())
        .and_then(|((answer, attainment_date), grade)| {
            attainment_matching_submission(
                &answer.existing_attainments,
                attainment_date,
                row.submitted_at,
                &grade,
            )
        });
    let Some(attainment) = found else {
        return Decision::new(uncertain_recheck_outcome(facts)).with_message(
            "No matching attainment yet, so whether the submission landed is still unknown.",
        );
    };
    Decision::new(Outcome {
        needs_admin_attention: Some(AdminAttention::Clear),
        ..Outcome::to(CreditRegistrationState::Duplicate)
    })
    .with_sisu_attainment(Some(attainment))
    .with_message(
        "The credits this submission would have created are in Sisu, so it was registered after \
         all.",
    )
}

#[cfg(test)]
mod tests {
    use chrono::TimeDelta;
    use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;
    use headless_lms_models::library::credit_registration::backoff::{
        NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD, PARTIAL_REGISTRATION_ADMIN_AFTER,
    };
    use headless_lms_models::library::credit_registration::outcomes::NextAttempt;
    use headless_lms_models::library::credit_registration::study_registry::RegistryAttainment;

    use super::*;
    use crate::registry::EnrolmentReading;
    use crate::test_fixtures::{attainment, date, now, registration};

    fn facts() -> RowFacts {
        RowFacts::of(&registration(State::AwaitingVerification), now())
    }

    fn answer(reading: VerificationReading) -> VerificationAnswer {
        VerificationAnswer {
            reading,
            error_message: Some("item error".to_string()),
        }
    }

    fn decided<'a>(state: State, answer: Option<&'a VerificationAnswer>) -> Decision<'a> {
        match decide_poll(state, answer, &facts()) {
            PollAnswer::Decided(decision) => *decision,
            PollAnswer::PartiallyRegistered => panic!("partially registered"),
            PollAnswer::NotRegistered => panic!("not registered"),
        }
    }

    #[test]
    fn a_course_unit_attainment_registers_the_row_and_settles_admin_attention() {
        let registered = attainment("sis-0-5", "4", date(2026, 8, 1));
        let answer = answer(VerificationReading::Registered {
            attainment: registered.clone(),
        });
        let decision = decided(State::SubmissionUncertain, Some(&answer));
        assert_eq!(decision.outcome.to_state, State::Registered);
        assert_eq!(
            decision.outcome.needs_admin_attention,
            Some(AdminAttention::Clear)
        );
        assert_eq!(decision.pre_transition.sisu_attainment, Some(&registered));
    }

    #[test]
    fn an_unanswered_poll_keeps_polling_in_place() {
        for state in [
            State::AwaitingVerification,
            State::PartiallyRegistered,
            State::SubmissionUncertain,
        ] {
            let decision = decided(state, None);
            assert_eq!(decision.outcome.to_state, state);
            assert!(!decision.outcome.is_failure());
        }
    }

    #[test]
    fn a_pending_submission_keeps_polling_and_records_when_resending_is_safe() {
        let resubmit_not_before = now() + TimeDelta::hours(3);
        let answer = answer(VerificationReading::Pending {
            resubmit_not_before: Some(resubmit_not_before),
        });
        let decision = decided(State::AwaitingVerification, Some(&answer));
        assert_eq!(decision.outcome.to_state, State::AwaitingVerification);
        assert_eq!(
            decision.pre_transition.resubmit_not_before,
            Some(resubmit_not_before)
        );
        assert!(matches!(decision.outcome.next, NextAttempt::After(_)));
    }

    #[test]
    fn only_misregistered_moves_a_failed_poll_out_of_verification() {
        for code in Code::ALL {
            let answer = answer(VerificationReading::Failed { code });
            let decision = decided(State::AwaitingVerification, Some(&answer));
            let expected = if code == Code::Misregistered {
                State::Misregistered
            } else {
                State::AwaitingVerification
            };
            assert_eq!(decision.outcome.to_state, expected, "{code:?}");
        }
    }

    #[test]
    fn an_inconclusive_answer_keeps_polling() {
        let answer = answer(VerificationReading::Inconclusive);
        let decision = decided(State::SubmissionUncertain, Some(&answer));
        assert_eq!(decision.outcome.to_state, State::SubmissionUncertain);
        assert!(!decision.outcome.is_failure());
    }

    #[test]
    fn partial_and_missing_registrations_are_left_to_the_row_history() {
        let partial = answer(VerificationReading::PartiallyRegistered);
        assert!(matches!(
            decide_poll(State::AwaitingVerification, Some(&partial), &facts()),
            PollAnswer::PartiallyRegistered
        ));
        let missing = answer(VerificationReading::NotRegistered);
        assert!(matches!(
            decide_poll(State::AwaitingVerification, Some(&missing), &facts()),
            PollAnswer::NotRegistered
        ));
    }

    #[test]
    fn a_partial_registration_waits_for_the_course_unit_attainment() {
        let decision = partially_registered_decision(&facts(), now());
        assert_eq!(decision.outcome.to_state, State::PartiallyRegistered);
        assert_eq!(decision.outcome.needs_admin_attention, None);
    }

    #[test]
    fn a_long_partial_registration_asks_for_an_admin() {
        let decision =
            partially_registered_decision(&facts(), now() - PARTIAL_REGISTRATION_ADMIN_AFTER);
        assert_eq!(decision.outcome.to_state, State::PartiallyRegistered);
        assert_eq!(
            decision.outcome.needs_admin_attention,
            Some(AdminAttention::Raise)
        );
    }

    #[test]
    fn not_registered_sends_the_row_back_to_be_imported_again() {
        let decision = not_registered_decision(&facts(), 1);
        assert_eq!(decision.outcome.to_state, State::FailedRetryable);
        assert_eq!(decision.outcome.error_code, Some(Code::NotRegistered));
        assert!(decision.outcome.increment_submit_retry_count);
        assert!(decision.message.as_deref().is_some());
    }

    #[test]
    fn repeated_not_registered_asks_for_an_admin() {
        let decision = not_registered_decision(&facts(), NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD);
        assert_eq!(
            decision.outcome.needs_admin_attention,
            Some(AdminAttention::Raise)
        );
    }

    fn uncertain_row() -> CreditRegistration {
        CreditRegistration {
            attained_at: Some("2026-08-01T09:00:00Z".parse().expect("valid instant")),
            submitted_at: Some(now() - TimeDelta::hours(1)),
            grade_scale_id: Some("sis-0-5".to_string()),
            grade_id: Some("4".to_string()),
            ..registration(State::SubmissionUncertain)
        }
    }

    fn enrolment_answer(existing: Vec<RegistryAttainment>) -> EnrolmentAnswer {
        EnrolmentAnswer {
            reading: EnrolmentReading::Listed,
            enrolments: Vec::new(),
            existing_attainments: existing,
        }
    }

    #[test]
    fn recovery_finding_the_attainment_settles_the_row_as_duplicate() {
        let row = uncertain_row();
        let found = attainment("sis-0-5", "4", date(2026, 8, 1));
        let answer = enrolment_answer(vec![found.clone()]);
        let decision = decide_recovery(&row, &RowFacts::of(&row, now()), Some(&answer));
        assert_eq!(decision.outcome.to_state, State::Duplicate);
        assert_eq!(
            decision.outcome.needs_admin_attention,
            Some(AdminAttention::Clear)
        );
        assert_eq!(decision.pre_transition.sisu_attainment, Some(&found));
    }

    #[test]
    fn recovery_ignores_an_attainment_with_another_grade() {
        let row = uncertain_row();
        let answer = enrolment_answer(vec![attainment("sis-0-5", "3", date(2026, 8, 1))]);
        let decision = decide_recovery(&row, &RowFacts::of(&row, now()), Some(&answer));
        assert_eq!(decision.outcome.to_state, State::SubmissionUncertain);
        assert!(decision.pre_transition.sisu_attainment.is_none());
        assert!(decision.message.as_deref().is_some());
    }

    #[test]
    fn recovery_without_an_answer_or_an_attainment_date_stays_uncertain() {
        let row = uncertain_row();
        let facts = RowFacts::of(&row, now());
        assert_eq!(
            decide_recovery(&row, &facts, None).outcome.to_state,
            State::SubmissionUncertain
        );
        let undated = CreditRegistration {
            attained_at: None,
            ..uncertain_row()
        };
        let answer = enrolment_answer(vec![attainment("sis-0-5", "4", date(2026, 8, 1))]);
        assert_eq!(
            decide_recovery(&undated, &facts, Some(&answer))
                .outcome
                .to_state,
            State::SubmissionUncertain
        );
    }
}
