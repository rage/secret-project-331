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
pub mod mock_azure;
pub mod mock_document_storage;
pub mod mock_sisu;
pub mod mock_suotar;
pub mod other_domain_redirects;
pub mod study_registry;
pub mod tmc_server;
pub mod well_known;
use crate::domain::error::{ControllerError, ControllerErrorType};
use crate::domain::rate_limit_middleware_builder::{RateLimit, RateLimitConfig, RateLimitKey};
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
        .service({
            let [per_grant, per_user] = mcp_rate_limits(app_conf.test_mode);
            // Registered inside out: authentication runs first and gives the limits their key.
            web::scope("/mcp")
                .wrap(per_grant)
                .wrap(per_user)
                .wrap(actix_web::middleware::from_fn(
                    headless_lms_mcp::http::auth::authenticate,
                ))
                .configure(headless_lms_mcp::http::configure)
        })
        .default_service(web::to(not_found));
    if app_conf.test_chatbot && app_conf.test_mode {
        cfg.service(web::scope("/mock-azure").configure(mock_azure::_add_routes))
            .service(
                web::scope("/mock-document-storage").configure(mock_document_storage::_add_routes),
            );
    }
    if app_conf.test_sisu && app_conf.test_mode {
        cfg.service(web::scope("/mock-sisu").configure(mock_sisu::_add_routes));
    }
    if app_conf.test_suotar && app_conf.test_mode {
        cfg.service(mock_suotar::scope());
    }
}

/// The MCP server's limits, per grant and per user. A user's grants together get twice what one
/// grant does, so one runaway agent cannot use up the quota of the user's other agent.
fn mcp_rate_limits(test_mode: bool) -> [RateLimit; 2] {
    let multiplier = if test_mode { 100 } else { 1 };
    let limit = |per_minute: u64, per_hour: u64, key| {
        RateLimit::new(RateLimitConfig {
            per_minute: Some(per_minute * multiplier),
            per_hour: Some(per_hour * multiplier),
            ..Default::default()
        })
        .keyed_by(key)
    };
    [
        limit(120, 3000, RateLimitKey::Grant),
        limit(240, 6000, RateLimitKey::User),
    ]
}

async fn not_found(req: HttpRequest) -> HttpResponse {
    ControllerError::new(
        ControllerErrorType::NotFound,
        format!("No handler found for route '{}'", req.path()),
        None,
    )
    .error_response()
}
