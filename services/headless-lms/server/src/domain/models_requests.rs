//! Contains helper functions that are passed to headless-lms-models where it needs to make requests to exercise services.

use crate::config::server_runtime_config;
use crate::prelude::*;
use actix_http::Payload;
use actix_web::{FromRequest, HttpRequest};
use chrono::{DateTime, Duration, Utc};
use futures::{
    FutureExt,
    future::{BoxFuture, Ready, ready},
};
use headless_lms_models::{
    HttpErrorType, ModelError, ModelErrorType, ModelResult,
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_task_gradings::{ExerciseTaskGradingRequest, ExerciseTaskGradingResult},
    exercise_task_submissions::ExerciseTaskSubmission,
    exercise_tasks::ExerciseTask,
};

use headless_lms_base::error::backend_error::BackendError;
use jsonwebtoken::{
    Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode, errors::ErrorKind,
};
use models::SpecFetcher;
use std::collections::HashMap;
use std::fmt::Debug;
use std::sync::{Arc, Mutex};
use url::Url;

use super::error::{ControllerError, ControllerErrorType};

// keep in sync with the shared-module constants
const EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER: &str = "exercise-service-grading-update-claim";
const EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER: &str = "exercise-service-upload-claim";

/// A type for caching the spec fetching (only for the seed)
type SpecCache = HashMap<(String, String, Option<String>), serde_json::Value>;

#[derive(Clone, Debug)]
pub struct JwtKey(Vec<u8>);

impl JwtKey {
    pub fn try_from_env() -> anyhow::Result<Self> {
        let jwt_password = server_runtime_config().jwt_password.clone();
        let jwt_key = Self::new(&jwt_password)?;
        Ok(jwt_key)
    }

    pub fn new(key: &str) -> anyhow::Result<Self> {
        Ok(Self(key.as_bytes().to_vec()))
    }

    #[cfg(test)]
    pub fn test_key() -> Self {
        let test_jwt_key = "sMG87WlKnNZoITzvL2+jczriTR7JRsCtGu/bSKaSIvw=asdfjklasd***FSDfsdASDFDS";
        Self(test_jwt_key.as_bytes().to_vec())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadClaim {
    exercise_service_slug: String,
    exp: usize,
    iat: usize,
}

#[derive(Debug, Deserialize)]
struct LegacyUploadClaim {
    exercise_service_slug: String,
    expiration_time: DateTime<Utc>,
}

impl UploadClaim {
    pub fn exercise_service_slug(&self) -> &str {
        self.exercise_service_slug.as_ref()
    }

    pub fn expiring_in_1_day(exercise_service_slug: impl Into<String>) -> Self {
        let now = Utc::now().timestamp().max(0) as usize;
        let exp = (Utc::now().timestamp() + Duration::days(1).num_seconds()).max(0) as usize;
        Self {
            exercise_service_slug: exercise_service_slug.into(),
            exp,
            iat: now,
        }
    }

    pub fn sign(self, key: &JwtKey) -> Result<String, jsonwebtoken::errors::Error> {
        sign_hs256_claim(&self, key)
    }

    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, ControllerError> {
        validate_upload_claim_with_legacy_fallback(token, key).map_err(|err| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                format!("Invalid jwt key: {}", err),
                Some(err.into()),
            )
        })
    }
}

impl FromRequest for UploadClaim {
    type Error = ControllerError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let try_from_request = move || {
            let jwt_key = req.app_data::<web::Data<JwtKey>>().ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Missing JwtKey in app data - server configuration error".to_string(),
                    None,
                )
            })?;
            let header = req
                .headers()
                .get(EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER)
                .ok_or_else(|| {
                    ControllerError::new(
                        ControllerErrorType::BadRequest,
                        format!("Missing header {EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER}",),
                        None,
                    )
                })?;
            let header = std::str::from_utf8(header.as_bytes()).map_err(|err| {
                ControllerError::new(
                    ControllerErrorType::BadRequest,
                    format!(
                        "Invalid header {EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER} = {}",
                        String::from_utf8_lossy(header.as_bytes())
                    ),
                    Some(err.into()),
                )
            })?;
            let claim = UploadClaim::validate(header, jwt_key)?;
            Result::<_, Self::Error>::Ok(claim)
        };
        ready(try_from_request())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GradingUpdateClaim {
    submission_id: Uuid,
    exp: usize,
    iat: usize,
}

#[derive(Debug, Deserialize)]
struct LegacyGradingUpdateClaim {
    submission_id: Uuid,
    expiration_time: DateTime<Utc>,
}

impl GradingUpdateClaim {
    pub fn submission_id(&self) -> Uuid {
        self.submission_id
    }

    pub fn expiring_in_1_day(submission_id: Uuid) -> Self {
        let now = Utc::now().timestamp().max(0) as usize;
        let exp = (Utc::now().timestamp() + Duration::days(1).num_seconds()).max(0) as usize;
        Self {
            submission_id,
            exp,
            iat: now,
        }
    }

    pub fn sign(self, key: &JwtKey) -> Result<String, jsonwebtoken::errors::Error> {
        sign_hs256_claim(&self, key)
    }

    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, ControllerError> {
        validate_grading_update_claim_with_legacy_fallback(token, key).map_err(|err| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                format!("Invalid jwt key: {}", err),
                Some(err.into()),
            )
        })
    }
}

impl FromRequest for GradingUpdateClaim {
    type Error = ControllerError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let try_from_request = move || {
            let jwt_key = req.app_data::<web::Data<JwtKey>>().ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Missing JwtKey in app data - server configuration error".to_string(),
                    None,
                )
            })?;
            let header = req
                .headers()
                .get(EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER)
                .ok_or_else(|| {
                    ControllerError::new(
                        ControllerErrorType::BadRequest,
                        format!("Missing header {EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER}",),
                        None,
                    )
                })?;
            let header = std::str::from_utf8(header.as_bytes()).map_err(|err| {
                ControllerError::new(
                    ControllerErrorType::BadRequest,
                    format!(
                        "Invalid header {EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER} = {}",
                        String::from_utf8_lossy(header.as_bytes())
                    ),
                    Some(err.into()),
                )
            })?;
            let claim = GradingUpdateClaim::validate(header, jwt_key)?;
            Result::<_, Self::Error>::Ok(claim)
        };
        ready(try_from_request())
    }
}

/// Accepted by the public-spec and model-solution endpoints of exercise services.
#[derive(Debug, Serialize)]

pub struct SpecRequest<'a> {
    request_id: Uuid,
    private_spec: Option<&'a serde_json::Value>,
    upload_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExerciseServiceCsvExportRequest<'a, T: Serialize> {
    pub items: &'a [T],
}

/// Column definition for exercise service CSV export; callers must use scalar-only cell values.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ExerciseServiceCsvExportColumn {
    pub key: String,
    pub header: String,
}

/// One batch of CSV rows; each row's values must be scalar (null, bool, number, string). Objects/arrays are rejected by the controller.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ExerciseServiceCsvExportResult {
    pub rows: Vec<HashMap<String, serde_json::Value>>,
}

/// Full CSV export response; columns define headers, results align by index. All cell values must be scalar.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ExerciseServiceCsvExportResponse {
    pub columns: Vec<ExerciseServiceCsvExportColumn>,
    pub results: Vec<ExerciseServiceCsvExportResult>,
}

/// Fetches a public/model spec based on the private spec from the given url.
/// The slug and jwt key are used for an upload claim that allows the service
/// to upload files as part of the spec.
pub fn make_spec_fetcher(
    base_url: String,
    request_id: Uuid,
    jwt_key: Arc<JwtKey>,
) -> impl SpecFetcher {
    move |url, exercise_service_slug, private_spec| {
        let client = reqwest::Client::new();
        let upload_claim = UploadClaim::expiring_in_1_day(exercise_service_slug);
        let upload_url = Some(format!("{base_url}/api/v0/files/{exercise_service_slug}"));
        let signed_upload_claim = match upload_claim.sign(&jwt_key) {
            Ok(claim) => claim,
            Err(err) => {
                return async move {
                    Err(ModelError::new(
                        ModelErrorType::Generic,
                        format!("Failed to sign upload claim: {err}"),
                        Some(err.into()),
                    ))
                }
                .boxed();
            }
        };
        let req = client
            .post(url.clone())
            .header(EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER, signed_upload_claim)
            .timeout(std::time::Duration::from_secs(120))
            .json(&SpecRequest {
                request_id,
                private_spec,
                upload_url,
            })
            .send();
        async move {
            let res = req.await.map_err(ModelError::from)?;
            let status_code = res.status();
            if !status_code.is_success() {
                let error_text = res.text().await;
                let error = error_text.as_deref().unwrap_or("(No text in response)");
                error!(
                    ?url,
                    ?exercise_service_slug,
                    ?private_spec,
                    ?status_code,
                    "Exercise service returned an error while generating a spec: {}",
                    error
                );
                return Err(ModelError::new(
                    ModelErrorType::HttpRequest {
                        status_code: status_code.as_u16(),
                        response_body: error.to_string(),
                    },
                    format!(
                        "Failed to generate spec for exercise for {exercise_service_slug}: {error}."
                    ),
                    None,
                ));
            }
            let json = parse_response_json(res).await?;
            Ok(json)
        }
        .boxed()
    }
}

// see `fetch_service_info_fast` while handling HTTP requests
pub fn fetch_service_info(url: Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> {
    fetch_service_info_with_timeout(url, 1000 * 120)
}

// use this while handling HTTP requests, see `fetch_service_info`
pub fn fetch_service_info_fast(
    url: Url,
) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> {
    fetch_service_info_with_timeout(url, 1000 * 5)
}

fn fetch_service_info_with_timeout(
    url: Url,
    timeout_ms: u64,
) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> {
    async move {
        let client = reqwest::Client::new();
        let res = client
            .get(url) // e.g. http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info
            .timeout(std::time::Duration::from_millis(timeout_ms))
            .send()
            .await
            .map_err(ModelError::from)?;
        let status = res.status();
        if !status.is_success() {
            let response_url = res.url().to_string();
            let body = res.text().await.map_err(ModelError::from)?;
            warn!(url=?response_url, status=?status, body=?body, "Could not fetch service info.");
            return Err(ModelError::new(
                ModelErrorType::HttpRequest {
                    status_code: status.as_u16(),
                    response_body: body,
                },
                "Could not fetch service info.".to_string(),
                None,
            ));
        }
        let res = parse_response_json(res).await?;
        Ok(res)
    }
    .boxed()
}

pub fn make_grading_request_sender(
    jwt_key: Arc<JwtKey>,
) -> impl Fn(
    Url,
    &ExerciseTask,
    &ExerciseTaskSubmission,
) -> BoxFuture<'static, ModelResult<ExerciseTaskGradingResult>> {
    move |grade_url, exercise_task, submission| {
        let client = reqwest::Client::new();
        // TODO: use real url
        let grading_update_url = format!(
            "http://project-331.local/api/v0/exercise-services/grading/grading-update/{}",
            submission.id
        );
        let grading_update_claim = GradingUpdateClaim::expiring_in_1_day(submission.id);
        let signed_grading_update_claim = match grading_update_claim.sign(&jwt_key) {
            Ok(claim) => claim,
            Err(err) => {
                return async move {
                    Err(ModelError::new(
                        ModelErrorType::Generic,
                        format!("Failed to sign grading update claim: {err}"),
                        Some(err.into()),
                    ))
                }
                .boxed();
            }
        };
        let req = client
            .post(grade_url)
            .header(
                EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER,
                signed_grading_update_claim,
            )
            .timeout(std::time::Duration::from_secs(120))
            .json(&ExerciseTaskGradingRequest {
                grading_update_url: &grading_update_url,
                exercise_spec: &exercise_task.private_spec,
                submission_data: &submission.data_json,
            });
        async move {
            let res = req.send().await.map_err(ModelError::from)?;
            let status = res.status();
            if !status.is_success() {
                let status_code = status.as_u16();
                let response_body = res.text().await.unwrap_or_default();
                error!(
                    ?response_body,
                    status_code = %status_code,
                    "Grading request returned an unsuccesful status code"
                );

                return Err(ModelError::new(
                    ModelErrorType::HttpRequest {
                        status_code,
                        response_body: response_body.clone(),
                    },
                    format!(
                        "Grading failed with status: {} response: {}",
                        status_code, response_body
                    ),
                    None,
                ));
            }
            let obj = parse_response_json(res).await?;
            info!("Received a grading result: {:#?}", &obj);
            Ok(obj)
        }
        .boxed()
    }
}

pub async fn post_exercise_service_csv_export_request<T: Serialize>(
    url: Url,
    items: &[T],
) -> ModelResult<ExerciseServiceCsvExportResponse> {
    let client = reqwest::Client::new();
    let response = client
        .post(url.clone())
        .timeout(std::time::Duration::from_secs(120))
        .json(&ExerciseServiceCsvExportRequest { items })
        .send()
        .await
        .map_err(ModelError::from)?;

    let status = response.status();
    if !status.is_success() {
        let status_code = status.as_u16();
        let response_body = response.text().await.unwrap_or_default();
        error!(
            ?response_body,
            status_code = %status_code,
            "Exercise service CSV export request returned an unsuccessful status code"
        );

        return Err(ModelError::new(
            ModelErrorType::HttpRequest {
                status_code,
                response_body: response_body.clone(),
            },
            format!(
                "CSV export request failed with status: {} response: {}",
                status_code, response_body
            ),
            None,
        ));
    }

    parse_response_json(response).await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GivePeerReviewClaim {
    pub exercise_slide_submission_id: Uuid,
    pub peer_or_self_review_config_id: Uuid,
    exp: usize,
    iat: usize,
}

#[derive(Debug, Deserialize)]
struct LegacyGivePeerReviewClaim {
    exercise_slide_submission_id: Uuid,
    peer_or_self_review_config_id: Uuid,
    expiration_time: DateTime<Utc>,
}

impl GivePeerReviewClaim {
    pub fn expiring_in_1_day(
        exercise_slide_submission_id: Uuid,
        peer_or_self_review_config_id: Uuid,
    ) -> Self {
        let now = Utc::now().timestamp().max(0) as usize;
        let exp = (Utc::now().timestamp() + Duration::days(1).num_seconds()).max(0) as usize;
        Self {
            exercise_slide_submission_id,
            peer_or_self_review_config_id,
            exp,
            iat: now,
        }
    }

    pub fn sign(self, key: &JwtKey) -> Result<String, jsonwebtoken::errors::Error> {
        sign_hs256_claim(&self, key)
    }

    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, ControllerError> {
        validate_peer_review_claim_with_legacy_fallback(token, key).map_err(|err| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                format!("Invalid claim: {}", err),
                Some(err.into()),
            )
        })
    }
}

/// Signs any serializable claim payload as HS256 using the shared JWT secret.
fn sign_hs256_claim<T: serde::Serialize>(
    claim: &T,
    key: &JwtKey,
) -> Result<String, jsonwebtoken::errors::Error> {
    encode(
        &Header::new(Algorithm::HS256),
        claim,
        &EncodingKey::from_secret(&key.0),
    )
}

/// Decodes and verifies an HS256 token into the requested claim type.
fn validate_hs256_claim<T: serde::de::DeserializeOwned>(
    token: &str,
    key: &JwtKey,
) -> Result<T, jsonwebtoken::errors::Error> {
    let validation = Validation::new(Algorithm::HS256);
    decode::<T>(token, &DecodingKey::from_secret(&key.0), &validation)
        .map(|token_data| token_data.claims)
}

/// Decodes claims in compatibility mode and validates legacy `expiration_time` manually.
fn validate_hs256_legacy_claim<T: serde::de::DeserializeOwned>(
    token: &str,
    key: &JwtKey,
) -> Result<T, jsonwebtoken::errors::Error> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.required_spec_claims = std::collections::HashSet::new();
    validation.validate_exp = false;
    decode::<T>(token, &DecodingKey::from_secret(&key.0), &validation)
        .map(|token_data| token_data.claims)
}

fn legacy_timestamp_to_claim_number(
    timestamp: DateTime<Utc>,
) -> Result<usize, jsonwebtoken::errors::Error> {
    usize::try_from(timestamp.timestamp())
        .map_err(|_| jsonwebtoken::errors::Error::from(ErrorKind::InvalidToken))
}

/// Validates upload claim using modern JWT fields, with temporary fallback to legacy claims.
fn validate_upload_claim_with_legacy_fallback(
    token: &str,
    key: &JwtKey,
) -> Result<UploadClaim, jsonwebtoken::errors::Error> {
    match validate_hs256_claim::<UploadClaim>(token, key) {
        Ok(claim) => Ok(claim),
        Err(err) if matches!(err.kind(), ErrorKind::MissingRequiredClaim(claim) if claim == "exp") =>
        {
            let legacy: LegacyUploadClaim = validate_hs256_legacy_claim(token, key)?;
            if legacy.expiration_time < Utc::now() {
                return Err(jsonwebtoken::errors::Error::from(
                    ErrorKind::ExpiredSignature,
                ));
            }
            Ok(UploadClaim {
                exercise_service_slug: legacy.exercise_service_slug,
                exp: legacy_timestamp_to_claim_number(legacy.expiration_time)?,
                iat: 0,
            })
        }
        Err(err) => Err(err),
    }
}

/// Validates grading update claim using modern JWT fields, with temporary fallback to legacy claims.
fn validate_grading_update_claim_with_legacy_fallback(
    token: &str,
    key: &JwtKey,
) -> Result<GradingUpdateClaim, jsonwebtoken::errors::Error> {
    match validate_hs256_claim::<GradingUpdateClaim>(token, key) {
        Ok(claim) => Ok(claim),
        Err(err) if matches!(err.kind(), ErrorKind::MissingRequiredClaim(claim) if claim == "exp") =>
        {
            let legacy: LegacyGradingUpdateClaim = validate_hs256_legacy_claim(token, key)?;
            if legacy.expiration_time < Utc::now() {
                return Err(jsonwebtoken::errors::Error::from(
                    ErrorKind::ExpiredSignature,
                ));
            }
            Ok(GradingUpdateClaim {
                submission_id: legacy.submission_id,
                exp: legacy_timestamp_to_claim_number(legacy.expiration_time)?,
                iat: 0,
            })
        }
        Err(err) => Err(err),
    }
}

/// Validates peer review claim using modern JWT fields, with temporary fallback to legacy claims.
fn validate_peer_review_claim_with_legacy_fallback(
    token: &str,
    key: &JwtKey,
) -> Result<GivePeerReviewClaim, jsonwebtoken::errors::Error> {
    match validate_hs256_claim::<GivePeerReviewClaim>(token, key) {
        Ok(claim) => Ok(claim),
        Err(err) if matches!(err.kind(), ErrorKind::MissingRequiredClaim(claim) if claim == "exp") =>
        {
            let legacy: LegacyGivePeerReviewClaim = validate_hs256_legacy_claim(token, key)?;
            if legacy.expiration_time < Utc::now() {
                return Err(jsonwebtoken::errors::Error::from(
                    ErrorKind::ExpiredSignature,
                ));
            }
            Ok(GivePeerReviewClaim {
                exercise_slide_submission_id: legacy.exercise_slide_submission_id,
                peer_or_self_review_config_id: legacy.peer_or_self_review_config_id,
                exp: legacy_timestamp_to_claim_number(legacy.expiration_time)?,
                iat: 0,
            })
        }
        Err(err) => Err(err),
    }
}

/// A caching spec fetcher ONLY FOR THE SEED that returns a cached spec if the same
/// (url, exercise_service_slug, private_spec) is requested. Since this is only used during seeding,
/// there is no cache eviction.
pub fn make_seed_spec_fetcher_with_cache(
    base_url: String,
    request_id: Uuid,
    jwt_key: Arc<JwtKey>,
) -> impl SpecFetcher {
    // Cache key: (url, exercise_service_slug, private_spec serialized)
    let cache: Arc<Mutex<SpecCache>> = Arc::new(Mutex::new(HashMap::new()));

    // Create the base non-caching spec fetcher and wrap it in Arc to make it clonable
    let base_fetcher = Arc::new(make_spec_fetcher(base_url, request_id, jwt_key));

    move |url, exercise_service_slug, private_spec| {
        let url_str = url.to_string();
        let service_slug = exercise_service_slug.to_string();
        // Convert private_spec to string for cache key if present
        let private_spec_str =
            private_spec.map(|spec| serde_json::to_string(&spec).unwrap_or_default());
        let key = (url_str.clone(), service_slug.clone(), private_spec_str);
        let cache = Arc::clone(&cache);
        let base_fetcher = Arc::clone(&base_fetcher);

        async move {
            // Try to get from cache first
            let cached_spec = {
                let cache_guard = cache.lock().map_err(|err| {
                    ModelError::new(
                        ModelErrorType::Generic,
                        format!("Seed spec fetcher cache lock poisoned: {err}"),
                        None::<anyhow::Error>,
                    )
                })?;
                cache_guard.get(&key).cloned()
            };
            if let Some(cached_spec) = cached_spec {
                return Ok(cached_spec.clone());
            }

            // Not in cache - fetch using base fetcher
            let fetched_spec = base_fetcher(url, exercise_service_slug, private_spec).await?;

            // Store in cache
            {
                let mut cache_guard = cache.lock().map_err(|err| {
                    ModelError::new(
                        ModelErrorType::Generic,
                        format!("Seed spec fetcher cache lock poisoned: {err}"),
                        None::<anyhow::Error>,
                    )
                })?;
                cache_guard.insert(key, fetched_spec.clone());
            }

            Ok(fetched_spec)
        }
        .boxed()
    }
}

/// Safely parses a response body as JSON, capturing the actual response body in error cases
async fn parse_response_json<T>(response: reqwest::Response) -> ModelResult<T>
where
    T: serde::de::DeserializeOwned,
{
    let status = response.status();
    let response_text = response.text().await.map_err(ModelError::from)?;

    serde_json::from_str(&response_text).map_err(|err| {
        ModelError::new(
            ModelErrorType::HttpError {
                error_type: HttpErrorType::ResponseDecodeFailed,
                reason: err.to_string(),
                status_code: Some(status.as_u16()),
                response_body: Some(response_text),
            },
            format!("Failed to decode JSON response: {}", err),
            None,
        )
    })
}
