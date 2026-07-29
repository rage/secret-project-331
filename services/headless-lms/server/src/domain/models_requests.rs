//! Contains helper functions that are passed to headless-lms-models where it needs to make requests to exercise services.

use crate::config::server_runtime_config;
use crate::prelude::*;
use actix_http::Payload;
use actix_web::{FromRequest, HttpRequest};
use chrono::{Duration, Utc};
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
use secrecy::{ExposeSecret, SecretString};

use headless_lms_base::error::backend_error::BackendError;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use models::SpecFetcher;
use std::collections::HashMap;
use std::fmt::Debug;
use std::sync::{Arc, Mutex};
use url::Url;

use super::error::{ControllerError, ControllerErrorType};

// keep in sync with the shared-module constants
const EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER: &str = "exercise-service-grading-update-claim";
const EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER: &str = "exercise-service-upload-claim";
pub const PLAYGROUND_GRADING_CALLBACK_CLAIM_PARAM: &str = "playground-grading-callback-claim";

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

    pub fn new(key: &SecretString) -> anyhow::Result<Self> {
        Ok(Self(key.expose_secret().as_bytes().to_vec()))
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
        validate_hs256_claim(token, key).map_err(|err| {
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
        validate_hs256_claim(token, key).map_err(|err| {
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

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaygroundGradingCallbackClaim {
    websocket_id: Uuid,
    exp: usize,
    iat: usize,
}

impl PlaygroundGradingCallbackClaim {
    pub fn websocket_id(&self) -> Uuid {
        self.websocket_id
    }

    pub fn expiring_in_1_day(websocket_id: Uuid) -> Self {
        let now = Utc::now().timestamp().max(0) as usize;
        let exp = (Utc::now().timestamp() + Duration::days(1).num_seconds()).max(0) as usize;
        Self {
            websocket_id,
            exp,
            iat: now,
        }
    }

    pub fn sign(self, key: &JwtKey) -> Result<String, jsonwebtoken::errors::Error> {
        sign_hs256_claim(&self, key)
    }

    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, ControllerError> {
        validate_hs256_claim::<Self>(token, key).map_err(|err| {
            controller_err!(
                BadRequest,
                format!("Invalid playground grading callback claim: {}", err),
                err
            )
        })
    }
}

impl FromRequest for PlaygroundGradingCallbackClaim {
    type Error = ControllerError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let try_from_request = move || {
            let jwt_key = req.app_data::<web::Data<JwtKey>>().ok_or_else(|| {
                controller_err!(
                    InternalServerError,
                    "Missing JwtKey in app data - server configuration error".to_string()
                )
            })?;
            let query_claim = url::form_urlencoded::parse(req.query_string().as_bytes())
                .find(|(key, _)| key == PLAYGROUND_GRADING_CALLBACK_CLAIM_PARAM)
                .map(|(_, value)| value.into_owned());
            let header_claim = req
                .headers()
                .get(PLAYGROUND_GRADING_CALLBACK_CLAIM_PARAM)
                .and_then(|header| std::str::from_utf8(header.as_bytes()).ok())
                .map(ToString::to_string);
            let claim = header_claim.or(query_claim).ok_or_else(|| {
                controller_err!(
                    BadRequest,
                    format!("Missing {PLAYGROUND_GRADING_CALLBACK_CLAIM_PARAM}")
                )
            })?;
            PlaygroundGradingCallbackClaim::validate(&claim, jwt_key)
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
        validate_hs256_claim(token, key).map_err(|err| {
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

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::ResponseError;
    use actix_web::http::StatusCode;
    use actix_web::http::header::{HeaderName, HeaderValue};
    use actix_web::test::TestRequest;
    use base64::Engine;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use serde_json::json;

    fn other_key() -> JwtKey {
        JwtKey::new(&SecretString::new(
            "a-completely-different-jwt-secret-0123456789"
                .to_string()
                .into(),
        ))
        .expect("test key")
    }

    /// Signs an arbitrary JSON payload with the same HS256 helper the production claims use, so
    /// tests can produce claims (expired, wrong shape, legacy) the public constructors can't.
    fn sign_json(payload: serde_json::Value, key: &JwtKey) -> String {
        sign_hs256_claim(&payload, key).expect("signing should succeed")
    }

    fn past_timestamp(seconds_ago: i64) -> i64 {
        (Utc::now() - Duration::seconds(seconds_ago)).timestamp()
    }

    fn future_timestamp(seconds_ahead: i64) -> i64 {
        (Utc::now() + Duration::seconds(seconds_ahead)).timestamp()
    }

    #[test]
    fn grading_update_claim_round_trips() {
        let key = JwtKey::test_key();
        let submission_id = Uuid::new_v4();
        let token = GradingUpdateClaim::expiring_in_1_day(submission_id)
            .sign(&key)
            .expect("signing should succeed");
        let claim = GradingUpdateClaim::validate(&token, &key).expect("the claim should validate");
        assert_eq!(claim.submission_id(), submission_id);
    }

    /// An expired claim must not keep authorizing grading updates.
    #[test]
    fn expired_grading_update_claim_is_rejected() {
        let key = JwtKey::test_key();
        // Well past the default 60s leeway jsonwebtoken allows for clock skew.
        let token = sign_json(
            json!({
                "submission_id": Uuid::new_v4(),
                "exp": past_timestamp(3600),
                "iat": past_timestamp(7200),
            }),
            &key,
        );
        let err = GradingUpdateClaim::validate(&token, &key)
            .expect_err("an expired claim must be rejected");
        assert_eq!(err.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    /// A claim signed with some other secret must not validate: this is the only thing standing
    /// between an unauthenticated caller and writing grading results.
    #[test]
    fn grading_update_claim_signed_with_another_key_is_rejected() {
        let token = GradingUpdateClaim::expiring_in_1_day(Uuid::new_v4())
            .sign(&other_key())
            .expect("signing should succeed");
        GradingUpdateClaim::validate(&token, &JwtKey::test_key())
            .expect_err("a claim signed with a foreign key must be rejected");
    }

    /// Rewriting the payload of a validly signed claim (e.g. to point at another submission)
    /// must invalidate the signature.
    #[test]
    fn tampered_grading_update_claim_is_rejected() {
        let key = JwtKey::test_key();
        let token = GradingUpdateClaim::expiring_in_1_day(Uuid::new_v4())
            .sign(&key)
            .expect("signing should succeed");
        let mut parts = token.split('.');
        let header = parts.next().expect("header");
        let _original_payload = parts.next().expect("payload");
        let signature = parts.next().expect("signature");
        // Swap in a payload naming a different submission, keeping the original signature.
        let forged_payload = URL_SAFE_NO_PAD.encode(
            serde_json::to_vec(&json!({
                "submission_id": Uuid::new_v4(),
                "exp": future_timestamp(3600),
                "iat": Utc::now().timestamp(),
            }))
            .expect("json"),
        );
        let tampered = format!("{header}.{forged_payload}.{signature}");
        GradingUpdateClaim::validate(&tampered, &key)
            .expect_err("a tampered claim must be rejected");
    }

    /// The classic JWT bypass: an unsigned token declaring `alg: none` must not be accepted.
    #[test]
    fn unsigned_grading_update_claim_is_rejected() {
        let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"none","typ":"JWT"}"#);
        let payload = URL_SAFE_NO_PAD.encode(
            serde_json::to_vec(&json!({
                "submission_id": Uuid::new_v4(),
                "exp": future_timestamp(3600),
                "iat": Utc::now().timestamp(),
            }))
            .expect("json"),
        );
        let token = format!("{header}.{payload}.");
        GradingUpdateClaim::validate(&token, &JwtKey::test_key())
            .expect_err("an unsigned (alg=none) claim must be rejected");
    }

    /// The claim types share one signing key, so a token minted for one purpose must not be
    /// usable for another. An upload claim carries no `submission_id`, so it must not deserialize
    /// into a grading update claim (and vice versa).
    #[test]
    fn claims_do_not_cross_validate_between_types() {
        let key = JwtKey::test_key();
        let upload_token = UploadClaim::expiring_in_1_day("tmc")
            .sign(&key)
            .expect("signing should succeed");
        GradingUpdateClaim::validate(&upload_token, &key)
            .expect_err("an upload claim must not validate as a grading update claim");

        let grading_token = GradingUpdateClaim::expiring_in_1_day(Uuid::new_v4())
            .sign(&key)
            .expect("signing should succeed");
        UploadClaim::validate(&grading_token, &key)
            .expect_err("a grading update claim must not validate as an upload claim");
    }

    /// A legacy-shaped claim, carrying `expiration_time` instead of `exp`, is rejected whether or
    /// not that timestamp has passed. Pinned so that accepting the old shape again has to be
    /// deliberate.
    #[test]
    fn legacy_grading_update_claim_shape_is_rejected() {
        let key = JwtKey::test_key();
        let submission_id = Uuid::new_v4();

        let unexpired = sign_json(
            json!({
                "submission_id": submission_id,
                "expiration_time": Utc::now() + Duration::hours(1),
            }),
            &key,
        );
        let err = GradingUpdateClaim::validate(&unexpired, &key)
            .expect_err("a claim without `exp` must be rejected");
        assert_eq!(err.status_code(), StatusCode::UNPROCESSABLE_ENTITY);

        let expired = sign_json(
            json!({
                "submission_id": submission_id,
                "expiration_time": Utc::now() - Duration::hours(1),
            }),
            &key,
        );
        GradingUpdateClaim::validate(&expired, &key)
            .expect_err("an expired legacy claim must be rejected");
    }

    /// A claim missing `exp` entirely must never be treated as non-expiring.
    #[test]
    fn grading_update_claim_without_an_expiry_is_rejected() {
        let key = JwtKey::test_key();
        let token = sign_json(
            json!({ "submission_id": Uuid::new_v4(), "iat": Utc::now().timestamp() }),
            &key,
        );
        GradingUpdateClaim::validate(&token, &key)
            .expect_err("a claim without an expiry must be rejected");
    }

    fn extract_grading_update_claim(
        req: actix_web::HttpRequest,
        mut payload: Payload,
    ) -> Result<GradingUpdateClaim, ControllerError> {
        GradingUpdateClaim::from_request(&req, &mut payload)
            .now_or_never()
            .expect("the extractor resolves immediately")
    }

    #[test]
    fn extractor_accepts_a_valid_claim_header() {
        let key = JwtKey::test_key();
        let submission_id = Uuid::new_v4();
        let token = GradingUpdateClaim::expiring_in_1_day(submission_id)
            .sign(&key)
            .expect("signing should succeed");
        let (req, payload) = TestRequest::default()
            .app_data(web::Data::new(key))
            .insert_header((EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER, token.as_str()))
            .to_http_parts();
        let claim = extract_grading_update_claim(req, payload).expect("should extract");
        assert_eq!(claim.submission_id(), submission_id);
    }

    #[test]
    fn extractor_rejects_a_missing_claim_header() {
        let (req, payload) = TestRequest::default()
            .app_data(web::Data::new(JwtKey::test_key()))
            .to_http_parts();
        let err = extract_grading_update_claim(req, payload)
            .expect_err("a request without the claim header must be rejected");
        assert_eq!(err.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    /// A non-UTF-8 header value must be a client error, not a panic.
    #[test]
    fn extractor_rejects_an_invalid_utf8_claim_header() {
        let (req, payload) = TestRequest::default()
            .app_data(web::Data::new(JwtKey::test_key()))
            .insert_header((
                HeaderName::from_static(EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER),
                HeaderValue::from_bytes(&[0xff, 0xfe, 0x80]).expect("header value"),
            ))
            .to_http_parts();
        let err = extract_grading_update_claim(req, payload)
            .expect_err("a non-UTF-8 claim header must be rejected");
        assert_eq!(err.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    /// Without the signing key in app data the server cannot verify anything; that is a server
    /// misconfiguration (500), and must never be mistaken for a valid claim.
    #[test]
    fn extractor_reports_a_missing_jwt_key_as_a_server_error() {
        let token = GradingUpdateClaim::expiring_in_1_day(Uuid::new_v4())
            .sign(&JwtKey::test_key())
            .expect("signing should succeed");
        let (req, payload) = TestRequest::default()
            .insert_header((EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER, token.as_str()))
            .to_http_parts();
        let err = extract_grading_update_claim(req, payload)
            .expect_err("a missing JwtKey must not yield a claim");
        assert_eq!(err.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    /// A request carrying a garbage header value must be rejected before any DB work.
    #[test]
    fn extractor_rejects_a_non_jwt_claim_header() {
        let (req, payload) = TestRequest::default()
            .app_data(web::Data::new(JwtKey::test_key()))
            .insert_header((EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER, "not-a-jwt"))
            .to_http_parts();
        let err = extract_grading_update_claim(req, payload)
            .expect_err("a non-JWT claim header must be rejected");
        assert_eq!(err.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
    }
}
