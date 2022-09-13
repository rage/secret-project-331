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
use backtrace::Backtrace;
use derive_more::Display;
use headless_lms_models::{ModelError, ModelErrorType};
use headless_lms_utils::error::{backend_error::BackendError, util_error::UtilError};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::fmt::Write as _;
use tracing_error::SpanTrace;
#[cfg(feature = "ts_rs")]
use ts_rs::TS;
use uuid::Uuid;

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
