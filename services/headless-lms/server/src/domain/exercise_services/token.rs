use crate::{domain::authorization, prelude::*};
use actix_web::{FromRequest, http::header};
use futures_util::{FutureExt, future::LocalBoxFuture};
use headless_lms_utils::cache::Cache;
use models::{
    library::oauth::{EXERCISE_SERVICES_SCOPE, token_digest_sha256},
    oauth_access_token::{OAuthAccessToken, TokenType},
    oauth_client::OAuthClient,
    users::User,
};
use secrecy::{ExposeSecret, SecretString};
use sqlx::PgConnection;
use std::ops::{Deref, DerefMut};
use std::time::Duration;

/// Authenticated user extracted from a courses.mooc.fi OAuth 2.0 access token.
///
/// The client sends an opaque access token issued by this backend's own OAuth
/// provider (via the device-authorization flow) as `Authorization: Bearer <token>`.
/// The token is hashed to a digest, looked up in `oauth_access_tokens`, gated on
/// the `exercise-services` scope, and mapped to the local user that owns it.
///
/// This replaced the earlier `UserFromTMCAccessToken`, which validated a TMC
/// access token against tmc.mooc.fi. The error bodies and status codes are kept
/// byte-for-byte identical to that extractor so the tmc-langs client's error
/// mapping keeps working:
///  - a missing / invalid / expired / revoked token, a token whose client may
///    not use Bearer tokens, a sender-constrained (DPoP) token, or a token whose
///    user no longer exists all yield `401` with an `unauthorized` body;
///  - a valid token that lacks the `exercise-services` scope yields `403` with a
///    `forbidden` body.
#[derive(Debug, Clone)]
pub struct UserFromOAuthToken(User);

impl Deref for UserFromOAuthToken {
    type Target = User;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for UserFromOAuthToken {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

/// Builds the `401 unauthorized` error the langs client expects for any rejected token.
fn unauthorized(message: &str) -> ControllerError {
    ControllerError::new(
        ControllerErrorType::Unauthorized,
        message.to_string(),
        None::<anyhow::Error>,
    )
}

/// Builds the `403 forbidden` error the langs client expects for a token missing the scope.
fn forbidden(message: &str) -> ControllerError {
    ControllerError::new(
        ControllerErrorType::Forbidden,
        message.to_string(),
        None::<anyhow::Error>,
    )
}

/// Classify a model lookup error raised while resolving a Bearer token.
///
/// A genuinely absent row — the token, its client, or its user does not exist
/// (or the user is soft-deleted) — is an authentication failure and maps to
/// `401` with the `unauthorized` body the langs client keys on. Any other error
/// is an infrastructure failure (a sqlx connection/statement error surfaces as
/// `ModelErrorType::Database`) and must propagate as a `500`.
///
/// This distinction is load-bearing: langs turns a `401` into
/// refresh-then-DELETE-credentials, so collapsing a transient DB blip into `401`
/// (as the previous blanket `.map_err(|_| unauthorized(...))` did) would
/// force-log-out every user during the outage. The removed TMC extractor kept
/// transport errors as `5xx` for exactly this reason.
fn lookup_error(err: models::ModelError, unauthorized_message: &str) -> ControllerError {
    use headless_lms_base::error::backend_error::BackendError;
    match err.error_type() {
        models::ModelErrorType::RecordNotFound | models::ModelErrorType::NotFound => {
            unauthorized(unauthorized_message)
        }
        _ => {
            let source: anyhow::Error = err.into();
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "A database error occurred while validating the access token.".to_string(),
                Some(source),
            )
        }
    }
}

/// Resolve an opaque Bearer access token to the local user that owns it.
///
/// Pure DB work (no actix, no cache) so it can be unit-tested directly. Flow:
/// digest the token → look up a still-valid `oauth_access_tokens` row → reject
/// sender-constrained (DPoP) tokens (this API is Bearer-only, so
/// `find_valid_for_sender` is deliberately not used) → require the issuing
/// client to allow Bearer tokens → require the `exercise-services` scope → load
/// the user.
async fn resolve_oauth_user(
    conn: &mut PgConnection,
    token: &SecretString,
    token_hmac_key: &SecretString,
) -> Result<User, ControllerError> {
    let digest = token_digest_sha256(token.expose_secret(), token_hmac_key);
    let access_token = OAuthAccessToken::find_valid(conn, digest)
        .await
        .map_err(|e| lookup_error(e, "The access token is missing, invalid, or expired."))?;

    // Bearer-only: a DPoP (sender-constrained) token must be presented with a
    // proof, which this API does not verify, so reject it rather than accept it
    // unbound.
    if access_token.token_type != TokenType::Bearer {
        return Err(unauthorized(
            "This API accepts only Bearer tokens; the presented token is sender-constrained.",
        ));
    }

    // The issuing client must be allowed to use Bearer tokens.
    let client = OAuthClient::find_by_id(conn, access_token.client_id)
        .await
        .map_err(|e| lookup_error(e, "The access token's client could not be found."))?;
    if !client.allows_bearer() {
        return Err(unauthorized(
            "The access token's client is not permitted to use Bearer tokens.",
        ));
    }

    // Scope gate: the token must carry the exercise-services scope.
    if !access_token
        .scopes
        .iter()
        .any(|scope| scope == EXERCISE_SERVICES_SCOPE)
    {
        return Err(forbidden(
            "The access token does not grant the required exercise-services scope.",
        ));
    }

    let user_id = access_token
        .user_id
        .ok_or_else(|| unauthorized("The access token is not associated with a user."))?;

    // `get_active_by_id` filters `deleted_at IS NULL`, so a soft-deleted
    // (banned/removed) user resolves to RecordNotFound -> 401, rather than
    // continuing to authenticate until the token expires.
    let user = models::users::get_active_by_id(conn, user_id)
        .await
        .map_err(|e| lookup_error(e, "The access token's user could not be found."))?;

    Ok(user)
}

impl FromRequest for UserFromOAuthToken {
    type Error = ControllerError;
    type Future = LocalBoxFuture<'static, Result<Self, ControllerError>>;

    fn from_request(req: &HttpRequest, _payload: &mut actix_http::Payload) -> Self::Future {
        let pool = req
            .app_data::<web::Data<PgPool>>()
            .expect("Missing database pool")
            .clone();
        let app_conf = req
            .app_data::<web::Data<ApplicationConfiguration>>()
            .expect("Missing application configuration")
            .clone();
        let cache = req
            .app_data::<web::Data<Cache>>()
            .expect("Missing cache")
            .clone();

        let auth_header = req
            .headers()
            .get(header::AUTHORIZATION)
            .map(|hv| String::from_utf8_lossy(hv.as_bytes()))
            .and_then(|h| h.strip_prefix("Bearer ").map(str::to_string))
            .map(|o| SecretString::new(o.into()));

        async move {
            let Some(token) = auth_header else {
                return Err(unauthorized("Missing bearer token"));
            };
            let mut conn = pool.acquire().await?;

            // In test/dev mode a small set of fixed tokens map straight to seeded
            // users so tests can call the API without running a full device flow.
            // Any token that is not one of those falls through to the real
            // OAuth-token path below, so genuine device-flow tokens (and their
            // 401/403 rejections) are still exercised end-to-end even here.
            if app_conf.test_mode {
                warn!("Test mode is on: fixed test tokens map directly to seeded users.");
                if let Some(user) =
                    authorization::authenticate_test_token(&mut conn, &token, &app_conf)
                        .await
                        .map_err(|err| {
                            ControllerError::new(
                                ControllerErrorType::Unauthorized,
                                "Could not find user for test token".to_string(),
                                Some(err),
                            )
                        })?
                {
                    return Ok(Self(user));
                }
            }

            // A cached user (keyed by the token) skips the DB re-resolution — and
            // therefore the soft-delete/revocation checks in `resolve_oauth_user`
            // — for up to the 1h cache TTL. That staleness is the accepted
            // revocation-latency window for this API (same order as the access
            // token lifetime); a hard cutoff still happens when the token expires.
            let user = match load_user(&cache, &token).await {
                Some(user) => user,
                None => {
                    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
                    let user = resolve_oauth_user(&mut conn, &token, token_hmac_key).await?;
                    cache_user(&cache, &token, &user).await;
                    user
                }
            };

            Ok(Self(user))
        }
        .boxed_local()
    }
}

fn token_to_cache_key(token: &SecretString) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(token.expose_secret().as_bytes());
    format!("user:{}", hasher.finalize().to_hex())
}

pub async fn cache_user(cache: &Cache, token: &SecretString, user: &User) {
    cache
        .cache_json(
            token_to_cache_key(token),
            user,
            Duration::from_secs(60 * 60),
        )
        .await;
}

pub async fn load_user(cache: &Cache, token: &SecretString) -> Option<User> {
    cache.get_json(token_to_cache_key(token)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;
    use actix_web::ResponseError;
    use actix_web::http::StatusCode;
    use chrono::{Duration as ChronoDuration, Utc};
    use headless_lms_models::library::oauth::pkce::PkceMethod;
    use headless_lms_models::library::oauth::{GrantTypeName, generate_access_token};
    use headless_lms_models::oauth_access_token::NewAccessTokenParams;
    use headless_lms_models::oauth_client::{
        ApplicationType, NewClientParams, OAuthClient, TokenEndpointAuthMethod,
    };

    fn hmac_key() -> SecretString {
        SecretString::new("test-exercise-services-hmac-key".to_string().into())
    }

    async fn insert_client(
        conn: &mut PgConnection,
        scopes: &[String],
        bearer_allowed: bool,
    ) -> OAuthClient {
        let client_id = format!("cli-{}", &generate_access_token()[..12]);
        OAuthClient::insert(
            conn,
            NewClientParams {
                client_id: &client_id,
                client_name: "Exercise services token test client",
                application_type: ApplicationType::Native,
                token_endpoint_auth_method: TokenEndpointAuthMethod::None,
                client_secret: None,
                client_secret_expires_at: None,
                redirect_uris: &["urn:ietf:wg:oauth:2.0:oob".to_string()],
                post_logout_redirect_uris: None,
                allowed_grant_types: &[GrantTypeName::DeviceCode, GrantTypeName::RefreshToken],
                scopes,
                require_pkce: true,
                pkce_methods_allowed: &[PkceMethod::S256],
                allowed_origins: None,
                bearer_allowed,
            },
        )
        .await
        .unwrap()
    }

    /// Insert an access token for the given user/client and return its plaintext.
    async fn insert_token(
        conn: &mut PgConnection,
        client: &OAuthClient,
        user_id: uuid::Uuid,
        scopes: &[String],
        token_type: TokenType,
        expires_at: chrono::DateTime<Utc>,
    ) -> String {
        let plaintext = generate_access_token();
        let digest = token_digest_sha256(&plaintext, &hmac_key());
        let dpop_jkt = match token_type {
            TokenType::Bearer => None,
            // A JWK SHA-256 thumbprint is 43 base64url chars (DB CHECK requires 43..=128).
            TokenType::DPoP => Some("0123456789abcdefghijklmnopqrstuvwxyzABCDEFG"),
        };
        OAuthAccessToken::insert(
            conn,
            NewAccessTokenParams {
                digest: &digest,
                user_id: Some(user_id),
                client_id: client.id,
                scopes,
                audience: None,
                token_type,
                dpop_jkt,
                metadata: serde_json::Map::new(),
                expires_at,
            },
        )
        .await
        .unwrap();
        plaintext
    }

    fn secret(s: &str) -> SecretString {
        SecretString::new(s.to_string().into())
    }

    #[actix_web::test]
    async fn happy_path_returns_the_token_owner() {
        insert_data!(:tx, :user);
        let client = insert_client(tx.as_mut(), &[EXERCISE_SERVICES_SCOPE.to_string()], true).await;
        let token = insert_token(
            tx.as_mut(),
            &client,
            user,
            &[EXERCISE_SERVICES_SCOPE.to_string()],
            TokenType::Bearer,
            Utc::now() + ChronoDuration::hours(1),
        )
        .await;

        let resolved = resolve_oauth_user(tx.as_mut(), &secret(&token), &hmac_key())
            .await
            .expect("valid token should resolve");
        assert_eq!(resolved.id, user);
    }

    #[actix_web::test]
    async fn unknown_token_is_unauthorized() {
        insert_data!(:tx);
        let err = resolve_oauth_user(tx.as_mut(), &secret("not-a-real-token"), &hmac_key())
            .await
            .expect_err("unknown token should be rejected");
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
        assert_unauthorized_body(err);
    }

    #[actix_web::test]
    async fn expired_token_is_unauthorized() {
        insert_data!(:tx, :user);
        let client = insert_client(tx.as_mut(), &[EXERCISE_SERVICES_SCOPE.to_string()], true).await;
        let token = insert_token(
            tx.as_mut(),
            &client,
            user,
            &[EXERCISE_SERVICES_SCOPE.to_string()],
            TokenType::Bearer,
            Utc::now() - ChronoDuration::minutes(1),
        )
        .await;

        let err = resolve_oauth_user(tx.as_mut(), &secret(&token), &hmac_key())
            .await
            .expect_err("expired token should be rejected");
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[actix_web::test]
    async fn missing_scope_is_forbidden() {
        insert_data!(:tx, :user);
        // Client and token both carry a non-exercise-services scope.
        let client = insert_client(tx.as_mut(), &["openid".to_string()], true).await;
        let token = insert_token(
            tx.as_mut(),
            &client,
            user,
            &["openid".to_string()],
            TokenType::Bearer,
            Utc::now() + ChronoDuration::hours(1),
        )
        .await;

        let err = resolve_oauth_user(tx.as_mut(), &secret(&token), &hmac_key())
            .await
            .expect_err("token without the scope should be forbidden");
        assert_eq!(err.status_code(), StatusCode::FORBIDDEN);
        assert_forbidden_body(err);
    }

    #[actix_web::test]
    async fn client_without_bearer_allowed_is_unauthorized() {
        insert_data!(:tx, :user);
        let client =
            insert_client(tx.as_mut(), &[EXERCISE_SERVICES_SCOPE.to_string()], false).await;
        let token = insert_token(
            tx.as_mut(),
            &client,
            user,
            &[EXERCISE_SERVICES_SCOPE.to_string()],
            TokenType::Bearer,
            Utc::now() + ChronoDuration::hours(1),
        )
        .await;

        let err = resolve_oauth_user(tx.as_mut(), &secret(&token), &hmac_key())
            .await
            .expect_err("bearer_allowed=false client should be rejected");
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[actix_web::test]
    async fn dpop_bound_token_is_rejected() {
        insert_data!(:tx, :user);
        let client = insert_client(tx.as_mut(), &[EXERCISE_SERVICES_SCOPE.to_string()], true).await;
        let token = insert_token(
            tx.as_mut(),
            &client,
            user,
            &[EXERCISE_SERVICES_SCOPE.to_string()],
            TokenType::DPoP,
            Utc::now() + ChronoDuration::hours(1),
        )
        .await;

        let err = resolve_oauth_user(tx.as_mut(), &secret(&token), &hmac_key())
            .await
            .expect_err("DPoP-bound token should be rejected on this Bearer-only API");
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[actix_web::test]
    async fn soft_deleted_user_is_unauthorized() {
        insert_data!(:tx, :user);
        let client = insert_client(tx.as_mut(), &[EXERCISE_SERVICES_SCOPE.to_string()], true).await;
        let token = insert_token(
            tx.as_mut(),
            &client,
            user,
            &[EXERCISE_SERVICES_SCOPE.to_string()],
            TokenType::Bearer,
            Utc::now() + ChronoDuration::hours(1),
        )
        .await;

        // Soft-delete the token owner. Their still-valid access token must stop
        // authenticating rather than working until it expires.
        sqlx::query("UPDATE users SET deleted_at = now() WHERE id = $1")
            .bind(user)
            .execute(&mut **tx.as_mut())
            .await
            .unwrap();

        let err = resolve_oauth_user(tx.as_mut(), &secret(&token), &hmac_key())
            .await
            .expect_err("a soft-deleted user's token must be rejected");
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
        assert_unauthorized_body(err);
    }

    #[actix_web::test]
    async fn lookup_error_maps_not_found_to_401_and_db_errors_to_500() {
        use headless_lms_models::{ModelError, ModelErrorType};

        // A missing row (token/client/user absent or soft-deleted) -> 401 with the
        // exact unauthorized body the langs client keys on.
        let not_found = lookup_error(
            ModelError::new(
                ModelErrorType::RecordNotFound,
                "no such row".to_string(),
                None::<anyhow::Error>,
            ),
            "missing",
        );
        assert_eq!(not_found.status_code(), StatusCode::UNAUTHORIZED);
        assert_unauthorized_body(not_found);

        // An infrastructure error (sqlx surfaces connection/statement failures as
        // ModelErrorType::Database) -> 500, so a DB blip never masquerades as an
        // invalid token and forces the client to drop its credentials.
        let db_error = lookup_error(
            ModelError::new(
                ModelErrorType::Database,
                "connection reset".to_string(),
                None::<anyhow::Error>,
            ),
            "missing",
        );
        assert_eq!(
            db_error.status_code(),
            StatusCode::INTERNAL_SERVER_ERROR,
            "transient DB errors must not collapse into 401"
        );
    }

    /// Assert the exact 401 body shape the langs client depends on.
    fn assert_unauthorized_body(err: ControllerError) {
        let response = err.error_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let bytes = actix_web::body::to_bytes(response.into_body())
            .now_or_never()
            .expect("body resolves immediately")
            .expect("body bytes");
        let value: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
        assert_eq!(value["type"], "unauthorized");
        assert_eq!(value["message_key"], "unauthorized");
    }

    /// Assert the exact 403 body shape the langs client depends on.
    fn assert_forbidden_body(err: ControllerError) {
        let response = err.error_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let bytes = actix_web::body::to_bytes(response.into_body())
            .now_or_never()
            .expect("body resolves immediately")
            .expect("body bytes");
        let value: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
        assert_eq!(value["type"], "forbidden");
        assert_eq!(value["message_key"], "forbidden");
    }
}
