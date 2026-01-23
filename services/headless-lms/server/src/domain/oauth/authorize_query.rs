use super::oauth_validate::OAuthValidate;
use crate::prelude::*;
use domain::error::{OAuthErrorCode, OAuthErrorData};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default)]
pub struct AuthorizeQuery {
    pub response_type: Option<String>,
    pub client_id: Option<String>,
    pub redirect_uri: Option<String>,
    pub scope: Option<String>,
    pub state: Option<String>,
    pub nonce: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,

    pub prompt: Option<String>,
    // Request is not supported, but we capture it so we can return "not supported" error
    pub request: Option<String>,

    // OAuth2.0 spec requires that auth does not fail when there are unknown parameters present,
    // see RFC 6749 3.1
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default)]
pub struct AuthorizeParams {
    pub response_type: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub scope: String,
    pub state: Option<String>,
    pub nonce: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
    pub prompt: Option<String>,
    pub request: Option<String>,
}

// We need to make sure we don't return errors directly, instead we need to return
// error as success request with error parameters to comply with OAuth.
impl OAuthValidate for AuthorizeQuery {
    type Output = AuthorizeParams;

    fn validate(&self) -> Result<Self::Output, ControllerError> {
        let rt_opt = self.response_type.as_deref();
        let rt = rt_opt.unwrap_or_default();

        let client_id = self.client_id.as_deref().unwrap_or_default();
        let redirect_uri = self.redirect_uri.as_deref().unwrap_or_default();
        let scope = self.scope.as_deref().unwrap_or_default();

        // preserve original state (don't stringify empty -> Some(""))
        let state_opt = self.state.clone();

        // Required params check
        if client_id.is_empty() || redirect_uri.is_empty() || scope.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidRequest.as_str().into(),
                    error_description: "client_id, redirect_uri, and scope are required".into(),
                    redirect_uri: None,
                    state: state_opt.clone(),
                    nonce: None,
                })),
                "Missing required OAuth parameters",
                None,
            ));
        }

        // response_type presence check
        if rt.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidRequest.as_str().into(),
                    error_description: "response_type is required".into(),
                    redirect_uri: None,
                    state: state_opt.clone(),
                    nonce: None,
                })),
                "Missing response_type",
                None::<anyhow::Error>,
            ));
        }

        // Only "code" is supported
        if rt != "code" {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::UnsupportedResponseType.as_str().into(),
                    error_description: "unsupported response_type".into(),
                    redirect_uri: None, // add later after client+URI validation
                    state: state_opt,
                    nonce: None,
                })),
                "Unsupported response_type",
                None::<anyhow::Error>,
            ));
        }

        Ok(AuthorizeParams {
            response_type: rt.to_string(),
            client_id: client_id.to_string(),
            redirect_uri: redirect_uri.to_string(),
            scope: scope.to_string(),
            state: self.state.clone(),
            nonce: self.nonce.clone(),
            code_challenge: self.code_challenge.clone(),
            code_challenge_method: self.code_challenge_method.clone(),
            prompt: self.prompt.clone(),
            request: self.request.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::error::{ControllerError, ControllerErrorType, OAuthErrorCode};
    use serde_json::{Value, json};

    fn assert_oauth_error(
        result: Result<AuthorizeParams, ControllerError>,
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
            Ok(_) => panic!("Expected Err, got Ok(_)"),
        }
    }

    #[test]
    fn authorize_missing_fields() {
        let q = AuthorizeQuery {
            response_type: Some("code".into()),
            client_id: None,
            redirect_uri: None,
            scope: None,
            state: Some("xyz".into()),
            nonce: None,
            code_challenge: None,
            code_challenge_method: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "client_id, redirect_uri, and scope are required",
        );
    }

    #[test]
    fn authorize_unsupported_response_type() {
        let q = AuthorizeQuery {
            response_type: Some("token".into()),
            client_id: Some("cid".into()),
            redirect_uri: Some("http://localhost".into()),
            scope: Some("openid".into()),
            state: None,
            nonce: None,
            code_challenge: None,
            code_challenge_method: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::UnsupportedResponseType,
            "unsupported response_type",
        );
    }

    #[test]
    fn authorize_valid_code_flow_openid_without_nonce_is_ok() {
        // For pure code flow, nonce is not required by OIDC core.
        let q = AuthorizeQuery {
            response_type: Some("code".into()),
            client_id: Some("cid".into()),
            redirect_uri: Some("http://localhost".into()),
            scope: Some("openid profile".into()),
            state: Some("s".into()),
            nonce: None,
            code_challenge: None,
            code_challenge_method: None,
            _extra: Default::default(),
        };
        assert!(q.validate().is_ok());
    }

    #[test]
    fn authorize_unknown_params_are_captured_in_extra() {
        let v: Value = json!({
            "response_type": "code",
            "client_id": "cid",
            "redirect_uri": "http://localhost",
            "scope": "openid",
            "state": "s",
            "foo": "bar",
            "x": "y"
        });
        let q: AuthorizeQuery = serde_json::from_value(v).unwrap();
        assert_eq!(q._extra.get("foo").map(String::as_str), Some("bar"));
        assert_eq!(q._extra.get("x").map(String::as_str), Some("y"));
        assert!(q.validate().is_ok());
    }

    #[test]
    fn authorize_missing_response_type_is_invalid_request() {
        let q = AuthorizeQuery {
            response_type: None,
            client_id: Some("cid".into()),
            redirect_uri: Some("http://localhost".into()),
            scope: Some("openid".into()),
            state: None,
            nonce: None,
            code_challenge: None,
            code_challenge_method: None,
            _extra: Default::default(),
        };
        let res = q.validate();
        assert_oauth_error(
            res,
            OAuthErrorCode::InvalidRequest,
            "response_type is required",
        );
    }

    #[test]
    fn authorize_pkce_fields_passthrough() {
        let q = AuthorizeQuery {
            response_type: Some("code".into()),
            client_id: Some("cid".into()),
            redirect_uri: Some("http://localhost".into()),
            scope: Some("openid profile".into()),
            state: Some("s".into()),
            nonce: Some("n".into()),
            code_challenge: Some("abcDEF123-_".into()),
            code_challenge_method: Some("S256".into()),
            _extra: Default::default(),
        };
        let p = q.validate().expect("validate should pass");
        assert_eq!(p.code_challenge.as_deref(), Some("abcDEF123-_"));
        assert_eq!(p.code_challenge_method.as_deref(), Some("S256"));
    }
}
