//! The mock's half of the moocfi endpoints: its own request and response shapes, deliberately not
//! shared with the client so the two can disagree the way a real Suotar and our client can.
//!
//! Every endpoint takes a top-level JSON array and answers with one item per request item, in order.
//! Per-item outcomes are HTTP 200; only request-level failures are 4xx/5xx. Suotar serializes an
//! `undefined` field by leaving it out and a `null` one as `null`, and the response structs keep
//! that distinction field by field.

use chrono::{NaiveDate, SecondsFormat};

use crate::prelude::*;

/// The moocfi endpoints, keyed the way the audited client names them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Endpoint {
    ResolvePersons,
    ResolveEnrolments,
    ImportAttainments,
    VerifyAttainments,
    ListByCourse,
    ValidateCourseCodes,
}

impl Endpoint {
    pub fn max_batch_size(self) -> usize {
        match self {
            Self::ImportAttainments => 100,
            Self::ListByCourse => 50,
            Self::ResolvePersons
            | Self::ResolveEnrolments
            | Self::VerifyAttainments
            | Self::ValidateCourseCodes => 1000,
        }
    }
}

pub const ASSESSMENT_ITEM_ATTAINMENT: &str = "AssessmentItemAttainment";
pub const COURSE_UNIT_ATTAINMENT: &str = "CourseUnitAttainment";

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvePersonRequestItem {
    pub request_item_id: String,
    pub student_number: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveEnrolmentRequestItem {
    pub request_item_id: String,
    pub student_number: String,
    pub course_code: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAttainmentRequestItem {
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

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyAttainmentRequestItem {
    pub request_item_id: String,
    pub submitted_attainment_id: String,
}

/// Shared by list-by-course and course-code validation, which both take only a code.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseCodeRequestItem {
    pub request_item_id: String,
    pub course_code: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalizedName {
    pub fi: String,
    pub sv: String,
    pub en: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatePeriod {
    pub start_date: NaiveDate,
    /// `null` for a realisation or study right with no end, which Sisu allows.
    pub end_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditRange {
    pub min: f64,
    /// `null` is an open range, which Suotar refuses to import against.
    pub max: Option<f64>,
}

/// Exactly the four keys Suotar passes on from the importer's person row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonResult {
    pub student_number: String,
    pub person_id: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Enrolment {
    pub id: String,
    pub state: String,
    pub kind: String,
    pub course_unit_id: String,
    pub assessment_item_id: String,
    pub course_unit_realisation_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course_unit_realisation_name: Option<LocalizedName>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub activity_period: Option<DatePeriod>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grade_scale_id: Option<String>,
    pub credits: Option<CreditRange>,
    pub study_right_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub study_right_validity_period: Option<DatePeriod>,
    /// ISO with milliseconds, as the importer hands it through; left out when it has none.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enrolment_date_time: Option<String>,
}

/// The importer's attainment passed through: a course-unit attainment has no assessment item or
/// realisation, and a missing grade leaves `passed` out.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingAttainment {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
    pub state: String,
    pub person_id: String,
    pub course_unit_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assessment_item_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course_unit_realisation_id: Option<String>,
    /// [`sisu_midnight`], as the importer hands dates through.
    pub attainment_date: String,
    pub registration_date: String,
    pub grade_scale_id: String,
    pub grade_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passed: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentResolutionResult {
    pub enrolments: Vec<Enrolment>,
    pub existing_attainments: Vec<ExistingAttainment>,
}

/// The seven fields `duplicateAttainment` and `notImprovedAttainment` report.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttainmentSummary {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
    pub state: String,
    /// [`sisu_midnight`], as the importer hands dates through.
    pub attainment_date: String,
    pub registration_date: String,
    pub grade_scale_id: String,
    pub grade_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmittedAttainment {
    pub submitted_attainment_id: String,
    pub submitted_attainment_type: String,
}

impl SubmittedAttainment {
    pub fn new(submitted_attainment_id: &str) -> Self {
        Self {
            submitted_attainment_id: submitted_attainment_id.to_string(),
            submitted_attainment_type: ASSESSMENT_ITEM_ATTAINMENT.to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateAttainmentResult {
    pub attainment: AttainmentSummary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotImprovedAttainmentResult {
    pub previous_attainment: AttainmentSummary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttainmentReference {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredResult {
    pub attainment: AttainmentReference,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmissionPendingResult {
    pub submitted_attainment_id: String,
    pub submitted_attainment_type: String,
    pub retry_after: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedEnrolment {
    pub id: String,
    pub course_unit_realisation_id: String,
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enrolment_date_time: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedPerson {
    pub student_number: String,
    pub person_id: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub primary_email: Option<String>,
    pub secondary_email: Option<String>,
    pub enrolment: ListedEnrolment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentsListedResult {
    pub people: Vec<ListedPerson>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseAllowedResult {
    pub course_code: String,
    pub name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ItemStatus {
    Ok,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItemError {
    pub message: String,
}

/// A request's items are all one endpoint's shape, but the pipeline also carries fault-shaped items
/// and logs them, so the result is erased to JSON as soon as the logic has built it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseItem {
    pub request_item_id: String,
    pub status: ItemStatus,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ItemError>,
    /// On an error item only for the codes that hand back the submission they concern.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
}

impl ResponseItem {
    pub fn ok<R: Serialize>(request_item_id: &str, code: &str, result: R) -> Self {
        Self {
            request_item_id: request_item_id.to_string(),
            status: ItemStatus::Ok,
            code: code.to_string(),
            error: None,
            result: None,
        }
        .with_result(result)
    }

    /// With the code's canonical wording, which depends on the endpoint for `enrolmentNotFound`.
    pub fn error(endpoint: Endpoint, request_item_id: &str, code: &str) -> Self {
        Self::error_with_message(
            request_item_id,
            code,
            canonical_message(Some(endpoint), code),
        )
    }

    pub fn error_with_message(request_item_id: &str, code: &str, message: String) -> Self {
        Self {
            request_item_id: request_item_id.to_string(),
            status: ItemStatus::Error,
            code: code.to_string(),
            error: Some(ItemError { message }),
            result: None,
        }
    }

    pub fn with_result<R: Serialize>(mut self, result: R) -> Self {
        self.result = Some(serde_json::to_value(result).unwrap_or(serde_json::Value::Null));
        self
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
    pub fn new(code: &str) -> Self {
        Self::with_message(code, canonical_message(None, code))
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

/// Suotar's fixed wording per code, `endpoint` being `None` for a request-level one. Codes whose real
/// message names the item fall back to a generic sentence here, for a fault that names the code
/// without a message.
fn canonical_message(endpoint: Option<Endpoint>, code: &str) -> String {
    match code {
        "requestTooLarge" => "Request body is too large.",
        "unauthorized" => "Missing or invalid credentials.",
        "internalError" => "Suotar failed to process the request.",
        "serviceTemporarilyUnavailable" => "Failed to fetch Sisu data.",
        "malformedRequest" => NOT_AN_ARRAY,
        "personNotFound" => "No Sisu person was found for the supplied student number.",
        "courseCodeNotFound" => "Course code could not be resolved in Sisu.",
        "enrolmentNotFound" if endpoint == Some(Endpoint::ImportAttainments) => {
            "No ENROLLED Sisu enrolment was found for this student and course code."
        }
        "enrolmentNotFound" => "No Sisu enrolment was found for this person and course.",
        "enrolmentNotAccepted" => "The Sisu enrolment has not been accepted.",
        "duplicateRequestItem" => {
            "An earlier request item in this batch is the same completion, and it was registered once. Verify the attainment in `result` rather than submitting this completion again."
        }
        "invalidGradeForGradeScale" => {
            "Grade id is not valid for the resolved enrolment's grade scale."
        }
        "studyRightNotValid" => "Study right cannot support the attainment.",
        "sisuTimeout" => "Sisu operation timed out; outcome is uncertain.",
        "notRegistered" => {
            "No final or partial Sisu registration evidence was found for the submitted attainment id."
        }
        "submissionPending" => {
            "This attainment was submitted too recently for Sisu to have shown it to Suotar yet. Keep polling; do not resubmit before retryAfter."
        }
        "misregistered" => {
            "A previously registered attainment has been marked misregistered in Sisu."
        }
        "courseNotAllowed" => COURSE_NOT_CARRIED,
        "sisuValidationFailed" => "Sisu rejected the attainment.",
        _ => "Suotar returned an unspecified outcome.",
    }
    .to_string()
}

pub const COURSE_NOT_CARRIED: &str = "Suotar does not carry this course code.";

pub const NOT_AN_ARRAY: &str = "Request body must be a JSON array of request items.";

/// JavaScript's `toISOString()`: UTC with exactly three fractional digits.
pub fn iso_millis(time: DateTime<Utc>) -> String {
    time.to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// A date the way the importer passes Sisu's through: an instant at UTC midnight.
pub fn sisu_midnight(date: NaiveDate) -> String {
    format!("{date}T00:00:00.000Z")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_per_item_error_serializes_to_the_documented_shape() {
        let item = ResponseItem::error(Endpoint::ResolvePersons, "b2", "personNotFound");
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
