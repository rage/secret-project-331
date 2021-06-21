pub mod controllers;
pub mod domain;
pub mod models;
pub mod utils;

#[cfg(test)]
pub mod test_helper;

#[macro_use]
extern crate tracing;

use actix_http::error::InternalError;
use actix_web::web::{self, HttpResponse, ServiceConfig};
use oauth2::basic::BasicClient;
use std::sync::Arc;

pub type OAuthClient = Arc<BasicClient>;

pub fn configure(config: &mut ServiceConfig) {
    let json_config = web::JsonConfig::default()
        .limit(81920)
        .error_handler(|err, _req| {
            info!("Bad request: {}", &err);
            // create custom error response
            let response = HttpResponse::BadRequest().body(format!(
                "{{\"title\": \"Bad Request\", \"detail\": \"{}\"}}",
                &err
            ));
            InternalError::from_response(err, response).into()
        });
    config
        .app_data(json_config)
        .service(web::scope("/api/v0").configure(controllers::configure_controllers));
}
