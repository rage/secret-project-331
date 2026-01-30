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
