/*!
Handlers for HTTP requests to `/api/v0`.

This documents all endpoints. Select a module below for a category.

*/

pub mod courses;
pub mod organizations;
pub mod pages;

use actix_web::{
    dev::HttpResponseBuilder,
    error,
    http::header::ContentType,
    web::{self, ServiceConfig},
    HttpResponse,
};
use derive_more::Display;
use http_api_problem::{HttpApiProblem, StatusCode};
use serde::{Deserialize, Serialize};

use self::{
    courses::_add_courses_routes, organizations::_add_organizations_routes,
    pages::_add_pages_routes,
};

/// Add controllers from all the submodules.
pub fn configure_controllers(cfg: &mut ServiceConfig) {
    cfg.service(web::scope("/courses").configure(_add_courses_routes))
        .service(web::scope("/pages").configure(_add_pages_routes))
        .service(web::scope("/organizations").configure(_add_organizations_routes));
}

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
}

impl std::error::Error for ApplicationError {}

impl error::ResponseError for ApplicationError {
    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        let mut detail = "Error";
        if let ApplicationError::InternalServerError(reason) = self {
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
        }
    }
}
