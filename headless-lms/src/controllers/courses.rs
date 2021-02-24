use crate::models::courses::Course;
use actix_web::{
    dev::HttpResponseBuilder,
    error,
    http::{header::ContentType, StatusCode},
    web::{self, Json},
    HttpResponse, Result,
};
use derive_more::Display;
use http_api_problem::HttpApiProblem;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Display, Serialize, Deserialize)]
enum ApplicationError {
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

pub async fn get_all_courses(pool: web::Data<PgPool>) -> Result<Json<Vec<Course>>> {
    let courses = crate::models::courses::all_courses(pool.get_ref())
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(courses))
}
