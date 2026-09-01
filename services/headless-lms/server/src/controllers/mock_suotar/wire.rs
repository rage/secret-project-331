//! The mock's half of the six contract endpoints: the client's own request and response types,
//! re-exported so a mock body that the client cannot read is a compile error, plus the shapes and
//! message strings that exist only on the answering side.
//!
//! Every endpoint takes a top-level JSON array and answers with one item per request item, in order.
//! Per-item outcomes are HTTP 200; only request-level failures are 4xx/5xx.

use headless_lms_utils::services::suotar::SuotarEndpoint;
pub use headless_lms_utils::services::suotar::{
    CreditRange, DatePeriod, EnrolmentResolutionResult, EnrolmentsListedResult, ExistingAttainment,
    ImportAttainmentRequestItem, ImportAttainmentResult, ListByCourseRequestItem, ListedEnrolment,
    ListedPerson, LocalizedName, PersonResult, ProductAccessTokenRequestItem,
    ProductAccessTokenResult, ResolveEnrolmentRequestItem, ResolvePersonRequestItem,
    SuotarAttainment, SuotarEnrolment, SuotarItemError, SuotarItemStatus, SuotarResponseItem,
    VerifyAttainmentRequestItem, VerifyAttainmentResult,
};

use crate::prelude::*;

/// A request's items are all one endpoint's shape, but the pipeline also carries fault-shaped items
/// and logs them, so the payload is erased once the per-item logic has built it in its typed form.
pub type ErasedResponseItem = SuotarResponseItem<serde_json::Value>;

pub fn erase<R: Serialize>(item: SuotarResponseItem<R>) -> ErasedResponseItem {
    ErasedResponseItem {
        request_item_id: item.request_item_id,
        status: item.status,
        code: item.code,
        result: item
            .result
            .map(|result| serde_json::to_value(result).unwrap_or(serde_json::Value::Null)),
        error: item.error,
    }
}

pub fn ok_item<R>(request_item_id: &str, code: &str, result: R) -> SuotarResponseItem<R> {
    SuotarResponseItem {
        request_item_id: request_item_id.to_string(),
        status: SuotarItemStatus::Ok,
        code: code.to_string(),
        result: Some(result),
        error: None,
    }
}

pub fn error_item<R>(
    endpoint: SuotarEndpoint,
    request_item_id: &str,
    code: &str,
) -> SuotarResponseItem<R> {
    error_item_with_message(request_item_id, code, canonical_message(endpoint, code))
}

pub fn error_item_with_message<R>(
    request_item_id: &str,
    code: &str,
    message: String,
) -> SuotarResponseItem<R> {
    SuotarResponseItem {
        request_item_id: request_item_id.to_string(),
        status: SuotarItemStatus::Error,
        code: code.to_string(),
        result: None,
        error: Some(SuotarItemError {
            message,
            submitted_attainment_id: None,
        }),
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RequestLevelErrorBody {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RequestLevelError {
    pub error: RequestLevelErrorBody,
}

impl RequestLevelError {
    pub fn new(endpoint: SuotarEndpoint, code: &str) -> Self {
        Self {
            error: RequestLevelErrorBody {
                code: code.to_string(),
                message: canonical_message(endpoint, code),
            },
        }
    }

    pub fn with_message(code: &str, message: String) -> Self {
        Self {
            error: RequestLevelErrorBody {
                code: code.to_string(),
                message,
            },
        }
    }
}

/// `sisuTemporarilyUnavailable` is worded differently per endpoint, reproduced here so a client
/// keying off `message` instead of `code` breaks.
pub fn canonical_message(endpoint: SuotarEndpoint, code: &str) -> String {
    if code == "sisuTemporarilyUnavailable" {
        return match endpoint {
            SuotarEndpoint::VerifyAttainments => {
                "Sisu was temporarily unavailable during verification."
            }
            SuotarEndpoint::ProductAccessTokens => {
                "Suotar could not fetch the Open University product access token from Sisu."
            }
            SuotarEndpoint::ListByCourse => "Suotar could not serve the list of enrolled people.",
            _ => "Sisu was temporarily unavailable.",
        }
        .to_string();
    }
    match code {
        "personNotFound" => "No Sisu person was found for the supplied student number.",
        "courseCodeNotFound" => "Course code could not be resolved in Sisu.",
        "enrolmentNotFound" => {
            "No ENROLLED Sisu enrolment was found for this student and course code."
        }
        // TODO: Suotar has not given wording for this code; the proposal only names it.
        "enrolmentNotAccepted" => "The student's Sisu enrolment has not been accepted.",
        "studyRightNotValid" => "Study right cannot support the attainment.",
        "sisuTimeout" => "Sisu operation timed out; outcome is uncertain.",
        "notRegistered" => {
            "No final or partial Sisu registration evidence was found for the submitted attainment id."
        }
        "misregistered" => {
            "A previously registered attainment has been marked misregistered in Sisu."
        }
        "productAccessTokenNotFound" => {
            "No access token was found for the supplied Open University product id."
        }
        "unauthorized" => "Missing or invalid credentials.",
        "malformedRequest" => "Request body is not valid JSON or has the wrong top-level shape.",
        // TODO: Suotar has not given wording for the five import validation codes below.
        "invalidGradeForGradeScale" => "The grade is not valid for the enrolment's grade scale.",
        "courseNotAllowed" => "Attainments may not be imported for this course.",
        "invalidCredits" => "The credits are outside the range the enrolment allows.",
        "acceptorNotFound" => "No acceptor was found for the course unit realisation.",
        "sisuValidationFailed" => "Sisu rejected the attainment as invalid.",
        "internalError" => "Suotar encountered an internal error.",
        _ => "Suotar returned an unspecified outcome.",
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The proposal's own example bodies, verbatim.
    #[test]
    fn the_proposals_example_request_bodies_deserialize() {
        let persons: Vec<ResolvePersonRequestItem> = serde_json::from_str(
            r#"[{ "requestItemId": "person-1", "studentNumber": "012345678" }]"#,
        )
        .expect("resolve-persons example");
        assert_eq!(persons[0].student_number, "012345678");

        let enrolments: Vec<ResolveEnrolmentRequestItem> = serde_json::from_str(
            r#"[{ "requestItemId": "enrolment-1", "studentNumber": "012345678", "courseCode": "TKT10001" }]"#,
        )
        .expect("resolve-enrolments example");
        assert_eq!(enrolments[0].course_code, "TKT10001");

        let imports: Vec<ImportAttainmentRequestItem> = serde_json::from_str(
            r#"[{
                "requestItemId": "moocfi-completion-12345",
                "studentNumber": "012345678",
                "courseCode": "TKT10001",
                "enrolmentId": "selected-enrolment-id",
                "attainmentDate": "2026-05-22",
                "attainmentLanguage": "fi",
                "gradeScaleId": "sis-hyl-hyv",
                "gradeId": "1",
                "credits": 5
            }]"#,
        )
        .expect("import example");
        assert_eq!(imports[0].credits, 5.0);

        let verifies: Vec<VerifyAttainmentRequestItem> = serde_json::from_str(
            r#"[{ "requestItemId": "verify-1", "submittedAttainmentId": "hy-kur-1" }]"#,
        )
        .expect("verify example");
        assert_eq!(verifies[0].submitted_attainment_id, "hy-kur-1");

        let tokens: Vec<ProductAccessTokenRequestItem> = serde_json::from_str(
            r#"[{ "requestItemId": "token-1", "openUniversityProductId": "otm-product" }]"#,
        )
        .expect("product access token example");
        assert_eq!(tokens[0].open_university_product_id, "otm-product");

        let listings: Vec<ListByCourseRequestItem> = serde_json::from_str(
            r#"[{ "requestItemId": "people-1", "courseCode": "TKT10001", "courseUnitRealisationId": "hy-opt-cur-1" }]"#,
        )
        .expect("list-by-course example");
        assert_eq!(
            listings[0].course_unit_realisation_id.as_deref(),
            Some("hy-opt-cur-1")
        );
    }

    #[test]
    fn a_per_item_error_serializes_to_the_documented_shape() {
        let item: ErasedResponseItem =
            error_item(SuotarEndpoint::ResolvePersons, "b2", "personNotFound");
        assert_eq!(
            serde_json::to_value(&item).expect("serializes"),
            serde_json::json!({
                "requestItemId": "b2",
                "status": "error",
                "code": "personNotFound",
                "error": { "message": "No Sisu person was found for the supplied student number." }
            })
        );
    }
}
