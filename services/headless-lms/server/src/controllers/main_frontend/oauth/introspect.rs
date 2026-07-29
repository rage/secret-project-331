use crate::domain::oauth::helpers::oauth_invalid_client;
use crate::domain::oauth::introspect_query::IntrospectQuery;
use crate::domain::oauth::introspect_response::IntrospectResponse;
use crate::domain::oauth::oauth_validated::OAuthValidated;
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use headless_lms_base::config::ApplicationConfiguration;
use models::{
    library::oauth::token_digest_sha256,
    oauth_access_token::{OAuthAccessToken, TokenType},
    oauth_client::OAuthClient,
};
use secrecy::ExposeSecret;
use sqlx::PgPool;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(introspect))]
#[allow(dead_code)]
pub(crate) struct MainFrontendOauthIntrospectApiDoc;

/// Handles the `/introspect` endpoint for OAuth 2.0 token introspection (RFC 7662).
///
/// This endpoint allows resource servers to query the authorization server about
/// the active state and metadata of an access token.
///
/// ### Security Features
/// - Client authentication is required (client_id and client_secret for confidential clients);
///   an unknown client or bad secret is 401 `invalid_client` (RFC 7662 §2.3)
/// - Returns 200 with `active: false` for an invalid/expired *token* (RFC 7662 §2.1), so token
///   existence is never disclosed to an authenticated caller
///
/// ### Request Parameters
/// - `token` (required): The token to be introspected
/// - `token_type_hint` (optional): Hint about token type ("access_token" or "refresh_token")
/// - `client_id` (required): Client identifier
/// - `client_secret` (required for confidential clients): Client secret
///
/// ### Response
/// Returns a JSON object with:
/// - `active` (bool, required): Whether the token is active
/// - Additional fields only present if `active: true`:
///   - `scope`: Space-separated list of scopes
///   - `client_id`: Client identifier
///   - `username`/`sub`: User identifier (if token has user)
///   - `exp`: Expiration timestamp (Unix time)
///   - `iat`: Issued at timestamp (Unix time)
///   - `aud`: Audience
///   - `iss`: Issuer
///   - `jti`: JWT ID
///   - `token_type`: "Bearer" or "DPoP"
/// - Non-standard members, returned only to callers that authenticated as a
///   confidential client and omitted (never falsified) otherwise:
///   - `upstream_id`: the token owner's legacy TMC user id
///   - `client_bearer_allowed`: whether the client the token was issued to may use it
///     as a plain Bearer credential. Consumers must fail closed if it is absent.
///
/// Follows [RFC 7662 — OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662).
///
/// # Example
/// ```http
/// POST /api/v0/main-frontend/oauth/introspect HTTP/1.1
/// Content-Type: application/x-www-form-urlencoded
///
/// token=ACCESS_TOKEN&client_id=test-client-id&client_secret=test-secret
/// ```
///
/// Successful response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
/// Cache-Control: no-store
///
/// {
///   "active": true,
///   "scope": "openid profile email",
///   "client_id": "test-client-id",
///   "sub": "550e8400-e29b-41d4-a716-446655440000",
///   "username": "550e8400-e29b-41d4-a716-446655440000",
///   "exp": 1735689600,
///   "iat": 1735686000,
///   "iss": "https://example.com/api/v0/main-frontend/oauth",
///   "jti": "123e4567-e89b-12d3-a456-426614174000",
///   "token_type": "Bearer"
/// }
/// ```
///
/// Inactive token response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
/// Cache-Control: no-store
///
/// {
///   "active": false
/// }
/// ```
#[instrument(skip(pool, app_conf, form))]
#[utoipa::path(
    post,
    path = "/introspect",
    operation_id = "introspectOauthToken",
    tag = "oauth",
    request_body(
        content = serde_json::Value,
        content_type = "application/x-www-form-urlencoded"
    ),
    responses(
        (status = 200, description = "OAuth token introspection response", body = serde_json::Value),
        (status = 401, description = "Client authentication failed (invalid_client)")
    )
)]
pub async fn introspect(
    pool: web::Data<PgPool>,
    OAuthValidated(form): OAuthValidated<IntrospectQuery>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    // Add non-secret fields to the span for observability
    tracing::Span::current().record("client_id", &form.client_id);

    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
    let client = authenticate_introspecting_client(&mut conn, &form, token_hmac_key).await?;

    // Hash the provided token to get digest
    let token_digest = token_digest_sha256(form.token.expose_secret(), token_hmac_key);

    // Look up the access token (only access tokens are supported)
    let access_token_result = OAuthAccessToken::find_valid(&mut conn, token_digest).await;

    // If token not found or expired, return active: false
    let access_token = match access_token_result {
        Ok(token) => token,
        Err(e) => {
            tracing::debug!(err = %e, "OAuth introspect: access token lookup failed (inactive/expired token)");
            return server_token.authorized_ok(
                HttpResponse::Ok()
                    .insert_header(("Cache-Control", "no-store"))
                    .json(IntrospectResponse::inactive()),
            );
        }
    };

    // Add token type to span for observability
    tracing::Span::current().record("token_type", format!("{:?}", access_token.token_type));
    tracing::Span::current().record("token_active", "true");

    // Fetch the client that originally issued the token (not the introspecting client)
    let token_client = OAuthClient::find_by_id(&mut conn, access_token.client_id).await?;

    let upstream_id = resolve_gated_upstream_id(&mut conn, &client, access_token.user_id).await;
    let client_bearer_allowed = resolve_gated_bearer_allowed(&client, &token_client);

    // Build response with token metadata
    let base_url = app_conf.base_url.trim_end_matches('/');
    let issuer = format!("{}/api/v0/main-frontend/oauth", base_url);

    let response = IntrospectResponse {
        active: true,
        scope: Some(access_token.scopes.join(" ")),
        client_id: Some(token_client.client_id.clone()),
        username: access_token.user_id.map(|id| id.to_string()),
        exp: Some(access_token.expires_at.timestamp()),
        iat: Some(access_token.created_at.timestamp()),
        sub: access_token.user_id.map(|id| id.to_string()),
        aud: access_token.audience.clone(),
        iss: Some(issuer),
        jti: Some(access_token.jti.to_string()),
        token_type: Some(match access_token.token_type {
            TokenType::Bearer => "Bearer".to_string(),
            TokenType::DPoP => "DPoP".to_string(),
        }),
        upstream_id,
        client_bearer_allowed,
    };

    server_token.authorized_ok(
        HttpResponse::Ok()
            .insert_header(("Cache-Control", "no-store"))
            .json(response),
    )
}

/// Authenticate the caller of the introspection endpoint.
///
/// Rejects an unknown `client_id` or a bad secret with 401 `invalid_client` (RFC 7662 §2.3).
/// Only the *token's* validity is reported as `200 {"active": false}` (§2.1): folding failed
/// **client** authentication into that answer makes a caller's credential typo
/// indistinguishable from every one of its users holding an inactive token. No enumeration
/// risk, since an unauthenticated caller never reaches a token lookup.
async fn authenticate_introspecting_client(
    conn: &mut sqlx::PgConnection,
    form: &crate::domain::oauth::introspect_query::IntrospectParams,
    token_hmac_key: &secrecy::SecretString,
) -> Result<OAuthClient, ControllerError> {
    let client = OAuthClient::find_by_client_id(conn, &form.client_id)
        .await
        .map_err(|e| {
            tracing::warn!(err = %e, "OAuth introspect: unknown client_id");
            oauth_invalid_client("invalid client_id")
        })?;

    if client.is_confidential() {
        let Some(secret) = &client.client_secret else {
            tracing::warn!("OAuth introspect: confidential client has no stored secret");
            return Err(oauth_invalid_client("invalid client secret"));
        };
        let provided = token_digest_sha256(
            form.client_secret
                .as_ref()
                .map(|s| s.expose_secret())
                .unwrap_or_default(),
            token_hmac_key,
        );
        if !secret.constant_eq(&provided) {
            tracing::warn!("OAuth introspect: invalid client secret");
            return Err(oauth_invalid_client("invalid client secret"));
        }
    }

    Ok(client)
}

/// Resolve the token owner's legacy TMC `upstream_id` for the introspection
/// response — a privileged, non-standard claim consumed by tmc-server.
///
/// Only a caller that authenticated as a **confidential** client (its secret was
/// verified before this point) receives it; for public clients the user lookup is
/// skipped entirely. A lookup failure omits the claim rather than failing
/// introspection.
async fn resolve_gated_upstream_id(
    conn: &mut sqlx::PgConnection,
    introspecting_client: &OAuthClient,
    token_user_id: Option<uuid::Uuid>,
) -> Option<i32> {
    if !introspecting_client.is_confidential() {
        return None;
    }
    match token_user_id {
        Some(user_id) => match models::users::get_by_id(conn, user_id).await {
            Ok(user) => user.upstream_id,
            Err(e) => {
                tracing::warn!(err = %e, "OAuth introspect: token user lookup failed; omitting upstream_id");
                None
            }
        },
        None => None,
    }
}

/// Resolve the `client_bearer_allowed` member of the introspection response — a privileged,
/// non-standard member letting resource servers apply the same `bearer_allowed = false`
/// rejection `domain::exercise_services::token` applies here.
///
/// Reports the **issuing** client (`token_client`), never the introspecting caller. Gated like
/// `upstream_id`: disclosed only to a confidential caller, and omitted rather than serialized
/// as `false` otherwise, so a `false` is never ambiguous between "not permitted" and "not
/// disclosed". See `IntrospectResponse::client_bearer_allowed` for the fail-closed contract.
fn resolve_gated_bearer_allowed(
    introspecting_client: &OAuthClient,
    token_client: &OAuthClient,
) -> Option<bool> {
    if !introspecting_client.is_confidential() {
        return None;
    }
    Some(token_client.allows_bearer())
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/introspect", web::post().to(introspect));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::oauth::introspect_query::IntrospectParams;
    use crate::test_helper::*;
    use headless_lms_models::{
        library::oauth::{GrantTypeName, generate_access_token, token_digest_sha256},
        oauth_client::{ApplicationType, NewClientParams, OAuthClient, TokenEndpointAuthMethod},
    };
    use secrecy::SecretString;
    use sqlx::PgConnection;
    use uuid::Uuid;

    fn hmac_key() -> SecretString {
        SecretString::new("test-introspect-hmac-key".to_string().into())
    }

    async fn insert_client(
        conn: &mut PgConnection,
        auth_method: TokenEndpointAuthMethod,
        bearer_allowed: bool,
    ) -> OAuthClient {
        let client_id = format!("cli-{}", &generate_access_token()[..12]);
        let secret = token_digest_sha256("introspect-test-secret", &hmac_key());
        let (client_secret, require_pkce) = match auth_method {
            TokenEndpointAuthMethod::ClientSecretPost => (Some(&secret), false),
            TokenEndpointAuthMethod::None => (None, true),
        };
        OAuthClient::insert(
            conn,
            NewClientParams {
                client_id: &client_id,
                client_name: "Introspect test client",
                application_type: ApplicationType::Service,
                token_endpoint_auth_method: auth_method,
                client_secret,
                client_secret_expires_at: None,
                redirect_uris: &["https://example.com/callback".to_string()],
                post_logout_redirect_uris: None,
                allowed_grant_types: &[GrantTypeName::RefreshToken],
                scopes: &["exercise-services".to_string()],
                require_pkce,
                pkce_methods_allowed: &[],
                allowed_origins: None,
                bearer_allowed,
            },
        )
        .await
        .unwrap()
    }

    /// A confidential caller (secret verified) receives the privileged
    /// `upstream_id` claim.
    #[actix_web::test]
    async fn upstream_id_exposed_to_confidential_client() {
        insert_data!(:tx);
        let user = headless_lms_models::users::insert_with_upstream_id_and_moocfi_id(
            tx.as_mut(),
            "introspect-confidential@example.com",
            None,
            None,
            424242,
            Uuid::new_v4(),
        )
        .await
        .unwrap();
        let client =
            insert_client(tx.as_mut(), TokenEndpointAuthMethod::ClientSecretPost, true).await;

        let upstream_id = resolve_gated_upstream_id(tx.as_mut(), &client, Some(user.id)).await;
        assert_eq!(upstream_id, Some(424242));
    }

    /// A public caller (no secret) never receives `upstream_id`, even for a token
    /// whose owner has one.
    #[actix_web::test]
    async fn upstream_id_hidden_from_public_client() {
        insert_data!(:tx);
        let user = headless_lms_models::users::insert_with_upstream_id_and_moocfi_id(
            tx.as_mut(),
            "introspect-public@example.com",
            None,
            None,
            515151,
            Uuid::new_v4(),
        )
        .await
        .unwrap();
        let client = insert_client(tx.as_mut(), TokenEndpointAuthMethod::None, true).await;

        let upstream_id = resolve_gated_upstream_id(tx.as_mut(), &client, Some(user.id)).await;
        assert_eq!(upstream_id, None);
    }

    /// A confidential caller learns that the token's issuing client may use Bearer
    /// tokens, so tmc-server can accept a token this backend would also accept.
    #[actix_web::test]
    async fn client_bearer_allowed_reported_true_to_confidential_client() {
        insert_data!(:tx);
        let caller =
            insert_client(tx.as_mut(), TokenEndpointAuthMethod::ClientSecretPost, true).await;
        let token_client = insert_client(tx.as_mut(), TokenEndpointAuthMethod::None, true).await;

        assert_eq!(
            resolve_gated_bearer_allowed(&caller, &token_client),
            Some(true)
        );
    }

    /// The case the member exists for: a token issued to a client barred from Bearer
    /// use. `Some(false)` is what lets tmc-server refuse the token, matching
    /// `domain::exercise_services::token`'s own `allows_bearer` rejection.
    #[actix_web::test]
    async fn client_bearer_allowed_reported_false_to_confidential_client() {
        insert_data!(:tx);
        let caller =
            insert_client(tx.as_mut(), TokenEndpointAuthMethod::ClientSecretPost, true).await;
        let token_client = insert_client(tx.as_mut(), TokenEndpointAuthMethod::None, false).await;

        assert_eq!(
            resolve_gated_bearer_allowed(&caller, &token_client),
            Some(false)
        );
    }

    /// A public caller is told nothing — the member is omitted, not reported as
    /// `false`, so a `false` in the wire response is always authoritative.
    #[actix_web::test]
    async fn client_bearer_allowed_hidden_from_public_client() {
        insert_data!(:tx);
        let caller = insert_client(tx.as_mut(), TokenEndpointAuthMethod::None, true).await;
        let token_client = insert_client(tx.as_mut(), TokenEndpointAuthMethod::None, true).await;

        assert_eq!(resolve_gated_bearer_allowed(&caller, &token_client), None);
    }

    /// The member describes the *issuing* client, not the introspecting caller:
    /// a caller with `bearer_allowed = true` introspecting a token from a
    /// `bearer_allowed = false` client must see `false`, and vice versa.
    #[actix_web::test]
    async fn client_bearer_allowed_reflects_issuing_client_not_caller() {
        insert_data!(:tx);
        let permissive_caller =
            insert_client(tx.as_mut(), TokenEndpointAuthMethod::ClientSecretPost, true).await;
        let restricted_caller = insert_client(
            tx.as_mut(),
            TokenEndpointAuthMethod::ClientSecretPost,
            false,
        )
        .await;
        let permissive_token_client =
            insert_client(tx.as_mut(), TokenEndpointAuthMethod::None, true).await;
        let restricted_token_client =
            insert_client(tx.as_mut(), TokenEndpointAuthMethod::None, false).await;

        assert_eq!(
            resolve_gated_bearer_allowed(&permissive_caller, &restricted_token_client),
            Some(false),
            "a permissive caller must not mask the issuing client's restriction"
        );
        assert_eq!(
            resolve_gated_bearer_allowed(&restricted_caller, &permissive_token_client),
            Some(true),
            "the caller's own bearer_allowed must not leak into the response"
        );
    }

    fn params(client_id: &str, client_secret: Option<&str>) -> IntrospectParams {
        IntrospectParams {
            client_id: client_id.to_string(),
            client_secret: client_secret.map(|s| SecretString::new(s.to_string().into())),
            token: SecretString::new("some-token".to_string().into()),
            token_type_hint: None,
        }
    }

    fn assert_invalid_client(err: ControllerError) {
        match err.error_type() {
            ControllerErrorType::OAuthError(data) => assert_eq!(data.error, "invalid_client"),
            other => panic!("expected OAuthError invalid_client, got {:?}", other),
        }
    }

    #[actix_web::test]
    async fn confidential_client_with_the_right_secret_authenticates() {
        insert_data!(:tx);
        let client =
            insert_client(tx.as_mut(), TokenEndpointAuthMethod::ClientSecretPost, true).await;

        let authenticated = authenticate_introspecting_client(
            tx.as_mut(),
            &params(&client.client_id, Some("introspect-test-secret")),
            &hmac_key(),
        )
        .await
        .expect("correct credentials must authenticate");
        assert_eq!(authenticated.id, client.id);
    }

    /// A wrong-but-non-blank `client_id` must be a distinguishable 401 `invalid_client`, not
    /// `200 {"active": false}` — otherwise a caller's credential typo looks exactly like every
    /// one of its users' tokens expiring at once.
    #[actix_web::test]
    async fn unknown_client_id_is_invalid_client() {
        insert_data!(:tx);

        let err = authenticate_introspecting_client(
            tx.as_mut(),
            &params("no-such-client", Some("introspect-test-secret")),
            &hmac_key(),
        )
        .await
        .expect_err("an unknown client_id must be rejected");
        assert_invalid_client(err);
    }

    /// Same reasoning as an unknown `client_id`: a rotated-but-not-redeployed secret is
    /// misconfiguration on the caller's side, not a statement about the token.
    #[actix_web::test]
    async fn wrong_client_secret_is_invalid_client() {
        insert_data!(:tx);
        let client =
            insert_client(tx.as_mut(), TokenEndpointAuthMethod::ClientSecretPost, true).await;

        let err = authenticate_introspecting_client(
            tx.as_mut(),
            &params(&client.client_id, Some("wrong-secret")),
            &hmac_key(),
        )
        .await
        .expect_err("a wrong client secret must be rejected");
        assert_invalid_client(err);

        let missing = authenticate_introspecting_client(
            tx.as_mut(),
            &params(&client.client_id, None),
            &hmac_key(),
        )
        .await
        .expect_err("a confidential client must not authenticate without a secret");
        assert_invalid_client(missing);
    }

    /// A public client has no secret to check, so it authenticates without one — it just never
    /// receives the privileged members.
    #[actix_web::test]
    async fn public_client_authenticates_without_a_secret() {
        insert_data!(:tx);
        let client = insert_client(tx.as_mut(), TokenEndpointAuthMethod::None, true).await;

        let authenticated = authenticate_introspecting_client(
            tx.as_mut(),
            &params(&client.client_id, None),
            &hmac_key(),
        )
        .await
        .expect("a public client needs no secret");
        assert_eq!(authenticated.id, client.id);
    }
}
