//! Client for Suotar, the University of Helsinki study registry.
//!
//! Every endpoint is a batch. Per-item outcomes arrive as HTTP 200 and are read from each item's
//! `status` and `code`; only request-level failures are 4xx/5xx and `Err`. Items are matched back
//! by `requestItemId`, never by position.

use std::collections::HashSet;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use async_trait::async_trait;
use chrono::NaiveDate;
use headless_lms_base::config::{MOCK_SUOTAR_TOKEN, SUOTAR_AUTH_SCHEME, SuotarConfiguration};
use once_cell::sync::Lazy;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use secrecy::{ExposeSecret, SecretString};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer};
use utoipa::ToSchema;

use crate::{
    error::util_error::SuotarErrorVariant, helsinki_time::helsinki_date, prelude::*,
    secret_string::serialize_exposed,
};

/// Under the ingress's 60 s, so an admin waiting on a call gets our answer rather than a 504.
pub const INTERACTIVE_REQUEST_TIMEOUT: Duration = Duration::from_secs(50);

/// Separate from `REQWEST_CLIENT` for the keepalive: an import can sit silent on its socket for up
/// to an hour, which NAT and proxies otherwise drop without telling either end.
static SUOTAR_HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    crate::http::base_client_builder()
        .tcp_keepalive(Duration::from_secs(30))
        .build()
        .expect("Failed to build the Suotar client")
});

/// Carries `suotar_api_calls.id` so Suotar's log and ours join on one value.
pub const CORRELATION_ID_HEADER: &str = "X-Correlation-Id";

/// Suotar's own body limit (Express `5mb`), so an oversized batch is refused here rather than 413'd
/// at the far end.
pub const MAX_REQUEST_BODY_BYTES: usize = 5 * 1024 * 1024;

/// The final attainment type in Sisu; verify's `registered` with any other type is partial evidence.
pub const ATTAINMENT_TYPE_COURSE_UNIT: &str = "CourseUnitAttainment";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "suotar_endpoint", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SuotarEndpoint {
    ResolvePersons,
    ResolveEnrolments,
    ImportAttainments,
    VerifyAttainments,
    ListByCourse,
    ValidateCourseCodes,
}

impl SuotarEndpoint {
    /// Relative to the configured base url, which ends in `/`.
    pub fn path(self) -> &'static str {
        match self {
            Self::ResolvePersons => "persons/resolve-by-student-numbers",
            Self::ResolveEnrolments => "enrolments/resolve",
            Self::ImportAttainments => "attainments/import",
            Self::VerifyAttainments => "attainments/verify",
            Self::ListByCourse => "enrolments/list-by-course",
            Self::ValidateCourseCodes => "course-codes/validate",
        }
    }

    /// Suotar's own per-endpoint limits; a larger batch is refused whole.
    pub fn max_batch_size(self) -> usize {
        match self {
            Self::ResolvePersons
            | Self::ResolveEnrolments
            | Self::VerifyAttainments
            | Self::ValidateCourseCodes => 1000,
            Self::ImportAttainments => 100,
            Self::ListByCourse => 50,
        }
    }

    /// How long one worker call may take before it is abandoned. On `import` an abandoned call
    /// leaves the whole batch uncertain, so it is sized above Suotar's worst case for a full batch;
    /// the read-only endpoints sit below theirs, as a timeout there costs only a retry.
    pub const fn request_timeout(self) -> Duration {
        let minutes = match self {
            Self::ImportAttainments => 60,
            Self::VerifyAttainments => 25,
            Self::ResolveEnrolments | Self::ListByCourse => 20,
            Self::ResolvePersons | Self::ValidateCourseCodes => 10,
        };
        Duration::from_secs(minutes * 60)
    }

    /// An item this endpoint never answered is uncertain, not retryable: re-sending it can put a
    /// second attainment on a real transcript.
    pub fn creates_attainments(self) -> bool {
        matches!(self, Self::ImportAttainments)
    }
}

/// A fresh requestItemId for one item of one call.
pub fn new_request_item_id() -> String {
    Uuid::new_v4().to_string()
}

/// Suotar echoes the requestItemId back, which is what makes a reordered or partial response safe to
/// read.
pub trait SuotarRequestItem: Serialize {
    fn request_item_id(&self) -> &str;
    /// Gives the item a fresh requestItemId, for sending it again in another call.
    fn renew_request_item_id(&mut self);
}

macro_rules! request_item {
    ($name:ident) => {
        impl SuotarRequestItem for $name {
            fn request_item_id(&self) -> &str {
                &self.request_item_id
            }

            fn renew_request_item_id(&mut self) {
                self.request_item_id = new_request_item_id();
            }
        }
    };
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvePersonRequestItem {
    pub request_item_id: String,
    #[serde(serialize_with = "serialize_exposed")]
    pub student_number: SecretString,
}
request_item!(ResolvePersonRequestItem);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveEnrolmentRequestItem {
    pub request_item_id: String,
    #[serde(serialize_with = "serialize_exposed")]
    pub student_number: SecretString,
    pub course_code: String,
}
request_item!(ResolveEnrolmentRequestItem);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAttainmentRequestItem {
    pub request_item_id: String,
    #[serde(serialize_with = "serialize_exposed")]
    pub student_number: SecretString,
    pub course_code: String,
    pub enrolment_id: String,
    pub attainment_date: NaiveDate,
    pub attainment_language: String,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub credits: f64,
}
request_item!(ImportAttainmentRequestItem);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyAttainmentRequestItem {
    pub request_item_id: String,
    pub submitted_attainment_id: String,
}
request_item!(VerifyAttainmentRequestItem);

/// Lists every realisation of the code; Suotar refuses the whole request if an item names one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListByCourseRequestItem {
    pub request_item_id: String,
    pub course_code: String,
}
request_item!(ListByCourseRequestItem);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateCourseCodeRequestItem {
    pub request_item_id: String,
    pub course_code: String,
}
request_item!(ValidateCourseCodeRequestItem);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalizedName {
    pub fi: Option<String>,
    pub sv: Option<String>,
    pub en: Option<String>,
}

/// Sisu's date range, either end of which may be open.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatePeriod {
    #[serde(default, deserialize_with = "lenient_date")]
    pub start_date: Option<NaiveDate>,
    #[serde(default, deserialize_with = "lenient_date")]
    pub end_date: Option<NaiveDate>,
}

impl DatePeriod {
    /// An open end contains every date on that side.
    pub fn contains(&self, date: NaiveDate) -> bool {
        self.start_date.is_none_or(|start| start <= date)
            && self.end_date.is_none_or(|end| date <= end)
    }
}

/// Sisu's credit range. Suotar refuses an import against one missing either bound.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditRange {
    #[serde(default, deserialize_with = "lenient")]
    pub min: Option<f64>,
    #[serde(default, deserialize_with = "lenient")]
    pub max: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonResult {
    pub student_number: SecretString,
    pub person_id: SecretString,
    /// `None` when Sisu holds no name.
    pub first_names: Option<SecretString>,
    pub last_name: Option<SecretString>,
}

/// An enrolment as Suotar passes it through from its importer. Only the id is required: a field
/// that is missing or unreadable reads as absent rather than dropping the enrolment.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuotarEnrolment {
    pub id: String,
    #[serde(default, deserialize_with = "lenient")]
    pub state: Option<String>,
    #[serde(default, deserialize_with = "lenient")]
    pub kind: Option<String>,
    #[serde(default, deserialize_with = "lenient")]
    pub course_unit_realisation_id: Option<String>,
    #[serde(default, deserialize_with = "lenient")]
    pub course_unit_realisation_name: Option<LocalizedName>,
    #[serde(default, deserialize_with = "lenient")]
    pub activity_period: Option<DatePeriod>,
    /// The assessment item's scale, else the course unit's.
    #[serde(default, deserialize_with = "lenient")]
    pub grade_scale_id: Option<String>,
    /// The course unit's range; `None` when Sisu gives none, which Suotar refuses to import against.
    #[serde(default, deserialize_with = "lenient")]
    pub credits: Option<CreditRange>,
    /// `None` when Suotar could not resolve the study right, which is no proof it is invalid.
    #[serde(default, deserialize_with = "lenient")]
    pub study_right_validity_period: Option<DatePeriod>,
    #[serde(default, deserialize_with = "lenient_instant")]
    pub enrolment_date_time: Option<DateTime<Utc>>,
}

/// An attainment as Suotar passes it through from its importer, so every field but the id and type
/// may be missing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingAttainment {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
    pub state: Option<String>,
    #[serde(default, deserialize_with = "lenient_date")]
    pub attainment_date: Option<NaiveDate>,
    #[serde(default, deserialize_with = "lenient_date")]
    pub registration_date: Option<NaiveDate>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
}

/// An enrolment or attainment that cannot be read drops out alone rather than taking the item with it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentResolutionResult {
    #[serde(deserialize_with = "readable_elements")]
    pub enrolments: Vec<SuotarEnrolment>,
    #[serde(default, deserialize_with = "readable_elements")]
    pub existing_attainments: Vec<ExistingAttainment>,
}

/// Covers both contract bodies: the bare `{id, type}` of verify's `registered` and the fuller one
/// behind import's `duplicateAttainment` and `notImprovedAttainment`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuotarAttainment {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(
        default,
        deserialize_with = "lenient_date",
        skip_serializing_if = "Option::is_none"
    )]
    pub attainment_date: Option<NaiveDate>,
    #[serde(
        default,
        deserialize_with = "lenient_date",
        skip_serializing_if = "Option::is_none"
    )]
    pub registration_date: Option<NaiveDate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grade_scale_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grade_id: Option<String>,
}

/// One shape for every import result: `sent`, `sisuTimeout` and `duplicateRequestItem` fill the
/// submitted pair, `duplicateAttainment` fills `attainment`, `notImprovedAttainment` fills
/// `previous_attainment`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAttainmentResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submitted_attainment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submitted_attainment_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attainment: Option<SuotarAttainment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_attainment: Option<SuotarAttainment>,
}

/// `registered` fills `attainment`; `submissionPending` fills the submitted pair and `retry_after`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyAttainmentResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attainment: Option<SuotarAttainment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submitted_attainment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submitted_attainment_type: Option<String>,
    /// Before this, a resubmission may still duplicate the pending attainment.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateCourseCodeResult {
    pub course_code: String,
    /// Suotar's own name for the course.
    pub name: Option<String>,
}

/// Passed through from Suotar's importer like [`SuotarEnrolment`], so every field may be absent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedEnrolment {
    #[serde(default, deserialize_with = "lenient")]
    pub id: Option<String>,
    #[serde(default, deserialize_with = "lenient")]
    pub course_unit_realisation_id: Option<String>,
    #[serde(default, deserialize_with = "lenient")]
    pub state: Option<String>,
    #[serde(default, deserialize_with = "lenient_instant")]
    pub enrolment_date_time: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedPerson {
    pub student_number: SecretString,
    pub person_id: SecretString,
    pub first_names: Option<SecretString>,
    pub last_name: Option<SecretString>,
    pub primary_email: Option<SecretString>,
    pub secondary_email: Option<SecretString>,
    #[serde(default, deserialize_with = "lenient")]
    pub enrolment: Option<ListedEnrolment>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentsListedResult {
    /// A person the importer handed over without a student number or person id drops out alone.
    #[serde(deserialize_with = "readable_elements")]
    pub people: Vec<ListedPerson>,
}

/// Importer dates arrive as `YYYY-MM-DD` or as an instant (Sisu's UTC midnight), and an instant
/// means its Helsinki date, the zone Suotar compares days in. Anything else reads as absent.
fn lenient_date<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<NaiveDate>, D::Error> {
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(value
        .as_ref()
        .and_then(serde_json::Value::as_str)
        .and_then(|text| {
            NaiveDate::parse_from_str(text, "%Y-%m-%d")
                .ok()
                .or_else(|| {
                    DateTime::parse_from_rfc3339(text)
                        .ok()
                        .map(|instant| helsinki_date(instant.with_timezone(&Utc)))
                })
        }))
}

/// A value that does not read as `T` reads as absent.
fn lenient<'de, D: Deserializer<'de>, T: DeserializeOwned>(
    deserializer: D,
) -> Result<Option<T>, D::Error> {
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(value.and_then(|value| serde_json::from_value(value).ok()))
}

/// An RFC 3339 instant, or Sisu's zoneless local date-time read as UTC, which is close enough to
/// order enrolments by. Anything else reads as absent.
fn lenient_instant<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<DateTime<Utc>>, D::Error> {
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(value
        .as_ref()
        .and_then(serde_json::Value::as_str)
        .and_then(|text| {
            DateTime::parse_from_rfc3339(text)
                .map(|instant| instant.with_timezone(&Utc))
                .ok()
                .or_else(|| {
                    chrono::NaiveDateTime::parse_from_str(text, "%Y-%m-%dT%H:%M:%S%.f")
                        .ok()
                        .map(|local| local.and_utc())
                })
        }))
}

/// Keeps the elements that parse and logs how many did not.
fn readable_elements<'de, D, T>(deserializer: D) -> Result<Vec<T>, D::Error>
where
    D: Deserializer<'de>,
    T: DeserializeOwned,
{
    let values = Vec::<serde_json::Value>::deserialize(deserializer)?;
    let total = values.len();
    let readable: Vec<T> = values
        .into_iter()
        .filter_map(|value| serde_json::from_value(value).ok())
        .collect();
    if readable.len() < total {
        warn!(
            "Suotar answered with {} of {total} list elements that could not be read; skipping them.",
            total - readable.len()
        );
    }
    Ok(readable)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SuotarItemStatus {
    Ok,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuotarItemError {
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuotarResponseItem<R> {
    pub request_item_id: String,
    pub status: SuotarItemStatus,
    /// A string, not an enum: Suotar may add codes, and a strict enum would take the pipeline down
    /// the day it does.
    pub code: String,
    /// Also present on the error items that carry one: `sisuTimeout`, `duplicateRequestItem` and
    /// `submissionPending`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<R>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<SuotarItemError>,
}

#[derive(Debug)]
pub struct SuotarBatchResponse<R> {
    pub endpoint: SuotarEndpoint,
    pub items: Vec<SuotarResponseItem<R>>,
    /// Sent, but answered by nothing. Unknown outcome on [`SuotarEndpoint::creates_attainments`].
    pub missing_request_item_ids: Vec<String>,
    /// Answered, but never sent. Logged and otherwise ignored.
    pub unexpected_request_item_ids: Vec<String>,
    /// Zero when the batch was empty and no call was made.
    pub http_status: u16,
    pub duration: Duration,
    /// `suotar_api_calls.id`, absent only when the audit write itself failed.
    pub call_id: Option<Uuid>,
    /// Unscrubbed; scrub before persisting any part of it. Shared with the audit record rather than
    /// copied, since `list-by-course` bodies are the largest the pipeline handles.
    pub raw_response: Arc<serde_json::Value>,
}

impl<R> SuotarBatchResponse<R> {
    pub fn item(&self, request_item_id: &str) -> Option<&SuotarResponseItem<R>> {
        self.items
            .iter()
            .find(|item| item.request_item_id == request_item_id)
    }
}

/// Both fields are audit-row columns: `worker_name` separates the submitter from the verify poller
/// from a manual retry, and the ids replace the identifiers scrubbing removes from stored bodies.
#[derive(Debug, Clone, Default)]
pub struct SuotarCallContext {
    pub worker_name: String,
    pub credit_registration_ids: Vec<Uuid>,
    /// Replaces [`SuotarEndpoint::request_timeout`] when set.
    pub request_timeout: Option<Duration>,
}

impl SuotarCallContext {
    pub fn new(worker_name: impl Into<String>) -> Self {
        Self {
            worker_name: worker_name.into(),
            credit_registration_ids: Vec::new(),
            request_timeout: None,
        }
    }

    /// For a call someone is waiting on in the browser.
    pub fn interactive(mut self) -> Self {
        self.request_timeout = Some(INTERACTIVE_REQUEST_TIMEOUT);
        self
    }

    pub fn for_registrations(mut self, ids: Vec<Uuid>) -> Self {
        self.credit_registration_ids = ids;
        self
    }
}

#[derive(Debug, Clone)]
pub struct SuotarCallStarted {
    pub endpoint: SuotarEndpoint,
    pub request_item_count: usize,
    pub worker_name: String,
    pub credit_registration_ids: Vec<Uuid>,
    pub request_item_ids: Vec<String>,
    pub started_at: DateTime<Utc>,
    /// Unscrubbed; the implementation scrubs before it persists anything.
    pub request_body: serde_json::Value,
}

#[derive(Debug, Clone, Default)]
pub struct SuotarCallFinished {
    pub http_status: Option<u16>,
    pub duration: Duration,
    pub succeeded: bool,
    pub ok_item_count: usize,
    pub error_item_count: usize,
    pub request_level_error_code: Option<String>,
    pub error_message: Option<String>,
    /// Unscrubbed; the implementation scrubs before it persists anything.
    pub response_body: Option<Arc<serde_json::Value>>,
}

/// Persists one `suotar_api_calls` row per call. A trait because the table is in the models crate,
/// which depends on this one. Implementations must scrub the bodies.
#[async_trait]
pub trait SuotarCallAudit: Send + Sync {
    /// Returns the row id, which travels out as [`CORRELATION_ID_HEADER`]. `None` means the row
    /// could not be written; the call goes out anyway.
    async fn started(&self, started: SuotarCallStarted) -> Option<Uuid>;

    async fn finished(&self, call_id: Uuid, finished: SuotarCallFinished);
}

pub struct NoSuotarCallAudit;

#[async_trait]
impl SuotarCallAudit for NoSuotarCallAudit {
    async fn started(&self, _started: SuotarCallStarted) -> Option<Uuid> {
        None
    }

    async fn finished(&self, _call_id: Uuid, _finished: SuotarCallFinished) {}
}

/// Suotar matches the `Bearer ` prefix exactly: case-sensitive, one space.
fn authorization_header_value(token: &str) -> String {
    format!("{SUOTAR_AUTH_SCHEME} {token}")
}

#[derive(Clone)]
pub struct SuotarClient {
    api_base_url: Url,
    authorization: SecretString,
    audit: Arc<dyn SuotarCallAudit>,
    /// Requests that actually left for the study registry, shared by every clone of the client
    /// except those made by [`SuotarClient::with_own_exchange_count`]. A pre-flight refusal is not
    /// counted because it never reached the registry.
    exchanges: Arc<AtomicU64>,
}

impl SuotarClient {
    pub fn new(config: &SuotarConfiguration, audit: Arc<dyn SuotarCallAudit>) -> Self {
        Self {
            api_base_url: config.api_base_url.clone(),
            authorization: SecretString::new(
                authorization_header_value(config.api_token.expose_secret()).into(),
            ),
            audit,
            exchanges: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn mock_for_test() -> Self {
        Self {
            api_base_url: Url::parse("http://project-331.local/api/v0/mock-suotar/")
                .expect("hardcoded url"),
            authorization: SecretString::new(authorization_header_value(MOCK_SUOTAR_TOKEN).into()),
            audit: Arc::new(NoSuotarCallAudit),
            exchanges: Arc::new(AtomicU64::new(0)),
        }
    }

    /// A clone whose [`SuotarClient::exchange_count`] starts from zero and counts only its own
    /// requests, so work running beside it cannot pass for its own.
    pub fn with_own_exchange_count(&self) -> Self {
        Self {
            exchanges: Arc::new(AtomicU64::new(0)),
            ..self.clone()
        }
    }

    /// How many requests this client and the clones sharing its count have sent.
    pub fn exchange_count(&self) -> u64 {
        self.exchanges.load(Ordering::Relaxed)
    }

    pub async fn resolve_persons(
        &self,
        context: SuotarCallContext,
        items: Vec<ResolvePersonRequestItem>,
    ) -> UtilResult<SuotarBatchResponse<PersonResult>> {
        self.post_batch(SuotarEndpoint::ResolvePersons, context, items)
            .await
    }

    pub async fn resolve_enrolments(
        &self,
        context: SuotarCallContext,
        items: Vec<ResolveEnrolmentRequestItem>,
    ) -> UtilResult<SuotarBatchResponse<EnrolmentResolutionResult>> {
        self.post_batch(SuotarEndpoint::ResolveEnrolments, context, items)
            .await
    }

    pub async fn import_attainments(
        &self,
        context: SuotarCallContext,
        items: Vec<ImportAttainmentRequestItem>,
    ) -> UtilResult<SuotarBatchResponse<ImportAttainmentResult>> {
        self.post_batch(SuotarEndpoint::ImportAttainments, context, items)
            .await
    }

    pub async fn verify_attainments(
        &self,
        context: SuotarCallContext,
        items: Vec<VerifyAttainmentRequestItem>,
    ) -> UtilResult<SuotarBatchResponse<VerifyAttainmentResult>> {
        self.post_batch(SuotarEndpoint::VerifyAttainments, context, items)
            .await
    }

    pub async fn list_enrolments_by_course(
        &self,
        context: SuotarCallContext,
        items: Vec<ListByCourseRequestItem>,
    ) -> UtilResult<SuotarBatchResponse<EnrolmentsListedResult>> {
        self.post_batch(SuotarEndpoint::ListByCourse, context, items)
            .await
    }

    pub async fn validate_course_codes(
        &self,
        context: SuotarCallContext,
        items: Vec<ValidateCourseCodeRequestItem>,
    ) -> UtilResult<SuotarBatchResponse<ValidateCourseCodeResult>> {
        self.post_batch(SuotarEndpoint::ValidateCourseCodes, context, items)
            .await
    }

    async fn post_batch<T: SuotarRequestItem, R: DeserializeOwned>(
        &self,
        endpoint: SuotarEndpoint,
        context: SuotarCallContext,
        items: Vec<T>,
    ) -> UtilResult<SuotarBatchResponse<R>> {
        if items.is_empty() {
            return Ok(empty_batch_response(endpoint));
        }
        // Serialized once: the audited body and the wire body must be byte-for-byte the same.
        let request_body = serde_json::to_value(&items)?;
        let encoded = serde_json::to_vec(&request_body)?;
        // Before the pre-flight checks, so a refused batch still leaves an audit row to diagnose.
        let call_id = self
            .audit
            .started(SuotarCallStarted {
                endpoint,
                request_item_count: items.len(),
                worker_name: context.worker_name,
                credit_registration_ids: context.credit_registration_ids,
                request_item_ids: items
                    .iter()
                    .map(|item| item.request_item_id().to_string())
                    .collect(),
                started_at: Utc::now(),
                request_body,
            })
            .await;
        if call_id.is_none() {
            error!(
                "Could not write a suotar_api_calls row for a {} call; sending it unaudited.",
                endpoint.path()
            );
        }

        let sent_ids = match check_batch(endpoint, &items) {
            Ok(sent_ids) => sent_ids,
            Err(error) => return self.refused(call_id, error).await,
        };
        if encoded.len() > MAX_REQUEST_BODY_BYTES {
            return self
                .refused(
                    call_id,
                    util_err!(
                        SuotarClientError(SuotarErrorVariant::MalformedRequest),
                        format!(
                            "A {} request of {} items encodes to {} bytes, over the {MAX_REQUEST_BODY_BYTES} byte limit.",
                            endpoint.path(),
                            sent_ids.len(),
                            encoded.len()
                        )
                    ),
                )
                .await;
        }

        let url = self.api_base_url.join(endpoint.path())?;
        let clock = Instant::now();
        let mut request = SUOTAR_HTTP_CLIENT
            .post(url)
            .timeout(
                context
                    .request_timeout
                    .unwrap_or_else(|| endpoint.request_timeout()),
            )
            .header(AUTHORIZATION, self.authorization.expose_secret())
            .header(CONTENT_TYPE, "application/json");
        if let Some(call_id) = call_id {
            request = request.header(CORRELATION_ID_HEADER, call_id.to_string());
        }

        self.exchanges.fetch_add(1, Ordering::Relaxed);
        let (mut outcome, finished) = self
            .exchange(endpoint, request, encoded, sent_ids, clock)
            .await;
        if let Ok(response) = &mut outcome {
            response.call_id = call_id;
        }
        if let Some(call_id) = call_id {
            self.audit.finished(call_id, finished).await;
        }
        outcome
    }

    /// Records a pre-flight refusal as the `suotar_api_calls` row any other failure would leave.
    async fn refused<R>(
        &self,
        call_id: Option<Uuid>,
        error: UtilError,
    ) -> UtilResult<SuotarBatchResponse<R>> {
        if let Some(call_id) = call_id {
            self.audit
                .finished(
                    call_id,
                    SuotarCallFinished {
                        error_message: Some(error.message().to_string()),
                        ..SuotarCallFinished::default()
                    },
                )
                .await;
        }
        Err(error)
    }

    /// Returns the audit record alongside the result: only this function knows the status, the
    /// duration and the request-level code, and the row needs all three.
    async fn exchange<R: DeserializeOwned>(
        &self,
        endpoint: SuotarEndpoint,
        request: reqwest::RequestBuilder,
        body: Vec<u8>,
        sent_ids: Vec<String>,
        clock: Instant,
    ) -> Exchanged<R> {
        let response = match request.body(body).send().await {
            Ok(response) => response,
            Err(error) => {
                return failed(
                    util_err!(
                        SuotarClientError(transport_variant(&error)),
                        format!("Request to Suotar {} failed", endpoint.path()),
                        error
                    ),
                    None,
                    clock.elapsed(),
                    None,
                    None,
                );
            }
        };

        let http_status = response.status().as_u16();
        let text = match response.text().await {
            Ok(text) => text,
            Err(error) => {
                return failed(
                    util_err!(
                        SuotarClientError(transport_variant(&error)),
                        format!(
                            "Reading the Suotar {} response body failed",
                            endpoint.path()
                        ),
                        error
                    ),
                    Some(http_status),
                    clock.elapsed(),
                    None,
                    None,
                );
            }
        };
        let duration = clock.elapsed();

        if !(200..300).contains(&http_status) {
            let detail = serde_json::from_str::<RequestLevelErrorBody>(&text)
                .ok()
                .map(|parsed| parsed.error);
            let code = detail
                .as_ref()
                .and_then(RequestLevelErrorDetail::code)
                .map(str::to_string);
            let error = request_level_error(endpoint, http_status, detail.as_ref());
            return failed(
                error,
                Some(http_status),
                duration,
                code,
                Some(Arc::new(body_for_audit(&text))),
            );
        }

        let raw_response: Arc<serde_json::Value> = match serde_json::from_str(&text) {
            Ok(value) => Arc::new(value),
            Err(error) => {
                return failed(
                    util_err!(
                        SuotarClientError(SuotarErrorVariant::Deserialization),
                        format!(
                            "Suotar {} answered {http_status} with a body that is not JSON",
                            endpoint.path()
                        ),
                        error
                    ),
                    Some(http_status),
                    duration,
                    None,
                    Some(Arc::new(body_for_audit(&text))),
                );
            }
        };
        let Some(array) = raw_response.as_array() else {
            return failed(
                util_err!(
                    SuotarClientError(SuotarErrorVariant::Deserialization),
                    format!(
                        "Suotar {} answered {http_status} with a body that is not a batch response",
                        endpoint.path()
                    )
                ),
                Some(http_status),
                duration,
                None,
                Some(raw_response),
            );
        };
        // Item by item, so one malformed entry costs only its own row: parsing the array as a whole
        // would park every other row of the batch as unanswered too. `reconcile` then reports the
        // dropped ids as missing, which is what an item we cannot read amounts to.
        let items: Vec<SuotarResponseItem<R>> = array
            .iter()
            .filter_map(|item| match SuotarResponseItem::<R>::deserialize(item) {
                Ok(parsed) => Some(parsed),
                // Not the serde message: it quotes the offending value, which may be personal data.
                Err(_) => {
                    error!(
                        "Suotar {} answered with an item that could not be read; treating it as unanswered.",
                        endpoint.path()
                    );
                    None
                }
            })
            .collect();

        let response = reconcile(
            endpoint,
            sent_ids,
            items,
            http_status,
            duration,
            raw_response,
        );
        let finished = SuotarCallFinished {
            http_status: Some(http_status),
            duration,
            succeeded: true,
            ok_item_count: response
                .items
                .iter()
                .filter(|item| item.status == SuotarItemStatus::Ok)
                .count(),
            error_item_count: response
                .items
                .iter()
                .filter(|item| item.status == SuotarItemStatus::Error)
                .count(),
            request_level_error_code: None,
            error_message: None,
            response_body: Some(Arc::clone(&response.raw_response)),
        };
        (Ok(response), finished)
    }
}

type Exchanged<R> = (UtilResult<SuotarBatchResponse<R>>, SuotarCallFinished);

fn failed<R>(
    error: UtilError,
    http_status: Option<u16>,
    duration: Duration,
    request_level_error_code: Option<String>,
    response_body: Option<Arc<serde_json::Value>>,
) -> Exchanged<R> {
    let finished = SuotarCallFinished {
        http_status,
        duration,
        succeeded: false,
        ok_item_count: 0,
        error_item_count: 0,
        request_level_error_code,
        error_message: Some(error.message().to_string()),
        response_body,
    };
    (Err(error), finished)
}

/// A body that is not JSON is still worth keeping; the scrubber takes a bare string too.
fn body_for_audit(text: &str) -> serde_json::Value {
    serde_json::from_str(text).unwrap_or_else(|_| serde_json::Value::String(text.to_string()))
}

/// Refuses our own bugs before a request goes out; both would come back as a request-level error
/// rejecting the whole batch.
fn check_batch<T: SuotarRequestItem>(
    endpoint: SuotarEndpoint,
    items: &[T],
) -> UtilResult<Vec<String>> {
    if items.len() > endpoint.max_batch_size() {
        return Err(util_err!(
            SuotarClientError(SuotarErrorVariant::MalformedRequest),
            format!(
                "A {} request carries {} items, over the batch size of {}.",
                endpoint.path(),
                items.len(),
                endpoint.max_batch_size()
            )
        ));
    }
    let mut seen = HashSet::with_capacity(items.len());
    for item in items {
        if !seen.insert(item.request_item_id()) {
            return Err(util_err!(
                SuotarClientError(SuotarErrorVariant::MalformedRequest),
                format!(
                    "A {} request repeats requestItemId `{}`.",
                    endpoint.path(),
                    item.request_item_id()
                )
            ));
        }
    }
    Ok(items
        .iter()
        .map(|item| item.request_item_id().to_string())
        .collect())
}

/// Nothing to ask, so an empty batch is never sent and leaves no audit row.
fn empty_batch_response<R>(endpoint: SuotarEndpoint) -> SuotarBatchResponse<R> {
    SuotarBatchResponse {
        endpoint,
        items: Vec::new(),
        missing_request_item_ids: Vec::new(),
        unexpected_request_item_ids: Vec::new(),
        http_status: 0,
        duration: Duration::ZERO,
        call_id: None,
        raw_response: Arc::new(serde_json::Value::Array(Vec::new())),
    }
}

/// Pairs the response against what was sent by `requestItemId`; order is not consulted.
fn reconcile<R>(
    endpoint: SuotarEndpoint,
    sent_ids: Vec<String>,
    items: Vec<SuotarResponseItem<R>>,
    http_status: u16,
    duration: Duration,
    raw_response: Arc<serde_json::Value>,
) -> SuotarBatchResponse<R> {
    let sent: HashSet<&str> = sent_ids.iter().map(String::as_str).collect();
    let answered: HashSet<&str> = items
        .iter()
        .map(|item| item.request_item_id.as_str())
        .collect();

    let missing_request_item_ids: Vec<String> = sent_ids
        .iter()
        .filter(|id| !answered.contains(id.as_str()))
        .cloned()
        .collect();
    let unexpected_request_item_ids: Vec<String> = items
        .iter()
        .filter(|item| !sent.contains(item.request_item_id.as_str()))
        .map(|item| item.request_item_id.clone())
        .collect();

    if !unexpected_request_item_ids.is_empty() {
        warn!(
            "Suotar {} answered with {} requestItemIds that were not sent; ignoring them.",
            endpoint.path(),
            unexpected_request_item_ids.len()
        );
    }
    if !missing_request_item_ids.is_empty() && endpoint.creates_attainments() {
        error!(
            "Suotar {} left {} of {} items unanswered. Their attainments may or may not exist and they must not be re-sent.",
            endpoint.path(),
            missing_request_item_ids.len(),
            sent_ids.len()
        );
    }

    SuotarBatchResponse {
        endpoint,
        items,
        missing_request_item_ids,
        unexpected_request_item_ids,
        http_status,
        duration,
        call_id: None,
        raw_response,
    }
}

#[derive(Debug, Deserialize)]
struct RequestLevelErrorBody {
    error: RequestLevelErrorDetail,
}

/// The envelope's `{code, message}`, or the bare string Suotar's fall-through route answers with.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum RequestLevelErrorDetail {
    Coded { code: String, message: String },
    Bare(String),
}

impl RequestLevelErrorDetail {
    fn code(&self) -> Option<&str> {
        match self {
            Self::Coded { code, .. } => Some(code),
            Self::Bare(_) => None,
        }
    }
}

fn request_level_error(
    endpoint: SuotarEndpoint,
    http_status: u16,
    detail: Option<&RequestLevelErrorDetail>,
) -> UtilError {
    let path = endpoint.path();
    // A path the moocfi router does not serve falls through to a route that refuses our key; the
    // key is fine and the base url is wrong.
    if let Some(RequestLevelErrorDetail::Bare(message)) = detail
        && http_status == 401
    {
        return util_err!(
            SuotarClientError(SuotarErrorVariant::RequestLevelError),
            format!(
                "Suotar answered {path} with 401 `{message}`, which means the moocfi API does not serve that path. Check SUOTAR_API_BASE_URL."
            )
        );
    }
    let variant = match (http_status, detail.and_then(RequestLevelErrorDetail::code)) {
        (401 | 403, _) | (_, Some("unauthorized")) => SuotarErrorVariant::Unauthorized,
        (413, _) | (_, Some("malformedRequest" | "requestTooLarge")) => {
            SuotarErrorVariant::MalformedRequest
        }
        (503, Some("serviceTemporarilyUnavailable")) => {
            SuotarErrorVariant::ServiceTemporarilyUnavailable
        }
        (500..=599, _) => SuotarErrorVariant::ServerError,
        _ => SuotarErrorVariant::RequestLevelError,
    };
    let detail = match detail {
        Some(RequestLevelErrorDetail::Coded { code, message }) => format!("`{code}`: {message}"),
        Some(RequestLevelErrorDetail::Bare(message)) => format!("`{message}`"),
        None => "no documented error body".to_string(),
    };
    util_err!(
        SuotarClientError(variant),
        format!("Suotar {path} rejected the whole request with {http_status}, {detail}")
    )
}

/// `is_connect` is the one case where the request provably never reached Suotar; everything else, a
/// timeout above all, may have been processed.
fn transport_variant(error: &reqwest::Error) -> SuotarErrorVariant {
    if error.is_connect() || error.is_builder() {
        SuotarErrorVariant::TransportNotDelivered
    } else {
        SuotarErrorVariant::TransportUnknown
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn person_items(ids: &[&str]) -> Vec<ResolvePersonRequestItem> {
        ids.iter()
            .map(|id| ResolvePersonRequestItem {
                request_item_id: (*id).to_string(),
                student_number: "012345678".into(),
            })
            .collect()
    }

    fn person_response(ids: &[&str]) -> Vec<SuotarResponseItem<PersonResult>> {
        let items: Vec<serde_json::Value> = ids
            .iter()
            .map(|id| {
                json!({
                    "requestItemId": id,
                    "status": "ok",
                    "code": "personFound",
                    "result": {
                        "studentNumber": "012345678",
                        "personId": "otm-person-id",
                        "firstNames": "Henrik Admin",
                        "lastName": "Nygren",
                    }
                })
            })
            .collect();
        serde_json::from_value(json!(items)).expect("person response")
    }

    fn classified(http_status: u16, body: &str) -> UtilError {
        let detail = serde_json::from_str::<RequestLevelErrorBody>(body)
            .ok()
            .map(|parsed| parsed.error);
        request_level_error(
            SuotarEndpoint::ImportAttainments,
            http_status,
            detail.as_ref(),
        )
    }

    fn reconciled(
        sent: &[&str],
        items: Vec<SuotarResponseItem<PersonResult>>,
    ) -> SuotarBatchResponse<PersonResult> {
        reconcile(
            SuotarEndpoint::ResolvePersons,
            sent.iter().map(|id| (*id).to_string()).collect(),
            items,
            200,
            Duration::ZERO,
            Arc::new(json!([])),
        )
    }

    /// A leading slash on either side would silently drop the base's route prefix and 404 every
    /// call.
    #[test]
    fn every_endpoint_joins_onto_the_configured_base() {
        let client = SuotarClient::mock_for_test();
        let joined: Vec<String> = [
            SuotarEndpoint::ResolvePersons,
            SuotarEndpoint::ResolveEnrolments,
            SuotarEndpoint::ImportAttainments,
            SuotarEndpoint::VerifyAttainments,
            SuotarEndpoint::ListByCourse,
            SuotarEndpoint::ValidateCourseCodes,
        ]
        .iter()
        .map(|endpoint| {
            client
                .api_base_url
                .join(endpoint.path())
                .expect("joins")
                .to_string()
        })
        .collect();
        assert_eq!(
            joined,
            vec![
                "http://project-331.local/api/v0/mock-suotar/persons/resolve-by-student-numbers",
                "http://project-331.local/api/v0/mock-suotar/enrolments/resolve",
                "http://project-331.local/api/v0/mock-suotar/attainments/import",
                "http://project-331.local/api/v0/mock-suotar/attainments/verify",
                "http://project-331.local/api/v0/mock-suotar/enrolments/list-by-course",
                "http://project-331.local/api/v0/mock-suotar/course-codes/validate",
            ]
        );
    }

    #[test]
    fn a_request_batch_serializes_to_the_documented_shape() {
        let items = vec![ImportAttainmentRequestItem {
            request_item_id: "11111111-1111-1111-1111-111111111111".to_string(),
            student_number: "012345678".into(),
            course_code: "TKT10001".to_string(),
            enrolment_id: "selected-enrolment-id".to_string(),
            attainment_date: NaiveDate::from_ymd_opt(2026, 5, 22).expect("valid date"),
            attainment_language: "fi".to_string(),
            grade_scale_id: "sis-hyl-hyv".to_string(),
            grade_id: "1".to_string(),
            credits: 5.0,
        }];
        assert_eq!(
            serde_json::to_value(&items).expect("serializes"),
            json!([{
                "requestItemId": "11111111-1111-1111-1111-111111111111",
                "studentNumber": "012345678",
                "courseCode": "TKT10001",
                "enrolmentId": "selected-enrolment-id",
                "attainmentDate": "2026-05-22",
                "attainmentLanguage": "fi",
                "gradeScaleId": "sis-hyl-hyv",
                "gradeId": "1",
                "credits": 5.0
            }])
        );
    }

    #[test]
    fn an_error_item_deserializes_without_a_result() {
        let items: Vec<SuotarResponseItem<PersonResult>> = serde_json::from_value(json!([{
            "requestItemId": "b2",
            "status": "error",
            "code": "personNotFound",
            "error": { "message": "No Sisu person was found for the supplied student number." }
        }]))
        .expect("error item");
        assert_eq!(items[0].status, SuotarItemStatus::Error);
        assert!(items[0].result.is_none());
        assert_eq!(
            items[0].error.as_ref().map(|error| error.message.as_str()),
            Some("No Sisu person was found for the supplied student number.")
        );
    }

    #[test]
    fn a_sisu_timeout_carries_the_id_the_client_may_verify() {
        let items: Vec<SuotarResponseItem<ImportAttainmentResult>> =
            serde_json::from_value(json!([{
                "requestItemId": "item-1",
                "status": "error",
                "code": "sisuTimeout",
                "error": { "message": "Sisu operation timed out; outcome is uncertain." },
                "result": {
                    "submittedAttainmentId": "hy-kur-1",
                    "submittedAttainmentType": "AssessmentItemAttainment"
                }
            }]))
            .expect("timeout with an id");
        assert_eq!(
            items[0]
                .result
                .as_ref()
                .and_then(|result| result.submitted_attainment_id.as_deref()),
            Some("hy-kur-1")
        );
    }

    #[test]
    fn one_deserializer_covers_every_import_success_body() {
        let items: Vec<SuotarResponseItem<ImportAttainmentResult>> =
            serde_json::from_value(json!([
                {
                    "requestItemId": "item-1",
                    "status": "ok",
                    "code": "sent",
                    "result": {
                        "submittedAttainmentId": "hy-kur-1",
                        "submittedAttainmentType": "AssessmentItemAttainment"
                    }
                },
                {
                    "requestItemId": "item-3",
                    "status": "ok",
                    "code": "duplicateAttainment",
                    "result": { "attainment": {
                        "id": "existing-id",
                        "type": "CourseUnitAttainment",
                        "state": "ATTAINED",
                        "attainmentDate": "2026-05-22T00:00:00.000Z",
                        "registrationDate": "2026-05-22T00:00:00.000Z",
                        "gradeScaleId": "sis-hyl-hyv",
                        "gradeId": "1"
                    } }
                },
                {
                    "requestItemId": "item-4",
                    "status": "ok",
                    "code": "notImprovedAttainment",
                    "result": { "previousAttainment": {
                        "id": "existing-id",
                        "type": "CourseUnitAttainment",
                        "state": "ATTAINED",
                        "gradeScaleId": "sis-0-5",
                        "gradeId": "5",
                        "attainmentDate": "2026-03-01",
                        "registrationDate": "2026-03-05"
                    } }
                }
            ]))
            .expect("import successes");

        let sent = items[0].result.as_ref().expect("sent result");
        assert_eq!(sent.submitted_attainment_id.as_deref(), Some("hy-kur-1"));
        let duplicate = items[1].result.as_ref().expect("duplicate result");
        assert_eq!(
            duplicate
                .attainment
                .as_ref()
                .and_then(|attainment| attainment.grade_id.as_deref()),
            Some("1")
        );
        assert_eq!(
            duplicate
                .attainment
                .as_ref()
                .and_then(|attainment| attainment.attainment_date),
            NaiveDate::from_ymd_opt(2026, 5, 22)
        );
        let not_improved = items[2].result.as_ref().expect("not improved result");
        assert_eq!(
            not_improved
                .previous_attainment
                .as_ref()
                .map(|attainment| attainment.id.as_str()),
            Some("existing-id")
        );
    }

    #[test]
    fn an_unknown_code_does_not_fail_deserialization() {
        let items: Vec<SuotarResponseItem<PersonResult>> = serde_json::from_value(json!([{
            "requestItemId": "a1",
            "status": "error",
            "code": "somethingSuotarAddedLater",
            "error": { "message": "..." }
        }]))
        .expect("unknown code");
        assert_eq!(items[0].code, "somethingSuotarAddedLater");
    }

    #[test]
    fn items_are_matched_by_request_item_id_not_position() {
        let response = reconciled(&["a1", "b2", "c3"], person_response(&["c3", "a1", "b2"]));
        assert!(response.missing_request_item_ids.is_empty());
        assert!(response.unexpected_request_item_ids.is_empty());
        assert_eq!(
            response.item("b2").map(|item| item.code.as_str()),
            Some("personFound")
        );
    }

    #[test]
    fn an_unanswered_item_is_reported_rather_than_paired_with_a_neighbour() {
        let response = reconciled(&["a1", "b2", "c3"], person_response(&["c3", "a1"]));
        assert_eq!(response.missing_request_item_ids, vec!["b2".to_string()]);
        assert!(response.item("b2").is_none());
        assert!(response.item("c3").is_some());
    }

    #[test]
    fn an_item_id_that_was_never_sent_is_reported_and_kept_out_of_the_way() {
        let response = reconciled(&["a1"], person_response(&["a1", "z9"]));
        assert_eq!(response.unexpected_request_item_ids, vec!["z9".to_string()]);
        assert!(response.missing_request_item_ids.is_empty());
    }

    #[test]
    fn a_repeated_request_item_id_is_refused_before_the_request_is_built() {
        let error = check_batch(SuotarEndpoint::ResolvePersons, &person_items(&["a1", "a1"]))
            .expect_err("duplicate ids");
        assert!(error.message().contains("repeats requestItemId `a1`"));
    }

    #[test]
    fn a_batch_over_the_endpoints_size_is_refused_before_the_request_is_built() {
        let items: Vec<ResolvePersonRequestItem> = (0..1001)
            .map(|index| ResolvePersonRequestItem {
                request_item_id: format!("item-{index}"),
                student_number: "012345678".into(),
            })
            .collect();
        for (endpoint, size) in [
            (SuotarEndpoint::ListByCourse, 50),
            (SuotarEndpoint::ImportAttainments, 100),
            (SuotarEndpoint::ResolvePersons, 1000),
            (SuotarEndpoint::VerifyAttainments, 1000),
        ] {
            assert_eq!(endpoint.max_batch_size(), size, "{endpoint:?}");
            assert!(
                check_batch(endpoint, &items[..size]).is_ok(),
                "{endpoint:?}"
            );
            assert!(
                check_batch(endpoint, &items[..size + 1]).is_err(),
                "{endpoint:?}"
            );
        }
    }

    #[test]
    fn the_documented_request_level_bodies_classify() {
        let unauthorized = classified(
            401,
            r#"{"error":{"code":"unauthorized","message":"Missing or invalid credentials."}}"#,
        );
        assert!(matches!(
            unauthorized.error_type(),
            UtilErrorType::SuotarClientError(SuotarErrorVariant::Unauthorized)
        ));

        let malformed = classified(
            400,
            r#"{"error":{"code":"malformedRequest","message":"Request body is not valid JSON or has the wrong top-level shape."}}"#,
        );
        assert!(matches!(
            malformed.error_type(),
            UtilErrorType::SuotarClientError(SuotarErrorVariant::MalformedRequest)
        ));

        let too_large = classified(
            413,
            r#"{"error":{"code":"requestTooLarge","message":"Request body is too large."}}"#,
        );
        assert!(matches!(
            too_large.error_type(),
            UtilErrorType::SuotarClientError(SuotarErrorVariant::MalformedRequest)
        ));

        let unavailable = classified(
            503,
            r#"{"error":{"code":"serviceTemporarilyUnavailable","message":"Failed to fetch Sisu data."}}"#,
        );
        assert!(matches!(
            unavailable.error_type(),
            UtilErrorType::SuotarClientError(SuotarErrorVariant::ServiceTemporarilyUnavailable)
        ));

        let internal = classified(
            500,
            r#"{"error":{"code":"internalError","message":"Suotar failed to process the request."}}"#,
        );
        assert!(matches!(
            internal.error_type(),
            UtilErrorType::SuotarClientError(SuotarErrorVariant::ServerError)
        ));

        let unserved_path = classified(401, r#"{"error":"Unauthorized access"}"#);
        assert!(matches!(
            unserved_path.error_type(),
            UtilErrorType::SuotarClientError(SuotarErrorVariant::RequestLevelError)
        ));
        assert!(unserved_path.message().contains("SUOTAR_API_BASE_URL"));

        let bodyless = classified(502, "<html>");
        assert!(matches!(
            bodyless.error_type(),
            UtilErrorType::SuotarClientError(SuotarErrorVariant::ServerError)
        ));
    }

    #[test]
    fn only_the_failures_that_never_reached_suotar_are_safe_to_resend() {
        assert!(!SuotarErrorVariant::TransportNotDelivered.outcome_may_have_landed());
        assert!(!SuotarErrorVariant::Unauthorized.outcome_may_have_landed());
        assert!(!SuotarErrorVariant::MalformedRequest.outcome_may_have_landed());
        assert!(!SuotarErrorVariant::RequestLevelError.outcome_may_have_landed());
        assert!(!SuotarErrorVariant::ServiceTemporarilyUnavailable.outcome_may_have_landed());
        assert!(SuotarErrorVariant::TransportUnknown.outcome_may_have_landed());
        assert!(SuotarErrorVariant::ServerError.outcome_may_have_landed());
        assert!(SuotarErrorVariant::Deserialization.outcome_may_have_landed());
    }
}
