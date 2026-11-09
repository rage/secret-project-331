//! Authentication for the MCP server at `/api/v0/mcp`, and the RFC 9728 metadata its 401
//! challenge points to.

use actix_web::{
    Error, HttpMessage, HttpResponse,
    body::{EitherBody, MessageBody},
    dev::{ServiceRequest, ServiceResponse},
    http::header,
    middleware::Next,
    web,
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::library::oauth::{
    bearer::{BearerTokenError, TokenSubject, bearer_token},
    mcp::{McpScope, authenticate_mcp_access_token},
};
use serde_json::json;

use super::McpEndpoint;
use crate::protocol::www_authenticate_challenge;

/// Where the MCP server's RFC 9728 protected resource metadata is served.
pub fn protected_resource_metadata_url(app_conf: &ApplicationConfiguration) -> String {
    app_conf.public_url("/.well-known/oauth-protected-resource/api/v0/mcp")
}

/**
GET `/.well-known/oauth-protected-resource/api/v0/mcp` - RFC 9728 protected resource metadata of the
MCP server: which authorization server issues its tokens and which scopes exist.
*/
pub async fn protected_resource_metadata(
    app_conf: web::Data<ApplicationConfiguration>,
) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "resource": app_conf.mcp_resource_url(),
        "authorization_servers": [app_conf.oauth_issuer()],
        "scopes_supported": McpScope::all_strs(),
        "bearer_methods_supported": ["header"],
        "resource_name": "courses.mooc.fi course material",
    }))
}

/// Middleware for the MCP route scope, through `actix_web::middleware::from_fn`: validates the
/// Bearer token for the MCP audience and puts the `McpPrincipal` and its `TokenSubject` in the
/// request extensions, or answers 401 with the challenge that starts the client's OAuth flow.
pub async fn authenticate(
    endpoint: web::Data<McpEndpoint>,
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<EitherBody<impl MessageBody>>, Error> {
    let app_conf = &endpoint.state.app_conf;
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(bearer_token)
        .map(str::to_string);
    let Some(token) = token else {
        return Ok(unauthorized(req, app_conf, None));
    };
    let mut conn = endpoint
        .state
        .pool
        .acquire()
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;
    let principal = match authenticate_mcp_access_token(
        &mut conn,
        &token,
        &app_conf.oauth_server_configuration.oauth_token_hmac_key,
        &app_conf.mcp_resource_url(),
    )
    .await
    {
        Ok(principal) => principal,
        Err(BearerTokenError::Invalid(description)) => {
            return Ok(unauthorized(
                req,
                app_conf,
                Some(("invalid_token", description)),
            ));
        }
        Err(BearerTokenError::Database(err)) => {
            return Err(actix_web::error::ErrorInternalServerError(err));
        }
    };
    drop(conn);
    req.extensions_mut().insert(TokenSubject {
        user_id: principal.actor.user_id,
        grant_id: principal.actor.oauth_grant_id,
    });
    req.extensions_mut().insert(principal);
    next.call(req)
        .await
        .map(ServiceResponse::map_into_left_body)
}

fn unauthorized<B>(
    req: ServiceRequest,
    app_conf: &ApplicationConfiguration,
    error: Option<(&str, &str)>,
) -> ServiceResponse<EitherBody<B>> {
    let response = HttpResponse::Unauthorized()
        .insert_header((
            header::WWW_AUTHENTICATE,
            www_authenticate_challenge(
                &protected_resource_metadata_url(app_conf),
                &McpScope::all_strs().join(" "),
                error,
            ),
        ))
        .finish();
    req.into_response(response).map_into_right_body()
}
