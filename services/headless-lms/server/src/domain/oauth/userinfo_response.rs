use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct UserInfoResponse {
    pub sub: String,
    #[serde(rename = "given_name", skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(rename = "family_name", skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    /// Whether the account has proven control of `email`. Emitted with the `email` scope.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email_verified: Option<bool>,
}
