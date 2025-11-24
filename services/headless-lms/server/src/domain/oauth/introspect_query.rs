use super::oauth_validate::OAuthValidate;
use crate::prelude::*;
use domain::error::{OAuthErrorCode, OAuthErrorData};
use serde::Deserialize;
use std::collections::HashMap;

/// Query parameters for the OAuth 2.0 token introspection endpoint (RFC 7662).
///
/// The introspection endpoint allows resource servers to query the authorization server
/// about the active state and metadata of an access token.
#[derive(Debug, Deserialize)]
pub struct IntrospectQuery {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    /// The token to be introspected (required).
    pub token: Option<String>,

    /// Hint about the type of the token being introspected (optional).
    /// Valid values: "access_token" or "refresh_token".
    /// Currently only "access_token" is supported.
    pub token_type_hint: Option<String>,
    // OAuth 2.0 requires unknown params be ignored
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

#[derive(Debug)]
pub struct IntrospectParams {
    pub client_id: String,
    pub client_secret: Option<String>,
    pub token: String,
    pub token_type_hint: Option<String>,
}

impl OAuthValidate for IntrospectQuery {
    type Output = IntrospectParams;

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

        Ok(IntrospectParams {
            client_id: client_id.to_string(),
            client_secret: self.client_secret.clone(),
            token: token.to_string(),
            token_type_hint: self.token_type_hint.clone(),
        })
    }
}
