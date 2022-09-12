/*!
Handlers for HTTP requests to `/api/v0`.

This documents all endpoints. Select a module below for a namespace.

*/

// tracing::instrument seems to have issues with this
#![allow(clippy::suspicious_else_formatting)]

pub mod auth;
pub mod cms;
pub mod course_material;
pub mod files;
pub mod helpers;
pub mod main_frontend;
pub mod prelude;
pub mod study_registry;

use std::error::Error;

use crate::domain::authorization::AuthorizedResponse;
use actix_web::{
    error,
    http::{header::ContentType, StatusCode},
    web::{self, ServiceConfig},
    HttpResponse, HttpResponseBuilder,
};
use backtrace::Backtrace;
use derive_more::Display;
use headless_lms_models::ModelError;
use headless_lms_utils::error::backend_error::BackendError;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::fmt::Write as _;
use tracing_error::SpanTrace;
#[cfg(feature = "ts_rs")]
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Display, Serialize, Deserialize)]
pub enum ControllerErrorType {
    #[display(fmt = "Internal server error")]
    InternalServerError,

    #[display(fmt = "Bad request")]
    BadRequest,

    #[display(fmt = "Bad request")]
    BadRequestWithData(ErrorData),

    #[display(fmt = "Not found")]
    NotFound,

    #[display(fmt = "Unauthorized")]
    Unauthorized,

    #[display(fmt = "Forbidden")]
    Forbidden,
}

/**
Represents error messages that are sent in responses.

# Example
```json
{
    "title": "Internal Server Error",
    "message": "pool timed out while waiting for an open connection",
    "source": "source of error"
}
```
*/
#[derive(Debug)]
pub struct ControllerError {
    error_type: <ControllerError as BackendError>::ErrorType,
    message: String,
    /// Original error that caused this error.
    source: Option<Box<dyn std::error::Error>>,
    /// A trace of tokio tracing spans, generated automatically when the error is generated.
    span_trace: SpanTrace,
    /// Stack trace, generated automatically when the error is created.
    backtrace: Backtrace,
}

impl std::error::Error for ControllerError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source.as_deref()
    }

    fn cause(&self) -> Option<&dyn std::error::Error> {
        self.source()
    }
}

impl std::fmt::Display for ControllerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ControllerError")
    }
}

impl BackendError for ControllerError {
    type ErrorType = ControllerErrorType;

    fn new(
        error_type: Self::ErrorType,
        message: String,
        source_error: Option<Box<dyn std::error::Error>>,
    ) -> Self {
        Self {
            error_type,
            message,
            source: source_error,
            span_trace: SpanTrace::capture(),
            backtrace: Backtrace::new(),
        }
    }

    fn backtrace(&self) -> Option<&Backtrace> {
        Some(&self.backtrace)
    }

    fn error_type(&self) -> &Self::ErrorType {
        &self.error_type
    }

    fn message(&self) -> &str {
        &self.message
    }

    fn span_trace(&self) -> &SpanTrace {
        &self.span_trace
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub enum ErrorData {
    BlockId(Uuid),
}

/// The format all error messages from the API is in
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ErrorResponse {
    pub title: String,
    pub message: String,
    pub source: Option<String>,
    pub data: Option<ErrorData>,
}

impl error::ResponseError for ControllerError {
    fn error_response(&self) -> HttpResponse {
        if let ControllerErrorType::InternalServerError(_) = &self {
            let mut err_string = String::new();
            let mut source = Some(&self as &dyn Error);
            while let Some(err) = source {
                let res = write!(err_string, "{}\n    ", err);
                if let Err(e) = res {
                    error!(
                        "Error occured while trying to construct error source string: {}",
                        e
                    );
                }
                source = err.source();
            }
            error!("Internal server error: {}", err_string);
        }

        let status = self.status_code();
        // let detail = if let ControllerErrorType::InternalServerError
        // | ControllerErrorType::BadRequest
        // | ControllerErrorType::BadRequestWithData()
        // | ControllerErrorType::Forbidden()
        // | ControllerErrorType::Unauthorized(reason) = self
        // {
        //     reason
        // } else {
        //     "Error"
        // };

        let error_data = if let ControllerErrorType::BadRequestWithData(_, data) = self {
            Some(data.clone())
        } else {
            None
        };

        let source = self.source();
        let source_message = source.map(|o| o.to_string());

        let error_response = ErrorResponse {
            title: status
                .canonical_reason()
                .map(|o| o.to_string())
                .unwrap_or_else(|| status.to_string()),
            message: detail.to_string(),
            source: source_message,
            data: error_data,
        };

        HttpResponseBuilder::new(status)
            .append_header(ContentType::json())
            .body(serde_json::to_string(&error_response).unwrap_or_else(|_| r#"{"title": "Internal server error", "message": "Error occured while formatting error message."}"#.to_string()))
    }

    fn status_code(&self) -> StatusCode {
        match *self {
            ControllerErrorType::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ControllerErrorType::BadRequest(_) => StatusCode::BAD_REQUEST,
            ControllerErrorType::BadRequestWithData(_, _) => StatusCode::BAD_REQUEST,
            ControllerErrorType::NotFound(_) => StatusCode::NOT_FOUND,
            ControllerErrorType::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ControllerErrorType::Forbidden(_) => StatusCode::FORBIDDEN,
        }
    }
}

impl From<anyhow::Error> for ControllerError {
    fn from(err: anyhow::Error) -> ControllerError {
        if let Some(sqlx::Error::RowNotFound) = err.downcast_ref::<sqlx::Error>() {
            return Self::NotFound(err.to_string());
        }

        error!("Internal server error: {}", err.chain().join("\n    "));
        Self::InternalServerError(err.to_string())
    }
}

impl From<uuid::Error> for ControllerError {
    fn from(err: uuid::Error) -> ControllerError {
        Self::BadRequest(err.to_string())
    }
}

impl From<sqlx::Error> for ControllerError {
    fn from(err: sqlx::Error) -> ControllerError {
        Self::InternalServerError(err.to_string())
    }
}

impl From<git2::Error> for ControllerError {
    fn from(err: git2::Error) -> ControllerError {
        Self::InternalServerError(err.to_string())
    }
}

impl From<ModelError> for ControllerError {
    fn from(err: ModelError) -> Self {
        match err {
            ModelError::RecordNotFound(_) => Self::NotFound(err.to_string()),
            ModelError::NotFound(_) => Self::NotFound(err.to_string()),
            ModelError::PreconditionFailed(msg) => Self::BadRequest(msg),
            ModelError::PreconditionFailedWithCMSAnchorBlockId { description, id } => {
                Self::BadRequestWithData(description.to_string(), ErrorData::BlockId(id))
            }
            ModelError::DatabaseConstraint { description, .. } => {
                Self::BadRequest(description.to_string())
            }
            ModelError::InvalidRequest(msg) => Self::BadRequest(msg),
            _ => Self::InternalServerError(err.to_string()),
        }
    }
}

impl From<UtilError> for ControllerError {
    fn from(err: UtilError) -> Self {
        Self::InternalServerError(err.to_string())
    }
}

/**
Used as the result types for all controllers.
Only put information here that you want to be visible to users.
*/
pub type ControllerResult<T, E = ControllerError> = std::result::Result<AuthorizedResponse<T>, E>;

/// Result of a image upload. Tells where the uploaded image can be retrieved from.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UploadResult {
    pub url: String,
}

/// Add controllers from all the submodules.
pub fn configure_controllers(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/course-material").configure(course_material::_add_routes))
        .service(web::scope("/cms").configure(cms::_add_routes))
        .service(web::scope("/files").configure(files::_add_routes))
        .service(web::scope("/main-frontend").configure(main_frontend::_add_routes))
        .service(web::scope("/auth").configure(auth::_add_routes))
        .service(web::scope("/study-registry").configure(study_registry::_add_routes));
}
