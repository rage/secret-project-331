/*!
Handlers for HTTP requests to `/api/v0`.

This documents all endpoints. Select a module below for a namespace.

*/

pub mod auth;
pub mod cms;
pub mod course_material;
pub mod files;
pub mod main_frontend;

use actix_web::{
    dev::HttpResponseBuilder,
    error,
    http::header::ContentType,
    web::{self, ServiceConfig},
    HttpResponse,
};
use derive_more::Display;
use http_api_problem::{HttpApiProblem, StatusCode};
use itertools::Itertools;
use serde::{Deserialize, Serialize};

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
    NotFound,

    #[display(fmt = "Unauthorized")]
    Unauthorized,

    #[display(fmt = "Forbidden")]
    Forbidden(String),
}

impl std::error::Error for ControllerError {}

impl error::ResponseError for ControllerError {
    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        let detail = if let ControllerError::InternalServerError(reason)
        | ControllerError::BadRequest(reason)
        | ControllerError::Forbidden(reason) = self
        {
            reason
        } else {
            "Error"
        };
        let problem_description =
            HttpApiProblem::with_title_and_type_from_status(status).set_detail(detail);

        HttpResponseBuilder::new(status)
            .append_header(ContentType::json())
            .body(&problem_description.json_string())
    }

    fn status_code(&self) -> StatusCode {
        match *self {
            ControllerError::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ControllerError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ControllerError::NotFound => StatusCode::NOT_FOUND,
            ControllerError::Unauthorized => StatusCode::UNAUTHORIZED,
            ControllerError::Forbidden(_) => StatusCode::FORBIDDEN,
        }
    }
}

impl From<anyhow::Error> for ControllerError {
    fn from(err: anyhow::Error) -> ControllerError {
        if let Some(sqlx::Error::RowNotFound) = err.downcast_ref::<sqlx::Error>() {
            return Self::NotFound;
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
        Self::InternalServerError(err.to_string())
    }
}

/**
Used as the result types for all controllers.
Only put information here that you want to be visible to users.
*/
pub type ControllerResult<T, E = ControllerError> = std::result::Result<T, E>;

/// Add controllers from all the submodules.
pub fn configure_controllers<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/course-material").configure(add_course_material_routes))
        .service(web::scope("/cms").configure(add_cms_routes::<T>))
        .service(web::scope("/files").configure(_add_files_routes))
        .service(web::scope("/main-frontend").configure(add_main_frontend_routes))
        .service(web::scope("/auth").configure(add_auth_routes));
}
