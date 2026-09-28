//! What an import answer does to its row.

use headless_lms_models::credit_registrations::{CreditRegistration, CreditRegistrationState};
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, import_success_outcome, submission_uncertain, submit_error_outcome,
    unanswered_item_outcome,
};
use headless_lms_models::library::credit_registration::study_registry::RegistryAttainment;

use super::ENDPOINT;
use crate::domain::Decision;
use crate::registry::ImportAnswer;

/// What the study registry's answer for one submitted row does to it. Anything the answer disclosed
/// about the attainment is written before the move.
pub(super) fn decide_import_answer<'a>(
    row: &CreditRegistration,
    answer: Option<&'a ImportAnswer>,
    facts: &RowFacts,
) -> Decision<'a> {
    // Sent and unanswered: verified from here, never re-sent.
    let Some(answer) = answer else {
        return Decision::new(unanswered_item_outcome(ENDPOINT, row.state, facts)).with_message(
            "Sisu did not answer for this item, so we do not know yet whether the credits were \
             registered.",
        );
    };
    match answer {
        ImportAnswer::Submitted {
            submission,
            is_repeat_in_batch,
        } => {
            let Some(submission) = submission else {
                // Accepted with nothing to verify by; recovery is a lookup among the student's
                // existing attainments, never a second import.
                return Decision::new(submission_uncertain())
                    .with_message("The submission was accepted without an id to verify it by.");
            };
            let outcome = import_success_outcome(CreditRegistrationState::AwaitingVerification);
            if !*is_repeat_in_batch {
                return Decision::new(outcome).with_submitted_attainment(Some(submission));
            }
            error!(
                credit_registration_id = %row.id,
                "Suotar answered duplicateRequestItem; a batch carried the same completion twice"
            );
            Decision::new(Outcome {
                needs_admin_attention: Some(true),
                ..outcome
            })
            .with_submitted_attainment(Some(submission))
            .with_message(
                "Suotar found this completion twice in one batch and submitted only the first; the \
                 batch should never have held both.",
            )
        }
        ImportAnswer::Settled { state, attainment } => {
            let attainment = attainment.as_ref();
            let decision =
                Decision::new(import_success_outcome(*state)).with_sisu_attainment(attainment);
            match settled_message(*state, attainment) {
                Some(message) => decision.with_message(message),
                None => decision,
            }
        }
        // A `sisuTimeout` still names the submission it may have made, which turns its recovery
        // into plain verification instead of a hunt through the student's existing attainments.
        ImportAnswer::Refused {
            code,
            submission,
            error_message,
        } => {
            let outcome = submit_error_outcome(ENDPOINT, *code, facts);
            let submission = submission
                .as_ref()
                .filter(|_| outcome.to_state == CreditRegistrationState::SubmissionUncertain);
            Decision::new(outcome)
                .with_submitted_attainment(submission)
                .with_row_error(error_message.as_deref())
        }
        ImportAnswer::UnknownSuccessCode => Decision::new(submission_uncertain()).with_message(
            "Sisu answered with a success code we do not know, so we do not know yet whether the \
             credits were registered.",
        ),
    }
}

/// The timeline line for an answer that settled the row. `not_improved` names the grade the registry
/// held, because "already equal or better" without it reads as a bug to whoever raised the grade.
fn settled_message(
    state: CreditRegistrationState,
    attainment: Option<&RegistryAttainment>,
) -> Option<String> {
    match state {
        CreditRegistrationState::Duplicate => Some("Sisu already had these credits.".to_string()),
        CreditRegistrationState::NotImproved => Some(match held_grade(attainment) {
            Some(grade) => format!("Sisu already has an equal or better grade: {grade}."),
            None => "Sisu already has an equal or better grade.".to_string(),
        }),
        _ => None,
    }
}

/// The registry's own grade for an attainment, with its scale named: "1" is a pass on one scale and
/// a one out of five on the other.
fn held_grade(attainment: Option<&RegistryAttainment>) -> Option<String> {
    let attainment = attainment?;
    let grade_id = attainment.grade_id.as_deref()?;
    Some(match attainment.grade_scale_id.as_deref() {
        Some(scale) => format!("{grade_id} on {scale}"),
        None => grade_id.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;

    use super::*;
    use crate::registry::{AttainmentId, SubmittedAttainmentRef};
    use crate::test_fixtures::{attainment, date, now, registration};

    fn submission() -> SubmittedAttainmentRef {
        SubmittedAttainmentRef {
            id: AttainmentId::new("submitted-1"),
            attainment_type: Some("AssessmentItemAttainment".to_string()),
        }
    }

    fn decide(answer: Option<&ImportAnswer>) -> Decision<'_> {
        let row = registration(State::CheckingEnrolment);
        decide_import_answer(&row, answer, &RowFacts::of(&row, now()))
    }

    fn submitted_id<'a>(decision: &Decision<'a>) -> Option<&'a str> {
        decision
            .pre_transition()
            .submitted_attainment()
            .map(|submission| submission.id.as_str())
    }

    #[test]
    fn an_unanswered_item_is_uncertain_and_never_resent() {
        let decision = decide(None);
        assert_eq!(decision.outcome().to_state, State::SubmissionUncertain);
        assert!(decision.message().is_some());
        assert!(submitted_id(&decision).is_none());
    }

    #[test]
    fn an_accepted_submission_awaits_verification_by_its_id() {
        let answer = ImportAnswer::Submitted {
            submission: Some(submission()),
            is_repeat_in_batch: false,
        };
        let decision = decide(Some(&answer));
        assert_eq!(decision.outcome().to_state, State::AwaitingVerification);
        assert_eq!(decision.outcome().needs_admin_attention, None);
        assert_eq!(submitted_id(&decision), Some("submitted-1"));
        assert!(decision.message().is_none());
        assert!(decision.atomic().payload().is_none());
    }

    #[test]
    fn a_repeat_in_one_batch_is_verified_and_flagged_for_an_admin() {
        let answer = ImportAnswer::Submitted {
            submission: Some(submission()),
            is_repeat_in_batch: true,
        };
        let decision = decide(Some(&answer));
        assert_eq!(decision.outcome().to_state, State::AwaitingVerification);
        assert_eq!(decision.outcome().needs_admin_attention, Some(true));
        assert_eq!(submitted_id(&decision), Some("submitted-1"));
        assert!(decision.message().is_some());
    }

    #[test]
    fn an_accepted_submission_without_an_id_is_uncertain() {
        for is_repeat_in_batch in [false, true] {
            let answer = ImportAnswer::Submitted {
                submission: None,
                is_repeat_in_batch,
            };
            let decision = decide(Some(&answer));
            assert_eq!(decision.outcome().to_state, State::SubmissionUncertain);
            assert!(submitted_id(&decision).is_none());
            assert!(decision.message().is_some());
        }
    }

    #[test]
    fn a_duplicate_answer_settles_as_duplicate_with_the_held_attainment() {
        let held = attainment("sis-0-5", "4", date(2026, 8, 1));
        let answer = ImportAnswer::Settled {
            state: State::Duplicate,
            attainment: Some(held.clone()),
        };
        let decision = decide(Some(&answer));
        assert_eq!(decision.outcome().to_state, State::Duplicate);
        assert_eq!(decision.pre_transition().sisu_attainment(), Some(&held));
        assert_eq!(decision.message(), Some("Sisu already had these credits."));
    }

    #[test]
    fn a_not_improved_answer_names_the_grade_and_scale_sisu_holds() {
        let answer = ImportAnswer::Settled {
            state: State::NotImproved,
            attainment: Some(attainment("sis-0-5", "5", date(2026, 8, 1))),
        };
        let decision = decide(Some(&answer));
        assert_eq!(decision.outcome().to_state, State::NotImproved);
        assert_eq!(
            decision.message(),
            Some("Sisu already has an equal or better grade: 5 on sis-0-5.")
        );
    }

    #[test]
    fn a_not_improved_answer_without_the_held_attainment_still_says_why() {
        let answer = ImportAnswer::Settled {
            state: State::NotImproved,
            attainment: None,
        };
        let decision = decide(Some(&answer));
        assert_eq!(decision.outcome().to_state, State::NotImproved);
        assert!(decision.pre_transition().sisu_attainment().is_none());
        assert_eq!(
            decision.message(),
            Some("Sisu already has an equal or better grade.")
        );
    }

    #[test]
    fn a_sisu_timeout_keeps_the_submission_it_names_for_verification() {
        let answer = ImportAnswer::Refused {
            code: Code::SisuTimeout,
            submission: Some(submission()),
            error_message: Some("Sisu timed out".to_string()),
        };
        let decision = decide(Some(&answer));
        assert_eq!(decision.outcome().to_state, State::SubmissionUncertain);
        assert_eq!(submitted_id(&decision), Some("submitted-1"));
        assert_eq!(decision.row_error(), Some("Sisu timed out"));
    }

    #[test]
    fn a_refusal_that_proves_nothing_landed_drops_the_submission_it_names() {
        let answer = ImportAnswer::Refused {
            code: Code::GradeScaleMismatch,
            submission: Some(submission()),
            error_message: Some("wrong scale".to_string()),
        };
        let decision = decide(Some(&answer));
        assert_eq!(decision.outcome().to_state, State::FailedPermanent);
        assert_eq!(
            decision.outcome().error_code,
            Some(Code::GradeScaleMismatch)
        );
        assert!(submitted_id(&decision).is_none());
        assert_eq!(decision.row_error(), Some("wrong scale"));
    }

    #[test]
    fn an_unknown_success_code_is_uncertain() {
        let decision = decide(Some(&ImportAnswer::UnknownSuccessCode));
        assert_eq!(decision.outcome().to_state, State::SubmissionUncertain);
        assert!(decision.message().is_some());
    }
}
