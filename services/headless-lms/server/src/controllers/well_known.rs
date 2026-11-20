//! Handlers for `/.well-known` at the server root, where OAuth clients look for metadata.
//!
//! The ingress must route these paths to this server.

use actix_web::{HttpResponse, web};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_mcp::http::auth::protected_resource_metadata;

use crate::controllers::main_frontend::oauth::authorization_server_metadata;

/**
GET `/.well-known/oauth-authorization-server/api/v0/main-frontend/oauth` - RFC 8414 authorization
server metadata for the issuer `{base_url}/api/v0/main-frontend/oauth`.
*/
async fn oauth_authorization_server_metadata(
    app_conf: web::Data<ApplicationConfiguration>,
) -> HttpResponse {
    HttpResponse::Ok().json(authorization_server_metadata(&app_conf))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route(
        "/oauth-protected-resource/api/v0/mcp",
        web::get().to(protected_resource_metadata),
    )
    .route(
        "/oauth-protected-resource",
        web::get().to(protected_resource_metadata),
    )
    .route(
        "/oauth-authorization-server/api/v0/main-frontend/oauth",
        web::get().to(oauth_authorization_server_metadata),
    );
}
