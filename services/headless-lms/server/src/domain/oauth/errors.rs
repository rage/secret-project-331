use crate::domain::error::{ControllerError, ControllerErrorType, OAuthErrorCode, OAuthErrorData};
use crate::prelude::BackendError;
use dpop_verifier::DpopError;
use thiserror::Error;

/// Domain-specific errors for OAuth token grant processing.
#[derive(Debug, Error)]
pub enum TokenGrantError {
    /// Invalid grant (e.g., invalid authorization code or refresh token)
    #[error("Invalid grant: {0}")]
    InvalidGrant(String),

    /// Invalid client (e.g., client ID mismatch or missing DPoP header)
    #[error("Invalid client: {0}")]
    InvalidClient(String),

    /// RFC 6749 §6: a refresh-token grant requested a scope that is not a
    /// subset of the scope originally granted to the token being refreshed.
    #[error("Invalid scope: {0}")]
    InvalidScope(String),

    /// PKCE verification failed
    #[error("PKCE verification failed")]
    PkceVerificationFailed,

    /// Unsupported grant type
    #[error("Unsupported grant type")]
    UnsupportedGrantType,

    /// DPoP JKT mismatch
    #[error("DPoP JKT mismatch")]
    DpopMismatch,

    /// RFC 8628: the authorization request is still pending (user has not yet
    /// approved or denied the device code).
    #[error("Authorization pending")]
    AuthorizationPending,

    /// RFC 8628: the client is polling faster than the permitted interval.
    #[error("Slow down")]
    SlowDown,

    /// RFC 8628: the device code has expired.
    #[error("Device code expired")]
    ExpiredToken,

    /// RFC 8628: the user denied the authorization request.
    #[error("Access denied")]
    AccessDenied,

    /// RFC 8707: the requested resource does not match the grant.
    #[error("Invalid target: {0}")]
    InvalidTarget(String),

    /// Server error (database or other internal error)
    #[error("Server error: {0}")]
    ServerError(String),
}

impl From<TokenGrantError> for ControllerError {
    fn from(err: TokenGrantError) -> Self {
        let data = match &err {
            TokenGrantError::InvalidGrant(msg) => {
                OAuthErrorData::new(OAuthErrorCode::InvalidGrant, msg)
            }
            TokenGrantError::InvalidClient(msg) => {
                OAuthErrorData::new(OAuthErrorCode::InvalidClient, msg)
            }
            TokenGrantError::InvalidScope(msg) => {
                OAuthErrorData::new(OAuthErrorCode::InvalidScope, msg)
            }
            TokenGrantError::PkceVerificationFailed => {
                OAuthErrorData::new(OAuthErrorCode::InvalidGrant, "PKCE verification failed")
            }
            TokenGrantError::UnsupportedGrantType => OAuthErrorData::new(
                OAuthErrorCode::UnsupportedGrantType,
                "unsupported grant type",
            ),
            TokenGrantError::DpopMismatch => {
                OAuthErrorData::new(OAuthErrorCode::InvalidToken, "DPoP JKT mismatch")
            }
            TokenGrantError::AuthorizationPending => OAuthErrorData::new(
                OAuthErrorCode::AuthorizationPending,
                "authorization request is still pending",
            ),
            TokenGrantError::SlowDown => OAuthErrorData::new(
                OAuthErrorCode::SlowDown,
                "polling too frequently; slow down",
            ),
            TokenGrantError::ExpiredToken => {
                OAuthErrorData::new(OAuthErrorCode::ExpiredToken, "device code has expired")
            }
            TokenGrantError::AccessDenied => OAuthErrorData::new(
                OAuthErrorCode::AccessDenied,
                "authorization request was denied",
            ),
            TokenGrantError::InvalidTarget(msg) => {
                OAuthErrorData::new(OAuthErrorCode::InvalidTarget, msg)
            }
            TokenGrantError::ServerError(msg) => {
                OAuthErrorData::new(OAuthErrorCode::ServerError, msg)
            }
        };

        ControllerError::new(
            ControllerErrorType::OAuthError(Box::new(data)),
            err.to_string(),
            Some(anyhow::anyhow!(err)),
        )
    }
}

impl From<DpopError> for TokenGrantError {
    fn from(err: DpopError) -> Self {
        match err {
            DpopError::AthMismatch => TokenGrantError::DpopMismatch,
            _ => TokenGrantError::ServerError(format!("DPoP error: {}", err)),
        }
    }
}
