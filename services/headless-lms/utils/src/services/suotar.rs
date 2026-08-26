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
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use serde::de::DeserializeOwned;

use crate::{error::util_error::SuotarErrorVariant, prelude::*};

/// Bounds one call so a Suotar that never answers cannot stall a worker tick.
pub const SUOTAR_REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// Carries `suotar_api_calls.id` so Suotar's log and ours join on one value.
pub const CORRELATION_ID_HEADER: &str = "X-Correlation-Id";

/// Matches the actix payload limit the mock Suotar runs behind, so an oversized batch is refused
/// here rather than 413'd at the far end.
pub const MAX_REQUEST_BODY_BYTES: usize = 2 * 1024 * 1024;

/// The only code the contract classifies as "transient, retry me".
pub const TRANSIENT_ITEM_CODE: &str = "sisuTemporarilyUnavailable";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SuotarEndpoint {
    ResolvePersons,
    ResolveEnrolments,
    ImportAttainments,
    VerifyAttainments,
    ProductAccessTokens,
    ListByCourse,
}

impl SuotarEndpoint {
    /// Relative to the configured base url, which ends in `/`.
    pub fn path(self) -> &'static str {
        match self {
            Self::ResolvePersons => "persons/resolve-by-student-numbers",
            Self::ResolveEnrolments => "enrolments/resolve",
            Self::ImportAttainments => "attainments/import",
            Self::VerifyAttainments => "attainments/verify",
            Self::ProductAccessTokens => "open-university-product-access-tokens/resolve",
            Self::ListByCourse => "enrolments/list-by-course",
        }
    }

    /// ListByCourse is smallest because each response item carries a full person per enrolment;
    /// ImportAttainments is next because a request-level failure re-queues the whole batch.
    pub fn max_batch_size(self) -> usize {
        match self {
            Self::ResolvePersons | Self::ResolveEnrolments | Self::ProductAccessTokens => 50,
            Self::ImportAttainments => 25,
            Self::VerifyAttainments => 100,
            Self::ListByCourse => 10,
        }
    }

    /// An item this endpoint never answered is uncertain, not retryable: re-sending it can put a
    /// second attainment on a real transcript.
    pub fn creates_attainments(self) -> bool {
        matches!(self, Self::ImportAttainments)
    }

    /// `resolve-enrolments` and `import` carry the transient failure only at the request level.
    pub fn carries_item_level_transient(self) -> bool {
        matches!(
            self,
            Self::ResolvePersons
                | Self::VerifyAttainments
                | Self::ProductAccessTokens
                | Self::ListByCourse
        )
    }
}

/// Sent verbatim from `credit_registrations.request_item_id`; Suotar echoes it back, which is what
/// makes a reordered or partial response safe to read.
pub trait SuotarRequestItem: Serialize {
    fn request_item_id(&self) -> &str;
}

macro_rules! request_item {
    ($name:ident) => {
        impl SuotarRequestItem for $name {
            fn request_item_id(&self) -> &str {
                &self.request_item_id
            }
        }
    };
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvePersonRequestItem {
    pub request_item_id: String,
    pub student_number: String,
}
request_item!(ResolvePersonRequestItem);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveEnrolmentRequestItem {
    pub request_item_id: String,
    pub student_number: String,
    pub course_code: String,
}
request_item!(ResolveEnrolmentRequestItem);

#[derive(Debug, Clone, PartialEq, Serialize)]
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
request_item!(ImportAttainmentRequestItem);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyAttainmentRequestItem {
    pub request_item_id: String,
    pub submitted_attainment_id: String,
}
request_item!(VerifyAttainmentRequestItem);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductAccessTokenRequestItem {
    pub request_item_id: String,
    pub open_university_product_id: String,
}
request_item!(ProductAccessTokenRequestItem);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListByCourseRequestItem {
    pub request_item_id: String,
    pub course_code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course_unit_realisation_id: Option<String>,
}
request_item!(ListByCourseRequestItem);

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
    pub end_date: NaiveDate,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditRange {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonResult {
    pub student_number: String,
    pub person_id: String,
    pub first_names: String,
    pub last_name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuotarEnrolment {
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingAttainment {
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
pub struct EnrolmentResolutionResult {
    pub enrolments: Vec<SuotarEnrolment>,
    #[serde(default)]
    pub existing_attainments: Vec<ExistingAttainment>,
}

/// Covers both contract bodies: the bare `{id, type}` of a `registered` answer and the fuller one
/// behind `duplicateAttainment` and `notImprovedAttainment`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuotarAttainment {
    pub id: String,
    #[serde(rename = "type")]
    pub attainment_type: String,
    pub state: Option<String>,
    pub attainment_date: Option<NaiveDate>,
    pub registration_date: Option<NaiveDate>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
}

/// One shape for import's four success codes: `sent` fills the submitted pair, `registered` and
/// `duplicateAttainment` fill `attainment`, `notImprovedAttainment` fills `previous_attainment`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAttainmentResult {
    pub submitted_attainment_id: Option<String>,
    pub submitted_attainment_type: Option<String>,
    pub attainment: Option<SuotarAttainment>,
    pub previous_attainment: Option<SuotarAttainment>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyAttainmentResult {
    pub attainment: SuotarAttainment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductAccessTokenResult {
    pub id: String,
    pub access_token: String,
    pub state: String,
    pub document_state: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedEnrolment {
    pub id: String,
    pub course_unit_realisation_id: String,
    pub state: String,
    pub enrolment_date_time: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedPerson {
    pub student_number: String,
    pub person_id: String,
    pub first_names: String,
    pub last_name: String,
    pub primary_email: String,
    pub secondary_email: Option<String>,
    pub enrolment: ListedEnrolment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrolmentsListedResult {
    pub people: Vec<ListedPerson>,
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
    /// Present only on a disclosed `sisuTimeout`: the id the client may verify instead of retrying.
    pub submitted_attainment_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuotarResponseItem<R> {
    pub request_item_id: String,
    pub status: SuotarItemStatus,
    /// A string, not an enum: Suotar may add codes, and a strict enum would take the pipeline down
    /// the day it does.
    pub code: String,
    pub result: Option<R>,
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
}

impl SuotarCallContext {
    pub fn new(worker_name: impl Into<String>) -> Self {
        Self {
            worker_name: worker_name.into(),
            credit_registration_ids: Vec::new(),
        }
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

/// Suotar's legacy study-registry path takes the token verbatim after the scheme word, not base64
/// of `user:password`.
fn authorization_header_value(token: &str) -> String {
    format!("{SUOTAR_AUTH_SCHEME} {token}")
}

#[derive(Clone)]
pub struct SuotarClient {
    api_base_url: Url,
    authorization: SecretString,
    audit: Arc<dyn SuotarCallAudit>,
    /// Requests that actually left for the study registry, shared by every clone of the client.
    /// The circuit breaker reads it to tell an iteration that heard from the registry from one that
    /// found nothing to ask about; a pre-flight refusal is not counted because it never reached it.
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

    /// How many requests this client has sent, monotonic for the life of the process. Compare two
    /// readings to learn whether the work between them reached the study registry at all.
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

    pub async fn resolve_product_access_tokens(
        &self,
        context: SuotarCallContext,
        items: Vec<ProductAccessTokenRequestItem>,
    ) -> UtilResult<SuotarBatchResponse<ProductAccessTokenResult>> {
        self.post_batch(SuotarEndpoint::ProductAccessTokens, context, items)
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
        let mut request = REQWEST_CLIENT
            .post(url)
            .timeout(SUOTAR_REQUEST_TIMEOUT)
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
            let code = detail.as_ref().map(|detail| detail.code.clone());
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
                Err(error) => {
                    error!(
                        "Suotar {} answered with an item that could not be read; treating it as unanswered: {error}",
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

/// An empty array is a request-level error at the far end, so an empty batch is never sent and
/// leaves no audit row.
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
    for item in &items {
        if item.code == TRANSIENT_ITEM_CODE && !endpoint.carries_item_level_transient() {
            warn!(
                "Suotar {} returned an item-level `{TRANSIENT_ITEM_CODE}`, which its contract does not list.",
                endpoint.path()
            );
        }
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

#[derive(Debug, Deserialize)]
struct RequestLevelErrorDetail {
    code: String,
    message: String,
}

fn request_level_error(
    endpoint: SuotarEndpoint,
    http_status: u16,
    detail: Option<&RequestLevelErrorDetail>,
) -> UtilError {
    let variant = match (http_status, detail.map(|detail| detail.code.as_str())) {
        (401 | 403, _) => SuotarErrorVariant::Unauthorized,
        (_, Some("unauthorized")) => SuotarErrorVariant::Unauthorized,
        (_, Some("malformedRequest")) => SuotarErrorVariant::MalformedRequest,
        (500..=599, _) => SuotarErrorVariant::ServerError,
        _ => SuotarErrorVariant::RequestLevelError,
    };
    let detail = match detail {
        Some(detail) => format!("`{}`: {}", detail.code, detail.message),
        None => "no documented error body".to_string(),
    };
    let path = endpoint.path();
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
                student_number: "012345678".to_string(),
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
            SuotarEndpoint::ProductAccessTokens,
            SuotarEndpoint::ListByCourse,
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
                "http://project-331.local/api/v0/mock-suotar/open-university-product-access-tokens/resolve",
                "http://project-331.local/api/v0/mock-suotar/enrolments/list-by-course",
            ]
        );
    }

    #[test]
    fn a_request_batch_serializes_to_the_documented_shape() {
        let items = vec![ImportAttainmentRequestItem {
            request_item_id: "cr-11111111-1111-1111-1111-111111111111".to_string(),
            student_number: "012345678".to_string(),
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
                "requestItemId": "cr-11111111-1111-1111-1111-111111111111",
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
    fn list_by_course_omits_an_absent_realisation_id() {
        let items = vec![ListByCourseRequestItem {
            request_item_id: "people-1".to_string(),
            course_code: "TKT10001".to_string(),
            course_unit_realisation_id: None,
        }];
        assert_eq!(
            serde_json::to_value(&items).expect("serializes"),
            json!([{ "requestItemId": "people-1", "courseCode": "TKT10001" }])
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
    fn a_disclosed_sisu_timeout_carries_the_id_the_client_may_verify() {
        let items: Vec<SuotarResponseItem<ImportAttainmentResult>> =
            serde_json::from_value(json!([{
                "requestItemId": "cr-1",
                "status": "error",
                "code": "sisuTimeout",
                "error": {
                    "message": "Sisu operation timed out; outcome is uncertain.",
                    "submittedAttainmentId": "hy-kur-1"
                }
            }]))
            .expect("disclosed timeout");
        assert_eq!(
            items[0]
                .error
                .as_ref()
                .and_then(|error| error.submitted_attainment_id.as_deref()),
            Some("hy-kur-1")
        );
    }

    #[test]
    fn one_deserializer_covers_every_import_success_body() {
        let items: Vec<SuotarResponseItem<ImportAttainmentResult>> =
            serde_json::from_value(json!([
                {
                    "requestItemId": "cr-1",
                    "status": "ok",
                    "code": "sent",
                    "result": {
                        "submittedAttainmentId": "hy-kur-1",
                        "submittedAttainmentType": "AssessmentItemAttainment"
                    }
                },
                {
                    "requestItemId": "cr-2",
                    "status": "ok",
                    "code": "registered",
                    "result": { "attainment": { "id": "final-id", "type": "CourseUnitAttainment" } }
                },
                {
                    "requestItemId": "cr-3",
                    "status": "ok",
                    "code": "duplicateAttainment",
                    "result": { "attainment": {
                        "id": "existing-id",
                        "type": "CourseUnitAttainment",
                        "state": "ATTAINED",
                        "attainmentDate": "2026-05-22",
                        "registrationDate": "2026-05-22",
                        "gradeScaleId": "sis-hyl-hyv",
                        "gradeId": "1"
                    } }
                },
                {
                    "requestItemId": "cr-4",
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
        let registered = items[1].result.as_ref().expect("registered result");
        assert_eq!(
            registered
                .attainment
                .as_ref()
                .map(|attainment| attainment.id.as_str()),
            Some("final-id")
        );
        let duplicate = items[2].result.as_ref().expect("duplicate result");
        assert_eq!(
            duplicate
                .attainment
                .as_ref()
                .and_then(|attainment| attainment.grade_id.as_deref()),
            Some("1")
        );
        let not_improved = items[3].result.as_ref().expect("not improved result");
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
        let items: Vec<ResolvePersonRequestItem> = (0..101)
            .map(|index| ResolvePersonRequestItem {
                request_item_id: format!("cr-{index}"),
                student_number: "012345678".to_string(),
            })
            .collect();
        for (endpoint, size) in [
            (SuotarEndpoint::ListByCourse, 10),
            (SuotarEndpoint::ImportAttainments, 25),
            (SuotarEndpoint::ResolvePersons, 50),
            (SuotarEndpoint::VerifyAttainments, 100),
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

        let server = classified(
            503,
            r#"{"error":{"code":"sisuTemporarilyUnavailable","message":"Sisu was temporarily unavailable."}}"#,
        );
        assert!(matches!(
            server.error_type(),
            UtilErrorType::SuotarClientError(SuotarErrorVariant::ServerError)
        ));

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
        assert!(SuotarErrorVariant::TransportUnknown.outcome_may_have_landed());
        assert!(SuotarErrorVariant::ServerError.outcome_may_have_landed());
        assert!(SuotarErrorVariant::Deserialization.outcome_may_have_landed());
    }
}
