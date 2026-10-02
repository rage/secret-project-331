//! Server process configuration, composition, and startup.
pub mod config;
pub mod programs;
pub use headless_lms_base::tracing::setup_tracing;
pub use headless_lms_external_service_clients::service_clients;
pub use headless_lms_http_api::{controllers, generated_docs, openapi};
pub use headless_lms_mock_suotar::mock_suotar;
pub use headless_lms_use_cases::domain;
#[cfg(test)]
mod env_guard;
#[macro_use]
extern crate tracing;
pub type OAuthClient = headless_lms_use_cases::OAuthClient;
pub use headless_lms_cli_tools::doc;
