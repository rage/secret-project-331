use crate::{library::oauth::Digest, prelude::*};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgConnection, Type};
use uuid::Uuid;

/// Approval lifecycle of a device authorization grant.
///
/// Maps 1:1 to the PostgreSQL `device_code_status` enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "device_code_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeviceCodeStatus {
    Pending,
    Approved,
    Denied,
}

/// **INTERNAL/DATABASE-ONLY MODEL - DO NOT EXPOSE TO CLIENTS**
///
/// This struct is a database model that contains a `Digest` field, which contains raw bytes
/// and uses custom (de)serialization. This model must **never** be serialized into external
/// API payloads or returned directly to clients.
///
/// For external-facing responses, use DTOs that strip or convert `Digest` fields to safe types.
///
/// **Rationale**: The `Digest` type contains sensitive raw bytes and uses custom serialization
/// that is not suitable for external APIs. Exposing this model directly could leak internal
/// implementation details or cause serialization issues.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OAuthDeviceCode {
    pub device_code_digest: Digest,
    pub user_code: String,
    pub client_id: Uuid,
    /// `None` until the user approves the grant on the verification page.
    pub user_id: Option<Uuid>,
    pub scopes: Vec<String>,
    pub status: DeviceCodeStatus,
    pub jti: Uuid,
    pub interval_seconds: i32,
    pub last_polled_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct NewDeviceCodeParams<'a> {
    pub device_code_digest: &'a Digest,
    pub user_code: &'a str,
    pub client_id: Uuid,
    pub scopes: &'a [String],
    pub interval_seconds: i32,
    pub expires_at: DateTime<Utc>,
    pub metadata: serde_json::Map<String, serde_json::Value>,
}

/// Result of recording a poll against a device code.
///
/// Carries just enough state for the token endpoint to decide between
/// `slow_down`, `authorization_pending`, `expired_token`, `access_denied`, or
/// proceeding to token issuance. `previous_polled_at` is the value of
/// `last_polled_at` *before* this poll updated it, so the caller can detect a
/// client polling faster than `interval_seconds`.
#[derive(Debug, Clone)]
pub struct DeviceCodePoll {
    pub status: DeviceCodeStatus,
    pub expires_at: DateTime<Utc>,
    pub interval_seconds: i32,
    pub previous_polled_at: Option<DateTime<Utc>>,
    pub user_id: Option<Uuid>,
    pub client_id: Uuid,
    pub scopes: Vec<String>,
}

impl OAuthDeviceCode {
    /// Insert a new pending device authorization grant.
    pub async fn insert(
        conn: &mut PgConnection,
        params: NewDeviceCodeParams<'_>,
    ) -> ModelResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO oauth_device_codes (
                device_code_digest,
                user_code,
                client_id,
                scopes,
                interval_seconds,
                expires_at,
                metadata
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7
            )
            "#,
            params.device_code_digest.as_bytes(),
            params.user_code,
            params.client_id,
            params.scopes,
            params.interval_seconds,
            params.expires_at,
            serde_json::Value::Object(params.metadata)
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    /// Find the still-valid, pending grant for a given `user_code`.
    ///
    /// Used by the verification page to render the pending consent request.
    /// The partial unique index guarantees at most one pending row per code.
    pub async fn find_pending_by_user_code(
        conn: &mut PgConnection,
        user_code: &str,
    ) -> ModelResult<OAuthDeviceCode> {
        let row = sqlx::query_as!(
            OAuthDeviceCode,
            r#"
            SELECT *
            FROM oauth_device_codes
            WHERE user_code = $1
              AND status = 'pending'
              AND expires_at > now()
            "#,
            user_code
        )
        .fetch_one(conn)
        .await?;

        Ok(row)
    }

    /// Approve a pending grant, attaching the approving user in a single statement.
    ///
    /// Only affects a row that is still pending and unexpired.
    pub async fn approve(
        conn: &mut PgConnection,
        user_code: &str,
        user_id: Uuid,
    ) -> ModelResult<OAuthDeviceCode> {
        let row = sqlx::query_as!(
            OAuthDeviceCode,
            r#"
            UPDATE oauth_device_codes
               SET user_id = $2,
                   status = 'approved'
             WHERE user_code = $1
               AND status = 'pending'
               AND expires_at > now()
            RETURNING *
            "#,
            user_code,
            user_id
        )
        .fetch_one(conn)
        .await?;

        Ok(row)
    }

    /// Deny a pending grant.
    ///
    /// Only affects a row that is still pending and unexpired.
    pub async fn deny(conn: &mut PgConnection, user_code: &str) -> ModelResult<OAuthDeviceCode> {
        let row = sqlx::query_as!(
            OAuthDeviceCode,
            r#"
            UPDATE oauth_device_codes
               SET status = 'denied'
             WHERE user_code = $1
               AND status = 'pending'
               AND expires_at > now()
            RETURNING *
            "#,
            user_code
        )
        .fetch_one(conn)
        .await?;

        Ok(row)
    }

    /// Record a poll from the token endpoint and return the state needed to
    /// decide the response.
    ///
    /// Atomically reads the previous `last_polled_at` and advances it to now.
    /// The returned `previous_polled_at` lets the caller detect a client
    /// polling faster than `interval_seconds` (=> `slow_down`). Returns a
    /// record-not-found error if the digest is unknown.
    pub async fn record_poll(
        conn: &mut PgConnection,
        device_code_digest: &Digest,
    ) -> ModelResult<DeviceCodePoll> {
        let row = sqlx::query!(
            r#"
            WITH current AS (
                SELECT device_code_digest, last_polled_at
                FROM oauth_device_codes
                WHERE device_code_digest = $1
                FOR UPDATE
            )
            UPDATE oauth_device_codes d
               SET last_polled_at = now()
              FROM current c
             WHERE d.device_code_digest = c.device_code_digest
            RETURNING
                c.last_polled_at AS "previous_polled_at",
                d.status AS "status: DeviceCodeStatus",
                d.expires_at AS "expires_at!",
                d.interval_seconds AS "interval_seconds!",
                d.user_id,
                d.client_id AS "client_id!",
                d.scopes AS "scopes!"
            "#,
            device_code_digest.as_bytes()
        )
        .fetch_one(conn)
        .await?;

        Ok(DeviceCodePoll {
            status: row.status,
            expires_at: row.expires_at,
            interval_seconds: row.interval_seconds,
            previous_polled_at: row.previous_polled_at,
            user_id: row.user_id,
            client_id: row.client_id,
            scopes: row.scopes,
        })
    }

    /// Single-use redemption of an approved device code within an existing transaction.
    ///
    /// # Transaction Requirements
    /// This method must be called within an existing database transaction.
    /// The caller is responsible for managing the transaction (begin, commit, rollback).
    ///
    /// Deletes the approved, unexpired row and returns it, so a second
    /// redemption of the same code finds nothing (single-use). The returned row
    /// always has `user_id = Some(..)` (enforced by the `approve` statement and
    /// the DB check constraint).
    pub async fn consume_approved_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        device_code_digest: &Digest,
    ) -> ModelResult<OAuthDeviceCode> {
        let row = sqlx::query_as!(
            OAuthDeviceCode,
            r#"
            DELETE FROM oauth_device_codes
             WHERE device_code_digest = $1
               AND status = 'approved'
               AND expires_at > now()
            RETURNING *
            "#,
            device_code_digest.as_bytes()
        )
        .fetch_one(&mut **tx)
        .await?;

        Ok(row)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        library::oauth::{
            GrantTypeName, generate_user_code,
            pkce::PkceMethod,
            tokens::{generate_access_token, token_digest_sha256},
        },
        oauth_client::{ApplicationType, NewClientParams, OAuthClient, TokenEndpointAuthMethod},
        test_helper::*,
    };
    use chrono::Duration;
    use secrecy::SecretString;

    fn hmac_key() -> SecretString {
        SecretString::new("test-device-code-hmac-key".to_string().into())
    }

    async fn insert_public_client(conn: &mut PgConnection) -> OAuthClient {
        let client_id = format!("cli-{}", &generate_access_token()[..12]);
        OAuthClient::insert(
            conn,
            NewClientParams {
                client_id: &client_id,
                client_name: "Device flow test client",
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

    fn new_params<'a>(
        digest: &'a Digest,
        user_code: &'a str,
        client_id: Uuid,
        scopes: &'a [String],
    ) -> NewDeviceCodeParams<'a> {
        NewDeviceCodeParams {
            device_code_digest: digest,
            user_code,
            client_id,
            scopes,
            interval_seconds: 5,
            expires_at: Utc::now() + Duration::minutes(15),
            metadata: serde_json::Map::new(),
        }
    }

    #[tokio::test]
    async fn insert_find_approve_and_consume() {
        insert_data!(:tx, :user);
        let client = insert_public_client(tx.as_mut()).await;

        let user_code = generate_user_code();
        let device_code = generate_access_token();
        let digest = token_digest_sha256(&device_code, &hmac_key());
        let scopes = vec!["exercise-services".to_string()];

        OAuthDeviceCode::insert(
            tx.as_mut(),
            new_params(&digest, &user_code, client.id, &scopes),
        )
        .await
        .unwrap();

        let pending = OAuthDeviceCode::find_pending_by_user_code(tx.as_mut(), &user_code)
            .await
            .unwrap();
        assert_eq!(pending.status, DeviceCodeStatus::Pending);
        assert_eq!(pending.user_id, None);
        assert_eq!(pending.scopes, scopes);

        let approved = OAuthDeviceCode::approve(tx.as_mut(), &user_code, user)
            .await
            .unwrap();
        assert_eq!(approved.status, DeviceCodeStatus::Approved);
        assert_eq!(approved.user_id, Some(user));

        // No longer pending once approved.
        assert!(
            OAuthDeviceCode::find_pending_by_user_code(tx.as_mut(), &user_code)
                .await
                .is_err()
        );

        // Single-use redemption succeeds once...
        let mut inner = tx.begin().await;
        let consumed = OAuthDeviceCode::consume_approved_in_transaction(inner.as_mut(), &digest)
            .await
            .unwrap();
        assert_eq!(consumed.user_id, Some(user));
        assert_eq!(consumed.client_id, client.id);
        // ...and not a second time (row deleted).
        assert!(
            OAuthDeviceCode::consume_approved_in_transaction(inner.as_mut(), &digest)
                .await
                .is_err()
        );
        inner.rollback().await;
    }

    #[tokio::test]
    async fn deny_marks_denied() {
        insert_data!(:tx, :user);
        let _ = user;
        let client = insert_public_client(tx.as_mut()).await;

        let user_code = generate_user_code();
        let digest = token_digest_sha256(&generate_access_token(), &hmac_key());
        let scopes = vec!["exercise-services".to_string()];

        OAuthDeviceCode::insert(
            tx.as_mut(),
            new_params(&digest, &user_code, client.id, &scopes),
        )
        .await
        .unwrap();

        let denied = OAuthDeviceCode::deny(tx.as_mut(), &user_code)
            .await
            .unwrap();
        assert_eq!(denied.status, DeviceCodeStatus::Denied);

        // A denied code cannot be consumed.
        let mut inner = tx.begin().await;
        assert!(
            OAuthDeviceCode::consume_approved_in_transaction(inner.as_mut(), &digest)
                .await
                .is_err()
        );
        inner.rollback().await;
    }

    #[tokio::test]
    async fn record_poll_reports_previous_poll_time() {
        insert_data!(:tx, :user);
        let _ = user;
        let client = insert_public_client(tx.as_mut()).await;

        let user_code = generate_user_code();
        let digest = token_digest_sha256(&generate_access_token(), &hmac_key());
        let scopes = vec!["exercise-services".to_string()];

        OAuthDeviceCode::insert(
            tx.as_mut(),
            new_params(&digest, &user_code, client.id, &scopes),
        )
        .await
        .unwrap();

        // First poll: no previous timestamp (=> not too fast).
        let first = OAuthDeviceCode::record_poll(tx.as_mut(), &digest)
            .await
            .unwrap();
        assert_eq!(first.status, DeviceCodeStatus::Pending);
        assert!(first.previous_polled_at.is_none());
        assert_eq!(first.interval_seconds, 5);

        // Second poll: previous timestamp is now populated.
        let second = OAuthDeviceCode::record_poll(tx.as_mut(), &digest)
            .await
            .unwrap();
        assert!(second.previous_polled_at.is_some());
    }
}
