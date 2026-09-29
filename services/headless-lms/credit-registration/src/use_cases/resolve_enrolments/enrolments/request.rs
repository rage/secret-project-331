//! Whether a row can be asked about at all, and what to ask the study registry about its
//! enrolment.

use headless_lms_models::credit_registrations::CreditRegistrationErrorCode;
use headless_lms_models::library::credit_registration::enrolment_selection::EnrolmentCriteria;
use headless_lms_models::library::credit_registration::outcomes::{
    UnaskedMove, module_not_configured, no_verified_student_number,
};
use headless_lms_models::library::credit_registration::submission_context::SubmissionContext;

use crate::registry::{CourseCode, EnrolmentLookup, StudentNumber};

/// A row that cannot even be asked about: each of these is the student's or a teacher's to fix, and
/// none of them is worth a call.
pub(super) enum Unaskable {
    NoStudentNumber,
    Config(CreditRegistrationErrorCode),
}

impl Unaskable {
    /// Where the row goes instead of being asked about.
    pub(super) fn unasked_move(&self) -> UnaskedMove {
        match self {
            Self::NoStudentNumber => no_verified_student_number(),
            Self::Config(code) => module_not_configured(*code),
        }
    }
}

/// A row that can be asked about: what to ask the registry, and what the enrolment it lists must fit
/// for the row's attainment to be registered against it.
pub(super) struct Askable {
    pub request: EnrolmentLookup,
    pub criteria: EnrolmentCriteria,
}

/// What to ask the registry about the row's enrolment, or why it cannot be asked about.
pub(super) fn enrolment_lookup(context: &SubmissionContext) -> Result<Askable, Unaskable> {
    let student_number = context
        .student_number
        .clone()
        .ok_or(Unaskable::NoStudentNumber)?;
    let course_code = context
        .uh_course_code
        .as_deref()
        .and_then(CourseCode::parse)
        .ok_or(Unaskable::Config(
            CreditRegistrationErrorCode::MissingUhCourseCode,
        ))?;
    let credits = context.ects_credits.ok_or(Unaskable::Config(
        CreditRegistrationErrorCode::MissingEctsCredits,
    ))?;
    Ok(Askable {
        request: EnrolmentLookup {
            student_number: StudentNumber::new(student_number),
            course_code,
        },
        criteria: EnrolmentCriteria {
            attainment_date: headless_lms_utils::helsinki_time::helsinki_date(
                context.completion.completion_date,
            ),
            credits,
        },
    })
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registrations::AdminAttention;
    use headless_lms_models::credit_registrations::CreditRegistrationErrorCode as Code;
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;

    use super::super::fixtures::context;
    use super::*;

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
        assert_eq!(unaskable.unasked_move().outcome.to_state, State::Pending);
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
            let outcome = unaskable.unasked_move().outcome;
            assert_eq!(outcome.to_state, State::FailedPermanent);
            assert_eq!(outcome.error_code, Some(expected));
            assert_eq!(outcome.needs_admin_attention, Some(AdminAttention::Raise));
        }
    }

    #[test]
    fn the_lookup_asks_about_the_trimmed_course_code() {
        let Ok(askable) = enrolment_lookup(&context(Some(4))) else {
            panic!("unaskable");
        };
        assert_eq!(askable.request.course_code.as_str(), "TKT10002");
        assert_eq!(askable.request.student_number.expose(), "012345678");
        assert_eq!(askable.criteria.credits, 5.0);
    }
}
