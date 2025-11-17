//! OAuth 2.1 / OIDC Client model
//!
//! Mirrors the `oauth_clients` table and PostgreSQL enums.
//! Includes small policy helpers (public/confidential, PKCE, grants).

use crate::{
    library::oauth::pkce::PkceMethod,
    oauth_shared_types::{Digest, GrantTypeName},
    prelude::*,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgConnection, Type};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "token_endpoint_auth_method")]
#[serde(rename_all = "snake_case")]
pub enum TokenEndpointAuthMethod {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "client_secret_post")]
    ClientSecretPost,
}

impl TokenEndpointAuthMethod {
    pub fn is_public(self) -> bool {
        matches!(self, Self::None)
    }

    pub fn is_confidential(self) -> bool {
        !self.is_public()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "application_type")]
#[serde(rename_all = "snake_case")]
pub enum ApplicationType {
    Web,
    Native,
    Spa,
    Service,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OAuthClient {
    pub id: Uuid,
    pub client_id: String,
    pub client_name: String,
    pub application_type: ApplicationType,

    pub token_endpoint_auth_method: TokenEndpointAuthMethod,

    /// Hashed/HMACed secret for confidential clients (`BYTEA`); `None` for public clients.
    pub client_secret: Option<Digest>,
    pub client_secret_expires_at: Option<DateTime<Utc>>,

    pub redirect_uris: Vec<String>,
    pub post_logout_redirect_uris: Option<Vec<String>>,

    pub allowed_grant_types: Vec<GrantTypeName>,
    pub scopes: Vec<String>,

    pub require_pkce: bool,
    pub pkce_methods_allowed: Vec<PkceMethod>,

    pub origin: String,
    pub bearer_allowed: bool,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl OAuthClient {
    pub fn is_public(&self) -> bool {
        self.token_endpoint_auth_method.is_public()
    }

    pub fn is_confidential(&self) -> bool {
        self.token_endpoint_auth_method.is_confidential()
    }

    pub fn allows_bearer(&self) -> bool {
        self.bearer_allowed
    }

    pub fn requires_pkce(&self) -> bool {
        self.require_pkce || self.is_public()
    }

    pub fn allows_pkce_method(&self, m: PkceMethod) -> bool {
        self.pkce_methods_allowed.iter().any(|&x| x == m)
    }

    pub fn allows_grant(&self, g: GrantTypeName) -> bool {
        self.allowed_grant_types.iter().any(|&x| x == g)
    }
}

#[derive(Debug, Clone)]
pub struct NewClientParams<'a> {
    pub client_id: &'a str,
    pub client_name: &'a str,
    pub application_type: ApplicationType,
    pub token_endpoint_auth_method: TokenEndpointAuthMethod,

    pub client_secret: Option<&'a Digest>,
    pub client_secret_expires_at: Option<DateTime<Utc>>,

    pub redirect_uris: &'a [String],
    pub post_logout_redirect_uris: Option<&'a [String]>,

    pub allowed_grant_types: &'a [GrantTypeName],
    pub scopes: &'a [String],

    pub require_pkce: bool,
    pub pkce_methods_allowed: &'a [PkceMethod],

    pub origin: &'a str,
    pub bearer_allowed: bool,
}

impl<'a> NewClientParams<'a> {
    /// Lightweight pre-DB checks (DB constraints still enforce policy).
    pub fn validate(&self) -> ModelResult<()> {
        if self.client_id.trim().is_empty() {
            return Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                "client_id cannot be empty",
                None::<anyhow::Error>,
            ));
        }

        if self.client_name.trim().is_empty() {
            return Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                "client_name cannot be empty",
                None::<anyhow::Error>,
            ));
        }

        if self.redirect_uris.is_empty() {
            return Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                "redirect_uris must not be empty",
                None::<anyhow::Error>,
            ));
        }

        if self.token_endpoint_auth_method.is_public() && self.client_secret.is_some() {
            return Err(ModelError::new(
                ModelErrorType::PreconditionFailed,
                "public clients must not include client_secret",
                None::<anyhow::Error>,
            ));
        }

        if self.token_endpoint_auth_method.is_confidential() && self.client_secret.is_none() {
            return Err(ModelError::new(
                ModelErrorType::PreconditionFailed,
                "confidential clients must include client_secret",
                None::<anyhow::Error>,
            ));
        }

        if !self.require_pkce && self.token_endpoint_auth_method.is_public() {
            return Err(ModelError::new(
                ModelErrorType::PreconditionFailed,
                "public clients must require PKCE",
                None::<anyhow::Error>,
            ));
        }

        Ok(())
    }
}

impl OAuthClient {
    /// Find an **active** (non-soft-deleted) client by DB `id` (UUID).
    pub async fn find_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Self> {
        let client = sqlx::query_as!(
            OAuthClient,
            r#"
        SELECT
          id,
          client_id,
          client_name,
          application_type                AS "application_type: _",
          token_endpoint_auth_method      AS "token_endpoint_auth_method: _",
          client_secret                   AS "client_secret: _",
          client_secret_expires_at,
          redirect_uris,
          post_logout_redirect_uris,
          allowed_grant_types             AS "allowed_grant_types: _",
          scopes,
          require_pkce,
          pkce_methods_allowed            AS "pkce_methods_allowed: _",
          origin,
          bearer_allowed,
          created_at,
          updated_at,
          deleted_at
        FROM oauth_clients
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
            id
        )
        .fetch_one(conn)
        .await?;

        Ok(client)
    }

    /// Same as `find_by_id`, but returns `Ok(None)` when not found.
    pub async fn find_by_id_optional(
        conn: &mut PgConnection,
        id: Uuid,
    ) -> Result<Option<Self>, ModelError> {
        Self::find_by_id(conn, id).await.optional()
    }

    /// Find an **active** (non-soft-deleted) client by `client_id`.
    pub async fn find_by_client_id(conn: &mut PgConnection, client_id: &str) -> ModelResult<Self> {
        let client = sqlx::query_as!(
            OAuthClient,
            r#"
    SELECT
      id,
      client_id,
      client_name,
      application_type                AS "application_type: _",
      token_endpoint_auth_method      AS "token_endpoint_auth_method: _",
      client_secret                   AS "client_secret: _",
      client_secret_expires_at,
      redirect_uris,
      post_logout_redirect_uris,
      allowed_grant_types             AS "allowed_grant_types: _",   -- or "grant_type[]"
      scopes,
      require_pkce,
      pkce_methods_allowed            AS "pkce_methods_allowed: _",  -- or "pkce_method[]"
      origin,
      bearer_allowed,
      created_at,
      updated_at,
      deleted_at
    FROM oauth_clients
    WHERE client_id = $1
      AND deleted_at IS NULL
    "#,
            client_id
        )
        .fetch_one(conn)
        .await?;

        Ok(client)
    }

    /// Same as `find_by_client_id`, but returns `Ok(None)` when not found.
    pub async fn find_by_client_id_optional(
        conn: &mut PgConnection,
        client_id: &str,
    ) -> Result<Option<Self>, ModelError> {
        Self::find_by_client_id(conn, client_id).await.optional()
    }

    /// Insert a new client and return the full hydrated row.
    pub async fn insert(conn: &mut PgConnection, p: NewClientParams<'_>) -> ModelResult<Self> {
        p.validate()?;
        let row = sqlx::query_as!(
            OAuthClient,
            r#"
    INSERT INTO oauth_clients (
        client_id,
        client_name,
        application_type,
        token_endpoint_auth_method,
        client_secret,
        client_secret_expires_at,
        redirect_uris,
        post_logout_redirect_uris,
        allowed_grant_types,
        scopes,
        require_pkce,
        pkce_methods_allowed,
        origin,
        bearer_allowed
    )
    VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, COALESCE($8, '{}'::text[]),     -- << cast needed for text[]
        $9, $10,
        $11, $12,
        $13, $14
    )
    RETURNING
      id,
      client_id,
      client_name,
      application_type                AS "application_type: _",
      token_endpoint_auth_method      AS "token_endpoint_auth_method: _",
      client_secret                   AS "client_secret: _",
      client_secret_expires_at,
      redirect_uris,
      post_logout_redirect_uris,
      allowed_grant_types             AS "allowed_grant_types: _",
      scopes,
      require_pkce,
      pkce_methods_allowed            AS "pkce_methods_allowed: _",
      origin,
      bearer_allowed,
      created_at,
      updated_at,
      deleted_at
    "#,
            p.client_id,
            p.client_name,
            p.application_type as ApplicationType,
            p.token_endpoint_auth_method as TokenEndpointAuthMethod,
            p.client_secret.map(|d| d.as_bytes() as &[u8]),
            p.client_secret_expires_at,
            p.redirect_uris,
            p.post_logout_redirect_uris,
            p.allowed_grant_types as &[GrantTypeName],
            p.scopes,
            p.require_pkce,
            p.pkce_methods_allowed as &[PkceMethod],
            p.origin,
            p.bearer_allowed
        )
        .fetch_one(conn)
        .await?;

        Ok(row)
    }
}
