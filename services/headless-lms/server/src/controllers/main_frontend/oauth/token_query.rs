use super::oauth_validate::OAuthValidate;
use crate::prelude::*;
use domain::error::{OAuthErrorCode, OAuthErrorData};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default)]
pub struct TokenQuery {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    #[serde(flatten)]
    pub grant: Option<GrantType>,
    // OAuth2.0 spec requires that token does not fail when there are unknown parameters present,
    // see RFC 6749 3.2
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

impl OAuthValidate for TokenQuery {
    fn validate(&self) -> Result<(), ControllerError> {
        let client_id = self.client_id.as_deref().unwrap_or_default();
        let client_secret = self.client_secret.as_deref().unwrap_or_default();

        if client_id.is_empty() || client_secret.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidClient.as_str().into(),
                    error_description: "client_id and client_secret are required".into(),
                    redirect_uri: None,
                    state: None,
                    nonce: None,
                })),
                "Missing client credentials",
                None::<anyhow::Error>,
            ));
        }

        match &self.grant {
            Some(GrantType::AuthorizationCode { code, redirect_uri }) => {
                if code.is_empty() || redirect_uri.is_empty() {
                    return Err(ControllerError::new(
                        ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                            error: OAuthErrorCode::InvalidRequest.as_str().into(),
                            error_description:
                                "code and redirect_uri are required for authorization_code grant"
                                    .into(),
                            redirect_uri: None,
                            state: None,
                            nonce: None,
                        })),
                        "Missing authorization code parameters",
                        None::<anyhow::Error>,
                    ));
                }
            }
            Some(GrantType::RefreshToken { refresh_token }) => {
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
            None => {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::UnsupportedGrantType.as_str().into(),
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

        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(tag = "grant_type")]
pub enum GrantType {
    #[serde(rename = "authorization_code")]
    AuthorizationCode { code: String, redirect_uri: String },
    #[serde(rename = "refresh_token")]
    RefreshToken { refresh_token: String },
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::error::{ControllerError, ControllerErrorType, OAuthErrorCode};
    use serde_json::{Value, json};

    fn assert_oauth_error(
        result: Result<(), ControllerError>,
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
            Ok(()) => panic!("Expected Err, got Ok(())"),
        }
    }

    #[test]
    fn token_missing_client_credentials() {
        let q = TokenQuery {
            client_id: None,
            client_secret: None,
            grant: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidClient,
            "client_id and client_secret are required",
        );
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
            OAuthErrorCode::UnsupportedGrantType,
            "grant_type is required",
        );
    }

    #[test]
    fn token_auth_code_missing_fields() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(GrantType::AuthorizationCode {
                code: "".into(),
                redirect_uri: "".into(),
            }),
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "code and redirect_uri are required for authorization_code grant",
        );
    }

    #[test]
    fn token_refresh_missing_field() {
        let q = TokenQuery {
            client_id: Some("cid".into()),
            client_secret: Some("sec".into()),
            grant: Some(GrantType::RefreshToken {
                refresh_token: "".into(),
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
            grant: Some(GrantType::AuthorizationCode {
                code: "abc".into(),
                redirect_uri: "http://localhost".into(),
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
            grant: Some(GrantType::RefreshToken {
                refresh_token: "r1".into(),
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
            "redirect_uri": "http://localhost"
        }))
        .unwrap();
        match ac.grant {
            Some(GrantType::AuthorizationCode { code, redirect_uri }) => {
                assert_eq!(code, "C");
                assert_eq!(redirect_uri, "http://localhost");
            }
            _ => panic!("expected AuthorizationCode"),
        }

        // refresh_token branch
        let rt: TokenQuery = serde_json::from_value(json!({
            "client_id": "cid",
            "client_secret": "sec",
            "grant_type": "refresh_token",
            "refresh_token": "R"
        }))
        .unwrap();
        match rt.grant {
            Some(GrantType::RefreshToken { refresh_token }) => {
                assert_eq!(refresh_token, "R");
            }
            _ => panic!("expected RefreshToken"),
        }
    }
}
