/*!
Handlers for HTTP requests to `/api/v0`.

This documents all endpoints. Select a module below for a namespace.

*/

pub mod auth;
pub mod cms;
pub mod course_material;
pub mod files;
pub mod helpers;
pub mod main_frontend;

use std::error::Error;

use actix_web::{
    error,
    http::header::ContentType,
    web::{self, ServiceConfig},
    HttpResponse,
};
use actix_web::{http::StatusCode, HttpResponseBuilder};
use derive_more::Display;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{models::ModelError, utils::file_store::FileStore};

use self::{
    auth::add_auth_routes, cms::add_cms_routes, course_material::add_course_material_routes,
    files::_add_files_routes, main_frontend::add_main_frontend_routes,
};

/**
Represents error messages that are sent in responses.

# Example
```json
{
    "type": "https://httpstatuses.com/500",
    "status": 500,
    "title": "Internal Server Error",
    "detail": "pool timed out while waiting for an open connection"
}
```
*/
#[derive(Debug, Display, Serialize, Deserialize)]
pub enum ControllerError {
    #[display(fmt = "Internal server error")]
    InternalServerError(String),

    #[display(fmt = "Bad request")]
    BadRequest(String),

    #[display(fmt = "Not found")]
    NotFound(String),

    #[display(fmt = "Unauthorized")]
    Unauthorized(String),

    #[display(fmt = "Forbidden")]
    Forbidden(String),
}

/// The format all error messages from the API is in
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub title: String,
    pub message: String,
    pub source: Option<String>,
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
        | ControllerError::Forbidden(reason) = self
        {
            reason
        } else {
            "Error"
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
        };

        HttpResponseBuilder::new(status)
            .append_header(ContentType::json())
            .body(serde_json::to_string(&error_response).unwrap_or_else(|_| r#"{"title": "Internal server error", "message": "Error occured while formatting error message."}"#.to_string()))
    }

    fn status_code(&self) -> StatusCode {
        match *self {
            ControllerError::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ControllerError::BadRequest(_) => StatusCode::BAD_REQUEST,
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
            ModelError::PreconditionFailed(msg) => Self::BadRequest(msg),
            ModelError::DatabaseConstraint { description, .. } => {
                Self::BadRequest(description.to_string())
            }
            ModelError::InvalidRequest(msg) => Self::BadRequest(msg),
            _ => Self::InternalServerError(err.to_string()),
        }
    }
}

/**
Used as the result types for all controllers.
Only put information here that you want to be visible to users.
*/
pub type ControllerResult<T, E = ControllerError> = std::result::Result<T, E>;

/// Result of a image upload. Tells where the uploaded image can be retrieved from.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct UploadResult {
    pub url: String,
}

/// Add controllers from all the submodules.
pub fn configure_controllers<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/course-material").configure(add_course_material_routes))
        .service(web::scope("/cms").configure(add_cms_routes::<T>))
        .service(web::scope("/files").configure(_add_files_routes))
        .service(web::scope("/main-frontend").configure(add_main_frontend_routes::<T>))
        .service(web::scope("/auth").configure(add_auth_routes));
}
