use crate::domain::oauth::authorize_query::AuthorizeParams;
use crate::domain::oauth::consent_deny_query::ConsentDenyQuery;
use crate::domain::oauth::consent_query::ConsentQuery;
use crate::domain::oauth::consent_response::ConsentResponse;
use crate::domain::oauth::helpers::{oauth_invalid_request, split_and_validate_scopes};
use crate::domain::oauth::redirects::{
    build_authorize_qs, error_redirect_url, is_loopback_host, redirect_uri_matches,
};
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use domain::error::OAuthErrorCode;
use models::{
    library::oauth::mcp::McpScope, oauth_client::OAuthClient,
    oauth_user_client_scopes::OAuthUserClientScopes,
};
use sqlx::PgPool;
use url::Url;
use utoipa::{IntoParams, ToSchema};

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
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
    pub client_name: String,
    pub client_uri: Option<String>,
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
    let client = consent_client(&mut conn, &query.client_id, &query.redirect_uri).await?;
    let granted = OAuthUserClientScopes::find_scopes(&mut conn, user.id, client.id).await?;
    let mut requested: Vec<String> = query.scope.split_whitespace().map(str::to_string).collect();
    if McpScope::lacks_required(requested.iter().map(String::as_str)) {
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
        client_name: client.client_name,
        client_uri: client.client_uri,
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

    let client = consent_client(&mut conn, &form.client_id, &form.redirect_uri).await?;

    let approved_scopes = split_and_validate_scopes(&form.scope, &client.scopes)
        .map_err(|_| oauth_invalid_request("invalid scope", None, Some(&form.state)))?;
    if approved_scopes.is_empty() {
        return Err(oauth_invalid_request(
            "no scope approved",
            None,
            Some(&form.state),
        ));
    }
    if McpScope::lacks_required(approved_scopes.iter().map(String::as_str)) {
        return Err(oauth_invalid_request(
            "material:read is required",
            None,
            Some(&form.state),
        ));
    }

    OAuthUserClientScopes::insert(&mut conn, user.id, client.id, &approved_scopes).await?;

    let approved = AuthorizeParams {
        response_type: form.response_type.clone(),
        client_id: form.client_id.clone(),
        redirect_uri: form.redirect_uri.clone(),
        scope: approved_scopes.join(" "),
        state: Some(form.state.clone()),
        nonce: Some(form.nonce.clone()),
        code_challenge: form.code_challenge.clone(),
        code_challenge_method: form.code_challenge_method.clone(),
        prompt: None,
        request: None,
        resource: form.resource.clone(),
    };
    // Relative Location: browser resolves against current origin
    let location = format!(
        "/api/v0/main-frontend/oauth/authorize?{}",
        build_authorize_qs(&approved)
    );

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
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    consent_client(&mut conn, &form.client_id, &form.redirect_uri).await?;
    let redirect_uri = error_redirect_url(
        &form.redirect_uri,
        OAuthErrorCode::AccessDenied.as_str(),
        None,
        Some(form.state.as_str()).filter(|state| !state.is_empty()),
        Some(&app_conf.oauth_issuer()),
    )
    .ok_or_else(|| oauth_invalid_request("invalid redirect URI", None, None))?;
    token.authorized_ok(HttpResponse::Ok().json(ConsentResponse { redirect_uri }))
}

/// The client a consent request names, provided `redirect_uri` is one of the client's.
async fn consent_client(
    conn: &mut PgConnection,
    client_id: &str,
    redirect_uri: &str,
) -> Result<OAuthClient, ControllerError> {
    let client = OAuthClient::find_by_client_id(conn, client_id).await?;
    if !redirect_uri_matches(&client, redirect_uri) {
        return Err(oauth_invalid_request(
            "redirect_uri does not match client",
            None,
            None,
        ));
    }
    Ok(client)
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/consent", web::post().to(approve_consent))
        .route("/consent/deny", web::post().to(deny_consent))
        .route("/consent-info", web::get().to(get_consent_info));
}
