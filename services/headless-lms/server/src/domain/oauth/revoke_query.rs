use super::oauth_validate::OAuthValidate;
use crate::prelude::*;
use domain::error::{OAuthErrorCode, OAuthErrorData};
use serde::Deserialize;
use std::collections::HashMap;

/// Query parameters for the OAuth 2.0 token revocation endpoint (RFC 7009).
///
/// The revocation endpoint allows clients to revoke access tokens or refresh tokens.
#[derive(Debug, Deserialize)]
pub struct RevokeQuery {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    /// The token to be revoked (required).
    pub token: String,

    /// Hint about the type of the token being revoked (optional).
    /// Valid values: "access_token" or "refresh_token".
    pub token_type_hint: Option<String>,
    // OAuth 2.0 requires unknown params be ignored at /revoke (RFC 7009 §2.1)
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

#[derive(Debug)]
pub struct RevokeParams {
    pub client_id: String,
    pub client_secret: Option<String>,
    pub token: String,
    pub token_type_hint: Option<String>,
}

impl OAuthValidate for RevokeQuery {
    type Output = RevokeParams;

    fn validate(&self) -> Result<Self::Output, ControllerError> {
        let client_id = self.client_id.as_deref().unwrap_or_default();

        if client_id.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidClient.as_str().into(),
                    error_description: "client_id is required".into(),
                    redirect_uri: None,
                    state: None,
                    nonce: None,
                })),
                "Missing client_id",
                None::<anyhow::Error>,
            ));
        }

        if self.token.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidRequest.as_str().into(),
                    error_description: "token is required".into(),
                    redirect_uri: None,
                    state: None,
                    nonce: None,
                })),
                "Missing token",
                None::<anyhow::Error>,
            ));
        }

        // Validate token_type_hint if provided
        if let Some(ref hint) = self.token_type_hint {
            if hint != "access_token" && hint != "refresh_token" {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidRequest.as_str().into(),
                        error_description:
                            "token_type_hint must be 'access_token' or 'refresh_token'".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "Invalid token_type_hint",
                    None::<anyhow::Error>,
                ));
            }
        }

        Ok(RevokeParams {
            client_id: client_id.to_string(),
            client_secret: self.client_secret.clone(),
            token: self.token.clone(),
            token_type_hint: self.token_type_hint.clone(),
        })
    }
}
