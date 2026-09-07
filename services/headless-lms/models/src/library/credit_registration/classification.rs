//! What a Suotar per-item `code` means: the one place the wire vocabulary is spelled out, and the
//! one place retryability is decided. The mock Suotar's fault validator reads it too. Timing (how
//! long to wait) is [`super::backoff`].

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
        Code::SisuTemporarilyUnavailable | Code::TransportError => Class::RetryableTransient,
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
        | Code::InvalidCredits
        | Code::NoGradeScaleMapping
        | Code::MissingUhCourseCode
        | Code::MissingEctsCredits => Class::PermanentNeedsConfig,
        Code::AcceptorNotFound
        | Code::SisuValidationFailed
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
    /// A real answer that decides nothing: the lookup endpoints' success codes, and verify's
    /// `notRegistered`, which only means Sisu has not finished yet.
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
        // The four import answers that end a row, and verify's `registered`, which is the same
        // answer arriving later.
        "sent" => WireOutcome::Settled(State::AwaitingVerification),
        "registered" => WireOutcome::Settled(State::Registered),
        "duplicateAttainment" => WireOutcome::Settled(State::Duplicate),
        "notImprovedAttainment" => WireOutcome::Settled(State::NotImproved),
        "personFound" | "enrolmentFound" | "found" | "enrolmentsListed" | "notRegistered" => {
            WireOutcome::Unsettled
        }
        "personNotFound" => WireOutcome::Failure(Code::PersonNotFound),
        "courseCodeNotFound" => WireOutcome::Failure(Code::CourseCodeNotFound),
        "enrolmentNotFound" => WireOutcome::Failure(Code::EnrolmentNotFound),
        "enrolmentNotAccepted" => WireOutcome::Failure(Code::EnrolmentNotAccepted),
        "invalidGradeForGradeScale" => WireOutcome::Failure(Code::InvalidGradeForGradeScale),
        "courseNotAllowed" => WireOutcome::Failure(Code::CourseNotAllowed),
        "invalidCredits" => WireOutcome::Failure(Code::InvalidCredits),
        "studyRightNotValid" => WireOutcome::Failure(Code::StudyRightNotValid),
        "acceptorNotFound" => WireOutcome::Failure(Code::AcceptorNotFound),
        "sisuValidationFailed" => WireOutcome::Failure(Code::SisuValidationFailed),
        "sisuTimeout" => WireOutcome::Failure(Code::SisuTimeout),
        "misregistered" => WireOutcome::Failure(Code::Misregistered),
        "unauthorized" => WireOutcome::Failure(Code::Unauthorized),
        "malformedRequest" => WireOutcome::Failure(Code::MalformedRequest),
        "sisuTemporarilyUnavailable" => WireOutcome::Failure(Code::SisuTemporarilyUnavailable),
        _ => WireOutcome::Failure(Code::Unknown),
    }
}

/// [`wire_outcome`] hardened for the endpoint the code arrived on. Every caller that has an
/// endpoint to name goes through here.
pub fn outcome_of(endpoint: SuotarEndpoint, code: &str) -> WireOutcome {
    let outcome = wire_outcome(code);
    // Import's contract has no per-item transient, so one arriving there is no evidence that
    // nothing was created; retrying it could put a second attainment on a transcript.
    if endpoint == SuotarEndpoint::ImportAttainments
        && outcome == WireOutcome::Failure(CreditRegistrationErrorCode::SisuTemporarilyUnavailable)
    {
        return WireOutcome::Failure(CreditRegistrationErrorCode::SisuTimeout);
    }
    outcome
}

/// The class the contract gives a wire code, before any hardening of ours, which is what the mock's
/// fault validator needs.
pub fn wire_code_retryability(code: &str) -> Option<Retryability> {
    match wire_outcome(code) {
        WireOutcome::Failure(code) => Some(retryability(code)),
        _ => None,
    }
}

pub fn is_retryable_transient_wire_code(code: &str) -> bool {
    wire_code_retryability(code) == Some(Retryability::RetryableTransient)
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
            (Code::SisuTemporarilyUnavailable, Class::RetryableTransient),
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
            (Code::InvalidCredits, Class::PermanentNeedsConfig),
            (Code::NoGradeScaleMapping, Class::PermanentNeedsConfig),
            (Code::MissingUhCourseCode, Class::PermanentNeedsConfig),
            (Code::MissingEctsCredits, Class::PermanentNeedsConfig),
            (Code::AcceptorNotFound, Class::PermanentNeedsAdmin),
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

    /// Import's hardening must not reach the wire class, or the mock's fault validator would stop
    /// refusing the one combination it guards.
    #[test]
    fn the_wire_class_of_the_transient_code_ignores_imports_hardening() {
        assert!(is_retryable_transient_wire_code(
            "sisuTemporarilyUnavailable"
        ));
        assert_eq!(
            map_code(
                SuotarEndpoint::ImportAttainments,
                "sisuTemporarilyUnavailable"
            )
            .map(retryability),
            Some(Class::VerifyOnly)
        );
    }

    #[test]
    fn a_code_that_names_no_failure_has_no_wire_class() {
        assert_eq!(wire_code_retryability("registered"), None);
        assert_eq!(wire_code_retryability("notRegistered"), None);
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
                "sisuTemporarilyUnavailable",
                Code::SisuTemporarilyUnavailable,
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
                "acceptorNotFound",
                Code::AcceptorNotFound,
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
                "sisuTemporarilyUnavailable",
                Code::SisuTemporarilyUnavailable,
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
            (SuotarEndpoint::ImportAttainments, "registered"),
            (SuotarEndpoint::ImportAttainments, "duplicateAttainment"),
            (SuotarEndpoint::ImportAttainments, "notImprovedAttainment"),
            (SuotarEndpoint::VerifyAttainments, "registered"),
            (SuotarEndpoint::ProductAccessTokens, "found"),
            (SuotarEndpoint::ListByCourse, "enrolmentsListed"),
            (SuotarEndpoint::VerifyAttainments, "notRegistered"),
        ] {
            assert_eq!(map_code(endpoint, code), None, "{code} on {endpoint:?}");
        }
    }

    #[test]
    fn an_item_level_transient_on_import_is_uncertain_rather_than_retryable() {
        assert_eq!(
            map_code(
                SuotarEndpoint::ImportAttainments,
                "sisuTemporarilyUnavailable"
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
            ("registered", State::Registered),
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
        for code in ["notRegistered", "personFound", "sisuTimeout"] {
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
