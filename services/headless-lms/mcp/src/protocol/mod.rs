//! Stateless MCP over HTTP, protocol revision 2026-07-28 only. One POST carries one JSON-RPC
//! request; everything the server needs is in that request.

pub mod context;
pub mod dispatch;
pub mod headers;
pub mod progress;

use rmcp::model::ErrorCode;

pub const PROTOCOL_VERSION: &str = "2026-07-28";

/// Where teachers learn to set up their agent, including Codex's 2026-07-28 opt-in.
pub const SETUP_DOCS_URL: &str = "https://github.com/rage/course-material-agent-skills#setup";

/// Our errors, in the implementation-defined range; MCP's reserved codes are used where they apply.
pub mod error_codes {
    use super::ErrorCode;

    pub const UNSUPPORTED_PROTOCOL_VERSION: ErrorCode = ErrorCode::UNSUPPORTED_PROTOCOL_VERSION;
    pub const HEADER_MISMATCH: ErrorCode = ErrorCode::HEADER_MISMATCH;
    pub const INVALID_PARAMS: ErrorCode = ErrorCode::INVALID_PARAMS;
    pub const METHOD_NOT_FOUND: ErrorCode = ErrorCode::METHOD_NOT_FOUND;
    pub const INVALID_REQUEST: ErrorCode = ErrorCode::INVALID_REQUEST;
    pub const PARSE_ERROR: ErrorCode = ErrorCode::PARSE_ERROR;
    pub const INTERNAL_ERROR: ErrorCode = ErrorCode::INTERNAL_ERROR;
    /// The bearer token is missing, invalid or lacks a scope.
    pub const UNAUTHORIZED: ErrorCode = ErrorCode(-32050);
    /// A sealed `requestState` didn't verify or has expired.
    pub const INVALID_REQUEST_STATE: ErrorCode = ErrorCode(-32051);
}
