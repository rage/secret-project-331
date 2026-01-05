use super::oauth_validate::OAuthValidate;
use crate::prelude::*;
use domain::error::{OAuthErrorCode, OAuthErrorData};
use models::library::oauth::GrantTypeName;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default)]
pub struct TokenQuery {
    pub client_id: Option<String>,
    pub client_secret: Option<String>, // optional: public clients won't send this
    #[serde(flatten)]
    pub grant: Option<TokenGrant>,
    // OAuth 2.0 requires unknown params be ignored at /token (RFC 6749 §3.2)
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct TokenParams {
    pub client_id: String,
    pub client_secret: Option<String>, // carry through; validation for presence is done per-client later
    pub grant: TokenGrant,
}

impl OAuthValidate for TokenQuery {
    type Output = TokenParams;

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

        // Grant-specific required params
        match &self.grant {
            Some(TokenGrant::AuthorizationCode {
                code,
                redirect_uri,
                code_verifier: _,
            }) => {
                if code.is_empty() {
                    return Err(ControllerError::new(
                        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                            error: OAuthErrorCode::InvalidRequest.as_str().into(),
                            error_description: "code is required for authorization_code grant"
                                .into(),
                            redirect_uri: None,
                            state: None,
                            nonce: None,
                        })),
                        "Missing authorization code",
                        None::<anyhow::Error>,
                    ));
                }
                // If redirect_uri is provided, it must not be empty
                if matches!(redirect_uri.as_deref(), Some("")) {
                    return Err(ControllerError::new(
                        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                            error: OAuthErrorCode::InvalidRequest.as_str().into(),
                            error_description: "redirect_uri must not be empty when provided"
                                .into(),
                            redirect_uri: None,
                            state: None,
                            nonce: None,
                        })),
                        "Empty redirect_uri",
                        None::<anyhow::Error>,
                    ));
                }
                // PKCE code_verifier is verified at the token handler (if the code had a challenge)
            }
            Some(TokenGrant::RefreshToken { refresh_token, .. }) => {
                if refresh_token.is_empty() {
                    return Err(ControllerError::new(
                        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                            error: OAuthErrorCode::InvalidRequest.as_str().into(),
                            error_description: "refresh_token is required".into(),
                            redirect_uri: None,
                            state: None,
                            nonce: None,
                        })),
                        "Missing refresh token",
                        None::<anyhow::Error>,
                    ));
                }
            }
            Some(TokenGrant::Unknown) => {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::UnsupportedGrantType.as_str().into(),
                        error_description: "unsupported grant type".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "Unsupported grant type",
                    None::<anyhow::Error>,
                ));
            }
            None => {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidRequest.as_str().into(),
                        error_description: "grant_type is required".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "Missing grant type",
                    None::<anyhow::Error>,
                ));
            }
        }

        Ok(TokenParams {
            client_id: client_id.to_string(),
            client_secret: self.client_secret.clone(), // may be None for public clients
            grant: self
                .grant
                .clone()
                .expect("grant should be Some after match validation"),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(tag = "grant_type", rename_all = "snake_case")]
pub enum TokenGrant {
    AuthorizationCode {
        code: String,
        /// Optional per RFC 6749 §4.1.3 (required if it was present in the authorization request)
        redirect_uri: Option<String>,
        /// Optional; enforced later if the code stored a challenge
        code_verifier: Option<String>,
    },
    RefreshToken {
        refresh_token: String,
        /// Optional down-scope
        #[serde(default)]
        scope: Option<String>,
    },
    #[serde(other)]
    Unknown,
}

impl TokenGrant {
    pub fn kind(&self) -> GrantTypeName {
        match self {
            TokenGrant::AuthorizationCode { .. } => GrantTypeName::AuthorizationCode,
            TokenGrant::RefreshToken { .. } => GrantTypeName::RefreshToken,
            TokenGrant::Unknown => {
                unreachable!(
                    "Unknown grant type should be caught by validate() before kind() is called"
                )
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::error::{ControllerError, ControllerErrorType, OAuthErrorCode};
    use serde_json::{Value, json};

    fn assert_oauth_error(
        result: Result<TokenParams, ControllerError>,
        expected_error: OAuthErrorCode,
        expected_description: &str,
    ) {
        match result {
            Err(err) => match err.error_type() {
                ControllerErrorType::OAuthError(data) => {
                    assert_eq!(data.error, expected_error.as_str());
                    assert_eq!(data.error_description, expected_description);
                }
                other => panic!("Expected OAuthError, got {:?}", other),
            },
            Ok(_) => panic!("Expected Err, got Ok(())"),
        }
    }

    #[test]
    fn token_missing_client_id() {
        let q = TokenQuery {
            client_id: None,
            client_secret: None,
            grant: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(res, OAuthErrorCode::InvalidClient, "client_id is required");
    }

    #[test]
    fn token_public_client_without_secret_is_ok() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: None,
            grant: Some(TokenGrant::RefreshToken {
                refresh_token: "rt".into(),
                scope: None,
            }),
            _extra: Default::default(),
        };
        assert!(q.validate().is_ok());
    }

    #[test]
    fn token_missing_grant_type() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "grant_type is required",
        );
    }

    #[test]
    fn token_auth_code_missing_code() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(TokenGrant::AuthorizationCode {
                code: "".into(),
                redirect_uri: Some("http://localhost".into()),
                code_verifier: None,
            }),
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "code is required for authorization_code grant",
        );
    }

    #[test]
    fn token_auth_code_empty_redirect_uri_is_invalid() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(TokenGrant::AuthorizationCode {
                code: "C".into(),
                redirect_uri: Some("".into()),
                code_verifier: None,
            }),
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "redirect_uri must not be empty when provided",
        );
    }

    #[test]
    fn token_auth_code_minimal_ok_without_redirect_uri_or_pkce() {
        // Allowed by validator; actual PKCE/redirect checks happen in handler.
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(TokenGrant::AuthorizationCode {
                code: "C".into(),
                redirect_uri: None,
                code_verifier: None,
            }),
            _extra: Default::default(),
        };
        assert!(q.validate().is_ok());
    }

    #[test]
    fn token_auth_code_with_pkce_ok() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(TokenGrant::AuthorizationCode {
                code: "C".into(),
                redirect_uri: Some("http://localhost".into()),
                code_verifier: Some("verifier".into()),
            }),
            _extra: Default::default(),
        };
        assert!(q.validate().is_ok());
    }

    #[test]
    fn token_refresh_missing_field() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(TokenGrant::RefreshToken {
                refresh_token: "".into(),
                scope: None,
            }),
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "refresh_token is required",
        );
    }

    #[test]
    fn token_valid_auth_code() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(TokenGrant::AuthorizationCode {
                code: "abc".into(),
                redirect_uri: Some("http://localhost".into()),
                code_verifier: None,
            }),
            _extra: Default::default(),
        };
        assert!(q.validate().is_ok());
    }

    #[test]
    fn token_valid_refresh_token() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(TokenGrant::RefreshToken {
                refresh_token: "r1".into(),
                scope: None,
            }),
            _extra: Default::default(),
        };
        assert!(q.validate().is_ok());
    }

    #[test]
    fn token_unknown_params_are_captured_in_extra() {
        let v: Value = json!({
            "client_id": "cid",
            "client_secret": "sec",
            "grant_type": "refresh_token",
            "refresh_token": "rt",
            "extra_param": "zzz"
        });
        let q: TokenQuery = serde_json::from_value(v).unwrap();
        assert_eq!(q._extra.get("extra_param").map(String::as_str), Some("zzz"));
        assert!(q.validate().is_ok());
    }

    #[test]
    fn token_grant_tagging_deserializes_properly() {
        // authorization_code branch
        let ac: TokenQuery = serde_json::from_value(json!({
            "client_id": "cid",
            "client_secret": "sec",
            "grant_type": "authorization_code",
            "code": "C",
            "redirect_uri": "http://localhost",
            "code_verifier": "ver"
        }))
        .unwrap();
        match ac.grant {
            Some(TokenGrant::AuthorizationCode {
                code,
                redirect_uri,
                code_verifier,
            }) => {
                assert_eq!(code, "C");
                assert_eq!(redirect_uri.as_deref(), Some("http://localhost"));
                assert_eq!(code_verifier.as_deref(), Some("ver"));
            }
            _ => panic!("expected AuthorizationCode"),
        }

        // refresh_token branch
        let rt: TokenQuery = serde_json::from_value(json!({
            "client_id": "cid",
            "client_secret": "sec",
            "grant_type": "refresh_token",
            "refresh_token": "R",
            "scope": "read write"
        }))
        .unwrap();
        match rt.grant {
            Some(TokenGrant::RefreshToken {
                refresh_token,
                scope,
            }) => {
                assert_eq!(refresh_token, "R");
                assert_eq!(scope.as_deref(), Some("read write"));
            }
            _ => panic!("expected RefreshToken"),
        }
    }
}
