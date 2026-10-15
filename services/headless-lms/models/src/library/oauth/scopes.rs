//! Well-known OAuth scope identifiers used across the provider.
//!
//! Scopes are validated per client against `oauth_clients.scopes`; there is no
//! central registry to register into. These constants exist so the scope
//! strings that carry cross-cutting meaning are spelled exactly once.

/// Scope carried by device-flow tokens issued to native/editor clients (e.g.
/// the TMC CLI / VSCode extension). It gates access to the exercise-services
/// client API and is also checked by tmc-server when it introspects
/// courses.mooc.fi tokens.
pub const EXERCISE_SERVICES_SCOPE: &str = "exercise-services";
