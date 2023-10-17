/*!
Handlers for HTTP requests to `/api/v0`.

This documents all endpoints. Select a module below for a namespace.

*/

// tracing::instrument seems to have issues with this
#![allow(clippy::suspicious_else_formatting)]

pub mod auth;
pub mod cms;
pub mod course_material;
pub mod exercise_services;
pub mod files;
pub mod healthz;
pub mod helpers;
pub mod langs;
pub mod main_frontend;
pub mod other_domain_redirects;
pub mod study_registry;
pub mod tmc_server;

use crate::domain::error::{ControllerError, ControllerErrorType};
use actix_web::{
    web::{self, ServiceConfig},
    HttpRequest, HttpResponse, ResponseError,
};
use headless_lms_utils::prelude::*;
use serde::{Deserialize, Serialize};
#[cfg(feature = "ts_rs")]
use ts_rs::TS;

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
        .service(web::scope("/study-registry").configure(study_registry::_add_routes))
        .service(web::scope("/exercise-services").configure(exercise_services::_add_routes))
        .service(
            web::scope("/other-domain-redirects").configure(other_domain_redirects::_add_routes),
        )
        .service(web::scope("/healthz").configure(healthz::_add_routes))
        .service(web::scope("/langs").configure(langs::_add_routes))
        .service(web::scope("/tmc-server").configure(langs::_add_routes))
        .default_service(web::to(not_found));
}

async fn not_found(req: HttpRequest) -> HttpResponse {
    ControllerError::new(
        ControllerErrorType::NotFound,
        format!("No handler found for route '{}'", req.path()),
        None,
    )
    .error_response()
}
