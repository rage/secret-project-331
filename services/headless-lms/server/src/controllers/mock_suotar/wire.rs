//! Request and response bodies for the six contract endpoints, and the canonical message strings.
//!
//! Every batch endpoint takes a top-level JSON array and answers with one item per request item in
//! request order. Per-item outcomes are HTTP 200; only request-level failures are 4xx/5xx.

use chrono::NaiveDate;
use headless_lms_models::suotar_api_calls::SuotarEndpoint;

use crate::prelude::*;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvePersonsItem {
    pub request_item_id: String,
    pub student_number: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveEnrolmentsItem {
    pub request_item_id: String,
    pub student_number: String,
    pub course_code: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportItem {
    pub request_item_id: String,
    pub student_number: String,
    pub course_code: String,
    pub enrolment_id: String,
    pub attainment_date: NaiveDate,
    pub attainment_language: String,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub credits: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyItem {
    pub request_item_id: String,
    pub submitted_attainment_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductAccessTokenItem {
    pub request_item_id: String,
    pub open_university_product_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListByCourseItem {
    pub request_item_id: String,
    pub course_code: String,
    pub course_unit_realisation_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ItemStatus {
    Ok,
    Error,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemError {
    pub message: String,
    /// Present only on a disclosed `sisuTimeout`, where the client is told what it may verify.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submitted_attainment_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseItem {
    pub request_item_id: String,
    pub status: ItemStatus,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ItemError>,
}

impl ResponseItem {
    pub fn ok(request_item_id: &str, code: &str, result: serde_json::Value) -> Self {
        Self {
            request_item_id: request_item_id.to_string(),
            status: ItemStatus::Ok,
            code: code.to_string(),
            result: Some(result),
            error: None,
        }
    }

    pub fn error(endpoint: SuotarEndpoint, request_item_id: &str, code: &str) -> Self {
        Self {
            request_item_id: request_item_id.to_string(),
            status: ItemStatus::Error,
            code: code.to_string(),
            result: None,
            error: Some(ItemError {
                message: canonical_message(endpoint, code),
                submitted_attainment_id: None,
            }),
        }
    }

    pub fn error_with_message(request_item_id: &str, code: &str, message: String) -> Self {
        Self {
            request_item_id: request_item_id.to_string(),
            status: ItemStatus::Error,
            code: code.to_string(),
            result: None,
            error: Some(ItemError {
                message,
                submitted_attainment_id: None,
            }),
        }
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalizedName {
    pub fi: String,
    pub sv: String,
    pub en: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatePeriod {
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

impl DatePeriod {
    pub fn contains(&self, date: NaiveDate) -> bool {
        self.start_date <= date && date <= self.end_date
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditRange {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonResult {
    pub student_number: String,
    pub person_id: String,
    pub first_names: String,
    pub last_name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentDto {
    pub id: String,
    pub state: String,
    pub kind: String,
    pub course_unit_id: String,
    pub assessment_item_id: String,
    pub course_unit_realisation_id: String,
    pub course_unit_realisation_name: LocalizedName,
    pub activity_period: DatePeriod,
    pub grade_scale_id: String,
    pub credits: CreditRange,
    pub study_right_id: String,
    pub study_right_validity_period: DatePeriod,
    pub enrolment_date_time: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingAttainmentDto {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
    pub state: String,
    pub person_id: String,
    pub course_unit_id: String,
    pub assessment_item_id: String,
    pub course_unit_realisation_id: String,
    pub attainment_date: NaiveDate,
    pub registration_date: NaiveDate,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub passed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentsResult {
    pub enrolments: Vec<EnrolmentDto>,
    pub existing_attainments: Vec<ExistingAttainmentDto>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SentResult {
    pub submitted_attainment_id: String,
    pub submitted_attainment_type: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttainmentRef {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
}

/// Import's `registered` and verify's `registered` share this body, so one client-side
/// deserializer covers both.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredResult {
    pub attainment: AttainmentRef,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttainmentSummary {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
    pub state: String,
    pub attainment_date: NaiveDate,
    pub registration_date: NaiveDate,
    pub grade_scale_id: String,
    pub grade_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateResult {
    pub attainment: AttainmentSummary,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotImprovedResult {
    pub previous_attainment: AttainmentSummary,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductAccessTokenResult {
    pub id: String,
    pub access_token: String,
    pub state: String,
    pub document_state: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedEnrolment {
    pub id: String,
    pub course_unit_realisation_id: String,
    pub state: String,
    pub enrolment_date_time: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedPerson {
    pub student_number: String,
    pub person_id: String,
    pub first_names: String,
    pub last_name: String,
    pub primary_email: String,
    /// Omitted rather than null when Sisu holds none.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secondary_email: Option<String>,
    pub enrolment: ListedEnrolment,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeopleResult {
    pub people: Vec<ListedPerson>,
}

/// The proposal words `sisuTemporarilyUnavailable` differently on each endpoint that carries it, and
/// the mock reproduces that: a client keying off `message` instead of `code` has to break here.
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

    /// The proposal's own example bodies, which is the actual contract check.
    #[test]
    fn the_proposals_example_request_bodies_deserialize() {
        let persons: Vec<ResolvePersonsItem> = serde_json::from_str(
            r#"[{ "requestItemId": "person-1", "studentNumber": "012345678" }]"#,
        )
        .expect("resolve-persons example");
        assert_eq!(persons[0].student_number, "012345678");

        let enrolments: Vec<ResolveEnrolmentsItem> = serde_json::from_str(
            r#"[{ "requestItemId": "enrolment-1", "studentNumber": "012345678", "courseCode": "TKT10001" }]"#,
        )
        .expect("resolve-enrolments example");
        assert_eq!(enrolments[0].course_code, "TKT10001");

        let imports: Vec<ImportItem> = serde_json::from_str(
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

        let verifies: Vec<VerifyItem> = serde_json::from_str(
            r#"[{ "requestItemId": "verify-1", "submittedAttainmentId": "hy-kur-1" }]"#,
        )
        .expect("verify example");
        assert_eq!(verifies[0].submitted_attainment_id, "hy-kur-1");

        let tokens: Vec<ProductAccessTokenItem> = serde_json::from_str(
            r#"[{ "requestItemId": "token-1", "openUniversityProductId": "otm-product" }]"#,
        )
        .expect("product access token example");
        assert_eq!(tokens[0].open_university_product_id, "otm-product");

        let listings: Vec<ListByCourseItem> = serde_json::from_str(
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
        let item = ResponseItem::error(SuotarEndpoint::ResolvePersons, "b2", "personNotFound");
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
