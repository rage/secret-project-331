//! Stateless MCP over HTTP, protocol revision 2026-07-28 only. One POST carries one JSON-RPC
//! request; everything the server needs is in that request.

pub(crate) mod context;
pub mod dispatch;
pub mod headers;
pub(crate) mod progress;

use headless_lms_utils::http::escape_auth_param;
use rmcp::model::{ErrorCode, ProtocolVersion};

/// The only protocol revision the server speaks.
pub(crate) const PROTOCOL_VERSION: ProtocolVersion = ProtocolVersion::V_2026_07_28;

/// Where teachers learn to set up their agent, including Codex's 2026-07-28 opt-in.
pub(crate) const SETUP_DOCS_URL: &str =
    "https://github.com/rage/course-material-agent-skills/blob/main/SETUP.md";

/// Our errors, in the implementation-defined range. MCP's reserved codes are used from
/// [`ErrorCode`] where they apply.
pub(crate) mod error_codes {
    use super::ErrorCode;

    /// The bearer token is missing, invalid or lacks a scope.
    pub const UNAUTHORIZED: ErrorCode = ErrorCode(-32050);
    /// A sealed `requestState` didn't verify or has expired.
    pub const INVALID_REQUEST_STATE: ErrorCode = ErrorCode(-32051);
}

/// The `WWW-Authenticate` value of a 401 or 403 from the MCP server: where the client finds the
/// authorization server (RFC 9728) and which scopes to ask for. `error` is the RFC 6750 error code
/// and description, absent when no token was sent.
pub(crate) fn www_authenticate_challenge(
    resource_metadata_url: &str,
    scope: &str,
    error: Option<(&str, &str)>,
) -> String {
    let mut challenge = format!(
        r#"Bearer resource_metadata="{}", scope="{}""#,
        escape_auth_param(resource_metadata_url),
        escape_auth_param(scope)
    );
    if let Some((code, description)) = error {
        challenge.push_str(&format!(
            r#", error="{}", error_description="{}""#,
            escape_auth_param(code),
            escape_auth_param(description)
        ));
    }
    challenge
}
