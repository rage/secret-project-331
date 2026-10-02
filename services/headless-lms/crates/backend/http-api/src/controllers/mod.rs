/*!
Handlers for HTTP requests to `/api/v0`.

This documents all endpoints. Select a module below for a namespace.

*/

// tracing::instrument seems to have issues with this
#![allow(clippy::suspicious_else_formatting)]

pub mod auth;
pub mod cms;
pub mod course_material;
pub mod errors;
pub mod exercise_services;
pub mod files;
pub mod health;
pub mod helpers;
pub mod main_frontend;
pub mod other_domain_redirects;
pub mod study_registry;
pub mod tmc_server;
use crate::domain::error::{ControllerError, ControllerErrorType};
use crate::domain::{
    rate_limit_middleware_builder::RateLimit, request_span_middleware::RequestSpan,
};
use actix_web::{
    HttpRequest, HttpResponse, ResponseError,
    web::{self, ServiceConfig},
};
use headless_lms_utils::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Result of a image upload. Tells where the uploaded image can be retrieved from.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct UploadResult {
    pub url: String,
}

/// Owns the public API scope, its middleware, and its route registration.
pub fn configure_api(cfg: &mut ServiceConfig, app_conf: web::Data<ApplicationConfiguration>) {
    let api_rate_limit_config = RateLimit::global_api_rate_limit_config(app_conf.test_mode);
    cfg.service(
        web::scope("/api/v0")
            .wrap(RateLimit::new(api_rate_limit_config))
            .wrap(RequestSpan)
            .configure(|cfg| configure_controllers(cfg, app_conf)),
    );
}

/// Add controllers from all the submodules.
pub fn configure_controllers(
    cfg: &mut ServiceConfig,
    app_conf: web::Data<ApplicationConfiguration>,
) {
    cfg.service(web::scope("/course-material").configure(course_material::_add_routes))
        .service(web::scope("/cms").configure(cms::_add_routes))
        .service(web::scope("/files").configure(files::_add_routes))
        .service(web::scope("/main-frontend").configure(main_frontend::_add_routes))
        .service(web::scope("/auth").configure(auth::_add_routes))
        .service(web::scope("/errors").configure(errors::_add_routes))
        .service(web::scope("/study-registry").configure(study_registry::_add_routes))
        .service(web::scope("/exercise-services").configure(exercise_services::_add_routes))
        .service(
            web::scope("/other-domain-redirects").configure(other_domain_redirects::_add_routes),
        )
        .service(web::scope("/health").configure(health::_add_routes))
        .service(web::scope("/tmc-server").configure(tmc_server::_add_routes))
        .default_service(web::to(not_found));
    if app_conf.test_chatbot && app_conf.test_mode {
        cfg.service(
            web::scope("/mock-azure")
                .configure(headless_lms_mock_azure_ai::mock_azure::_add_routes),
        )
        .service(
            web::scope("/mock-document-storage")
                .configure(headless_lms_mock_chatbot_documents::mock_document_storage::_add_routes),
        );
    }
    if app_conf.test_sisu && app_conf.test_mode {
        cfg.service(
            web::scope("/mock-sisu").configure(headless_lms_mock_sisu::mock_sisu::_add_routes),
        );
    }
    if app_conf.test_suotar && app_conf.test_mode {
        cfg.service(headless_lms_mock_suotar::controllers::scope());
    }
}

async fn not_found(req: HttpRequest) -> HttpResponse {
    ControllerError::new(
        ControllerErrorType::NotFound,
        format!("No handler found for route '{}'", req.path()),
        None,
    )
    .error_response()
}
