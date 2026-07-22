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
            let old =
                OAuthRefreshTokens::consume_in_transaction(&mut tx, presented, request.client.id)
                    .await
                    .map_err(|e| TokenGrantError::InvalidGrant(format!("{}", e)))?;

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
    use headless_lms_models::users;

    fn hmac_key() -> SecretString {
        SecretString::new("test-token-service-hmac-key".to_string().into())
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
}
