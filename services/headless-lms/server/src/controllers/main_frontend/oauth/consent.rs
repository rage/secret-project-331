use crate::domain::mcp_auth::oauth_issuer;
use crate::domain::oauth::client_metadata_document::{is_loopback_host, redirect_uri_matches};
use crate::domain::oauth::consent_deny_query::ConsentDenyQuery;
use crate::domain::oauth::consent_query::ConsentQuery;
use crate::domain::oauth::consent_response::ConsentResponse;
use crate::domain::oauth::helpers::{oauth_invalid_request, split_and_validate_scopes};
use crate::prelude::*;
use actix_web::{Error, HttpResponse, web};
use models::{
    error::ModelErrorType, library::oauth::mcp::McpScope, oauth_client::OAuthClient,
    oauth_user_client_scopes::OAuthUserClientScopes,
};
use sqlx::PgPool;
use url::{Url, form_urlencoded};
use utoipa::{IntoParams, OpenApi, ToSchema};

#[derive(OpenApi)]
#[openapi(paths(approve_consent, deny_consent, get_consent_info))]
#[allow(dead_code)]
pub(crate) struct MainFrontendOauthConsentApiDoc;

#[derive(Debug, Deserialize, IntoParams)]
pub struct ConsentInfoQuery {
    pub client_id: String,
    pub redirect_uri: String,
    /// The requested scopes, space-separated.
    pub scope: String,
}

/// One requested scope as the consent screen shows it.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ConsentScope {
    pub scope: String,
    /// The user cannot uncheck it.
    pub is_required: bool,
    pub is_checked_by_default: bool,
    /// The user already granted it to this client.
    pub was_previously_granted: bool,
}

/// What the consent screen shows about the client asking for access.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ConsentInfo {
    /// The client's public id; for agents, the URL of its metadata document.
    pub client_id: String,
    pub client_name: String,
    pub client_uri: Option<String>,
    pub logo_uri: Option<String>,
    /// Where the browser goes after approving: shown so the user can see which client is asking,
    /// since any client can claim any name.
    pub redirect_uri: String,
    /// The redirect goes to a program on the user's own computer.
    pub is_loopback_redirect: bool,
    /// Whether the client registered itself through a client ID metadata document, as AI agents
    /// do.
    pub is_metadata_document_client: bool,
    pub scopes: Vec<ConsentScope>,
}

/**
GET `/api/v0/main-frontend/oauth/consent-info` - What the consent screen shows: the client asking
and a checkbox state per requested scope. The client must already be known, which the authorize
endpoint ensures before redirecting to the consent screen.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/consent-info",
    operation_id = "getOauthConsentInfo",
    tag = "oauth",
    params(ConsentInfoQuery),
    responses(
        (status = 200, description = "Consent screen data", body = ConsentInfo)
    )
)]
pub async fn get_consent_info(
    pool: web::Data<PgPool>,
    query: web::Query<ConsentInfoQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<ConsentInfo>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let client = OAuthClient::find_by_client_id(&mut conn, &query.client_id).await?;
    if !redirect_uri_matches(&client.redirect_uris, &query.redirect_uri) {
        return Err(controller_err!(
            BadRequest,
            "redirect_uri does not match client".to_string()
        ));
    }
    let granted = OAuthUserClientScopes::find_scopes(&mut conn, user.id, client.id).await?;
    let mut requested: Vec<String> = query.scope.split_whitespace().map(str::to_string).collect();
    let requests_mcp_scope = requested.iter().any(|s| McpScope::parse(s).is_some());
    if requests_mcp_scope
        && !requested
            .iter()
            .any(|s| s == McpScope::MaterialRead.as_str())
    {
        requested.insert(0, McpScope::MaterialRead.as_str().to_string());
    }
    let scopes = requested
        .into_iter()
        .map(|scope| {
            let mcp_scope = McpScope::parse(&scope);
            ConsentScope {
                is_required: mcp_scope.is_none_or(McpScope::is_required),
                is_checked_by_default: mcp_scope.is_none_or(McpScope::is_checked_by_default),
                was_previously_granted: granted.contains(&scope),
                scope,
            }
        })
        .collect();
    let is_loopback_redirect = Url::parse(&query.redirect_uri)
        .map(|url| is_loopback_host(&url))
        .unwrap_or(false);
    token.authorized_ok(web::Json(ConsentInfo {
        is_metadata_document_client: client.is_metadata_document_client(),
        client_id: client.client_id,
        client_name: client.client_name,
        client_uri: client.client_uri,
        logo_uri: client.logo_uri,
        redirect_uri: query.redirect_uri.clone(),
        is_loopback_redirect,
        scopes,
    }))
}

/// Handles `/consent` approval after the user agrees to grant requested scopes.
///
/// This endpoint:
/// - Validates the redirect URI and the approved scopes against the registered client.
/// - Records the approved scopes for the user-client pair.
/// - Redirects back to `/authorize` with the approved scopes, so the code is issued for them.
///
/// `scope` is what the user approved, which may be fewer scopes than requested. If it contains
/// any MCP scope it must contain `material:read`.
///
/// # Example
/// ```http
/// POST /api/v0/main-frontend/oauth/consent HTTP/1.1
/// Cookie: session=abc123
///
/// {"client_id":"test-client-id","redirect_uri":"http://localhost","scope":"openid profile","state":"random123","nonce":"secure_nonce_abc","response_type":"code"}
/// ```
///
/// Response:
/// ```json
/// {"redirect_uri": "/api/v0/main-frontend/oauth/authorize?client_id=..."}
/// ```
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/consent",
    operation_id = "approveOauthConsent",
    tag = "oauth",
    request_body = ConsentQuery,
    responses(
        (status = 200, description = "Consent approval response", body = ConsentResponse)
    )
)]
pub async fn approve_consent(
    pool: web::Data<PgPool>,
    form: web::Json<ConsentQuery>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let client = OAuthClient::find_by_client_id(&mut conn, &form.client_id).await?;
    if !redirect_uri_matches(&client.redirect_uris, &form.redirect_uri) {
        return Err(oauth_invalid_request(
            "redirect_uri does not match client",
            None, // Never redirect to an invalid redirect_uri (security)
            Some(&form.state),
        ));
    }

    let approved_scopes = split_and_validate_scopes(&form.scope, &client.scopes)
        .map_err(|_| oauth_invalid_request("invalid scope", None, Some(&form.state)))?;
    if approved_scopes.is_empty() {
        return Err(oauth_invalid_request(
            "no scope approved",
            None,
            Some(&form.state),
        ));
    }
    let approves_mcp_scope = approved_scopes
        .iter()
        .any(|scope| McpScope::parse(scope).is_some());
    if approves_mcp_scope
        && !approved_scopes
            .iter()
            .any(|scope| scope == McpScope::MaterialRead.as_str())
    {
        return Err(oauth_invalid_request(
            "material:read is required",
            None,
            Some(&form.state),
        ));
    }

    OAuthUserClientScopes::insert(&mut conn, user.id, client.id, &approved_scopes).await?;

    // Redirect to /authorize (the OAuth authorize endpoint typically remains a GET)
    let mut query_string = String::new();
    {
        let mut query_builder = form_urlencoded::Serializer::new(&mut query_string);
        query_builder
            .append_pair("client_id", &form.client_id)
            .append_pair("redirect_uri", &form.redirect_uri)
            .append_pair("scope", &approved_scopes.join(" "))
            .append_pair("state", &form.state)
            .append_pair("nonce", &form.nonce)
            .append_pair("response_type", &form.response_type);

        // Preserve PKCE parameters if present
        if let Some(code_challenge) = &form.code_challenge {
            query_builder.append_pair("code_challenge", code_challenge);
        }
        if let Some(code_challenge_method) = &form.code_challenge_method {
            query_builder.append_pair("code_challenge_method", code_challenge_method);
        }
        if let Some(resource) = &form.resource {
            query_builder.append_pair("resource", resource);
        }
    }
    let query = query_string;

    // Relative Location: browser resolves against current origin
    let location = format!("/api/v0/main-frontend/oauth/authorize?{}", query);

    token.authorized_ok(HttpResponse::Ok().json(ConsentResponse {
        redirect_uri: location,
    }))
}

/// Handles `/consent/deny` when the user refuses to grant scopes.
///
/// This endpoint:
/// - Redirects back to the client with `error=access_denied` and `iss` (RFC 9207).
///
/// # Example
/// ```http
/// POST /api/v0/main-frontend/oauth/consent/deny HTTP/1.1
///
/// {"client_id":"test-client-id","redirect_uri":"http://localhost","state":"random123"}
/// ```
///
/// Response:
/// ```json
/// {"redirect_uri": "http://localhost?error=access_denied&state=random123&iss=..."}
/// ```
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    post,
    path = "/consent/deny",
    operation_id = "denyOauthConsent",
    tag = "oauth",
    request_body = ConsentDenyQuery,
    responses(
        (status = 200, description = "Consent denial response", body = ConsentResponse)
    )
)]
pub async fn deny_consent(
    pool: web::Data<PgPool>,
    form: web::Json<ConsentDenyQuery>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> Result<HttpResponse, Error> {
    let mut conn = pool.acquire().await.map_err(|e| {
        tracing::error!(err = %e, "OAuth consent/deny: pool acquire failed");
        actix_web::error::ErrorInternalServerError(e)
    })?;

    let client_result = OAuthClient::find_by_client_id(&mut conn, &form.client_id).await;
    let client = match client_result {
        Ok(c) => c,
        Err(err) => {
            return Err(match err.error_type() {
                ModelErrorType::RecordNotFound | ModelErrorType::NotFound => {
                    actix_web::error::ErrorNotFound("client not found")
                }
                _ => {
                    tracing::error!(err = %err, "OAuth consent/deny: client lookup failed");
                    actix_web::error::ErrorInternalServerError(err)
                }
            });
        }
    };

    if !redirect_uri_matches(&client.redirect_uris, &form.redirect_uri) {
        return Err(actix_web::error::ErrorBadRequest("invalid redirect URI"));
    }

    let mut url = Url::parse(&form.redirect_uri)
        .map_err(|_| actix_web::error::ErrorBadRequest("invalid redirect URI"))?;

    {
        let mut qp = url.query_pairs_mut();
        qp.append_pair("error", "access_denied");
        if !form.state.is_empty() {
            qp.append_pair("state", &form.state);
        }
        qp.append_pair("iss", &oauth_issuer(&app_conf));
    }

    Ok(HttpResponse::Ok().json(ConsentResponse {
        redirect_uri: url.to_string(),
    }))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/consent", web::post().to(approve_consent))
        .route("/consent/deny", web::post().to(deny_consent))
        .route("/consent-info", web::get().to(get_consent_info));
}
