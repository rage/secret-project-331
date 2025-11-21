use crate::domain::oauth::consent_deny_query::ConsentDenyQuery;
use crate::domain::oauth::consent_query::ConsentQuery;
use crate::domain::oauth::consent_response::ConsentResponse;
use crate::domain::oauth::helpers::oauth_invalid_request;
use crate::prelude::*;
use actix_web::{Error, HttpResponse, web};
use models::{oauth_client::OAuthClient, oauth_user_client_scopes::OAuthUserClientScopes};
use sqlx::PgPool;
use url::{Url, form_urlencoded};

/// Handles `/consent` approval after the user agrees to grant requested scopes.
///
/// This endpoint:
/// - Validates the redirect URI and requested scopes against the registered client.
/// - Records granted scopes for the user-client pair.
/// - Redirects back to `/authorize` to continue the OAuth flow.
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/consent?client_id=test-client-id&redirect_uri=http://localhost&scopes=openid%20profile&state=random123&nonce=secure_nonce_abc HTTP/1.1
/// Cookie: session=abc123
///
/// ```
///
/// Redirect back to `/authorize`:
/// ```http
/// HTTP/1.1 302 Found
/// Location: /api/v0/main-frontend/oauth/authorize?client_id=...
/// ```
#[instrument(skip(pool))]
pub async fn approve_consent(
    pool: web::Data<PgPool>,
    form: web::Json<ConsentQuery>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let client = OAuthClient::find_by_client_id(&mut conn, &form.client_id).await?;
    if !client.redirect_uris.contains(&form.redirect_uri) {
        return Err(oauth_invalid_request(
            "redirect_uri does not match client",
            Some(&form.redirect_uri),
            Some(&form.state),
        ));
    }

    // Validate requested scopes against client.allowed scopes
    let requested_scopes: Vec<String> = form
        .scope
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();

    let allowed_scopes = &client.scopes;

    for scope in &requested_scopes {
        if !allowed_scopes.contains(scope) {
            return Err(oauth_invalid_request(
                "invalid scope",
                None,
                Some(&form.state),
            ));
        }
    }

    OAuthUserClientScopes::insert(&mut conn, user.id, client.id, &requested_scopes).await?;

    // Redirect to /authorize (the OAuth authorize endpoint typically remains a GET)
    let mut query_string = String::new();
    {
        let mut query_builder = form_urlencoded::Serializer::new(&mut query_string);
        query_builder
            .append_pair("client_id", &form.client_id)
            .append_pair("redirect_uri", &form.redirect_uri)
            .append_pair("scope", &form.scope)
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
/// - Redirects back to the client with `error=access_denied`.
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/consent/deny?redirect_uri=http://localhost&state=random123 HTTP/1.1
///
/// ```
///
/// Response:
/// ```http
/// HTTP/1.1 302 Found
/// Location: http://localhost?error=access_denied&state=random123
/// ```
#[instrument]
pub async fn deny_consent(
    pool: web::Data<PgPool>,
    form: web::Json<ConsentDenyQuery>,
) -> Result<HttpResponse, Error> {
    let mut conn = pool
        .acquire()
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let client = OAuthClient::find_by_client_id(&mut conn, &form.client_id)
        .await
        .map_err(actix_web::error::ErrorBadRequest)?;

    if !client.redirect_uris.contains(&form.redirect_uri) {
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
    }

    Ok(HttpResponse::Found()
        .append_header(("Location", url.to_string()))
        .finish())
}
