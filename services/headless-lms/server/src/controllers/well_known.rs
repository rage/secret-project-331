//! Handlers for `/.well-known` at the server root, where OAuth clients look for metadata.
//!
//! The ingress must route these paths to this server.

use actix_web::{HttpResponse, web};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::library::oauth::mcp::McpScope;

use crate::controllers::main_frontend::oauth::authorization_server_metadata;
use crate::domain::mcp_auth::{mcp_resource_url, oauth_issuer};

/**
GET `/.well-known/oauth-protected-resource/api/v0/mcp` - RFC 9728 protected resource metadata of the
MCP server: which authorization server issues its tokens and which scopes exist. Also served
without the path suffix.
*/
async fn mcp_protected_resource_metadata(
    app_conf: web::Data<ApplicationConfiguration>,
) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "resource": mcp_resource_url(&app_conf),
        "authorization_servers": [oauth_issuer(&app_conf)],
        "scopes_supported": McpScope::ALL.iter().map(|scope| scope.as_str()).collect::<Vec<_>>(),
        "bearer_methods_supported": ["header"],
        "resource_name": "courses.mooc.fi course material",
    }))
}

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
        web::get().to(mcp_protected_resource_metadata),
    )
    .route(
        "/oauth-protected-resource",
        web::get().to(mcp_protected_resource_metadata),
    )
    .route(
        "/oauth-authorization-server/api/v0/main-frontend/oauth",
        web::get().to(oauth_authorization_server_metadata),
    );
}
