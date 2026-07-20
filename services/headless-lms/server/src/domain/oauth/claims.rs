use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Claims {
    pub sub: String,
    pub aud: String,
    pub iss: String,
    pub iat: i64,
    pub exp: i64,
    /// OIDC nonce; only set when the authorization request included a nonce (omitted when absent per OIDC).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
}
