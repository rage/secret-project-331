//! What an enrolment lookup's answer does to its row, and whether the row can be asked about at
//! all.

use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, LiveSuccessForModule,
    RecordedCredit, Transition,
};
use headless_lms_models::library::credit_registration::classification::is_enrolment_error;
use headless_lms_models::library::credit_registration::enrolment_selection::{
    EnrolmentCriteria, NoUsableEnrolment, attained_candidates, preferred_attainment,
};
use headless_lms_models::library::credit_registration::grade_mapping::{
    GradeSource, grade_pairs, improves_on_all, map_grade,
};
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, submit_error_outcome,
};
use headless_lms_models::library::credit_registration::payload::{
    BuiltPayload, PayloadSources, build_payload_snapshot,
};
use headless_lms_models::library::credit_registration::study_registry::{
    RegistryAttainment, RegistryEnrolment,
};
use headless_lms_models::library::credit_registration::submission_context::SubmissionContext;
use headless_lms_models::secret::DbSecret;
use headless_lms_utils::prelude::Utc;

use super::ENDPOINT;
use crate::domain::{Decision, PayloadChange, transitions};
use crate::registry::{
    CourseCode, EnrolmentAnswer, EnrolmentLookup, EnrolmentReading, StudentNumber,
};

/// A row that cannot even be asked about: each of these is the student's or a teacher's to fix, and
/// none of them is worth a call.
pub(super) enum Unaskable {
    NoStudentNumber,
    Config(CreditRegistrationErrorCode),
}

impl Unaskable {
    pub(super) fn transition(&self) -> Transition {
        match self {
            Self::NoStudentNumber => transitions::no_verified_student_number(),
            Self::Config(code) => transitions::module_not_configured(*code),
        }
    }
}

/// What to ask the registry about the row's enrolment, with its course code trimmed.
pub(super) fn enrolment_lookup(context: &SubmissionContext) -> Result<EnrolmentLookup, Unaskable> {
    let student_number = context
        .student_number
        .clone()
        .ok_or(Unaskable::NoStudentNumber)?;
    let course_code = context
        .uh_course_code
        .as_deref()
        .map(str::trim)
        .filter(|code| !code.is_empty())
        .map(str::to_string)
        .ok_or(Unaskable::Config(
            CreditRegistrationErrorCode::MissingUhCourseCode,
        ))?;
    if context.ects_credits.is_none() {
        return Err(Unaskable::Config(
            CreditRegistrationErrorCode::MissingEctsCredits,
        ));
    }
    Ok(EnrolmentLookup {
        student_number: StudentNumber::new(student_number),
        course_code: CourseCode::new(course_code),
    })
}

/// `enrolments` are the answer's own, and `chosen` what `select_enrolment` made of them.
pub(super) fn read_enrolment_answer<'a>(
    answer: &'a EnrolmentAnswer,
    enrolments: &'a [RegistryEnrolment],
    chosen: Result<&'a RegistryEnrolment, NoUsableEnrolment>,
) -> EnrolmentLookupResult<'a> {
    match &answer.reading {
        EnrolmentReading::Refused {
            code,
            error_message,
        } => EnrolmentLookupResult::Refused {
            code: *code,
            error_message: error_message.as_deref(),
        },
        EnrolmentReading::Listed => EnrolmentLookupResult::Listed { enrolments, chosen },
    }
}

/// What an answered lookup said about the row's enrolment.
pub(super) enum EnrolmentLookupResult<'a> {
    /// Suotar answered with an error, which for an enrolment error still lists the attainments.
    Refused {
        code: CreditRegistrationErrorCode,
        error_message: Option<&'a str>,
    },
    /// Suotar listed the enrolments; `chosen` is what `select_enrolment` made of them.
    Listed {
        enrolments: &'a [RegistryEnrolment],
        chosen: Result<&'a RegistryEnrolment, NoUsableEnrolment>,
    },
}

impl EnrolmentLookupResult<'_> {
    /// The scale the grade would go out on: the chosen enrolment's, or that of any listed one, since
    /// all enrolments on one course code share it in practice. With no enrolment to say, the held
    /// attainment's own scale is the best evidence of it.
    pub(super) fn grade_scale_id<'a>(
        &'a self,
        existing: &'a [RegistryAttainment],
    ) -> Option<&'a str> {
        match self {
            Self::Listed { enrolments, chosen } => chosen
                .ok()
                .and_then(|enrolment| enrolment.grade_scale_id.as_deref())
                .or_else(|| {
                    enrolments
                        .iter()
                        .find_map(|enrolment| enrolment.grade_scale_id.as_deref())
                }),
            Self::Refused { .. } => preferred_attainment(&attained_candidates(existing))
                .and_then(|attained| attained.grade_scale_id.as_deref()),
        }
    }

    /// Whether the answer would send the student off to enrol.
    pub(super) fn is_enrolment_error(&self) -> bool {
        match self {
            Self::Refused { code, .. } => is_enrolment_error(*code),
            Self::Listed {
                chosen: Err(reason),
                ..
            } => is_enrolment_error(reason.error_code()),
            Self::Listed { chosen: Ok(_), .. } => false,
        }
    }
}

/// What the answer comes to once Sisu is known not to hold the credit.
pub(super) enum Resolution<'a> {
    /// Nothing is sent: our own records hold a credit the grade would not beat.
    HeldHere {
        message: &'static str,
    },
    Fail(Decision<'a>),
    Freeze(BuiltPayload),
}

/// `registered` are the student's other attempts for the module that the registry holds, locked;
/// `recorded` the credits our records hold for it, read only for an enrolment error.
pub(super) fn resolve<'a>(
    lookup_result: &EnrolmentLookupResult<'a>,
    context: &SubmissionContext,
    grade_scale_id: Option<&str>,
    registered: &[LiveSuccessForModule],
    recorded: &[RecordedCredit],
    row: &CreditRegistration,
) -> Resolution<'a> {
    let ours = grade_source(context, grade_scale_id);
    let registered_grades: Vec<_> = registered
        .iter()
        .map(LiveSuccessForModule::held_grade)
        .collect();
    if !registered.is_empty() && !improves_on_all(grade_pairs(&registered_grades), ours) {
        return Resolution::HeldHere {
            message: "A grade at least as good is already registered for this module from another \
                      attempt, so nothing was submitted.",
        };
    }
    // Suotar's copy of Sisu may predate a pull-path registration, so a student who holds the credit
    // would be told to enrol again. A better grade still gets the error, since an improvement needs
    // an enrolment too.
    let recorded_grades: Vec<_> = recorded.iter().map(RecordedCredit::held_grade).collect();
    if lookup_result.is_enrolment_error()
        && !recorded.is_empty()
        && !improves_on_all(grade_pairs(&recorded_grades), ours)
    {
        return Resolution::HeldHere {
            message: "The study registry has no usable enrolment, but our records already hold a \
                      credit at least as good for this module, so nothing was submitted.",
        };
    }
    let facts = RowFacts::of(row, Utc::now());
    let chosen = match lookup_result {
        EnrolmentLookupResult::Refused {
            code,
            error_message,
        } => {
            return Resolution::Fail(
                Decision::new(submit_error_outcome(ENDPOINT, *code, &facts))
                    .with_row_error(*error_message),
            );
        }
        EnrolmentLookupResult::Listed {
            chosen: Err(reason),
            ..
        } => {
            return Resolution::Fail(
                Decision::new(submit_error_outcome(ENDPOINT, reason.error_code(), &facts))
                    .with_message(reason.message()),
            );
        }
        EnrolmentLookupResult::Listed {
            chosen: Ok(chosen), ..
        } => *chosen,
    };
    let absent = DbSecret::new("");
    let built = build_payload_snapshot(
        &context.completion,
        PayloadSources {
            student_number: context.student_number.as_ref().unwrap_or(&absent),
            sisu_person_id: context.sisu_person_id.as_ref(),
            uh_course_code: context.uh_course_code.as_deref(),
            ects_credits: context.ects_credits,
            enrolment: Some(chosen),
        },
    );
    match built {
        Ok(built) => Resolution::Freeze(built),
        Err(code) => Resolution::Fail(Decision::new(submit_error_outcome(ENDPOINT, code, &facts))),
    }
}

/// The attainment the row settles as `duplicate` on: the preferred one of those the registry holds
/// for the course, when the grade we would send does not beat them.
///
/// `grade_scale_id` is the scale our grade would go out on; `None` guesses it from the completion.
pub(super) fn held_in_sisu<'a>(
    existing: &'a [RegistryAttainment],
    context: &SubmissionContext,
    grade_scale_id: Option<&str>,
) -> Option<&'a RegistryAttainment> {
    let candidates = attained_candidates(existing);
    let attained = preferred_attainment(&candidates)?;
    let held = candidates.iter().map(|attained| {
        (
            attained.grade_scale_id.as_deref(),
            attained.grade_id.as_deref(),
        )
    });
    (!improves_on_all(held, grade_source(context, grade_scale_id))).then_some(attained)
}

/// A row that is not sent, because the registry already holds the credit, moving to `duplicate`.
/// The grade we would have sent stays on the row as the one a later regrade has to beat.
pub(super) fn unsent_duplicate<'a>(
    context: &SubmissionContext,
    grade_scale_id: Option<&str>,
    message: &'static str,
) -> Decision<'a> {
    Decision::new(Outcome::to(CreditRegistrationState::Duplicate))
        .with_message(message)
        .with_payload(PayloadChange::Unsent {
            weighed_grade: map_grade(grade_source(context, grade_scale_id)).ok(),
        })
}

fn grade_source<'a>(
    context: &SubmissionContext,
    grade_scale_id: Option<&'a str>,
) -> GradeSource<'a> {
    GradeSource {
        passed: context.completion.passed,
        grade: context.completion.grade,
        enrolment_grade_scale_id: grade_scale_id,
    }
}

/// The timeline line for a frozen payload: that it replaces another attempt's registered grade,
/// and that its credits were adjusted to fit the enrolment.
pub(super) fn freeze_message(built: &BuiltPayload, supersedes: bool) -> Option<String> {
    let superseded_message = supersedes.then(|| {
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

/// What an enrolment must fit for this row's attainment to be registered against it.
pub(super) fn enrolment_criteria(context: &SubmissionContext) -> EnrolmentCriteria {
    EnrolmentCriteria {
        attainment_date: headless_lms_utils::helsinki_time::helsinki_date(
            context.completion.completion_date,
        ),
        credits: context.ects_credits.unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;
    use headless_lms_models::library::credit_registration::payload::CompletionFacts;
    use headless_lms_models::library::credit_registration::study_registry::CreditRange;
    use uuid::Uuid;

    use super::*;
    use crate::test_fixtures::{attainment, date, now, registration};

    use CreditRegistrationErrorCode as Code;

    fn context(grade: Option<i32>) -> SubmissionContext {
        SubmissionContext {
            registration_id: Uuid::new_v4(),
            student_number: Some(DbSecret::new("012345678")),
            sisu_person_id: Some(DbSecret::new("person-1")),
            uh_course_code: Some(" TKT10002 ".to_string()),
            ects_credits: Some(5.0),
            completion: CompletionFacts {
                passed: true,
                grade,
                completion_date: now(),
                completion_language: "en".to_string(),
            },
        }
    }

    fn enrolment(state: &str) -> RegistryEnrolment {
        RegistryEnrolment {
            id: "enrolment-1".to_string(),
            state: Some(state.to_string()),
            kind: None,
            course_unit_realisation_id: None,
            course_unit_realisation_name: None,
            activity_period: None,
            grade_scale_id: Some("sis-0-5".to_string()),
            credits: Some(CreditRange {
                min: Some(5.0),
                max: Some(5.0),
            }),
            study_right_validity_period: None,
            enrolment_date_time: None,
        }
    }

    fn registered(grade_id: &str) -> LiveSuccessForModule {
        LiveSuccessForModule {
            id: Uuid::new_v4(),
            grade_scale_id: Some("sis-0-5".to_string()),
            grade_id: Some(grade_id.to_string()),
            completion_passed: true,
            completion_grade: grade_id.parse().ok(),
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

    fn refused(code: CreditRegistrationErrorCode) -> EnrolmentLookupResult<'static> {
        EnrolmentLookupResult::Refused {
            code,
            error_message: Some("item error"),
        }
    }

    fn resolved<'a>(
        lookup_result: &EnrolmentLookupResult<'a>,
        context: &SubmissionContext,
        registered: &[LiveSuccessForModule],
        recorded: &[RecordedCredit],
    ) -> Resolution<'a> {
        resolve(
            lookup_result,
            context,
            Some("sis-0-5"),
            registered,
            recorded,
            &registration(State::ResolvingEnrolment),
        )
    }

    fn failed(resolution: Resolution<'_>) -> Decision<'_> {
        match resolution {
            Resolution::Fail(decision) => decision,
            Resolution::HeldHere { .. } => panic!("held here"),
            Resolution::Freeze(_) => panic!("frozen"),
        }
    }

    #[test]
    fn a_row_without_a_verified_number_waits_in_pending_without_a_call() {
        let unlinked = SubmissionContext {
            student_number: None,
            ..context(Some(4))
        };
        let Err(unaskable) = enrolment_lookup(&unlinked) else {
            panic!("askable");
        };
        assert!(matches!(unaskable, Unaskable::NoStudentNumber));
        assert_eq!(unaskable.transition().to_state, State::Pending);
    }

    #[test]
    fn a_module_missing_its_code_or_credits_needs_an_admin_without_a_call() {
        let blank_code = SubmissionContext {
            uh_course_code: Some("  ".to_string()),
            ..context(Some(4))
        };
        let no_credits = SubmissionContext {
            ects_credits: None,
            ..context(Some(4))
        };
        for (context, expected) in [
            (blank_code, Code::MissingUhCourseCode),
            (no_credits, Code::MissingEctsCredits),
        ] {
            let Err(unaskable) = enrolment_lookup(&context) else {
                panic!("askable");
            };
            let transition = unaskable.transition();
            assert_eq!(transition.to_state, State::FailedPermanent);
            assert_eq!(transition.error_code, Some(expected));
            assert_eq!(transition.needs_admin_attention, Some(true));
        }
    }

    #[test]
    fn the_lookup_asks_about_the_trimmed_course_code() {
        let Ok(lookup) = enrolment_lookup(&context(Some(4))) else {
            panic!("unaskable");
        };
        assert_eq!(lookup.course_code.as_str(), "TKT10002");
        assert_eq!(lookup.student_number.expose(), "012345678");
    }

    #[test]
    fn a_refused_lookup_reads_as_refused_whatever_it_lists() {
        let answer = EnrolmentAnswer {
            reading: EnrolmentReading::Refused {
                code: Code::EnrolmentNotFound,
                error_message: Some("no enrolment".to_string()),
            },
            enrolments: vec![enrolment("ENROLLED")],
            existing_attainments: Vec::new(),
        };
        let lookup_result =
            read_enrolment_answer(&answer, &answer.enrolments, Ok(&answer.enrolments[0]));
        assert!(matches!(
            lookup_result,
            EnrolmentLookupResult::Refused {
                code: Code::EnrolmentNotFound,
                error_message: Some("no enrolment"),
            }
        ));
    }

    #[test]
    fn only_a_missing_or_unaccepted_enrolment_sends_the_student_to_enrol() {
        let listed = [enrolment("ENROLLED")];
        let cases = [
            (refused(Code::EnrolmentNotFound), true),
            (refused(Code::EnrolmentNotAccepted), true),
            (refused(Code::StudyRightNotValid), false),
            (
                EnrolmentLookupResult::Listed {
                    enrolments: &[],
                    chosen: Err(NoUsableEnrolment::None),
                },
                true,
            ),
            (
                EnrolmentLookupResult::Listed {
                    enrolments: &listed,
                    chosen: Err(NoUsableEnrolment::CreditsOutOfRange),
                },
                false,
            ),
            (
                EnrolmentLookupResult::Listed {
                    enrolments: &listed,
                    chosen: Ok(&listed[0]),
                },
                false,
            ),
        ];
        for (lookup_result, expected) in cases {
            assert_eq!(lookup_result.is_enrolment_error(), expected);
        }
    }

    #[test]
    fn the_grade_scale_comes_from_the_enrolments_then_from_a_held_attainment() {
        let chosen = RegistryEnrolment {
            grade_scale_id: Some("sis-hyl-hyv".to_string()),
            ..enrolment("ENROLLED")
        };
        let other = enrolment("ENROLLED");
        let held = [attainment("sis-hyv-hyl", "1", date(2026, 8, 1))];
        let listed = [other.clone(), chosen.clone()];
        let with_chosen = EnrolmentLookupResult::Listed {
            enrolments: &listed,
            chosen: Ok(&chosen),
        };
        assert_eq!(with_chosen.grade_scale_id(&held), Some("sis-hyl-hyv"));
        let without_chosen = EnrolmentLookupResult::Listed {
            enrolments: &listed,
            chosen: Err(NoUsableEnrolment::NotAccepted),
        };
        assert_eq!(without_chosen.grade_scale_id(&held), Some("sis-0-5"));
        assert_eq!(
            refused(Code::EnrolmentNotFound).grade_scale_id(&held),
            Some("sis-hyv-hyl")
        );
    }

    #[test]
    fn a_usable_enrolment_freezes_the_payload_for_import() {
        let listed = [enrolment("ENROLLED")];
        let lookup_result = EnrolmentLookupResult::Listed {
            enrolments: &listed,
            chosen: Ok(&listed[0]),
        };
        let Resolution::Freeze(built) = resolved(&lookup_result, &context(Some(4)), &[], &[])
        else {
            panic!("not frozen");
        };
        assert_eq!(built.snapshot.uh_course_code, "TKT10002");
        assert_eq!(
            built.snapshot.selected_enrolment_id.as_deref(),
            Some("enrolment-1")
        );
        assert_eq!(built.snapshot.grade_scale_id, "sis-0-5");
        assert_eq!(built.snapshot.grade_id, "4");
        assert_eq!(built.clamped_credits_from, None);
    }

    #[test]
    fn a_grade_no_better_than_another_registered_attempt_is_held_here() {
        let listed = [enrolment("ENROLLED")];
        let lookup_result = EnrolmentLookupResult::Listed {
            enrolments: &listed,
            chosen: Ok(&listed[0]),
        };
        for held in ["4", "5"] {
            assert!(matches!(
                resolved(&lookup_result, &context(Some(4)), &[registered(held)], &[]),
                Resolution::HeldHere { .. }
            ));
        }
        assert!(matches!(
            resolved(&lookup_result, &context(Some(4)), &[registered("3")], &[]),
            Resolution::Freeze(_)
        ));
    }

    #[test]
    fn an_enrolment_error_is_held_here_when_our_records_hold_a_credit_as_good() {
        let lookup_result = refused(Code::EnrolmentNotFound);
        assert!(matches!(
            resolved(&lookup_result, &context(Some(4)), &[], &[recorded("4")]),
            Resolution::HeldHere { .. }
        ));
    }

    #[test]
    fn an_enrolment_error_still_fails_a_grade_that_beats_our_records() {
        let lookup_result = refused(Code::EnrolmentNotFound);
        let decision = failed(resolved(
            &lookup_result,
            &context(Some(5)),
            &[],
            &[recorded("4")],
        ));
        assert_eq!(decision.outcome().to_state, State::NoUsableEnrolment);
        assert_eq!(decision.row_error(), Some("item error"));
    }

    #[test]
    fn a_refused_lookup_fails_with_the_item_code_and_error() {
        let decision = failed(resolved(
            &refused(Code::CourseNotAllowed),
            &context(Some(4)),
            &[],
            &[],
        ));
        assert_eq!(decision.outcome().to_state, State::FailedPermanent);
        assert_eq!(decision.outcome().error_code, Some(Code::CourseNotAllowed));
        assert_eq!(decision.row_error(), Some("item error"));
        assert!(decision.atomic().payload().is_none());
    }

    #[test]
    fn no_usable_enrolment_parks_the_row_with_the_reason() {
        let listed = [enrolment("PROCESSING")];
        let lookup_result = EnrolmentLookupResult::Listed {
            enrolments: &listed,
            chosen: Err(NoUsableEnrolment::NotAccepted),
        };
        let decision = failed(resolved(&lookup_result, &context(Some(4)), &[], &[]));
        assert_eq!(decision.outcome().to_state, State::NoUsableEnrolment);
        assert_eq!(
            decision.outcome().error_code,
            Some(Code::EnrolmentNotAccepted)
        );
        assert_eq!(
            decision.message(),
            Some(NoUsableEnrolment::NotAccepted.message())
        );
        assert!(decision.row_error().is_none());
    }

    #[test]
    fn a_failed_completion_is_never_frozen() {
        let listed = [enrolment("ENROLLED")];
        let lookup_result = EnrolmentLookupResult::Listed {
            enrolments: &listed,
            chosen: Ok(&listed[0]),
        };
        let not_passed = SubmissionContext {
            completion: CompletionFacts {
                passed: false,
                ..context(Some(4)).completion
            },
            ..context(Some(4))
        };
        let decision = failed(resolved(&lookup_result, &not_passed, &[], &[]));
        assert_eq!(decision.outcome().to_state, State::FailedPermanent);
        assert_eq!(
            decision.outcome().error_code,
            Some(Code::NoGradeScaleMapping)
        );
    }

    #[test]
    fn sisu_holding_an_attainment_as_good_settles_the_row() {
        let held = attainment("sis-0-5", "4", date(2026, 8, 1));
        let existing = [held.clone()];
        assert_eq!(
            held_in_sisu(&existing, &context(Some(4)), Some("sis-0-5")),
            Some(&held)
        );
        assert_eq!(
            held_in_sisu(&existing, &context(Some(5)), Some("sis-0-5")),
            None
        );
    }

    #[test]
    fn a_failed_attainment_in_sisu_holds_nothing() {
        let existing = [RegistryAttainment {
            state: Some("FAILED".to_string()),
            ..attainment("sis-0-5", "5", date(2026, 8, 1))
        }];
        assert_eq!(
            held_in_sisu(&existing, &context(Some(4)), Some("sis-0-5")),
            None
        );
    }

    #[test]
    fn an_unsent_duplicate_keeps_the_grade_a_regrade_has_to_beat() {
        let decision = unsent_duplicate(&context(Some(4)), Some("sis-0-5"), "held");
        assert_eq!(decision.outcome().to_state, State::Duplicate);
        assert_eq!(decision.message(), Some("held"));
        let Some(PayloadChange::Unsent {
            weighed_grade: Some(grade),
        }) = decision.atomic().payload()
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
        let lookup_result = EnrolmentLookupResult::Listed {
            enrolments: &listed,
            chosen: Ok(&listed[0]),
        };
        let Resolution::Freeze(built) = resolved(&lookup_result, &context(Some(4)), &[], &[])
        else {
            panic!("not frozen");
        };
        assert_eq!(freeze_message(&built, false), None);
        assert!(freeze_message(&built, true).is_some_and(|message| message.contains("supersedes")));
        let clamped = BuiltPayload {
            clamped_credits_from: Some(6.0),
            ..built
        };
        let message = freeze_message(&clamped, true).expect("message");
        assert!(message.contains("supersedes") && message.contains("adjusted from 6"));
    }
}
