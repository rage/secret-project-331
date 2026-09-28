//! What the study registry's answer to an enrolment lookup means for the row: the enrolment it
//! lists, or the error it gave, and the grade scale our grade would go out on.

use headless_lms_models::credit_registrations::CreditRegistrationErrorCode;
use headless_lms_models::library::credit_registration::classification::is_enrolment_error;
use headless_lms_models::library::credit_registration::enrolment_selection::{
    NoUsableEnrolment, attained_candidates, preferred_attainment,
};
use headless_lms_models::library::credit_registration::grade_mapping::{
    GradeSource, improves_on_all,
};
use headless_lms_models::library::credit_registration::study_registry::{
    RegistryAttainment, RegistryEnrolment,
};
use headless_lms_models::library::credit_registration::submission_context::SubmissionContext;

use super::Resolvable;
use crate::registry::{EnrolmentAnswer, EnrolmentReading};
use crate::workflow::ClaimedRegistration;

/// What an answered lookup said about the row's enrolment.
#[derive(Clone, Copy)]
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

impl<'a> EnrolmentLookupResult<'a> {
    /// `chosen` is what `select_enrolment` made of the answer's enrolments.
    pub(super) fn read(
        answer: &'a EnrolmentAnswer,
        chosen: Result<&'a RegistryEnrolment, NoUsableEnrolment>,
    ) -> Self {
        match &answer.reading {
            EnrolmentReading::Refused {
                code,
                error_message,
            } => Self::Refused {
                code: *code,
                error_message: error_message.as_deref(),
            },
            EnrolmentReading::Listed => Self::Listed {
                enrolments: &answer.enrolments,
                chosen,
            },
        }
    }

    /// The scale the grade would go out on: the chosen enrolment's, or that of any listed one, since
    /// all enrolments on one course code share it in practice. With no enrolment to say, the held
    /// attainment's own scale is the best evidence of it.
    pub(super) fn grade_scale_id(self, existing: &'a [RegistryAttainment]) -> Option<&'a str> {
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
    pub(super) fn is_enrolment_error(self) -> bool {
        match self {
            Self::Refused { code, .. } => is_enrolment_error(code),
            Self::Listed {
                chosen: Err(reason),
                ..
            } => is_enrolment_error(reason.error_code()),
            Self::Listed { chosen: Ok(_), .. } => false,
        }
    }
}

/// An answered lookup together with the row it was asked for. The grade scale is read from the
/// answer once, so every question asked of it weighs our grade on the same scale. What it comes to
/// for the row, once Sisu is known not to hold the credit, is [`super::resolution`]'s.
pub(super) struct AnsweredLookup<'a> {
    claim: &'a ClaimedRegistration,
    submission: &'a SubmissionContext,
    result: EnrolmentLookupResult<'a>,
    existing: &'a [RegistryAttainment],
    grade_scale_id: Option<&'a str>,
}

impl<'a> AnsweredLookup<'a> {
    /// `existing` are the attainments Sisu holds for the course, as the answer listed them.
    pub(super) fn new(
        resolvable: &'a Resolvable,
        result: EnrolmentLookupResult<'a>,
        existing: &'a [RegistryAttainment],
    ) -> Self {
        Self {
            claim: &resolvable.claim,
            submission: &resolvable.extra.submission,
            result,
            existing,
            grade_scale_id: result.grade_scale_id(existing),
        }
    }

    pub(super) fn claim(&self) -> &'a ClaimedRegistration {
        self.claim
    }

    pub(super) fn submission(&self) -> &'a SubmissionContext {
        self.submission
    }

    pub(super) fn result(&self) -> EnrolmentLookupResult<'a> {
        self.result
    }

    /// The grade we would send, on the scale it would go out on.
    pub(super) fn our_grade(&self) -> GradeSource<'a> {
        GradeSource {
            passed: self.submission.completion.passed,
            grade: self.submission.completion.grade,
            enrolment_grade_scale_id: self.grade_scale_id,
        }
    }

    /// The attainment that settles the row as `duplicate` before anything is sent: the preferred
    /// one of those Sisu holds for the course, when our grade does not beat them. Only a listed
    /// answer or an enrolment error says what Sisu holds.
    pub(super) fn held_in_sisu(&self) -> Option<&'a RegistryAttainment> {
        let may_be_held = match self.result {
            EnrolmentLookupResult::Listed { .. } => true,
            EnrolmentLookupResult::Refused { .. } => self.result.is_enrolment_error(),
        };
        if !may_be_held {
            return None;
        }
        let candidates = attained_candidates(self.existing);
        let attained = preferred_attainment(&candidates)?;
        let held: Vec<_> = candidates
            .iter()
            .map(|attained| attained.held_grade())
            .collect();
        (!improves_on_all(&held, self.our_grade())).then_some(attained)
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;

    use super::super::fixtures::{enrolment, refused};
    use super::*;
    use crate::test_fixtures::{attainment, date};

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
        let lookup_result = EnrolmentLookupResult::read(&answer, Ok(&answer.enrolments[0]));
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
}
