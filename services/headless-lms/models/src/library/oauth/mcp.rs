//! OAuth scopes and access-token validation for the MCP server at `/api/v0/mcp`.
//!
//! MCP tokens are Bearer tokens issued to Client ID Metadata Document clients, bound by RFC 8707
//! to the MCP resource URL. A token's rights are its scopes intersected with what its grant still
//! allows; the caller intersects them with the user's live roles through `authorize`.

use secrecy::SecretString;
use utoipa::ToSchema;

use crate::{
    agent_changeset_calls::CallActor,
    library::oauth::token_digest_sha256,
    oauth_access_token::{OAuthAccessToken, TokenType},
    oauth_client::OAuthClient,
    oauth_user_client_scopes,
    prelude::*,
};

/// A capability an MCP token can carry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
pub enum McpScope {
    /// All read tools. Every MCP grant includes it.
    #[serde(rename = "material:read")]
    MaterialRead,
    /// Staging changes; risky changes always wait for the user on the review page.
    #[serde(rename = "material:stage")]
    MaterialStage,
    /// Publishing staged routine changes without the review page.
    #[serde(rename = "material:publish")]
    MaterialPublish,
    /// The course settings tool.
    #[serde(rename = "settings:write")]
    SettingsWrite,
}

impl McpScope {
    pub const ALL: [McpScope; 4] = [
        McpScope::MaterialRead,
        McpScope::MaterialStage,
        McpScope::MaterialPublish,
        McpScope::SettingsWrite,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            McpScope::MaterialRead => "material:read",
            McpScope::MaterialStage => "material:stage",
            McpScope::MaterialPublish => "material:publish",
            McpScope::SettingsWrite => "settings:write",
        }
    }

    pub fn parse(scope: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|s| s.as_str() == scope)
    }

    /// The consent screen does not let the user uncheck it.
    pub fn is_required(self) -> bool {
        self == McpScope::MaterialRead
    }

    /// Whether the consent screen's checkbox starts checked.
    pub fn is_checked_by_default(self) -> bool {
        self != McpScope::SettingsWrite
    }
}

/// The space-separated list of every MCP scope, for `scope` challenges and metadata.
pub fn all_mcp_scopes_string() -> String {
    McpScope::ALL
        .iter()
        .map(|scope| scope.as_str())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Who an MCP request acts for, from a validated access token.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpPrincipal {
    pub user_id: Uuid,
    /// `oauth_user_client_scopes.id`: revoking this grant revokes the token.
    pub grant_id: Uuid,
    /// `oauth_clients.id`.
    pub oauth_client_id: Uuid,
    /// The client's public client id, its metadata document URL.
    pub client_id: String,
    pub client_name: String,
    /// The token's scopes still allowed by its grant.
    pub scopes: Vec<McpScope>,
    pub access_token_expires_at: DateTime<Utc>,
}

impl McpPrincipal {
    pub fn has_scope(&self, scope: McpScope) -> bool {
        self.scopes.contains(&scope)
    }

    /// The actor to record agent write calls under.
    pub fn call_actor(&self) -> CallActor {
        CallActor {
            user_id: self.user_id,
            oauth_client_id: Some(self.oauth_client_id),
            oauth_grant_id: Some(self.grant_id),
            client_name: self.client_name.clone(),
        }
    }
}

#[derive(Debug)]
pub enum McpTokenError {
    /// The token is unknown, expired, revoked or not meant for the MCP server: answer 401 with
    /// `error="invalid_token"`. The message is safe to show to the client.
    InvalidToken(&'static str),
    Database(ModelError),
}

impl From<ModelError> for McpTokenError {
    fn from(err: ModelError) -> Self {
        if err.error_type() == &ModelErrorType::RecordNotFound {
            McpTokenError::InvalidToken("The access token is invalid or has expired.")
        } else {
            McpTokenError::Database(err)
        }
    }
}

/// Validates a Bearer access token for the MCP resource `mcp_resource_url` and resolves who it
/// acts for. Records the grant as used.
pub async fn authenticate_mcp_access_token(
    conn: &mut PgConnection,
    token: &str,
    token_hmac_key: &SecretString,
    mcp_resource_url: &str,
) -> Result<McpPrincipal, McpTokenError> {
    let digest = token_digest_sha256(token, token_hmac_key);
    let access_token = OAuthAccessToken::find_valid(conn, digest).await?;
    if access_token.token_type != TokenType::Bearer {
        return Err(McpTokenError::InvalidToken(
            "The MCP server accepts only Bearer tokens.",
        ));
    }
    let is_for_mcp = access_token
        .audience
        .as_ref()
        .is_some_and(|audience| audience.iter().any(|a| a == mcp_resource_url));
    if !is_for_mcp {
        return Err(McpTokenError::InvalidToken(
            "The access token was not issued for this MCP server.",
        ));
    }
    let Some(user_id) = access_token.user_id else {
        return Err(McpTokenError::InvalidToken(
            "The access token is not associated with a user.",
        ));
    };
    let client = OAuthClient::find_by_id(conn, access_token.client_id).await?;
    if !client.is_metadata_document_client() || !client.allows_bearer() {
        return Err(McpTokenError::InvalidToken(
            "The access token's client may not use the MCP server.",
        ));
    }
    crate::users::get_active_by_id(conn, user_id).await?;
    let Some(grant) =
        oauth_user_client_scopes::get_grant_by_user_and_client(conn, user_id, client.id).await?
    else {
        return Err(McpTokenError::InvalidToken("The grant has been revoked."));
    };
    let scopes = access_token
        .scopes
        .iter()
        .filter(|scope| grant.scopes.contains(scope))
        .filter_map(|scope| McpScope::parse(scope))
        .collect();
    oauth_user_client_scopes::mark_grant_used(conn, grant.id).await?;
    Ok(McpPrincipal {
        user_id,
        grant_id: grant.id,
        oauth_client_id: client.id,
        client_id: client.client_id,
        client_name: client.client_name,
        scopes,
        access_token_expires_at: access_token.expires_at,
    })
}
