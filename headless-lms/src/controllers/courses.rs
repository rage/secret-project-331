use std::str::FromStr;

use crate::models::{courses::Course, pages::Page};
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
use uuid::Uuid;

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

pub async fn get_all_courses(pool: web::Data<PgPool>) -> Result<Json<Vec<Course>>> {
    let courses = crate::models::courses::all_courses(pool.get_ref())
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(courses))
}

pub async fn get_course_pages(
    request_course_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> Result<Json<Vec<Page>>> {
    let course_id = Uuid::from_str(&request_course_id)
        .map_err(|original_error| ApplicationError::BadRequest(original_error.to_string()))?;

    let pages: Vec<Page> = crate::models::pages::course_pages(pool.get_ref(), course_id)
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(pages))
}
