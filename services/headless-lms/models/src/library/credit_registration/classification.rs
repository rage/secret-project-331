//! What a Suotar per-item `code` means: the one place the wire vocabulary is spelled out, and the
//! one place retryability is decided. Timing (how long to wait) is [`super::backoff`].

use utoipa::ToSchema;

use crate::credit_registrations::{CreditRegistrationErrorCode, CreditRegistrationState};
use crate::prelude::*;
use crate::suotar_api_calls::SuotarEndpoint;

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

/// What one `code` says about the row that carries it. Every view below narrows this.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum WireOutcome {
    /// The answer settles the row, in this state.
    Settled(CreditRegistrationState),
    /// A real answer that decides nothing by itself: the lookup endpoints' success codes, and
    /// verify's `submissionPending`, which only means Sisu has not finished yet.
    Unsettled,
    Failure(CreditRegistrationErrorCode),
}

/// The contract's own reading of a `code`, before any hardening of ours.
///
/// An unrecognised code is a failure rather than an error, since Suotar may add codes; which of
/// them are even recoverable is [`retryability`].
fn wire_outcome(code: &str) -> WireOutcome {
    use CreditRegistrationErrorCode as Code;
    use CreditRegistrationState as State;
    match code {
        "sent" => WireOutcome::Settled(State::AwaitingVerification),
        // An error on the wire, but it names the submission an earlier item of the batch made for
        // the same completion, which is ours to verify.
        "duplicateRequestItem" => WireOutcome::Settled(State::AwaitingVerification),
        "registered" => WireOutcome::Settled(State::Registered),
        "duplicateAttainment" => WireOutcome::Settled(State::Duplicate),
        "notImprovedAttainment" => WireOutcome::Settled(State::NotImproved),
        "personFound" | "enrolmentFound" | "enrolmentsListed" | "courseAllowed"
        | "submissionPending" => WireOutcome::Unsettled,
        "notRegistered" => WireOutcome::Failure(Code::NotRegistered),
        "personNotFound" => WireOutcome::Failure(Code::PersonNotFound),
        "courseCodeNotFound" => WireOutcome::Failure(Code::CourseCodeNotFound),
        "enrolmentNotFound" => WireOutcome::Failure(Code::EnrolmentNotFound),
        "enrolmentNotAccepted" => WireOutcome::Failure(Code::EnrolmentNotAccepted),
        "invalidGradeForGradeScale" => WireOutcome::Failure(Code::InvalidGradeForGradeScale),
        "gradeScaleMismatch" => WireOutcome::Failure(Code::GradeScaleMismatch),
        "courseNotAllowed" => WireOutcome::Failure(Code::CourseNotAllowed),
        "invalidCredits" => WireOutcome::Failure(Code::InvalidCredits),
        "studyRightNotValid" => WireOutcome::Failure(Code::StudyRightNotValid),
        "sisuValidationFailed" => WireOutcome::Failure(Code::SisuValidationFailed),
        "sisuTimeout" => WireOutcome::Failure(Code::SisuTimeout),
        "misregistered" => WireOutcome::Failure(Code::Misregistered),
        "unauthorized" => WireOutcome::Failure(Code::Unauthorized),
        "malformedRequest" => WireOutcome::Failure(Code::MalformedRequest),
        "serviceTemporarilyUnavailable" => {
            WireOutcome::Failure(Code::ServiceTemporarilyUnavailable)
        }
        _ => WireOutcome::Failure(Code::Unknown),
    }
}

/// [`wire_outcome`] hardened for the endpoint the code arrived on. Every caller that has an
/// endpoint to name goes through here.
pub fn outcome_of(endpoint: SuotarEndpoint, code: &str) -> WireOutcome {
    let outcome = wire_outcome(code);
    if endpoint != SuotarEndpoint::ImportAttainments {
        return outcome;
    }
    match outcome {
        // Import's contract has no per-item transient, so one arriving there is no evidence that
        // nothing was created; retrying it could put a second attainment on a transcript.
        WireOutcome::Failure(CreditRegistrationErrorCode::ServiceTemporarilyUnavailable) => {
            WireOutcome::Failure(CreditRegistrationErrorCode::SisuTimeout)
        }
        // `registered` is not an import answer, so what the item created is unknown.
        WireOutcome::Settled(CreditRegistrationState::Registered) => {
            WireOutcome::Failure(CreditRegistrationErrorCode::Unknown)
        }
        outcome => outcome,
    }
}

/// Whether an item says the registry could not be reached right now. The contract has this only at
/// the request level, so an item carrying it is Suotar changing, and worth backing off from.
pub fn is_service_unavailable_wire_code(code: &str) -> bool {
    wire_outcome(code)
        == WireOutcome::Failure(CreditRegistrationErrorCode::ServiceTemporarilyUnavailable)
}

/// Suotar's per-item `code` as a ledger error code, hardened for the endpoint it arrived on.
/// `None` where the code names no failure to record.
pub fn map_code(endpoint: SuotarEndpoint, code: &str) -> Option<CreditRegistrationErrorCode> {
    match outcome_of(endpoint, code) {
        WireOutcome::Failure(code) => Some(code),
        _ => None,
    }
}

/// The state a `code` settles a row in, or `None` where it settles nothing.
pub fn settled_state(endpoint: SuotarEndpoint, code: &str) -> Option<CreditRegistrationState> {
    match outcome_of(endpoint, code) {
        WireOutcome::Settled(state) => Some(state),
        _ => None,
    }
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

    #[test]
    fn only_the_unavailability_code_reads_as_the_registry_being_unreachable() {
        assert!(is_service_unavailable_wire_code(
            "serviceTemporarilyUnavailable"
        ));
        assert!(!is_service_unavailable_wire_code("notRegistered"));
        assert!(!is_service_unavailable_wire_code("sisuTimeout"));
    }

    #[test]
    fn every_documented_error_code_maps() {
        use CreditRegistrationErrorCode as Code;
        let cases = [
            (
                SuotarEndpoint::ResolvePersons,
                "personNotFound",
                Code::PersonNotFound,
            ),
            (
                SuotarEndpoint::ResolvePersons,
                "serviceTemporarilyUnavailable",
                Code::ServiceTemporarilyUnavailable,
            ),
            (
                SuotarEndpoint::ResolveEnrolments,
                "personNotFound",
                Code::PersonNotFound,
            ),
            (
                SuotarEndpoint::ResolveEnrolments,
                "courseCodeNotFound",
                Code::CourseCodeNotFound,
            ),
            (
                SuotarEndpoint::ResolveEnrolments,
                "enrolmentNotFound",
                Code::EnrolmentNotFound,
            ),
            (
                SuotarEndpoint::ResolveEnrolments,
                "enrolmentNotAccepted",
                Code::EnrolmentNotAccepted,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "invalidGradeForGradeScale",
                Code::InvalidGradeForGradeScale,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "courseNotAllowed",
                Code::CourseNotAllowed,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "invalidCredits",
                Code::InvalidCredits,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "studyRightNotValid",
                Code::StudyRightNotValid,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "gradeScaleMismatch",
                Code::GradeScaleMismatch,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "registered",
                Code::Unknown,
            ),
            (
                SuotarEndpoint::VerifyAttainments,
                "notRegistered",
                Code::NotRegistered,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "sisuValidationFailed",
                Code::SisuValidationFailed,
            ),
            (
                SuotarEndpoint::ImportAttainments,
                "sisuTimeout",
                Code::SisuTimeout,
            ),
            (
                SuotarEndpoint::VerifyAttainments,
                "misregistered",
                Code::Misregistered,
            ),
            (
                SuotarEndpoint::VerifyAttainments,
                "serviceTemporarilyUnavailable",
                Code::ServiceTemporarilyUnavailable,
            ),
            (
                SuotarEndpoint::ListByCourse,
                "courseCodeNotFound",
                Code::CourseCodeNotFound,
            ),
            (
                SuotarEndpoint::ResolvePersons,
                "unauthorized",
                Code::Unauthorized,
            ),
            (
                SuotarEndpoint::ResolvePersons,
                "malformedRequest",
                Code::MalformedRequest,
            ),
        ];
        for (endpoint, code, expected) in cases {
            assert_eq!(
                map_code(endpoint, code),
                Some(expected),
                "{code} on {endpoint:?}"
            );
        }
    }

    #[test]
    fn no_code_that_needs_no_recording_becomes_an_error() {
        for (endpoint, code) in [
            (SuotarEndpoint::ResolvePersons, "personFound"),
            (SuotarEndpoint::ResolveEnrolments, "enrolmentFound"),
            (SuotarEndpoint::ImportAttainments, "sent"),
            (SuotarEndpoint::ImportAttainments, "duplicateRequestItem"),
            (SuotarEndpoint::ImportAttainments, "duplicateAttainment"),
            (SuotarEndpoint::ImportAttainments, "notImprovedAttainment"),
            (SuotarEndpoint::VerifyAttainments, "registered"),
            (SuotarEndpoint::VerifyAttainments, "submissionPending"),
            (SuotarEndpoint::ListByCourse, "enrolmentsListed"),
            (SuotarEndpoint::ValidateCourseCodes, "courseAllowed"),
        ] {
            assert_eq!(map_code(endpoint, code), None, "{code} on {endpoint:?}");
        }
    }

    #[test]
    fn an_item_level_transient_on_import_is_uncertain_rather_than_retryable() {
        assert_eq!(
            map_code(
                SuotarEndpoint::ImportAttainments,
                "serviceTemporarilyUnavailable"
            ),
            Some(CreditRegistrationErrorCode::SisuTimeout)
        );
    }

    /// The success half of the vocabulary, which decides where a row ends up rather than what went
    /// wrong with it.
    #[test]
    fn every_code_that_settles_a_row_names_the_state_it_settles_it_in() {
        use CreditRegistrationState as State;
        for (code, expected) in [
            ("sent", State::AwaitingVerification),
            ("duplicateRequestItem", State::AwaitingVerification),
            ("duplicateAttainment", State::Duplicate),
            ("notImprovedAttainment", State::NotImproved),
        ] {
            assert_eq!(
                settled_state(SuotarEndpoint::ImportAttainments, code),
                Some(expected),
                "{code}"
            );
        }
        assert_eq!(
            settled_state(SuotarEndpoint::VerifyAttainments, "registered"),
            Some(State::Registered)
        );
        assert_eq!(
            settled_state(SuotarEndpoint::ImportAttainments, "registered"),
            None
        );
        for code in [
            "notRegistered",
            "submissionPending",
            "personFound",
            "sisuTimeout",
        ] {
            assert_eq!(
                settled_state(SuotarEndpoint::VerifyAttainments, code),
                None,
                "{code}"
            );
        }
    }

    #[test]
    fn a_code_suotar_adds_later_maps_to_unknown_rather_than_failing() {
        assert_eq!(
            map_code(
                SuotarEndpoint::VerifyAttainments,
                "somethingSuotarAddedLater"
            ),
            Some(CreditRegistrationErrorCode::Unknown)
        );
    }
}
