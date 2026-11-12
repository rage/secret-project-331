pub mod bearer;
pub mod digest;
pub mod grant_type;
pub mod mcp;
pub mod pkce;
pub mod scopes;
pub mod tokens;

pub use digest::{Digest, DigestError};
pub use grant_type::GrantTypeName;
pub use scopes::{EXERCISE_SERVICES_SCOPE, OFFLINE_ACCESS_SCOPE};
pub use tokens::{generate_access_token, generate_user_code, token_digest_sha256};

/// Whether a token bound to `audience` (RFC 8707) may be used at `resource`.
pub fn is_bound_to(audience: Option<&[String]>, resource: &str) -> bool {
    audience.is_some_and(|audience| audience.iter().any(|bound| bound == resource))
}
