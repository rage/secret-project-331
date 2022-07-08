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
use derive_more::Display;
use headless_lms_models::ModelError;
use headless_lms_utils::UtilError;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
#[cfg(feature = "ts_rs")]
use ts_rs::TS;
use uuid::Uuid;

/**
Represents error messages that are sent in responses.

# Example
```json
{
    "title": "Internal Server Error",
    "message": "pool timed out while waiting for an open connection"
    "source": "source of error"
}
```
*/
#[derive(Debug, Display, Serialize, Deserialize)]
pub enum ControllerError {
    #[display(fmt = "Internal server error")]
    InternalServerError(String),

    #[display(fmt = "Bad request")]
    BadRequest(String),

    #[display(fmt = "Bad request")]
    BadRequestWithData(String, ErrorData),

    #[display(fmt = "Not found")]
    NotFound(String),

    #[display(fmt = "Unauthorized")]
    Unauthorized(String),

    #[display(fmt = "Forbidden")]
    Forbidden(String),
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

impl std::error::Error for ControllerError {}

impl error::ResponseError for ControllerError {
    fn error_response(&self) -> HttpResponse {
        if let ControllerError::InternalServerError(_) = &self {
            let mut err_string = String::new();
            let mut source = Some(&self as &dyn Error);
            while let Some(err) = source {
                err_string += &format!("{}\n    ", err);
                source = err.source();
            }
            error!("Internal server error: {}", err_string);
        }

        let status = self.status_code();
        let detail = if let ControllerError::InternalServerError(reason)
        | ControllerError::BadRequest(reason)
        | ControllerError::BadRequestWithData(reason, _)
        | ControllerError::Forbidden(reason)
        | ControllerError::Unauthorized(reason) = self
        {
            reason
        } else {
            "Error"
        };

        let error_data = if let ControllerError::BadRequestWithData(_, data) = self {
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
            ControllerError::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ControllerError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ControllerError::BadRequestWithData(_, _) => StatusCode::BAD_REQUEST,
            ControllerError::NotFound(_) => StatusCode::NOT_FOUND,
            ControllerError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ControllerError::Forbidden(_) => StatusCode::FORBIDDEN,
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
