use serde::{Deserialize, Serialize};
use sqlx::Type;

/// OAuth 2.0 grant type name (fieldless enum for DB mapping and policy checks).
///
/// Maps 1:1 to the PostgreSQL `grant_type` enum.
/// Used in `OAuthClient.allowed_grant_types` and for checking which grants a client supports.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "grant_type")]
#[serde(rename_all = "snake_case")]
pub enum GrantTypeName {
    AuthorizationCode,
    RefreshToken,
    ClientCredentials,
    DeviceCode,
    // keep this in sync with the Postgres enum
}
