//! pkce.rs — PKCE types for database serialization
//!
//! This module provides the minimal `PkceMethod` enum needed for sqlx database queries.
//! The full PKCE implementation (CodeVerifier, CodeChallenge, etc.) has been moved to
//! `headless_lms_server::domain::oauth::pkce`.

use serde::{Deserialize, Serialize};
use sqlx::Type;

/// PKCE method (RFC 7636 §4.3). Mirrors Postgres enum: `pkce_method = ('plain','S256')`.
///
/// This type is kept in models for sqlx compatibility. The full implementation
/// including validation logic is in `headless_lms_server::domain::oauth::pkce`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "pkce_method")]
pub enum PkceMethod {
    #[serde(rename = "plain")]
    #[sqlx(rename = "plain")]
    Plain,
    #[serde(rename = "S256")]
    #[sqlx(rename = "S256")]
    S256,
}

impl PkceMethod {
    #[inline]
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "plain" => Some(Self::Plain),
            "S256" => Some(Self::S256),
            _ => None,
        }
    }
}
