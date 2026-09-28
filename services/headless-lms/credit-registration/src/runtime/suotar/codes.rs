//! What a Suotar per-item `code` means: the one place the wire vocabulary is spelled out. What may
//! be done about the ledger error code it maps to is models' `classification::retryability`.

use headless_lms_models::credit_registrations::{
    CreditRegistrationErrorCode, CreditRegistrationState,
};
use headless_lms_models::library::credit_registration::classification::{
    Retryability, retryability,
};
use headless_lms_utils::services::suotar::{SuotarEndpoint, SuotarItemStatus};

/// What one `code` says about the row that carries it. Every view below narrows this.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub(super) enum WireOutcome {
    /// The answer settles the row, in this state.
    Settled(CreditRegistrationState),
    /// A real answer that decides nothing by itself: the lookup endpoints' success codes, and
    /// verify's `submissionPending`, which only means Sisu has not finished yet.
    Unsettled,
    Failure(CreditRegistrationErrorCode),
}

/// Suotar's answer for a later item of a batch that repeats an earlier one; it names the earlier
/// item's submission.
pub(super) const DUPLICATE_REQUEST_ITEM_CODE: &str = "duplicateRequestItem";
/// Suotar's answer for a student number that names nobody.
pub(super) const PERSON_NOT_FOUND_CODE: &str = "personNotFound";

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
        DUPLICATE_REQUEST_ITEM_CODE => WireOutcome::Settled(State::AwaitingVerification),
        "registered" => WireOutcome::Settled(State::Registered),
        "duplicateAttainment" => WireOutcome::Settled(State::Duplicate),
        "notImprovedAttainment" => WireOutcome::Settled(State::NotImproved),
        "personFound" | "enrolmentFound" | "enrolmentsListed" | "courseAllowed"
        | "submissionPending" => WireOutcome::Unsettled,
        "notRegistered" => WireOutcome::Failure(Code::NotRegistered),
        PERSON_NOT_FOUND_CODE => WireOutcome::Failure(Code::PersonNotFound),
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
pub(super) fn outcome_of(endpoint: SuotarEndpoint, code: &str) -> WireOutcome {
    let outcome = wire_outcome(code);
    if endpoint != SuotarEndpoint::ImportAttainments {
        return outcome;
    }
    match outcome {
        // Suotar's import has no per-item transient, so one arriving there is no evidence that
        // nothing was created; retrying it could put a second attainment on a transcript.
        WireOutcome::Failure(code) if retryability(code) == Retryability::RetryableTransient => {
            WireOutcome::Failure(CreditRegistrationErrorCode::SisuTimeout)
        }
        // `registered` is not an import answer, so what the item created is unknown.
        WireOutcome::Settled(CreditRegistrationState::Registered) => {
            WireOutcome::Failure(CreditRegistrationErrorCode::Unknown)
        }
        outcome => outcome,
    }
}

/// Whether an item says the registry could not be reached right now. Suotar sends
/// `serviceTemporarilyUnavailable` only for a whole request, so an item carrying it means its API
/// changed, and is still worth backing off from. On import, `sisuTimeout` is what every item answers
/// while Sisu is down.
fn is_service_unavailable_code(endpoint: SuotarEndpoint, code: &str) -> bool {
    match wire_outcome(code) {
        WireOutcome::Failure(CreditRegistrationErrorCode::ServiceTemporarilyUnavailable) => true,
        WireOutcome::Failure(CreditRegistrationErrorCode::SisuTimeout) => {
            endpoint == SuotarEndpoint::ImportAttainments
        }
        _ => false,
    }
}

/// Whether an import item says Sisu timed out: an answer from Suotar, not a failure of it.
fn is_sisu_timeout_code(endpoint: SuotarEndpoint, code: &str) -> bool {
    endpoint == SuotarEndpoint::ImportAttainments
        && wire_outcome(code) == WireOutcome::Failure(CreditRegistrationErrorCode::SisuTimeout)
}

/// Whether every item of an answer says the registry could not be reached. One good item makes it a
/// plain answer, because something moved.
pub(super) fn is_all_unavailable<'a>(
    endpoint: SuotarEndpoint,
    items: impl IntoIterator<Item = (SuotarItemStatus, &'a str)>,
) -> bool {
    let mut items = items.into_iter().peekable();
    items.peek().is_some()
        && items.all(|(status, code)| {
            status == SuotarItemStatus::Error && is_service_unavailable_code(endpoint, code)
        })
}

/// Whether every item code of an answer says Sisu timed out: Suotar itself answered.
pub(super) fn is_only_sisu_timeouts<'a>(
    endpoint: SuotarEndpoint,
    codes: impl IntoIterator<Item = &'a str>,
) -> bool {
    codes
        .into_iter()
        .all(|code| is_sisu_timeout_code(endpoint, code))
}

/// Suotar's per-item `code` as a ledger error code, hardened for the endpoint it arrived on.
/// `None` where the code names no failure to record.
pub(super) fn map_code(
    endpoint: SuotarEndpoint,
    code: &str,
) -> Option<CreditRegistrationErrorCode> {
    match outcome_of(endpoint, code) {
        WireOutcome::Failure(code) => Some(code),
        _ => None,
    }
}

/// The state a `code` settles a row in, or `None` where it settles nothing. On import, `sent` means
/// Sisu has not answered yet.
pub(super) fn settled_state(
    endpoint: SuotarEndpoint,
    code: &str,
) -> Option<CreditRegistrationState> {
    match outcome_of(endpoint, code) {
        WireOutcome::Settled(state) => Some(state),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use CreditRegistrationErrorCode as Code;

    #[test]
    fn only_the_unavailability_codes_read_as_the_registry_being_unreachable() {
        assert!(is_service_unavailable_code(
            SuotarEndpoint::VerifyAttainments,
            "serviceTemporarilyUnavailable"
        ));
        assert!(is_service_unavailable_code(
            SuotarEndpoint::ImportAttainments,
            "sisuTimeout"
        ));
        assert!(!is_service_unavailable_code(
            SuotarEndpoint::VerifyAttainments,
            "notRegistered"
        ));
        assert!(!is_service_unavailable_code(
            SuotarEndpoint::VerifyAttainments,
            "sisuTimeout"
        ));
    }

    #[test]
    fn every_documented_error_code_maps() {
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
        for code in [
            "serviceTemporarilyUnavailable",
            "notRegistered",
            "unauthorized",
            "malformedRequest",
        ] {
            assert_eq!(
                map_code(SuotarEndpoint::ImportAttainments, code),
                Some(Code::SisuTimeout),
                "{code}"
            );
        }
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
            Some(Code::Unknown)
        );
    }

    #[test]
    fn an_answer_is_all_unavailable_only_when_every_item_errs_unavailable() {
        use SuotarItemStatus::{Error, Ok};
        let endpoint = SuotarEndpoint::VerifyAttainments;
        assert!(is_all_unavailable(
            endpoint,
            [(Error, "serviceTemporarilyUnavailable")]
        ));
        assert!(!is_all_unavailable(
            endpoint,
            [(Error, "serviceTemporarilyUnavailable"), (Ok, "registered")]
        ));
        assert!(!is_all_unavailable(endpoint, []));
    }
}
