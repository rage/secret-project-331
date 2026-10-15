//! What may be done about a ledger error code: the one place retryability is decided. How long to
//! wait is [`super::backoff`]; which Suotar codes map to which error code is the worker's Suotar
//! adapter's.

use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationErrorCode;
use crate::prelude::*;

/// What may be done about an error code. The class is the contract's, not the endpoint's: the
/// import phase is the only place that upgrades a code to [`Retryability::VerifyOnly`].
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Retryability {
    RetryableTransient,
    /// The outcome is unknown and re-sending could duplicate it. Only `verify` may touch it.
    VerifyOnly,
    PermanentNeedsStudent,
    PermanentNeedsAdmin,
    PermanentNeedsConfig,
}

/// What may be done about a row carrying `code`.
pub fn retryability(code: CreditRegistrationErrorCode) -> Retryability {
    use CreditRegistrationErrorCode as Code;
    use Retryability as Class;
    match code {
        Code::ServiceTemporarilyUnavailable | Code::TransportError => Class::RetryableTransient,
        // Suotar found no trace of the submission, so it goes back to import.
        Code::NotRegistered => Class::RetryableTransient,
        // Our credentials or our request shape: re-queue the batch rather than blame its rows.
        Code::Unauthorized | Code::MalformedRequest => Class::RetryableTransient,
        // An answer we could not read says nothing about the row.
        Code::UnexpectedResponse => Class::RetryableTransient,
        Code::SisuTimeout => Class::VerifyOnly,
        Code::PersonNotFound
        | Code::EnrolmentNotFound
        | Code::EnrolmentNotAccepted
        | Code::StudyRightNotValid => Class::PermanentNeedsStudent,
        Code::CourseCodeNotFound
        | Code::CourseNotAllowed
        | Code::InvalidGradeForGradeScale
        | Code::GradeScaleMismatch
        | Code::InvalidCredits
        | Code::NoGradeScaleMapping
        | Code::MissingUhCourseCode
        | Code::MissingEctsCredits => Class::PermanentNeedsConfig,
        Code::SisuValidationFailed
        | Code::Misregistered
        | Code::RetryWindowExpired
        | Code::Unknown => Class::PermanentNeedsAdmin,
    }
}

/// Whether Sisu answers an unchanged resend of a row carrying `code` the same way: the rejection
/// is about what we sent or whom we sent it for, not about the moment it was sent.
pub fn is_repeatable_rejection(code: CreditRegistrationErrorCode) -> bool {
    use CreditRegistrationErrorCode as Code;
    match retryability(code) {
        Retryability::PermanentNeedsStudent | Retryability::PermanentNeedsConfig => true,
        // The other admin codes are a timeout's aftermath, a reversal, or unclassified.
        Retryability::PermanentNeedsAdmin => code == Code::SisuValidationFailed,
        Retryability::RetryableTransient | Retryability::VerifyOnly => false,
    }
}

/// The answers that would send the student off to enrol.
pub fn is_enrolment_error(code: CreditRegistrationErrorCode) -> bool {
    matches!(
        code,
        CreditRegistrationErrorCode::EnrolmentNotFound
            | CreditRegistrationErrorCode::EnrolmentNotAccepted
    )
}

/// Whether a row carrying `code` only awaits something outside the pipeline, so its answer is no
/// failure: a submission Suotar cannot find yet, or an enrolment the student has not made.
pub fn is_waiting_error(code: CreditRegistrationErrorCode) -> bool {
    code == CreditRegistrationErrorCode::NotRegistered || is_enrolment_error(code)
}

#[cfg(test)]
mod tests {
    use super::*;
    use CreditRegistrationErrorCode as Code;
    use Retryability as Class;

    /// Pins each code to its documented class explicitly, so a future edit that moves a code
    /// between match arms fails here even though the match stays exhaustive to the compiler.
    #[test]
    fn retryability_matches_the_documented_class_for_every_code() {
        let cases = [
            (
                Code::ServiceTemporarilyUnavailable,
                Class::RetryableTransient,
            ),
            (Code::NotRegistered, Class::RetryableTransient),
            (Code::TransportError, Class::RetryableTransient),
            (Code::Unauthorized, Class::RetryableTransient),
            (Code::MalformedRequest, Class::RetryableTransient),
            (Code::UnexpectedResponse, Class::RetryableTransient),
            (Code::SisuTimeout, Class::VerifyOnly),
            (Code::PersonNotFound, Class::PermanentNeedsStudent),
            (Code::EnrolmentNotFound, Class::PermanentNeedsStudent),
            (Code::EnrolmentNotAccepted, Class::PermanentNeedsStudent),
            (Code::StudyRightNotValid, Class::PermanentNeedsStudent),
            (Code::CourseCodeNotFound, Class::PermanentNeedsConfig),
            (Code::CourseNotAllowed, Class::PermanentNeedsConfig),
            (Code::InvalidGradeForGradeScale, Class::PermanentNeedsConfig),
            (Code::GradeScaleMismatch, Class::PermanentNeedsConfig),
            (Code::InvalidCredits, Class::PermanentNeedsConfig),
            (Code::NoGradeScaleMapping, Class::PermanentNeedsConfig),
            (Code::MissingUhCourseCode, Class::PermanentNeedsConfig),
            (Code::MissingEctsCredits, Class::PermanentNeedsConfig),
            (Code::SisuValidationFailed, Class::PermanentNeedsAdmin),
            (Code::Misregistered, Class::PermanentNeedsAdmin),
            (Code::RetryWindowExpired, Class::PermanentNeedsAdmin),
            (Code::Unknown, Class::PermanentNeedsAdmin),
        ];
        assert_eq!(
            cases.len(),
            CreditRegistrationErrorCode::ALL.len(),
            "every code must be covered"
        );
        for (code, expected) in cases {
            assert_eq!(retryability(code), expected, "{code:?}");
        }
    }
}
