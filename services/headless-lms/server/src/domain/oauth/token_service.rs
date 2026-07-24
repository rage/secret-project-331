use chrono::{DateTime, Duration, Utc};
use secrecy::{ExposeSecret, SecretString};
use sqlx::{Connection, PgConnection};
use uuid::Uuid;

use crate::domain::oauth::errors::TokenGrantError;
use crate::domain::oauth::pkce::verify_token_pkce;
use headless_lms_models::library::oauth::Digest;
use headless_lms_models::library::oauth::tokens::token_digest_sha256;
use headless_lms_models::oauth_access_token::TokenType;
use headless_lms_models::oauth_auth_code::OAuthAuthCode;
use headless_lms_models::oauth_client::OAuthClient;
use headless_lms_models::oauth_device_codes::{DeviceCodeStatus, OAuthDeviceCode};
use headless_lms_models::oauth_refresh_tokens::{
    IssueTokensFromAuthCodeParams, OAuthRefreshTokens, RotateRefreshTokenParams,
};

use super::token_query::TokenGrant;

/// How long, in seconds, an already-rotated refresh token may still be redeemed
/// (once more, without family-wide revocation) so two clients racing a refresh
/// don't immediately log each other out. See [`process_token_grant`] refresh
/// handling and `OAuthRefreshTokens::claim_reusable_after_rotation`.
const REFRESH_TOKEN_REUSE_GRACE_SECONDS: i64 = 60;

/// A pair of access and refresh tokens with their digests.
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub access_digest: Digest,
    pub refresh_digest: Digest,
}

/// Generate a new token pair (access token and refresh token) with their digests.
pub fn generate_token_pair(key: &SecretString) -> TokenPair {
    let access_token = headless_lms_models::library::oauth::tokens::generate_access_token();
    let refresh_token = headless_lms_models::library::oauth::tokens::generate_access_token();
    TokenPair {
        access_token: access_token.clone(),
        refresh_token: refresh_token.clone(),
        access_digest: token_digest_sha256(&access_token, key),
        refresh_digest: token_digest_sha256(&refresh_token, key),
    }
}

pub struct TokenGrantRequest<'a> {
    pub grant: &'a TokenGrant,
    pub client: &'a OAuthClient,
    pub token_pair: TokenPair,
    pub access_expires_at: DateTime<Utc>,
    pub refresh_expires_at: DateTime<Utc>,
    pub issued_token_type: TokenType,
    pub dpop_jkt: Option<&'a str>,
    pub token_hmac_key: &'a SecretString,
}

#[derive(Debug)]
pub struct TokenGrantResult {
    pub user_id: Uuid,
    pub scopes: Vec<String>,
    pub nonce: Option<String>,
    pub access_expires_at: DateTime<Utc>,
    pub issue_id_token: bool,
}

pub async fn process_token_grant(
    conn: &mut PgConnection,
    request: TokenGrantRequest<'_>,
) -> Result<TokenGrantResult, TokenGrantError> {
    // The device-code grant records each poll (last_polled_at) and that write
    // must persist even when the poll returns an error (authorization_pending /
    // slow_down). Handle it on the bare connection (autocommit) before opening
    // the single issuance transaction the other grants roll back on failure.
    if let TokenGrant::DeviceCode { device_code } = request.grant {
        return process_device_code_grant(conn, &request, device_code).await;
    }

    let mut tx = conn
        .begin()
        .await
        .map_err(|e| TokenGrantError::ServerError(format!("Failed to start transaction: {}", e)))?;

    let result = match request.grant {
        TokenGrant::AuthorizationCode {
            code,
            redirect_uri,
            code_verifier,
        } => {
            let code_digest = token_digest_sha256(code.expose_secret(), request.token_hmac_key);
            // Consume with client_id check in WHERE clause to prevent DoS attacks
            let code_row = if let Some(ref_uri) = redirect_uri {
                OAuthAuthCode::consume_with_redirect_in_transaction(
                    &mut tx,
                    code_digest,
                    request.client.id,
                    ref_uri,
                )
                .await
                .map_err(|e| {
                    tracing::warn!(
                        err = %e,
                        "OAuth token: auth code consume failed (redirect_uri check); possible causes: code already used, wrong redirect_uri, expired, or wrong client"
                    );
                    TokenGrantError::InvalidGrant("Given grant is invalid".to_string())
                })?
            } else {
                OAuthAuthCode::consume_in_transaction(&mut tx, code_digest, request.client.id)
                    .await
                    .map_err(|e| {
                        tracing::warn!(
                            err = %e,
                            "OAuth token: auth code consume failed; possible causes: code already used, expired, or wrong client"
                        );
                        TokenGrantError::InvalidGrant("Given grant is invalid".to_string())
                    })?
            };

            // PKCE verification happens after client_id check (enforced in SQL)
            verify_token_pkce(
                request.client,
                code_row.code_challenge.as_deref(),
                code_row.code_challenge_method,
                code_verifier.as_ref().map(|v| v.expose_secret()),
            )
            .map_err(|_| TokenGrantError::PkceVerificationFailed)?;

            OAuthRefreshTokens::issue_tokens_from_auth_code_in_transaction(
                &mut tx,
                IssueTokensFromAuthCodeParams {
                    user_id: code_row.user_id,
                    client_id: code_row.client_id,
                    scopes: &code_row.scopes,
                    access_token_digest: &request.token_pair.access_digest,
                    refresh_token_digest: &request.token_pair.refresh_digest,
                    access_token_expires_at: request.access_expires_at,
                    refresh_token_expires_at: request.refresh_expires_at,
                    access_token_type: request.issued_token_type,
                    access_token_dpop_jkt: request.dpop_jkt,
                    refresh_token_dpop_jkt: request.dpop_jkt,
                },
            )
            .await
            .map_err(|e| TokenGrantError::ServerError(format!("{}", e)))?;

            // Determine if ID token should be issued based on presence of "openid" scope
            let has_openid = code_row.scopes.iter().any(|s| s == "openid");

            Ok(TokenGrantResult {
                user_id: code_row.user_id,
                scopes: code_row.scopes,
                nonce: code_row.nonce.clone(),
                access_expires_at: request.access_expires_at,
                issue_id_token: has_openid,
            })
        }
        TokenGrant::RefreshToken { refresh_token, .. } => {
            let presented =
                token_digest_sha256(refresh_token.expose_secret(), request.token_hmac_key);
            // Consume with client_id check in WHERE clause to prevent DoS attacks
            match OAuthRefreshTokens::consume_in_transaction(&mut tx, presented, request.client.id)
                .await
            {
                Ok(old) => {
                    if let Some(expected_jkt) = old.dpop_jkt.as_deref() {
                        let presented_jkt = request.dpop_jkt.ok_or_else(|| {
                            TokenGrantError::InvalidClient(
                                "missing DPoP header for sender-constrained refresh".into(),
                            )
                        })?;
                        if presented_jkt != expected_jkt {
                            return Err(TokenGrantError::DpopMismatch);
                        }
                    }

                    let refresh_issue_type = if old.dpop_jkt.is_some() {
                        TokenType::DPoP
                    } else {
                        request.issued_token_type
                    };
                    let at_jkt = old.dpop_jkt.as_deref().or(request.dpop_jkt);
                    let refresh_jkt = old.dpop_jkt.as_deref().or(request.dpop_jkt);

                    OAuthRefreshTokens::complete_refresh_token_rotation_in_transaction(
                        &mut tx,
                        &old,
                        RotateRefreshTokenParams {
                            new_refresh_token_digest: &request.token_pair.refresh_digest,
                            new_access_token_digest: &request.token_pair.access_digest,
                            access_token_expires_at: request.access_expires_at,
                            refresh_token_expires_at: request.refresh_expires_at,
                            access_token_type: refresh_issue_type,
                            access_token_dpop_jkt: at_jkt,
                            refresh_token_dpop_jkt: refresh_jkt,
                        },
                    )
                    .await
                    .map_err(|e| TokenGrantError::ServerError(format!("{}", e)))?;

                    Ok(TokenGrantResult {
                        user_id: old.user_id,
                        scopes: old.scopes.clone(),
                        nonce: None,
                        access_expires_at: request.access_expires_at,
                        issue_id_token: false,
                    })
                }
                Err(_) => {
                    // The presented token isn't currently valid. It may have been
                    // rotated moments ago by a racing client (e.g. a shared or
                    // synced credential). Honor a short reuse grace window: a
                    // just-rotated token is redeemed once more WITHOUT the
                    // family-wide revocation, so the sibling chain stays valid
                    // (bounded temporary branching). Outside the window — and for
                    // hard-revoked or unknown tokens — this fails as before.
                    let presented =
                        token_digest_sha256(refresh_token.expose_secret(), request.token_hmac_key);
                    let rotated_after =
                        Utc::now() - Duration::seconds(REFRESH_TOKEN_REUSE_GRACE_SECONDS);
                    // Atomically claim the just-rotated token: this both finds it
                    // and clears its `rotated_at` so it can be reused at most once.
                    // A second reuse within the window (or a racing concurrent
                    // redemption) matches zero rows and fails as invalid_grant.
                    let reused = OAuthRefreshTokens::claim_reusable_after_rotation(
                        &mut tx,
                        presented,
                        request.client.id,
                        rotated_after,
                    )
                    .await
                    .map_err(|e| TokenGrantError::InvalidGrant(format!("{}", e)))?;

                    if let Some(expected_jkt) = reused.dpop_jkt.as_deref() {
                        let presented_jkt = request.dpop_jkt.ok_or_else(|| {
                            TokenGrantError::InvalidClient(
                                "missing DPoP header for sender-constrained refresh".into(),
                            )
                        })?;
                        if presented_jkt != expected_jkt {
                            return Err(TokenGrantError::DpopMismatch);
                        }
                    }

                    let refresh_issue_type = if reused.dpop_jkt.is_some() {
                        TokenType::DPoP
                    } else {
                        request.issued_token_type
                    };
                    let at_jkt = reused.dpop_jkt.as_deref().or(request.dpop_jkt);
                    let refresh_jkt = reused.dpop_jkt.as_deref().or(request.dpop_jkt);

                    OAuthRefreshTokens::issue_tokens_reused_within_grace_in_transaction(
                        &mut tx,
                        &reused,
                        RotateRefreshTokenParams {
                            new_refresh_token_digest: &request.token_pair.refresh_digest,
                            new_access_token_digest: &request.token_pair.access_digest,
                            access_token_expires_at: request.access_expires_at,
                            refresh_token_expires_at: request.refresh_expires_at,
                            access_token_type: refresh_issue_type,
                            access_token_dpop_jkt: at_jkt,
                            refresh_token_dpop_jkt: refresh_jkt,
                        },
                    )
                    .await
                    .map_err(|e| TokenGrantError::ServerError(format!("{}", e)))?;

                    Ok(TokenGrantResult {
                        user_id: reused.user_id,
                        scopes: reused.scopes.clone(),
                        nonce: None,
                        access_expires_at: request.access_expires_at,
                        issue_id_token: false,
                    })
                }
            }
        }
        TokenGrant::DeviceCode { .. } => {
            // Handled before the transaction is opened (see process_token_grant).
            unreachable!("device_code grant is dispatched before the issuance transaction")
        }
        TokenGrant::Unknown => Err(TokenGrantError::UnsupportedGrantType),
    };

    match result {
        Ok(res) => {
            tx.commit().await.map_err(|e| {
                TokenGrantError::ServerError(format!("Failed to commit transaction: {}", e))
            })?;
            Ok(res)
        }
        Err(e) => {
            // Transaction will be rolled back on drop
            Err(e)
        }
    }
}

/// Handle the RFC 8628 device-code grant at the token endpoint.
///
/// The poll is recorded on the bare connection so `last_polled_at` persists
/// regardless of the outcome (a pending / slow_down response must still advance
/// the poll clock). Only the approved branch opens a transaction, which
/// atomically consumes the single-use device code and reuses the
/// authorization-code issuance path so access/refresh creation and scope
/// persistence stay identical across grants.
async fn process_device_code_grant(
    conn: &mut PgConnection,
    request: &TokenGrantRequest<'_>,
    device_code: &SecretString,
) -> Result<TokenGrantResult, TokenGrantError> {
    let digest = token_digest_sha256(device_code.expose_secret(), request.token_hmac_key);

    // Record this poll and read back enough state to decide the response.
    // An unknown device_code surfaces as a record-not-found => invalid grant.
    let poll = OAuthDeviceCode::record_poll(conn, &digest)
        .await
        .map_err(|e| TokenGrantError::InvalidGrant(format!("{}", e)))?;

    // RFC 8628 §3.4: the device_code is bound to the client it was issued to; a
    // different client must not redeem it even if it, too, is allowed the device
    // grant. Fail as invalid_grant without revealing whether the code or the
    // presenting client was the mismatch.
    if poll.client_id != request.client.id {
        return Err(TokenGrantError::InvalidGrant(
            "Given grant is invalid".to_string(),
        ));
    }

    let now = Utc::now();

    if poll.status == DeviceCodeStatus::Denied {
        return Err(TokenGrantError::AccessDenied);
    }
    if poll.expires_at <= now {
        return Err(TokenGrantError::ExpiredToken);
    }
    if poll.status == DeviceCodeStatus::Approved {
        let mut tx = conn.begin().await.map_err(|e| {
            TokenGrantError::ServerError(format!("Failed to start transaction: {}", e))
        })?;

        // Single-use redemption: the row is deleted so a replay finds nothing.
        let device = OAuthDeviceCode::consume_approved_in_transaction(&mut tx, &digest)
            .await
            .map_err(|e| TokenGrantError::InvalidGrant(format!("{}", e)))?;

        let user_id = device.user_id.ok_or_else(|| {
            TokenGrantError::ServerError("approved device code missing user_id".into())
        })?;

        OAuthRefreshTokens::issue_tokens_from_auth_code_in_transaction(
            &mut tx,
            IssueTokensFromAuthCodeParams {
                user_id,
                client_id: device.client_id,
                scopes: &device.scopes,
                access_token_digest: &request.token_pair.access_digest,
                refresh_token_digest: &request.token_pair.refresh_digest,
                access_token_expires_at: request.access_expires_at,
                refresh_token_expires_at: request.refresh_expires_at,
                access_token_type: request.issued_token_type,
                access_token_dpop_jkt: request.dpop_jkt,
                refresh_token_dpop_jkt: request.dpop_jkt,
            },
        )
        .await
        .map_err(|e| TokenGrantError::ServerError(format!("{}", e)))?;

        tx.commit().await.map_err(|e| {
            TokenGrantError::ServerError(format!("Failed to commit transaction: {}", e))
        })?;

        return Ok(TokenGrantResult {
            user_id,
            scopes: device.scopes,
            nonce: None,
            access_expires_at: request.access_expires_at,
            issue_id_token: false,
        });
    }

    // Still pending: emit slow_down when the client polled faster than the
    // advertised interval, otherwise authorization_pending.
    let polled_too_soon = poll
        .previous_polled_at
        .map(|prev| {
            now.signed_duration_since(prev) < Duration::seconds(poll.interval_seconds as i64)
        })
        .unwrap_or(false);
    if polled_too_soon {
        Err(TokenGrantError::SlowDown)
    } else {
        Err(TokenGrantError::AuthorizationPending)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;
    use headless_lms_models::PKeyPolicy;
    use headless_lms_models::library::oauth::pkce::PkceMethod;
    use headless_lms_models::library::oauth::{
        GrantTypeName, generate_access_token, generate_user_code,
    };
    use headless_lms_models::oauth_client::{
        ApplicationType, NewClientParams, OAuthClient, TokenEndpointAuthMethod,
    };
    use headless_lms_models::oauth_device_codes::{NewDeviceCodeParams, OAuthDeviceCode};
    use headless_lms_models::oauth_refresh_tokens::NewRefreshTokenParams;
    use headless_lms_models::users;

    fn hmac_key() -> SecretString {
        SecretString::new("test-token-service-hmac-key".to_string().into())
    }

    /// Build a request that reuses a caller-supplied token pair (so the test can
    /// recover the issued refresh-token plaintext).
    fn build_request_with_pair<'a>(
        grant: &'a TokenGrant,
        client: &'a OAuthClient,
        key: &'a SecretString,
        token_pair: TokenPair,
    ) -> TokenGrantRequest<'a> {
        TokenGrantRequest {
            grant,
            client,
            token_pair,
            access_expires_at: Utc::now() + Duration::hours(1),
            refresh_expires_at: Utc::now() + Duration::days(30),
            issued_token_type: TokenType::Bearer,
            dpop_jkt: None,
            token_hmac_key: key,
        }
    }

    async fn insert_refresh_token(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> String {
        let plaintext = generate_access_token();
        let digest = token_digest_sha256(&plaintext, &hmac_key());
        OAuthRefreshTokens::insert(
            conn,
            NewRefreshTokenParams {
                digest: &digest,
                user_id,
                client_id,
                scopes: &["exercise-services".to_string()],
                audience: None,
                expires_at: Utc::now() + Duration::days(30),
                rotated_from: None,
                metadata: serde_json::Map::new(),
                dpop_jkt: None,
            },
        )
        .await
        .unwrap();
        plaintext
    }

    fn refresh_grant(plaintext: &str) -> TokenGrant {
        TokenGrant::RefreshToken {
            refresh_token: plaintext.into(),
            scope: None,
        }
    }

    async fn insert_device_client(conn: &mut PgConnection) -> OAuthClient {
        let client_id = format!("cli-{}", &generate_access_token()[..12]);
        OAuthClient::insert(
            conn,
            NewClientParams {
                client_id: &client_id,
                client_name: "Device flow token test client",
                application_type: ApplicationType::Native,
                token_endpoint_auth_method: TokenEndpointAuthMethod::None,
                client_secret: None,
                client_secret_expires_at: None,
                redirect_uris: &["urn:ietf:wg:oauth:2.0:oob".to_string()],
                post_logout_redirect_uris: None,
                allowed_grant_types: &[GrantTypeName::DeviceCode, GrantTypeName::RefreshToken],
                scopes: &["exercise-services".to_string()],
                require_pkce: true,
                pkce_methods_allowed: &[PkceMethod::S256],
                allowed_origins: None,
                bearer_allowed: true,
            },
        )
        .await
        .unwrap()
    }

    /// Inserts a device code and returns its plaintext (the caller hashes it to
    /// build the grant).
    async fn insert_device_code(
        conn: &mut PgConnection,
        client_id: Uuid,
        expires_at: DateTime<Utc>,
    ) -> (String, String) {
        let device_code = generate_access_token();
        let user_code = generate_user_code();
        let digest = token_digest_sha256(&device_code, &hmac_key());
        OAuthDeviceCode::insert(
            conn,
            NewDeviceCodeParams {
                device_code_digest: &digest,
                user_code: &user_code,
                client_id,
                scopes: &["exercise-services".to_string()],
                interval_seconds: 5,
                expires_at,
                metadata: serde_json::Map::new(),
            },
        )
        .await
        .unwrap();
        (device_code, user_code)
    }

    fn build_request<'a>(
        grant: &'a TokenGrant,
        client: &'a OAuthClient,
        key: &'a SecretString,
    ) -> TokenGrantRequest<'a> {
        TokenGrantRequest {
            grant,
            client,
            token_pair: generate_token_pair(key),
            access_expires_at: Utc::now() + Duration::hours(1),
            refresh_expires_at: Utc::now() + Duration::days(30),
            issued_token_type: TokenType::Bearer,
            dpop_jkt: None,
            token_hmac_key: key,
        }
    }

    #[actix_web::test]
    async fn device_grant_happy_path_issues_tokens_and_is_single_use() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let user = users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "device-happy@example.com",
            None,
            None,
        )
        .await
        .unwrap();
        let client = insert_device_client(tx.as_mut()).await;
        let (device_code, user_code) =
            insert_device_code(tx.as_mut(), client.id, Utc::now() + Duration::minutes(15)).await;
        OAuthDeviceCode::approve(tx.as_mut(), &user_code, user)
            .await
            .unwrap();

        let grant = TokenGrant::DeviceCode {
            device_code: device_code.clone().into(),
        };
        let result = process_token_grant(tx.as_mut(), build_request(&grant, &client, &key))
            .await
            .expect("device grant should succeed");
        assert_eq!(result.user_id, user);
        assert_eq!(result.scopes, vec!["exercise-services".to_string()]);
        assert!(!result.issue_id_token);

        // Second redemption of the same device code fails (single-use).
        let grant2 = TokenGrant::DeviceCode {
            device_code: device_code.into(),
        };
        let err = process_token_grant(tx.as_mut(), build_request(&grant2, &client, &key))
            .await
            .expect_err("replay should fail");
        assert!(matches!(err, TokenGrantError::InvalidGrant(_)));

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn device_grant_pending_returns_authorization_pending() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let client = insert_device_client(tx.as_mut()).await;
        let (device_code, _user_code) =
            insert_device_code(tx.as_mut(), client.id, Utc::now() + Duration::minutes(15)).await;

        let grant = TokenGrant::DeviceCode {
            device_code: device_code.into(),
        };
        let err = process_token_grant(tx.as_mut(), build_request(&grant, &client, &key))
            .await
            .expect_err("pending grant should not succeed");
        assert!(matches!(err, TokenGrantError::AuthorizationPending));

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn device_grant_denied_returns_access_denied() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let client = insert_device_client(tx.as_mut()).await;
        let (device_code, user_code) =
            insert_device_code(tx.as_mut(), client.id, Utc::now() + Duration::minutes(15)).await;
        OAuthDeviceCode::deny(tx.as_mut(), &user_code)
            .await
            .unwrap();

        let grant = TokenGrant::DeviceCode {
            device_code: device_code.into(),
        };
        let err = process_token_grant(tx.as_mut(), build_request(&grant, &client, &key))
            .await
            .expect_err("denied grant should not succeed");
        assert!(matches!(err, TokenGrantError::AccessDenied));

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn device_grant_expired_returns_expired_token() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let client = insert_device_client(tx.as_mut()).await;
        // Already expired (still within the 30-minute CHECK ceiling relative to created_at).
        let (device_code, _user_code) =
            insert_device_code(tx.as_mut(), client.id, Utc::now() - Duration::minutes(1)).await;

        let grant = TokenGrant::DeviceCode {
            device_code: device_code.into(),
        };
        let err = process_token_grant(tx.as_mut(), build_request(&grant, &client, &key))
            .await
            .expect_err("expired grant should not succeed");
        assert!(matches!(err, TokenGrantError::ExpiredToken));

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn device_grant_fast_polling_returns_slow_down() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let client = insert_device_client(tx.as_mut()).await;
        let (device_code, _user_code) =
            insert_device_code(tx.as_mut(), client.id, Utc::now() + Duration::minutes(15)).await;

        // First poll: authorization_pending (no previous poll recorded).
        let grant1 = TokenGrant::DeviceCode {
            device_code: device_code.clone().into(),
        };
        let first = process_token_grant(tx.as_mut(), build_request(&grant1, &client, &key))
            .await
            .expect_err("first poll should be pending");
        assert!(matches!(first, TokenGrantError::AuthorizationPending));

        // Second immediate poll: slow_down (polled well within the interval).
        let grant2 = TokenGrant::DeviceCode {
            device_code: device_code.into(),
        };
        let second = process_token_grant(tx.as_mut(), build_request(&grant2, &client, &key))
            .await
            .expect_err("fast second poll should slow down");
        assert!(matches!(second, TokenGrantError::SlowDown));

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn device_grant_unknown_code_is_invalid_grant() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let client = insert_device_client(tx.as_mut()).await;

        let grant = TokenGrant::DeviceCode {
            device_code: "does-not-exist".into(),
        };
        let err = process_token_grant(tx.as_mut(), build_request(&grant, &client, &key))
            .await
            .expect_err("unknown device code should fail");
        assert!(matches!(err, TokenGrantError::InvalidGrant(_)));

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn device_grant_rejects_mismatched_client() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let user = users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "device-mismatch@example.com",
            None,
            None,
        )
        .await
        .unwrap();
        // Two distinct clients, both allowed the device_code grant.
        let client_a = insert_device_client(tx.as_mut()).await;
        let client_b = insert_device_client(tx.as_mut()).await;

        // The device code is issued to (and approved for) client A.
        let (device_code, user_code) =
            insert_device_code(tx.as_mut(), client_a.id, Utc::now() + Duration::minutes(15)).await;
        OAuthDeviceCode::approve(tx.as_mut(), &user_code, user)
            .await
            .unwrap();

        // Client B presenting A's device code must be rejected (RFC 8628 §3.4).
        let grant_b = TokenGrant::DeviceCode {
            device_code: device_code.clone().into(),
        };
        let err = process_token_grant(tx.as_mut(), build_request(&grant_b, &client_b, &key))
            .await
            .expect_err("cross-client device code redemption must fail");
        assert!(matches!(err, TokenGrantError::InvalidGrant(_)));

        // The binding check does not consume the code, so the original client
        // (A) can still redeem it successfully.
        let grant_a = TokenGrant::DeviceCode {
            device_code: device_code.into(),
        };
        let ok = process_token_grant(tx.as_mut(), build_request(&grant_a, &client_a, &key))
            .await
            .expect("the client the code was issued to should still succeed");
        assert_eq!(ok.user_id, user);

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn refresh_reuse_within_grace_window_branches_without_family_revocation() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let user = users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "refresh-grace@example.com",
            None,
            None,
        )
        .await
        .unwrap();
        let client = insert_device_client(tx.as_mut()).await;

        // RT1 -> RT2 (normal rotation; revokes the family, marks RT1 rotated).
        let rt1 = insert_refresh_token(tx.as_mut(), user, client.id).await;
        let pair2 = generate_token_pair(&key);
        let rt2 = pair2.refresh_token.clone();
        let grant1 = refresh_grant(&rt1);
        process_token_grant(
            tx.as_mut(),
            build_request_with_pair(&grant1, &client, &key, pair2),
        )
        .await
        .expect("initial rotation should succeed");

        // Reuse RT1 within the grace window -> RT3, WITHOUT revoking RT2.
        let pair3 = generate_token_pair(&key);
        let rt3 = pair3.refresh_token.clone();
        let grant2 = refresh_grant(&rt1);
        process_token_grant(
            tx.as_mut(),
            build_request_with_pair(&grant2, &client, &key, pair3),
        )
        .await
        .expect("reuse within grace window should succeed");

        // Both resulting chains are live (branching).
        assert!(
            OAuthRefreshTokens::find_valid(tx.as_mut(), token_digest_sha256(&rt2, &key))
                .await
                .is_ok(),
            "RT2 (original rotation chain) must stay valid"
        );
        assert!(
            OAuthRefreshTokens::find_valid(tx.as_mut(), token_digest_sha256(&rt3, &key))
                .await
                .is_ok(),
            "RT3 (grace-reuse chain) must be valid"
        );

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn refresh_second_reuse_within_grace_window_fails_with_invalid_grant() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let user = users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "refresh-grace-twice@example.com",
            None,
            None,
        )
        .await
        .unwrap();
        let client = insert_device_client(tx.as_mut()).await;

        // RT1 -> RT2 (normal rotation; marks RT1 rotated).
        let rt1 = insert_refresh_token(tx.as_mut(), user, client.id).await;
        let pair2 = generate_token_pair(&key);
        let rt2 = pair2.refresh_token.clone();
        process_token_grant(
            tx.as_mut(),
            build_request_with_pair(&refresh_grant(&rt1), &client, &key, pair2),
        )
        .await
        .expect("initial rotation should succeed");

        // First reuse of RT1 within the grace window -> RT3, WITHOUT family revoke.
        let pair3 = generate_token_pair(&key);
        let rt3 = pair3.refresh_token.clone();
        process_token_grant(
            tx.as_mut(),
            build_request_with_pair(&refresh_grant(&rt1), &client, &key, pair3),
        )
        .await
        .expect("first reuse within grace window should branch");

        // Second reuse of the SAME rotated token, still inside the window, must
        // fail: the claim cleared RT1's rotated_at, so it is single-use.
        let err = process_token_grant(
            tx.as_mut(),
            build_request_with_pair(
                &refresh_grant(&rt1),
                &client,
                &key,
                generate_token_pair(&key),
            ),
        )
        .await
        .expect_err("a second reuse of the same rotated token must fail");
        assert!(matches!(err, TokenGrantError::InvalidGrant(_)));

        // Neither sibling chain from the single allowed branch was revoked.
        assert!(
            OAuthRefreshTokens::find_valid(tx.as_mut(), token_digest_sha256(&rt2, &key))
                .await
                .is_ok(),
            "RT2 must stay valid after the rejected second reuse"
        );
        assert!(
            OAuthRefreshTokens::find_valid(tx.as_mut(), token_digest_sha256(&rt3, &key))
                .await
                .is_ok(),
            "RT3 (the single allowed grace branch) must stay valid"
        );

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn refresh_reuse_outside_grace_window_keeps_family_revocation() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let user = users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "refresh-late@example.com",
            None,
            None,
        )
        .await
        .unwrap();
        let client = insert_device_client(tx.as_mut()).await;

        let rt1 = insert_refresh_token(tx.as_mut(), user, client.id).await;
        let pair2 = generate_token_pair(&key);
        let rt2 = pair2.refresh_token.clone();
        let grant1 = refresh_grant(&rt1);
        process_token_grant(
            tx.as_mut(),
            build_request_with_pair(&grant1, &client, &key, pair2),
        )
        .await
        .expect("initial rotation should succeed");

        // Backdate the rotation so RT1 is now outside the grace window.
        let rt1_digest = token_digest_sha256(&rt1, &key);
        sqlx::query("UPDATE oauth_refresh_tokens SET rotated_at = $1 WHERE digest = $2")
            .bind(Utc::now() - Duration::seconds(REFRESH_TOKEN_REUSE_GRACE_SECONDS + 60))
            .bind(rt1_digest.as_slice())
            .execute(&mut **tx.as_mut())
            .await
            .unwrap();

        // Reuse RT1 now fails (today's behavior preserved).
        let grant2 = refresh_grant(&rt1);
        let err = process_token_grant(
            tx.as_mut(),
            build_request_with_pair(&grant2, &client, &key, generate_token_pair(&key)),
        )
        .await
        .expect_err("reuse outside the grace window must fail");
        assert!(matches!(err, TokenGrantError::InvalidGrant(_)));

        // The current chain (RT2) is untouched.
        assert!(
            OAuthRefreshTokens::find_valid(tx.as_mut(), token_digest_sha256(&rt2, &key))
                .await
                .is_ok(),
            "RT2 must remain valid after a failed out-of-window reuse"
        );

        tx.rollback().await;
    }

    #[actix_web::test]
    async fn refresh_hard_revoked_token_is_not_resurrected_by_grace() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let key = hmac_key();

        let user = users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "refresh-revoked@example.com",
            None,
            None,
        )
        .await
        .unwrap();
        let client = insert_device_client(tx.as_mut()).await;

        let rt1 = insert_refresh_token(tx.as_mut(), user, client.id).await;
        let pair2 = generate_token_pair(&key);
        let grant1 = refresh_grant(&rt1);
        process_token_grant(
            tx.as_mut(),
            build_request_with_pair(&grant1, &client, &key, pair2),
        )
        .await
        .expect("initial rotation should succeed");

        // Hard-revoke the family (e.g. logout): clears rotated_at, so RT1 must
        // not be resurrectable even though it was rotated moments ago.
        OAuthRefreshTokens::revoke_all_by_user_client(tx.as_mut(), user, client.id)
            .await
            .unwrap();

        let grant2 = refresh_grant(&rt1);
        let err = process_token_grant(
            tx.as_mut(),
            build_request_with_pair(&grant2, &client, &key, generate_token_pair(&key)),
        )
        .await
        .expect_err("hard-revoked token must not be resurrected");
        assert!(matches!(err, TokenGrantError::InvalidGrant(_)));

        tx.rollback().await;
    }
}
