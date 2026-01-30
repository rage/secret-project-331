use serde::{Deserialize, Serialize};

/// Response from the OAuth 2.0 token introspection endpoint (RFC 7662).
///
/// This response indicates whether a token is active and includes metadata
/// about the token if it is active.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct IntrospectResponse {
    /// Whether the token is active (required).
    pub active: bool,

    /// Space-separated list of scopes (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,

    /// Client identifier (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,

    /// Username/subject (optional, only if active and token has user).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,

    /// Expiration timestamp as Unix time (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exp: Option<i64>,

    /// Issued at timestamp as Unix time (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iat: Option<i64>,

    /// Subject identifier (optional, only if active and token has user).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub: Option<String>,

    /// Audience (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aud: Option<Vec<String>>,

    /// Issuer (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,

    /// JWT ID (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jti: Option<String>,

    /// Token type: "Bearer" or "DPoP" (optional, only if active).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,
}
