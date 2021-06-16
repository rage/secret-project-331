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
pub enum ApplicationError {
    #[display(fmt = "Internal server error")]
    InternalServerError(String),

    #[display(fmt = "Bad request")]
    BadRequest(String),

    #[display(fmt = "Not found")]
    NotFound,
}

impl std::error::Error for ApplicationError {}

impl error::ResponseError for ApplicationError {
    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        let mut detail = "Error";
        if let ApplicationError::InternalServerError(reason) = self {
            detail = reason;
        }
        if let ApplicationError::BadRequest(reason) = self {
            detail = reason;
        }
        let problem_description =
            HttpApiProblem::with_title_and_type_from_status(status).set_detail(detail);

        HttpResponseBuilder::new(status)
            .append_header(ContentType::json())
            .body(&problem_description.json_string())
    }

    fn status_code(&self) -> StatusCode {
        match *self {
            ApplicationError::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApplicationError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ApplicationError::NotFound => StatusCode::NOT_FOUND,
        }
    }
}

impl From<anyhow::Error> for ApplicationError {
    fn from(err: anyhow::Error) -> ApplicationError {
        if let Some(sqlx::Error::RowNotFound) = err.downcast_ref::<sqlx::Error>() {
            return Self::NotFound;
        }

        error!("Internal server error: {}", err.chain().join("\n    "));
        Self::InternalServerError(err.to_string())
    }
}

impl From<uuid::Error> for ApplicationError {
    fn from(err: uuid::Error) -> ApplicationError {
        Self::BadRequest(err.to_string())
    }
}

impl From<sqlx::Error> for ApplicationError {
    fn from(err: sqlx::Error) -> ApplicationError {
        Self::InternalServerError(err.to_string())
    }
}

/**
Used as the result types for all controllers.
Only put information here that you want to be visible to users.
*/
pub type ApplicationResult<T, E = ApplicationError> = std::result::Result<T, E>;

/// Add controllers from all the submodules.
pub fn configure_controllers(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/course-material").configure(add_course_material_routes))
        .service(web::scope("/cms").configure(add_cms_routes))
        .service(web::scope("/files").configure(_add_files_routes))
        .service(web::scope("/main-frontend").configure(add_main_frontend_routes))
        .service(web::scope("/auth").configure(add_auth_routes));
}
