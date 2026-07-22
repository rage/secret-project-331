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

    /// Server error (database or other internal error)
    #[error("Server error: {0}")]
    ServerError(String),
}

impl From<TokenGrantError> for ControllerError {
    fn from(err: TokenGrantError) -> Self {
        let data = match &err {
            TokenGrantError::InvalidGrant(msg) => OAuthErrorData {
                error: OAuthErrorCode::InvalidGrant.as_str().into(),
                error_description: msg.clone(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            TokenGrantError::InvalidClient(msg) => OAuthErrorData {
                error: OAuthErrorCode::InvalidClient.as_str().into(),
                error_description: msg.clone(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            TokenGrantError::PkceVerificationFailed => OAuthErrorData {
                error: OAuthErrorCode::InvalidGrant.as_str().into(),
                error_description: "PKCE verification failed".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            TokenGrantError::UnsupportedGrantType => OAuthErrorData {
                error: OAuthErrorCode::UnsupportedGrantType.as_str().into(),
                error_description: "unsupported grant type".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            TokenGrantError::DpopMismatch => OAuthErrorData {
                error: OAuthErrorCode::InvalidToken.as_str().into(),
                error_description: "DPoP JKT mismatch".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            TokenGrantError::AuthorizationPending => OAuthErrorData {
                error: OAuthErrorCode::AuthorizationPending.as_str().into(),
                error_description: "authorization request is still pending".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            TokenGrantError::SlowDown => OAuthErrorData {
                error: OAuthErrorCode::SlowDown.as_str().into(),
                error_description: "polling too frequently; slow down".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            TokenGrantError::ExpiredToken => OAuthErrorData {
                error: OAuthErrorCode::ExpiredToken.as_str().into(),
                error_description: "device code has expired".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            TokenGrantError::AccessDenied => OAuthErrorData {
                error: OAuthErrorCode::AccessDenied.as_str().into(),
                error_description: "authorization request was denied".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            TokenGrantError::ServerError(msg) => OAuthErrorData {
                error: OAuthErrorCode::ServerError.as_str().into(),
                error_description: msg.clone(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
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
