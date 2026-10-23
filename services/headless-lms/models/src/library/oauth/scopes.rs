//! The OAuth scopes this provider knows.
//!
//! Scopes are validated per client against `oauth_clients.scopes`; this registry spells the scope
//! strings with cross-cutting meaning once.

use super::mcp::McpScope;

/// Scope carried by device-flow tokens issued to native/editor clients (e.g.
/// the TMC CLI / VSCode extension). It gates access to the exercise-services
/// client API and is also checked by tmc-server when it introspects
/// courses.mooc.fi tokens.
pub const EXERCISE_SERVICES_SCOPE: &str = "exercise-services";

/// Asks for a refresh token. Allowed alongside any resource's scopes.
pub const OFFLINE_ACCESS_SCOPE: &str = "offline_access";

/// Every scope the provider supports, as discovery advertises them.
pub fn supported_scopes() -> Vec<&'static str> {
    let mut scopes = vec![
        "openid",
        "profile",
        "email",
        OFFLINE_ACCESS_SCOPE,
        EXERCISE_SERVICES_SCOPE,
    ];
    scopes.extend(McpScope::all_strs());
    scopes
}

/// Scopes a client registered through a Client ID Metadata Document may request: the MCP scopes
/// and `offline_access`.
pub fn metadata_document_client_scopes() -> Vec<String> {
    McpScope::all_strs()
        .into_iter()
        .chain([OFFLINE_ACCESS_SCOPE])
        .map(str::to_string)
        .collect()
}
