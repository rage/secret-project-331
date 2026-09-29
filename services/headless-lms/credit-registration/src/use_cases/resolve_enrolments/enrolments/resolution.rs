//! Given everything known once the lookup answered, what happens to the registration: settled as a
//! duplicate of a credit already held, failed, or its payload frozen for import.

use headless_lms_models::credit_registrations::{
    CreditRegistrationState, LiveSuccessForModule, RecordedCredit,
    get_recorded_credits_for_same_module, lock_live_successes_for_same_module,
};
use headless_lms_models::library::credit_registration::grade_mapping::{
    improves_on_all, map_grade,
};
use headless_lms_models::library::credit_registration::outcomes::{Outcome, submit_error_outcome};
use headless_lms_models::library::credit_registration::payload::{
    BuiltPayload, PayloadSources, build_payload_snapshot,
};
use headless_lms_models::secret::DbSecret;
use headless_lms_utils::prelude::Utc;
use sqlx::PgConnection;
use uuid::Uuid;

use super::answer::{AnsweredLookup, EnrolmentLookupResult};
use crate::error::CreditRegistrationResult;
use crate::registry::{BatchRequest, EnrolmentLookup};
use crate::workflow::{Decision, PayloadChange};

/// The credits outside Sisu this attempt's grade competes with for the module: what we registered
/// from the student's other attempts, which Suotar's copy of Sisu may predate, and the credits our
/// records hold.
pub(super) struct CompetingCredits {
    registered_by_us: Vec<LiveSuccessForModule>,
    recorded_locally: Vec<RecordedCredit>,
}

impl CompetingCredits {
    /// Locks our registered successes only for a listed answer, the one that can freeze a payload
    /// superseding them, and reads the recorded credits only for an enrolment error, the one answer
    /// they can overrule. Call inside the transaction that writes the resolution.
    pub(super) async fn load(
        tx: &mut PgConnection,
        lookup: &AnsweredLookup<'_>,
    ) -> CreditRegistrationResult<Self> {
        let row_id = lookup.claim().id();
        let registered_by_us = match lookup.result() {
            EnrolmentLookupResult::Listed { .. } => {
                lock_live_successes_for_same_module(tx, row_id).await?
            }
            EnrolmentLookupResult::Refused { .. } => Vec::new(),
        };
        let recorded_locally = if lookup.result().is_enrolment_error() {
            get_recorded_credits_for_same_module(tx, row_id).await?
        } else {
            Vec::new()
        };
        Ok(Self {
            registered_by_us,
            recorded_locally,
        })
    }

    /// The registrations a frozen payload replaces once it is registered.
    fn supersedes(&self) -> Vec<Uuid> {
        self.registered_by_us
            .iter()
            .map(|replaced| replaced.id)
            .collect()
    }
}

/// What the answer comes to once Sisu is known not to hold the credit: nothing sent when our own
/// records hold a credit the grade would not beat, a failure when there is nothing to register
/// against, and otherwise the payload frozen for import.
pub(super) fn resolve<'a>(
    lookup: &AnsweredLookup<'a>,
    competing: &CompetingCredits,
) -> Decision<'a> {
    let ours = lookup.our_grade();
    let registered_grades: Vec<_> = competing
        .registered_by_us
        .iter()
        .map(|success| success.credit.held_grade())
        .collect();
    if !registered_grades.is_empty() && !improves_on_all(&registered_grades, ours) {
        return unsent_duplicate(
            lookup,
            "A grade at least as good is already registered for this module from another \
             attempt, so nothing was submitted.",
        );
    }
    // Suotar's copy of Sisu may predate a pull-path registration, so a student who holds the
    // credit would be told to enrol again. A better grade still gets the error, since an
    // improvement needs an enrolment too.
    let recorded_grades: Vec<_> = competing
        .recorded_locally
        .iter()
        .map(RecordedCredit::held_grade)
        .collect();
    if lookup.result().is_enrolment_error()
        && !recorded_grades.is_empty()
        && !improves_on_all(&recorded_grades, ours)
    {
        return unsent_duplicate(
            lookup,
            "The study registry has no usable enrolment, but our records already hold a credit at \
             least as good for this module, so nothing was submitted.",
        );
    }
    let facts = lookup.claim().facts(Utc::now());
    let chosen = match lookup.result() {
        EnrolmentLookupResult::Refused {
            code,
            error_message,
        } => {
            return Decision::new(submit_error_outcome(
                EnrolmentLookup::OPERATION,
                code,
                &facts,
            ))
            .with_row_error(error_message);
        }
        EnrolmentLookupResult::Listed {
            chosen: Err(reason),
            ..
        } => {
            return Decision::new(submit_error_outcome(
                EnrolmentLookup::OPERATION,
                reason.error_code(),
                &facts,
            ))
            .with_message(reason.message());
        }
        EnrolmentLookupResult::Listed {
            chosen: Ok(chosen), ..
        } => chosen,
    };
    let submission = lookup.submission();
    let absent = DbSecret::new("");
    let built = build_payload_snapshot(
        &submission.completion,
        PayloadSources {
            student_number: submission.student_number.as_ref().unwrap_or(&absent),
            sisu_person_id: submission.sisu_person_id.as_ref(),
            uh_course_code: submission.uh_course_code.as_deref(),
            ects_credits: submission.ects_credits,
            enrolment: Some(chosen),
        },
    );
    match built {
        Ok(built) => freeze(built, competing.supersedes()),
        Err(code) => Decision::new(submit_error_outcome(
            EnrolmentLookup::OPERATION,
            code,
            &facts,
        )),
    }
}

/// The row is not sent, because a credit it would not beat is already held, and moves to
/// `duplicate`. The grade we would have sent stays on the row as the one a later regrade has to
/// beat.
pub(super) fn unsent_duplicate<'a>(
    lookup: &AnsweredLookup<'a>,
    message: &'static str,
) -> Decision<'a> {
    Decision::new(Outcome::to(CreditRegistrationState::Duplicate))
        .with_message(message)
        .with_payload(PayloadChange::Unsent {
            weighed_grade: map_grade(lookup.our_grade()).ok(),
        })
}

/// Only now does the row become claimable by `import`: the payload is frozen and the event records
/// when the enrolment was resolved.
fn freeze(built: BuiltPayload, supersedes: Vec<Uuid>) -> Decision<'static> {
    let message = freeze_message(&built, &supersedes);
    let decision = Decision::new(Outcome::to(CreditRegistrationState::CheckingEnrolment))
        .with_payload(PayloadChange::Frozen {
            snapshot: Box::new(built.snapshot),
            supersedes,
        });
    match message {
        Some(message) => decision.with_message(message),
        None => decision,
    }
}

/// The timeline line for a freeze: that it replaces another attempt's registered grade, and that
/// its credits were adjusted to fit the enrolment.
fn freeze_message(built: &BuiltPayload, supersedes: &[Uuid]) -> Option<String> {
    let superseded_message = (!supersedes.is_empty()).then(|| {
        format!(
            "This attempt's grade {} beats the one registered from another attempt, which this \
             one supersedes once it is registered.",
            built.snapshot.grade_id
        )
    });
    let clamped_message = built.clamped_credits_from.map(|from| {
        format!(
            "Credits adjusted from {from} to {} to fit the enrolment's range.",
            built.snapshot.credits
        )
    });
    [superseded_message, clamped_message]
        .into_iter()
        .flatten()
        .reduce(|first, second| format!("{first} {second}"))
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;
    use headless_lms_models::credit_registrations::PayloadSnapshot;
    use headless_lms_models::library::credit_registration::enrolment_selection::NoUsableEnrolment;
    use headless_lms_models::library::credit_registration::payload::CompletionFacts;
    use headless_lms_models::library::credit_registration::study_registry::{
        RegistryAttainment, RegistryEnrolment,
    };
    use headless_lms_models::library::credit_registration::submission_context::SubmissionContext;

    use super::super::Resolvable;
    use super::super::fixtures::{context, enrolment, refused, resolvable};
    use super::*;
    use crate::test_fixtures::{attainment, date};

    fn registered(grade_id: &str) -> LiveSuccessForModule {
        LiveSuccessForModule {
            id: Uuid::new_v4(),
            credit: recorded(grade_id),
        }
    }

    fn recorded(grade_id: &str) -> RecordedCredit {
        RecordedCredit {
            grade_scale_id: Some("sis-0-5".to_string()),
            grade_id: Some(grade_id.to_string()),
            completion_passed: true,
            completion_grade: grade_id.parse().ok(),
        }
    }

    fn competing(
        registered_by_us: Vec<LiveSuccessForModule>,
        recorded_locally: Vec<RecordedCredit>,
    ) -> CompetingCredits {
        CompetingCredits {
            registered_by_us,
            recorded_locally,
        }
    }

    fn usable(listed: &[RegistryEnrolment]) -> EnrolmentLookupResult<'_> {
        EnrolmentLookupResult::Listed {
            enrolments: listed,
            chosen: Ok(&listed[0]),
        }
    }

    fn resolved<'a>(
        resolvable: &'a Resolvable,
        lookup_result: EnrolmentLookupResult<'a>,
        competing: &CompetingCredits,
    ) -> Decision<'a> {
        resolve(
            &AnsweredLookup::new(resolvable, lookup_result, &[]),
            competing,
        )
    }

    /// The frozen payload and the registrations it supersedes.
    fn frozen(decision: Decision<'_>) -> (PayloadSnapshot, Vec<Uuid>) {
        assert_eq!(decision.outcome.to_state, State::CheckingEnrolment);
        match decision.atomic.payload {
            Some(PayloadChange::Frozen {
                snapshot,
                supersedes,
            }) => (*snapshot, supersedes),
            other => panic!("not frozen: {other:?}"),
        }
    }

    #[test]
    fn a_usable_enrolment_freezes_the_payload_for_import() {
        let listed = [enrolment("ENROLLED")];
        let resolvable = resolvable(context(Some(4)));
        let decision = resolved(&resolvable, usable(&listed), &competing(vec![], vec![]));
        assert_eq!(decision.message, None);
        let (snapshot, supersedes) = frozen(decision);
        assert_eq!(snapshot.uh_course_code, "TKT10002");
        assert_eq!(
            snapshot.selected_enrolment_id.as_deref(),
            Some("enrolment-1")
        );
        assert_eq!(snapshot.grade_scale_id, "sis-0-5");
        assert_eq!(snapshot.grade_id, "4");
        assert!(supersedes.is_empty());
    }

    #[test]
    fn a_grade_no_better_than_another_registered_attempt_is_held_here() {
        let listed = [enrolment("ENROLLED")];
        let resolvable = resolvable(context(Some(4)));
        for held in ["4", "5"] {
            let decision = resolved(
                &resolvable,
                usable(&listed),
                &competing(vec![registered(held)], vec![]),
            );
            assert_eq!(decision.outcome.to_state, State::Duplicate);
        }
        let (_, supersedes) = frozen(resolved(
            &resolvable,
            usable(&listed),
            &competing(vec![registered("3")], vec![]),
        ));
        assert_eq!(supersedes.len(), 1);
    }

    #[test]
    fn an_enrolment_error_is_held_here_when_our_records_hold_a_credit_as_good() {
        let resolvable = resolvable(context(Some(4)));
        let decision = resolved(
            &resolvable,
            refused(Code::EnrolmentNotFound),
            &competing(vec![], vec![recorded("4")]),
        );
        assert_eq!(decision.outcome.to_state, State::Duplicate);
    }

    #[test]
    fn an_enrolment_error_still_fails_a_grade_that_beats_our_records() {
        let resolvable = resolvable(context(Some(5)));
        let decision = resolved(
            &resolvable,
            refused(Code::EnrolmentNotFound),
            &competing(vec![], vec![recorded("4")]),
        );
        assert_eq!(decision.outcome.to_state, State::NoUsableEnrolment);
        assert_eq!(decision.row_error, Some("item error"));
    }

    #[test]
    fn a_refused_lookup_fails_with_the_item_code_and_error() {
        let resolvable = resolvable(context(Some(4)));
        let decision = resolved(
            &resolvable,
            refused(Code::CourseNotAllowed),
            &competing(vec![], vec![]),
        );
        assert_eq!(decision.outcome.to_state, State::FailedPermanent);
        assert_eq!(decision.outcome.error_code, Some(Code::CourseNotAllowed));
        assert_eq!(decision.row_error, Some("item error"));
        assert!(decision.atomic.payload.is_none());
    }

    #[test]
    fn no_usable_enrolment_parks_the_row_with_the_reason() {
        let listed = [enrolment("PROCESSING")];
        let resolvable = resolvable(context(Some(4)));
        let decision = resolved(
            &resolvable,
            EnrolmentLookupResult::Listed {
                enrolments: &listed,
                chosen: Err(NoUsableEnrolment::NotAccepted),
            },
            &competing(vec![], vec![]),
        );
        assert_eq!(decision.outcome.to_state, State::NoUsableEnrolment);
        assert_eq!(
            decision.outcome.error_code,
            Some(Code::EnrolmentNotAccepted)
        );
        assert_eq!(
            decision.message.as_deref(),
            Some(NoUsableEnrolment::NotAccepted.message())
        );
        assert!(decision.row_error.is_none());
    }

    #[test]
    fn a_failed_completion_is_never_frozen() {
        let listed = [enrolment("ENROLLED")];
        let not_passed = SubmissionContext {
            completion: CompletionFacts {
                passed: false,
                ..context(Some(4)).completion
            },
            ..context(Some(4))
        };
        let resolvable = resolvable(not_passed);
        let decision = resolved(&resolvable, usable(&listed), &competing(vec![], vec![]));
        assert_eq!(decision.outcome.to_state, State::FailedPermanent);
        assert_eq!(decision.outcome.error_code, Some(Code::NoGradeScaleMapping));
    }

    #[test]
    fn sisu_holding_an_attainment_as_good_settles_the_row() {
        let listed = [enrolment("ENROLLED")];
        let held = attainment("sis-0-5", "4", date(2026, 8, 1));
        let existing = [held.clone()];
        let as_good = resolvable(context(Some(4)));
        assert_eq!(
            AnsweredLookup::new(&as_good, usable(&listed), &existing).held_in_sisu(),
            Some(&held)
        );
        let better = resolvable(context(Some(5)));
        assert_eq!(
            AnsweredLookup::new(&better, usable(&listed), &existing).held_in_sisu(),
            None
        );
    }

    #[test]
    fn only_a_listed_answer_or_an_enrolment_error_says_what_sisu_holds() {
        let existing = [attainment("sis-0-5", "5", date(2026, 8, 1))];
        let resolvable = resolvable(context(Some(4)));
        assert!(
            AnsweredLookup::new(&resolvable, refused(Code::EnrolmentNotFound), &existing)
                .held_in_sisu()
                .is_some()
        );
        assert_eq!(
            AnsweredLookup::new(&resolvable, refused(Code::CourseNotAllowed), &existing)
                .held_in_sisu(),
            None
        );
    }

    #[test]
    fn a_failed_attainment_in_sisu_holds_nothing() {
        let listed = [enrolment("ENROLLED")];
        let existing = [RegistryAttainment {
            state: Some("FAILED".to_string()),
            ..attainment("sis-0-5", "5", date(2026, 8, 1))
        }];
        let resolvable = resolvable(context(Some(4)));
        assert_eq!(
            AnsweredLookup::new(&resolvable, usable(&listed), &existing).held_in_sisu(),
            None
        );
    }

    #[test]
    fn an_unsent_duplicate_keeps_the_grade_a_regrade_has_to_beat() {
        let listed = [enrolment("ENROLLED")];
        let resolvable = resolvable(context(Some(4)));
        let lookup = AnsweredLookup::new(&resolvable, usable(&listed), &[]);
        let decision = unsent_duplicate(&lookup, "held");
        assert_eq!(decision.outcome.to_state, State::Duplicate);
        assert_eq!(decision.message.as_deref(), Some("held"));
        let Some(PayloadChange::Unsent {
            weighed_grade: Some(grade),
        }) = decision.atomic.payload
        else {
            panic!("no weighed grade");
        };
        assert_eq!(
            (grade.grade_scale_id.as_str(), grade.grade_id.as_str()),
            ("sis-0-5", "4")
        );
    }

    #[test]
    fn the_freeze_message_names_what_it_supersedes_and_adjusts() {
        let listed = [enrolment("ENROLLED")];
        let resolvable = resolvable(context(Some(4)));
        let (snapshot, _) = frozen(resolved(
            &resolvable,
            usable(&listed),
            &competing(vec![], vec![]),
        ));
        let built = BuiltPayload {
            snapshot,
            clamped_credits_from: None,
        };
        assert_eq!(freeze_message(&built, &[]), None);
        assert!(
            freeze_message(&built, &[Uuid::new_v4()])
                .is_some_and(|message| message.contains("supersedes"))
        );
        let clamped = BuiltPayload {
            clamped_credits_from: Some(6.0),
            ..built
        };
        let message = freeze_message(&clamped, &[Uuid::new_v4()]).expect("message");
        assert!(message.contains("supersedes") && message.contains("adjusted from 6"));
    }
}
