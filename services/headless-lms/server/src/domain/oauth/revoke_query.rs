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
    pub token: Option<String>,

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

        let token = self.token.as_deref().unwrap_or_default();
        if token.is_empty() {
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

        // RFC 7009 §2.1: "The authorization server MAY ignore the hint."
        // Normalize token_type_hint: only recognize "access_token" and "refresh_token",
        // treat any other value as None (ignore unknown hints)
        let token_type_hint = self.token_type_hint.as_deref().and_then(|h| {
            match h {
                "access_token" | "refresh_token" => Some(h.to_string()),
                _ => None, // Unknown hints are ignored per RFC 7009
            }
        });

        Ok(RevokeParams {
            client_id: client_id.to_string(),
            client_secret: self.client_secret.clone(),
            token: token.to_string(),
            token_type_hint,
        })
    }
}
