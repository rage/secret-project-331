//! Contains helper functions that are passed to headless-lms-models where it needs to make requests to exercise services.

use crate::prelude::*;
use actix_http::Payload;
use actix_web::{FromRequest, HttpRequest};
use chrono::{DateTime, Duration, Utc};
use futures::{
    future::{ready, BoxFuture, Ready},
    FutureExt,
};
use headless_lms_models::{
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_task_gradings::{ExerciseTaskGradingRequest, ExerciseTaskGradingResult},
    exercise_task_submissions::ExerciseTaskSubmission,
    exercise_tasks::ExerciseTask,
    ModelError, ModelErrorType, ModelResult,
};
use headless_lms_utils::error::backend_error::BackendError;
use hmac::{Hmac, Mac};
use jwt::{SignWithKey, VerifyWithKey};
use models::SpecFetcher;
use sha2::Sha256;
use std::{borrow::Cow, fmt::Debug, sync::Arc};
use url::Url;

use super::error::{ControllerError, ControllerErrorType};

// keep in sync with the shared-module constants
const EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER: &str = "exercise-service-grading-update-claim";
const EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER: &str = "exercise-service-upload-claim";

#[derive(Clone, Debug)]
pub struct JwtKey(Hmac<Sha256>);

impl JwtKey {
    pub fn try_from_env() -> anyhow::Result<Self> {
        let jwt_password = std::env::var("JWT_PASSWORD").context("JWT_PASSWORD must be defined")?;
        let jwt_key = Self::new(&jwt_password)?;
        Ok(jwt_key)
    }

    pub fn new(key: &str) -> Result<Self, sha2::digest::InvalidLength> {
        let key: Hmac<Sha256> = Hmac::new_from_slice(key.as_bytes())?;
        Ok(Self(key))
    }

    #[cfg(test)]
    pub fn test_key() -> Self {
        let test_jwt_key = "sMG87WlKnNZoITzvL2+jczriTR7JRsCtGu/bSKaSIvw=asdfjklasd***FSDfsdASDFDS";
        Self::new(test_jwt_key).unwrap()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadClaim<'a> {
    exercise_service_slug: Cow<'a, str>,
    expiration_time: DateTime<Utc>,
}

impl<'a> UploadClaim<'a> {
    pub fn exercise_service_slug(&self) -> &str {
        self.exercise_service_slug.as_ref()
    }

    pub fn expiration_time(&self) -> &DateTime<Utc> {
        &self.expiration_time
    }

    pub fn expiring_in_1_day(exercise_service_slug: Cow<'a, str>) -> Self {
        Self {
            exercise_service_slug,
            expiration_time: Utc::now() + Duration::days(1),
        }
    }

    pub fn sign(self, key: &JwtKey) -> String {
        self.sign_with_key(&key.0).expect("should never fail")
    }

    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, ControllerError> {
        let claim: Self = token.verify_with_key(&key.0).map_err(|err| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                format!("Invalid jwt key: {}", err),
                Some(err.into()),
            )
        })?;
        if claim.expiration_time < Utc::now() {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Upload claim has expired".to_string(),
                None,
            ));
        }
        Ok(claim)
    }
}

impl<'a> FromRequest for UploadClaim<'a> {
    type Error = ControllerError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let try_from_request = move || {
            let jwt_key = req
                .app_data::<web::Data<JwtKey>>()
                .expect("Missing JwtKey in app data");
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
    expiration_time: DateTime<Utc>,
}

impl GradingUpdateClaim {
    pub fn submission_id(&self) -> Uuid {
        self.submission_id
    }

    pub fn expiration_time(&self) -> &DateTime<Utc> {
        &self.expiration_time
    }

    pub fn expiring_in_1_day(submission_id: Uuid) -> Self {
        Self {
            submission_id,
            expiration_time: Utc::now() + Duration::days(1),
        }
    }

    pub fn sign(self, key: &JwtKey) -> String {
        self.sign_with_key(&key.0).expect("should never fail")
    }

    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, ControllerError> {
        let claim: Self = token.verify_with_key(&key.0).map_err(|err| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                format!("Invalid jwt key: {}", err),
                Some(err.into()),
            )
        })?;
        if claim.expiration_time < Utc::now() {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Grading update claim has expired".to_string(),
                None,
            ));
        }
        Ok(claim)
    }
}

impl FromRequest for GradingUpdateClaim {
    type Error = ControllerError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let try_from_request = move || {
            let jwt_key = req
                .app_data::<web::Data<JwtKey>>()
                .expect("Missing JwtKey in app data");
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

fn reqwest_err(err: reqwest::Error) -> ModelError {
    ModelError::new(
        ModelErrorType::Generic,
        format!("Error during request: {err}"),
        None,
    )
}

/// Accepted by the public-spec and model-solution endpoints of exercise services.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SpecRequest<'a> {
    request_id: Uuid,
    private_spec: Option<&'a serde_json::Value>,
    upload_url: Option<String>,
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
        let upload_claim = UploadClaim::expiring_in_1_day(exercise_service_slug.into());
        let upload_url = Some(format!("{base_url}/api/v0/files/{exercise_service_slug}"));
        let req = client
            .post(url.clone())
            .header(
                EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER,
                upload_claim.sign(&jwt_key),
            )
            .timeout(std::time::Duration::from_secs(120))
            .json(&SpecRequest {
                request_id,
                private_spec,
                upload_url,
            })
            .send();
        async move {
            let res = req.await.map_err(reqwest_err)?;
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
                    ModelErrorType::Generic,
                    format!("Failed to generate spec for exercise for {exercise_service_slug}: {error}."),
                    None,
                ));
            }
            let json = res.json().await.map_err(reqwest_err)?;
            Ok(json)
        }
        .boxed()
    }
}

pub fn fetch_service_info(url: Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> {
    async {
        let client = reqwest::Client::new();
        let res = client
            .get(url) // e.g. http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info
            .timeout(std::time::Duration::from_secs(120))
            .send()
            .await
            .map_err(reqwest_err)?;
        let status = res.status();
        if !status.is_success() {
            let response_url = res.url().to_string();
            let body = res.text().await.map_err(reqwest_err)?;
            warn!(url=?response_url, status=?status, body=?body, "Could not fetch service info.");
            return Err(ModelError::new(
                ModelErrorType::Generic,
                "Could not fetch service info.".to_string(),
                None,
            ));
        }
        let res = res
            .json::<ExerciseServiceInfoApi>()
            .await
            .map_err(reqwest_err)?;
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
        let req = client
            .post(grade_url)
            .header(
                EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER,
                grading_update_claim.sign(&jwt_key),
            )
            .timeout(std::time::Duration::from_secs(120))
            .json(&ExerciseTaskGradingRequest {
                grading_update_url: &grading_update_url,
                exercise_spec: &exercise_task.private_spec,
                submission_data: &submission.data_json,
            });
        async move {
            let res = req.send().await.map_err(reqwest_err)?;
            let status = res.status();
            if !status.is_success() {
                let response_body = res.text().await;
                error!(
                    ?response_body,
                    "Grading request returned an unsuccesful status code"
                );
                let source_error = ModelError::new(
                    ModelErrorType::Generic,
                    format!("{:?}", response_body),
                    None,
                );
                return Err(ModelError::new(
                    ModelErrorType::Generic,
                    "Grading failed".to_string(),
                    Some(source_error.into()),
                ));
            }
            let obj = res
                .json::<ExerciseTaskGradingResult>()
                .await
                .map_err(reqwest_err)?;
            info!("Received a grading result: {:#?}", &obj);
            Ok(obj)
        }
        .boxed()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GivePeerReviewClaim {
    pub exercise_slide_submission_id: Uuid,
    pub peer_or_self_review_config_id: Uuid,
    expiration_time: DateTime<Utc>,
}

impl GivePeerReviewClaim {
    pub fn expiring_in_1_day(
        exercise_slide_submission_id: Uuid,
        peer_or_self_review_config_id: Uuid,
    ) -> Self {
        Self {
            exercise_slide_submission_id,
            peer_or_self_review_config_id,
            expiration_time: Utc::now() + Duration::days(1),
        }
    }

    pub fn sign(self, key: &JwtKey) -> String {
        self.sign_with_key(&key.0).expect("should never fail")
    }

    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, ControllerError> {
        let claim: Self = token.verify_with_key(&key.0).map_err(|err| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                format!("Invalid claim: {}", err),
                Some(err.into()),
            )
        })?;
        if claim.expiration_time < Utc::now() {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "The review has expired.".to_string(),
                None,
            ));
        }
        Ok(claim)
    }
}
