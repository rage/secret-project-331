//! Actix adapters for exercise-service JWT claims.

use crate::domain::error::{ControllerError, ControllerErrorType};
use crate::domain::exercise_service_requests::*;
use crate::prelude::*;
use actix_http::Payload;
use actix_web::{FromRequest, HttpRequest};
use futures::future::{Ready, ready};
use headless_lms_base::jwt::validate_hs256_claim;

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

impl UploadClaim {
    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, ControllerError> {
        validate_claim(token, key)
    }
}

impl GradingUpdateClaim {
    pub fn validate(token: &str, key: &JwtKey) -> Result<Self, ControllerError> {
        validate_claim(token, key)
    }
}

impl PlaygroundGradingCallbackClaim {
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

impl GivePeerReviewClaim {
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

fn validate_claim<T: serde::de::DeserializeOwned>(
    token: &str,
    key: &JwtKey,
) -> Result<T, ControllerError> {
    validate_hs256_claim(token, key)
        .map_err(|err| controller_err!(BadRequest, format!("Invalid jwt key: {}", err), err))
}
