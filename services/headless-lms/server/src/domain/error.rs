use std::error::Error;

use crate::domain::authorization::AuthorizedResponse;
use actix_web::{
    error,
    http::{header::ContentType, StatusCode},
    HttpResponse, HttpResponseBuilder,
};
use backtrace::Backtrace;
use derive_more::Display;
use headless_lms_models::{ModelError, ModelErrorType};
use headless_lms_utils::error::{backend_error::BackendError, util_error::UtilError};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::fmt::Write as _;
use tracing_error::SpanTrace;
#[cfg(feature = "ts_rs")]
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Display, Serialize, Deserialize)]
pub enum ControllerErrorType {
    /// HTTP status code 500.
    #[display(fmt = "Internal server error")]
    InternalServerError,

    /// HTTP status code 400.
    #[display(fmt = "Bad request")]
    BadRequest,

    /// HTTP status code 400.
    #[display(fmt = "Bad request")]
    BadRequestWithData(ErrorData),

    /// HTTP status code 404.
    #[display(fmt = "Not found")]
    NotFound,

    /// HTTP status code 401. Needs to log in.
    #[display(fmt = "Unauthorized")]
    Unauthorized,

    /// HTTP status code 403. Is logged in but is not allowed to access the resource.
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
    source: Option<anyhow::Error>,
    /// A trace of tokio tracing spans, generated automatically when the error is generated.
    span_trace: SpanTrace,
    /// Stack trace, generated automatically when the error is created.
    backtrace: Backtrace,
}

impl std::error::Error for ControllerError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source.as_ref().and_then(|o| o.source())
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
        source_error: Option<anyhow::Error>,
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
        if let ControllerErrorType::InternalServerError = &self.error_type {
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
        let error_data = if let ControllerErrorType::BadRequestWithData(data) = &self.error_type {
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
            message: self.message.clone(),
            source: source_message,
            data: error_data,
        };

        HttpResponseBuilder::new(status)
            .append_header(ContentType::json())
            .body(serde_json::to_string(&error_response).unwrap_or_else(|_| r#"{"title": "Internal server error", "message": "Error occured while formatting error message."}"#.to_string()))
    }

    fn status_code(&self) -> StatusCode {
        match self.error_type {
            ControllerErrorType::InternalServerError => StatusCode::INTERNAL_SERVER_ERROR,
            ControllerErrorType::BadRequest => StatusCode::BAD_REQUEST,
            ControllerErrorType::BadRequestWithData(_) => StatusCode::BAD_REQUEST,
            ControllerErrorType::NotFound => StatusCode::NOT_FOUND,
            ControllerErrorType::Unauthorized => StatusCode::UNAUTHORIZED,
            ControllerErrorType::Forbidden => StatusCode::FORBIDDEN,
        }
    }
}

impl From<anyhow::Error> for ControllerError {
    fn from(err: anyhow::Error) -> ControllerError {
        if let Some(sqlx::Error::RowNotFound) = err.downcast_ref::<sqlx::Error>() {
            return Self::new(ControllerErrorType::NotFound, err.to_string(), Some(err));
        }

        error!("Internal server error: {}", err.chain().join("\n    "));
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err),
        )
    }
}

impl From<uuid::Error> for ControllerError {
    fn from(err: uuid::Error) -> ControllerError {
        Self::new(
            ControllerErrorType::BadRequest,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<sqlx::Error> for ControllerError {
    fn from(err: sqlx::Error) -> ControllerError {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<git2::Error> for ControllerError {
    fn from(err: git2::Error) -> ControllerError {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<ModelError> for ControllerError {
    fn from(err: ModelError) -> Self {
        match err.error_type() {
            ModelErrorType::RecordNotFound => Self::new(
                ControllerErrorType::NotFound,
                err.to_string(),
                Some(err.into()),
            ),
            ModelErrorType::NotFound => Self::new(
                ControllerErrorType::NotFound,
                err.to_string(),
                Some(err.into()),
            ),
            ModelErrorType::PreconditionFailed => Self::new(
                ControllerErrorType::BadRequest,
                err.message().to_string(),
                Some(err.into()),
            ),
            ModelErrorType::PreconditionFailedWithCMSAnchorBlockId { description, id } => {
                Self::new(
                    ControllerErrorType::BadRequestWithData(ErrorData::BlockId(*id)),
                    description.to_string(),
                    Some(err.into()),
                )
            }
            ModelErrorType::DatabaseConstraint { description, .. } => Self::new(
                ControllerErrorType::BadRequest,
                description.to_string(),
                Some(err.into()),
            ),
            ModelErrorType::InvalidRequest => Self::new(
                ControllerErrorType::BadRequest,
                err.message().to_string(),
                Some(err.into()),
            ),
            _ => Self::new(
                ControllerErrorType::InternalServerError,
                err.to_string(),
                Some(err.into()),
            ),
        }
    }
}

impl From<UtilError> for ControllerError {
    fn from(err: UtilError) -> Self {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

/**
Used as the result types for all controllers.
Only put information here that you want to be visible to users.
*/
pub type ControllerResult<T, E = ControllerError> = std::result::Result<AuthorizedResponse<T>, E>;
