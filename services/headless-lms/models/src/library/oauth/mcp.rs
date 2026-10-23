//! OAuth scopes and access-token validation for the MCP server at `/api/v0/mcp`.
//!
//! MCP tokens are Bearer tokens issued to Client ID Metadata Document clients, bound by RFC 8707
//! to the MCP resource URL. A token's rights are its scopes intersected with what its grant still
//! allows; the caller intersects them with the user's live roles through `authorize`.

use secrecy::SecretString;

use crate::{
    agent_changeset_calls::CallActor,
    library::oauth::{
        bearer::{BearerTokenError, resolve_bearer_token},
        is_bound_to,
    },
    oauth_user_client_scopes::OAuthUserClientScopes,
    prelude::*,
};

/// A capability an MCP token can carry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum McpScope {
    /// All read tools. Every MCP grant includes it.
    MaterialRead,
    /// Staging changes; risky changes always wait for the user on the review page.
    MaterialStage,
    /// Publishing staged routine changes without the review page.
    MaterialPublish,
    /// The course settings tool.
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

    pub fn all_strs() -> [&'static str; 4] {
        Self::ALL.map(Self::as_str)
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

    /// Whether the scopes ask for MCP access without `material:read`, which every MCP grant
    /// includes.
    pub fn lacks_required<'a>(scopes: impl IntoIterator<Item = &'a str>) -> bool {
        let mut has_mcp_scope = false;
        for scope in scopes {
            match Self::parse(scope) {
                Some(McpScope::MaterialRead) => return false,
                Some(_) => has_mcp_scope = true,
                None => {}
            }
        }
        has_mcp_scope
    }
}

/// Who an MCP request acts for, from a validated access token.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpPrincipal {
    /// The user, client and grant the token was issued to; agent writes are recorded under it.
    pub actor: CallActor,
    /// The token's scopes still allowed by its grant.
    pub scopes: Vec<McpScope>,
}

impl McpPrincipal {
    pub fn has_scope(&self, scope: McpScope) -> bool {
        self.scopes.contains(&scope)
    }
}

/// Validates a Bearer access token for the MCP server and resolves who it acts for. Records the
/// grant as used.
pub async fn authenticate_mcp_access_token(
    conn: &mut PgConnection,
    token: &str,
    token_hmac_key: &SecretString,
    mcp_resource_url: &str,
) -> Result<McpPrincipal, BearerTokenError> {
    let token = resolve_bearer_token(conn, token, token_hmac_key).await?;
    if !is_bound_to(token.audience.as_deref(), mcp_resource_url) {
        return Err(BearerTokenError::Invalid(
            "The access token was not issued for this MCP server.",
        ));
    }
    if !token.is_metadata_document_client {
        return Err(BearerTokenError::Invalid(
            "The access token's client may not use the MCP server.",
        ));
    }
    let scopes = token
        .scopes
        .iter()
        .filter_map(|scope| McpScope::parse(scope))
        .collect();
    OAuthUserClientScopes::mark_grant_used(conn, token.grant.id, token.grant.last_used_at)
        .await
        .map_err(BearerTokenError::Database)?;
    Ok(McpPrincipal {
        actor: CallActor {
            user_id: token.user.id,
            oauth_client_id: token.client_id,
            oauth_grant_id: token.grant.id,
            client_name: token.client_name,
        },
        scopes,
    })
}
