//! OAuth 2.0 Device Authorization Grant endpoints (RFC 8628).
//!
//! Two audiences share this module:
//!
//! - The **device endpoint** `POST /device_authorization` is public (no session)
//!   and called by native clients (e.g. the TMC CLI). It issues an opaque
//!   `device_code` plus a human-typable `user_code` and tells the client where
//!   to send the user.
//! - The **verification endpoints** (`GET /device_verification`,
//!   `POST /device_verification/approve`, `POST /device_verification/deny`) are
//!   session-authed (`AuthUser`) and drive the browser consent page the user
//!   lands on after typing their `user_code`.
//!
//! The DB-touching core of each handler lives in a free function (mirroring the
//! `token.rs` -> `token_service.rs` split) so it can be unit-tested against a
//! real connection without actix extractors.
//!
//! Follows [RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628).

use crate::domain::oauth::helpers::{
    oauth_invalid_client, oauth_invalid_scope, oauth_unauthorized_client,
};
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use chrono::{Duration, Utc};
use headless_lms_base::config::ApplicationConfiguration;
use models::{
    library::oauth::{
        Digest, GrantTypeName, generate_access_token, generate_user_code, token_digest_sha256,
    },
    oauth_client::OAuthClient,
    oauth_device_codes::{NewDeviceCodeParams, OAuthDeviceCode},
    oauth_user_client_scopes::OAuthUserClientScopes,
};
use secrecy::SecretString;
use serde::{Deserialize, Serialize};
use sqlx::{Connection, PgConnection, PgPool};
use utoipa::{OpenApi, ToSchema};
use uuid::Uuid;

#[derive(OpenApi)]
#[openapi(paths(
    device_authorization,
    device_verification,
    approve_device_verification,
    deny_device_verification
))]
#[allow(dead_code)]
pub(crate) struct MainFrontendOauthDeviceApiDoc;

/// Device code lifetime. Must stay within the DB CHECK ceiling (30 minutes).
const DEVICE_CODE_TTL_MINUTES: i64 = 15;
/// Minimum seconds a client should wait between polls of the token endpoint.
const DEVICE_CODE_INTERVAL_SECONDS: i32 = 5;

/// Form body for `POST /device_authorization` (RFC 8628 §3.1).
#[derive(Debug, Deserialize, ToSchema)]
pub struct DeviceAuthorizationForm {
    pub client_id: String,
    /// Space-delimited requested scopes. Optional; when absent the client's
    /// registered scopes are used.
    #[serde(default)]
    pub scope: Option<String>,
}

/// Success body for `POST /device_authorization` (RFC 8628 §3.2).
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceAuthorizationResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: String,
    pub expires_in: i64,
    pub interval: i32,
}

/// Query for the verification page render data (`GET /device_verification`).
#[derive(Debug, Deserialize, ToSchema)]
pub struct DeviceVerificationQuery {
    pub user_code: String,
}

/// Render data returned to the verification page so it can show the user what
/// they are about to authorize.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceVerificationInfo {
    /// Public client identifier (the `client_id` string, not the internal UUID).
    pub client_id: String,
    /// Human-readable client name for display.
    pub client_name: String,
    /// Scopes the client is requesting.
    pub scopes: Vec<String>,
    /// The normalized `user_code` (`XXXX-XXXX`), echoed back for display.
    pub user_code: String,
}

/// Body for the approve/deny verification actions.
#[derive(Debug, Deserialize, ToSchema)]
pub struct DeviceDecisionBody {
    pub user_code: String,
}

/// Result of an approve/deny action.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceDecisionResponse {
    /// `"approved"` or `"denied"`.
    pub status: String,
}

/// Normalize a user-entered `user_code` into the canonical `XXXX-XXXX` shape.
///
/// Uppercases, strips everything that is not a base32 alphanumeric (so a missing
/// or extra hyphen and surrounding whitespace are tolerated), and re-inserts the
/// single group separator when exactly eight characters remain. Malformed input
/// is returned uppercased-and-stripped and simply won't match any stored code.
fn normalize_user_code(input: &str) -> String {
    let cleaned: String = input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_uppercase();
    if cleaned.len() == 8 {
        format!("{}-{}", &cleaned[..4], &cleaned[4..])
    } else {
        cleaned
    }
}

/// A `ControllerError` for a `user_code` that has no still-pending grant.
fn device_code_not_found() -> ControllerError {
    ControllerError::new(
        ControllerErrorType::NotFound,
        "no pending device authorization for this user_code".to_string(),
        None::<anyhow::Error>,
    )
}

/// Resolve and validate the requested scopes against the client's registered
/// scopes. An empty/absent request defaults to the client's full scope set
/// (RFC 8628 §3.1 makes `scope` optional).
fn resolve_device_scopes(
    client: &OAuthClient,
    scope: Option<&str>,
) -> Result<Vec<String>, ControllerError> {
    let requested: Vec<String> = match scope {
        Some(s) if s.split_whitespace().next().is_some() => {
            s.split_whitespace().map(|s| s.to_string()).collect()
        }
        _ => client.scopes.clone(),
    };
    for s in &requested {
        if !client.scopes.contains(s) {
            return Err(oauth_invalid_scope("requested scope is not allowed"));
        }
    }
    Ok(requested)
}

/// Number of times a colliding `user_code` is regenerated before giving up.
const DEVICE_USER_CODE_MAX_ATTEMPTS: usize = 3;

/// True when `err` is the pending-`user_code` unique-index violation (the
/// generated code clashed with another still-pending grant). Keyed on the mapped
/// constraint name rather than string-matching the raw DB message.
fn is_pending_user_code_collision(err: &models::ModelError) -> bool {
    matches!(
        err.error_type(),
        models::ModelErrorType::DatabaseConstraint { constraint, .. }
            if constraint == "uq_oauth_device_codes_user_code_pending"
    )
}

/// Insert a pending device code, regenerating the `user_code` on the rare
/// collision with another still-pending grant. The `user_code` space is large
/// (~2^40), so a clash is vanishingly unlikely — but when it happens it must
/// retry rather than surface a 500.
///
/// Each attempt runs inside its own savepoint so a unique-violation rolls back
/// cleanly and leaves the surrounding connection usable for the next try.
/// Returns the `user_code` that was successfully stored.
async fn insert_device_code_retrying_user_code(
    conn: &mut PgConnection,
    device_code_digest: &Digest,
    client_id: Uuid,
    scopes: &[String],
    expires_at: chrono::DateTime<Utc>,
    mut next_user_code: impl FnMut() -> String,
) -> Result<String, ControllerError> {
    let mut last_err = None;
    for _ in 0..DEVICE_USER_CODE_MAX_ATTEMPTS {
        let user_code = next_user_code();
        let mut savepoint = conn.begin().await?;
        let result = OAuthDeviceCode::insert(
            &mut savepoint,
            NewDeviceCodeParams {
                device_code_digest,
                user_code: &user_code,
                client_id,
                scopes,
                interval_seconds: DEVICE_CODE_INTERVAL_SECONDS,
                expires_at,
                metadata: serde_json::Map::new(),
            },
        )
        .await;
        match result {
            Ok(()) => {
                savepoint.commit().await?;
                return Ok(user_code);
            }
            Err(e) if is_pending_user_code_collision(&e) => {
                savepoint.rollback().await?;
                last_err = Some(e);
            }
            Err(e) => {
                savepoint.rollback().await?;
                return Err(e.into());
            }
        }
    }
    // Every attempt collided (astronomically unlikely). Surface the last error.
    Err(last_err
        .expect("the retry loop records the collision error on every attempt")
        .into())
}

/// Core of `POST /device_authorization`: look up the client, gate on the
/// device-code grant, validate scopes, generate + store the codes, and build the
/// RFC 8628 response. `verification_uri` is derived as `{base_url}/oauth_device`.
async fn create_device_authorization(
    conn: &mut PgConnection,
    form: &DeviceAuthorizationForm,
    token_hmac_key: &SecretString,
    base_url: &str,
) -> Result<DeviceAuthorizationResponse, ControllerError> {
    let client = OAuthClient::find_by_client_id(conn, &form.client_id)
        .await
        .map_err(|e| {
            tracing::warn!(err = %e, "device_authorization: client lookup failed");
            oauth_invalid_client("invalid client_id")
        })?;

    if !client.allows_grant(GrantTypeName::DeviceCode) {
        return Err(oauth_unauthorized_client(
            "client is not allowed the device_code grant",
        ));
    }

    let requested_scopes = resolve_device_scopes(&client, form.scope.as_deref())?;

    let device_code = generate_access_token();
    let device_code_digest = token_digest_sha256(&device_code, token_hmac_key);
    let expires_at = Utc::now() + Duration::minutes(DEVICE_CODE_TTL_MINUTES);

    let user_code = insert_device_code_retrying_user_code(
        conn,
        &device_code_digest,
        client.id,
        &requested_scopes,
        expires_at,
        generate_user_code,
    )
    .await?;

    let base_url = base_url.trim_end_matches('/');
    let verification_uri = format!("{}/oauth_device", base_url);
    let verification_uri_complete = format!("{}?user_code={}", verification_uri, user_code);

    Ok(DeviceAuthorizationResponse {
        device_code,
        user_code,
        verification_uri,
        verification_uri_complete,
        expires_in: DEVICE_CODE_TTL_MINUTES * 60,
        interval: DEVICE_CODE_INTERVAL_SECONDS,
    })
}

/// Core of `GET /device_verification`: look up the pending grant for a
/// (already normalized) `user_code` and gather the render data.
async fn load_device_verification_info(
    conn: &mut PgConnection,
    user_code: &str,
) -> Result<DeviceVerificationInfo, ControllerError> {
    let device = OAuthDeviceCode::find_pending_by_user_code(conn, user_code)
        .await
        .map_err(|_| device_code_not_found())?;
    let client = OAuthClient::find_by_id(conn, device.client_id).await?;
    Ok(DeviceVerificationInfo {
        client_id: client.client_id,
        client_name: client.client_name,
        scopes: device.scopes,
        user_code: user_code.to_string(),
    })
}

/// Core of `POST /device_verification/approve`: persist consent (always, never
/// short-circuited) then approve the pending grant, binding it to `user_id`.
async fn approve_device(
    conn: &mut PgConnection,
    user_code: &str,
    user_id: Uuid,
) -> Result<(), ControllerError> {
    // Look up the pending grant first so we know which client + scopes to
    // record consent for.
    let device = OAuthDeviceCode::find_pending_by_user_code(conn, user_code)
        .await
        .map_err(|_| device_code_not_found())?;

    // Persist consent exactly like the web consent flow (Decision 3: always
    // record consent; never short-circuit on an existing grant).
    OAuthUserClientScopes::insert(conn, user_id, device.client_id, &device.scopes).await?;

    OAuthDeviceCode::approve(conn, user_code, user_id)
        .await
        .map_err(|_| device_code_not_found())?;
    Ok(())
}

/// Core of `POST /device_verification/deny`.
async fn deny_device(conn: &mut PgConnection, user_code: &str) -> Result<(), ControllerError> {
    OAuthDeviceCode::deny(conn, user_code)
        .await
        .map_err(|_| device_code_not_found())?;
    Ok(())
}

/// Handles `POST /device_authorization` — the RFC 8628 device authorization
/// endpoint.
///
/// Public, form-encoded, no session required (rate-limited like `/token`).
/// Validates the client, checks it is allowed the device-code grant, validates
/// requested scopes against the client's registered scopes, then issues an
/// opaque `device_code` (stored only as an HMAC digest) plus a human-typable
/// `user_code`.
///
/// Follows [RFC 8628 §3.1–§3.2](https://datatracker.ietf.org/doc/html/rfc8628#section-3.1).
///
/// # Example
/// ```http
/// POST /api/v0/main-frontend/oauth/device_authorization HTTP/1.1
/// Content-Type: application/x-www-form-urlencoded
///
/// client_id=tmc-cli-vscode&scope=exercise-services
/// ```
///
/// Successful response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
///
/// {
///   "device_code": "GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS",
///   "user_code": "WDJB-MJHT",
///   "verification_uri": "https://courses.mooc.fi/oauth_device",
///   "verification_uri_complete": "https://courses.mooc.fi/oauth_device?user_code=WDJB-MJHT",
///   "expires_in": 900,
///   "interval": 5
/// }
/// ```
#[instrument(skip(pool, app_conf, form))]
#[utoipa::path(
    post,
    path = "/device_authorization",
    operation_id = "deviceAuthorizationOauth",
    tag = "oauth",
    request_body(
        content = DeviceAuthorizationForm,
        content_type = "application/x-www-form-urlencoded"
    ),
    responses(
        (status = 200, description = "Device authorization response", body = DeviceAuthorizationResponse),
        (status = 400, description = "OAuth error (invalid_scope, unauthorized_client)"),
        (status = 401, description = "OAuth error (invalid_client)")
    )
)]
pub async fn device_authorization(
    pool: web::Data<PgPool>,
    form: web::Form<DeviceAuthorizationForm>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    tracing::Span::current().record("client_id", &form.client_id);

    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
    let response =
        create_device_authorization(&mut conn, &form, token_hmac_key, &app_conf.base_url).await?;

    server_token.authorized_ok(HttpResponse::Ok().json(response))
}

/// Handles `GET /device_verification` — render data for the browser consent page.
///
/// Session-authed. Looks up the still-pending, unexpired grant for the given
/// `user_code` (normalizing the input first) and returns the client name and
/// requested scopes so the page can ask the user to approve. A code that is
/// unknown, expired, or no longer pending yields `404 Not Found` so the page can
/// show a distinguishable "invalid or expired code" message.
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/device_verification",
    operation_id = "getOauthDeviceVerification",
    tag = "oauth",
    params(
        ("user_code" = String, Query, description = "The user_code shown to the user by the device")
    ),
    responses(
        (status = 200, description = "Pending device authorization render data", body = DeviceVerificationInfo),
        (status = 404, description = "No pending device authorization for this user_code")
    )
)]
pub async fn device_verification(
    pool: web::Data<PgPool>,
    query: web::Query<DeviceVerificationQuery>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let _ = user; // session presence is the authorization; any signed-in user may view.

    let normalized = normalize_user_code(&query.user_code);
    let info = load_device_verification_info(&mut conn, &normalized).await?;

    token.authorized_ok(HttpResponse::Ok().json(info))
}

/// Handles `POST /device_verification/approve`.
///
/// Session-authed. Persists the user's consent via the same
/// `OAuthUserClientScopes::insert` the web consent flow uses (consent is always
/// recorded — never short-circuited on a pre-existing grant), then marks the
/// device code approved and bound to the signed-in user.
#[instrument(skip(pool, body))]
#[utoipa::path(
    post,
    path = "/device_verification/approve",
    operation_id = "approveOauthDeviceVerification",
    tag = "oauth",
    request_body = DeviceDecisionBody,
    responses(
        (status = 200, description = "Device authorization approved", body = DeviceDecisionResponse),
        (status = 404, description = "No pending device authorization for this user_code")
    )
)]
pub async fn approve_device_verification(
    pool: web::Data<PgPool>,
    body: web::Json<DeviceDecisionBody>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let normalized = normalize_user_code(&body.user_code);
    approve_device(&mut conn, &normalized, user.id).await?;

    token.authorized_ok(HttpResponse::Ok().json(DeviceDecisionResponse {
        status: "approved".to_string(),
    }))
}

/// Handles `POST /device_verification/deny`.
///
/// Session-authed. Marks the pending device code denied; the polling client then
/// receives `access_denied` at the token endpoint.
#[instrument(skip(pool, body))]
#[utoipa::path(
    post,
    path = "/device_verification/deny",
    operation_id = "denyOauthDeviceVerification",
    tag = "oauth",
    request_body = DeviceDecisionBody,
    responses(
        (status = 200, description = "Device authorization denied", body = DeviceDecisionResponse),
        (status = 404, description = "No pending device authorization for this user_code")
    )
)]
pub async fn deny_device_verification(
    pool: web::Data<PgPool>,
    body: web::Json<DeviceDecisionBody>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let _ = user; // any signed-in user with the code may deny it.

    let normalized = normalize_user_code(&body.user_code);
    deny_device(&mut conn, &normalized).await?;

    token.authorized_ok(HttpResponse::Ok().json(DeviceDecisionResponse {
        status: "denied".to_string(),
    }))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    use crate::domain::rate_limit_middleware_builder::{RateLimit, RateLimitConfig};
    // Modest per-IP limit shared by every device endpoint, mirroring `/token`.
    // The verification endpoints are session-authed, so this is defense-in-depth
    // against user_code guessing/enumeration rather than the primary gate.
    let device_rate_limit = || {
        RateLimit::new(RateLimitConfig {
            per_minute: Some(100),
            per_hour: Some(500),
            per_day: Some(2000),
            per_month: None,
            ..Default::default()
        })
    };
    cfg.service(
        web::resource("/device_authorization")
            .wrap(device_rate_limit())
            .route(web::post().to(device_authorization)),
    )
    .service(
        web::resource("/device_verification")
            .wrap(device_rate_limit())
            .route(web::get().to(device_verification)),
    )
    .service(
        web::resource("/device_verification/approve")
            .wrap(device_rate_limit())
            .route(web::post().to(approve_device_verification)),
    )
    .service(
        web::resource("/device_verification/deny")
            .wrap(device_rate_limit())
            .route(web::post().to(deny_device_verification)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;
    use headless_lms_models::library::oauth::GrantTypeName;
    use headless_lms_models::library::oauth::pkce::PkceMethod;
    use headless_lms_models::oauth_client::{
        ApplicationType, NewClientParams, OAuthClient, TokenEndpointAuthMethod,
    };
    use headless_lms_models::oauth_user_client_scopes::OAuthUserClientScopes;

    fn hmac_key() -> SecretString {
        SecretString::new("test-device-controller-hmac-key".to_string().into())
    }

    const BASE_URL: &str = "https://courses.mooc.fi";

    async fn insert_client(
        conn: &mut PgConnection,
        grants: &[GrantTypeName],
        scopes: &[String],
    ) -> OAuthClient {
        let client_id = format!("cli-{}", &generate_access_token()[..12]);
        OAuthClient::insert(
            conn,
            NewClientParams {
                client_id: &client_id,
                client_name: "Device controller test client",
                application_type: ApplicationType::Native,
                token_endpoint_auth_method: TokenEndpointAuthMethod::None,
                client_secret: None,
                client_secret_expires_at: None,
                redirect_uris: &["urn:ietf:wg:oauth:2.0:oob".to_string()],
                post_logout_redirect_uris: None,
                allowed_grant_types: grants,
                scopes,
                require_pkce: true,
                pkce_methods_allowed: &[PkceMethod::S256],
                allowed_origins: None,
                bearer_allowed: true,
            },
        )
        .await
        .unwrap()
    }

    fn form(client_id: &str, scope: Option<&str>) -> DeviceAuthorizationForm {
        DeviceAuthorizationForm {
            client_id: client_id.to_string(),
            scope: scope.map(|s| s.to_string()),
        }
    }

    #[test]
    fn normalize_user_code_handles_case_hyphen_and_whitespace() {
        assert_eq!(normalize_user_code("wdjb-mjht"), "WDJB-MJHT");
        assert_eq!(normalize_user_code("WDJBMJHT"), "WDJB-MJHT");
        assert_eq!(normalize_user_code("  wdjb mjht "), "WDJB-MJHT");
        // Malformed length is left stripped/uppercased and won't match anything.
        assert_eq!(normalize_user_code("abc"), "ABC");
    }

    #[actix_web::test]
    async fn device_authorization_happy_path_issues_codes() {
        insert_data!(:tx);
        let client = insert_client(
            tx.as_mut(),
            &[GrantTypeName::DeviceCode, GrantTypeName::RefreshToken],
            &["exercise-services".to_string()],
        )
        .await;

        let res = create_device_authorization(
            tx.as_mut(),
            &form(&client.client_id, Some("exercise-services")),
            &hmac_key(),
            BASE_URL,
        )
        .await
        .expect("device authorization should succeed");

        assert_eq!(res.interval, DEVICE_CODE_INTERVAL_SECONDS);
        assert_eq!(res.expires_in, DEVICE_CODE_TTL_MINUTES * 60);
        assert_eq!(res.verification_uri, "https://courses.mooc.fi/oauth_device");
        assert_eq!(
            res.verification_uri_complete,
            format!(
                "https://courses.mooc.fi/oauth_device?user_code={}",
                res.user_code
            )
        );

        // The pending grant is retrievable by its user_code and carries the scope.
        let info = load_device_verification_info(tx.as_mut(), &res.user_code)
            .await
            .expect("pending grant should be retrievable");
        assert_eq!(info.scopes, vec!["exercise-services".to_string()]);
        assert_eq!(info.client_id, client.client_id);
    }

    #[actix_web::test]
    async fn device_authorization_empty_scope_defaults_to_client_scopes() {
        insert_data!(:tx);
        let client = insert_client(
            tx.as_mut(),
            &[GrantTypeName::DeviceCode],
            &["exercise-services".to_string()],
        )
        .await;

        let res = create_device_authorization(
            tx.as_mut(),
            &form(&client.client_id, None),
            &hmac_key(),
            BASE_URL,
        )
        .await
        .expect("device authorization without scope should default to client scopes");

        let info = load_device_verification_info(tx.as_mut(), &res.user_code)
            .await
            .unwrap();
        assert_eq!(info.scopes, vec!["exercise-services".to_string()]);
    }

    #[actix_web::test]
    async fn device_authorization_unknown_client_is_invalid_client() {
        insert_data!(:tx);
        let err = create_device_authorization(
            tx.as_mut(),
            &form("does-not-exist", None),
            &hmac_key(),
            BASE_URL,
        )
        .await
        .expect_err("unknown client should fail");
        match err.error_type() {
            ControllerErrorType::OAuthError(data) => assert_eq!(data.error, "invalid_client"),
            other => panic!("expected OAuthError invalid_client, got {:?}", other),
        }
    }

    #[actix_web::test]
    async fn device_authorization_client_without_grant_is_unauthorized_client() {
        insert_data!(:tx);
        let client = insert_client(
            tx.as_mut(),
            &[GrantTypeName::RefreshToken],
            &["exercise-services".to_string()],
        )
        .await;
        let err = create_device_authorization(
            tx.as_mut(),
            &form(&client.client_id, None),
            &hmac_key(),
            BASE_URL,
        )
        .await
        .expect_err("client without device_code grant should fail");
        match err.error_type() {
            ControllerErrorType::OAuthError(data) => assert_eq!(data.error, "unauthorized_client"),
            other => panic!("expected OAuthError unauthorized_client, got {:?}", other),
        }
    }

    #[actix_web::test]
    async fn device_authorization_invalid_scope_is_rejected() {
        insert_data!(:tx);
        let client = insert_client(
            tx.as_mut(),
            &[GrantTypeName::DeviceCode],
            &["exercise-services".to_string()],
        )
        .await;
        let err = create_device_authorization(
            tx.as_mut(),
            &form(
                &client.client_id,
                Some("exercise-services some-other-scope"),
            ),
            &hmac_key(),
            BASE_URL,
        )
        .await
        .expect_err("scope outside the client's registered set should fail");
        match err.error_type() {
            ControllerErrorType::OAuthError(data) => assert_eq!(data.error, "invalid_scope"),
            other => panic!("expected OAuthError invalid_scope, got {:?}", other),
        }
    }

    #[actix_web::test]
    async fn verification_lookup_missing_code_is_not_found() {
        insert_data!(:tx);
        let err = load_device_verification_info(tx.as_mut(), "ZZZZ-ZZZZ")
            .await
            .expect_err("unknown user_code should be not found");
        assert!(matches!(err.error_type(), ControllerErrorType::NotFound));
    }

    #[actix_web::test]
    async fn approve_persists_consent_and_marks_approved() {
        insert_data!(:tx, :user);
        let client = insert_client(
            tx.as_mut(),
            &[GrantTypeName::DeviceCode],
            &["exercise-services".to_string()],
        )
        .await;
        let res = create_device_authorization(
            tx.as_mut(),
            &form(&client.client_id, None),
            &hmac_key(),
            BASE_URL,
        )
        .await
        .unwrap();

        approve_device(tx.as_mut(), &res.user_code, user)
            .await
            .expect("approve should succeed");

        // Consent row persisted for (user, client).
        let granted = OAuthUserClientScopes::find_scopes(tx.as_mut(), user, client.id)
            .await
            .unwrap();
        assert_eq!(granted, vec!["exercise-services".to_string()]);

        // The grant left the pending state: the verification lookup no longer
        // finds it, and a second approve fails as not found.
        let err = load_device_verification_info(tx.as_mut(), &res.user_code)
            .await
            .expect_err("approved code is no longer pending");
        assert!(matches!(err.error_type(), ControllerErrorType::NotFound));

        let err = approve_device(tx.as_mut(), &res.user_code, user)
            .await
            .expect_err("re-approving a non-pending code should fail");
        assert!(matches!(err.error_type(), ControllerErrorType::NotFound));
    }

    #[actix_web::test]
    async fn insert_device_code_retries_past_user_code_collision() {
        insert_data!(:tx);
        let client = insert_client(
            tx.as_mut(),
            &[GrantTypeName::DeviceCode],
            &["exercise-services".to_string()],
        )
        .await;

        // Pre-seed a pending grant so its user_code is taken.
        let taken = create_device_authorization(
            tx.as_mut(),
            &form(&client.client_id, None),
            &hmac_key(),
            BASE_URL,
        )
        .await
        .unwrap();

        // The generator hands out the already-taken code first (forcing a
        // collision + retry), then a fresh code that must succeed.
        let fresh = generate_user_code();
        // pop() drains from the end, so order it [fresh, taken] => taken first.
        let mut codes = vec![fresh.clone(), taken.user_code.clone()];
        let digest = token_digest_sha256(&generate_access_token(), &hmac_key());
        let scopes = vec!["exercise-services".to_string()];

        let stored = insert_device_code_retrying_user_code(
            tx.as_mut(),
            &digest,
            client.id,
            &scopes,
            Utc::now() + Duration::minutes(DEVICE_CODE_TTL_MINUTES),
            || codes.pop().expect("generator ran more than expected"),
        )
        .await
        .expect("a colliding user_code must be regenerated, not surfaced as an error");

        assert_eq!(stored, fresh);
        // The regenerated code is now the retrievable pending grant.
        let info = load_device_verification_info(tx.as_mut(), &fresh)
            .await
            .expect("the retried grant should be pending");
        assert_eq!(info.client_id, client.client_id);
    }

    #[actix_web::test]
    async fn insert_device_code_gives_up_after_repeated_collisions() {
        insert_data!(:tx);
        let client = insert_client(
            tx.as_mut(),
            &[GrantTypeName::DeviceCode],
            &["exercise-services".to_string()],
        )
        .await;

        let taken = create_device_authorization(
            tx.as_mut(),
            &form(&client.client_id, None),
            &hmac_key(),
            BASE_URL,
        )
        .await
        .unwrap();
        let taken_code = taken.user_code.clone();

        let digest = token_digest_sha256(&generate_access_token(), &hmac_key());
        let scopes = vec!["exercise-services".to_string()];

        // Always return the taken code: every attempt collides, so the bounded
        // retry eventually surfaces the error instead of looping forever.
        let err = insert_device_code_retrying_user_code(
            tx.as_mut(),
            &digest,
            client.id,
            &scopes,
            Utc::now() + Duration::minutes(DEVICE_CODE_TTL_MINUTES),
            || taken_code.clone(),
        )
        .await
        .expect_err("exhausting the retries should surface an error");
        assert!(matches!(err.error_type(), ControllerErrorType::BadRequest));
    }

    /// Review M8: the provisioned `tmc-cli-vscode` client has `require_pkce=true`
    /// (forced for public clients). RFC 8628 defines no PKCE binding, so the
    /// device grant must ignore it end-to-end: device authorization carries no
    /// code_challenge (the form has no such field) and the approved code redeems
    /// at the token endpoint with no PKCE verifier. This pins that no-op so a
    /// regression that started honoring require_pkce on the device path would
    /// fail here rather than silently break the prod client.
    #[actix_web::test]
    async fn require_pkce_is_a_noop_for_the_device_grant_end_to_end() {
        use crate::domain::oauth::token_query::TokenGrant;
        use crate::domain::oauth::token_service::{
            TokenGrantRequest, generate_token_pair, process_token_grant,
        };
        use headless_lms_models::oauth_access_token::TokenType;

        insert_data!(:tx, :user);
        let client = insert_client(
            tx.as_mut(),
            &[GrantTypeName::DeviceCode, GrantTypeName::RefreshToken],
            &["exercise-services".to_string()],
        )
        .await;
        assert!(
            client.require_pkce,
            "this test only means something if the client forces require_pkce"
        );

        let key = hmac_key();
        // Device authorization has no code_challenge parameter at all.
        let res = create_device_authorization(
            tx.as_mut(),
            &form(&client.client_id, None),
            &key,
            BASE_URL,
        )
        .await
        .expect("device authorization should succeed with no PKCE input");

        // User approves in the browser.
        approve_device(tx.as_mut(), &res.user_code, user)
            .await
            .expect("approve should succeed");

        // Redeem the approved device code with NO PKCE verifier.
        let grant = TokenGrant::DeviceCode {
            device_code: res.device_code.clone().into(),
        };
        let request = TokenGrantRequest {
            grant: &grant,
            client: &client,
            token_pair: generate_token_pair(&key),
            access_expires_at: Utc::now() + Duration::hours(1),
            refresh_expires_at: Utc::now() + Duration::days(30),
            issued_token_type: TokenType::Bearer,
            dpop_jkt: None,
            token_hmac_key: &key,
        };
        let result = process_token_grant(tx.as_mut(), request)
            .await
            .expect("device grant must succeed without a PKCE verifier despite require_pkce=true");
        assert_eq!(result.user_id, user);
        assert_eq!(result.scopes, vec!["exercise-services".to_string()]);

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn deny_marks_denied_and_is_not_found_afterwards() {
        insert_data!(:tx, :user);
        let _ = user;
        let client = insert_client(
            tx.as_mut(),
            &[GrantTypeName::DeviceCode],
            &["exercise-services".to_string()],
        )
        .await;
        let res = create_device_authorization(
            tx.as_mut(),
            &form(&client.client_id, None),
            &hmac_key(),
            BASE_URL,
        )
        .await
        .unwrap();

        deny_device(tx.as_mut(), &res.user_code)
            .await
            .expect("deny should succeed");

        // No longer pending -> lookup for the verification page is not found.
        let err = load_device_verification_info(tx.as_mut(), &res.user_code)
            .await
            .expect_err("denied code is not pending");
        assert!(matches!(err.error_type(), ControllerErrorType::NotFound));
    }
}
