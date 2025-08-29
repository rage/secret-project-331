use crate::prelude::*;
use actix_web::{FromRequest, HttpRequest, dev::Payload, web};
use domain::error::{OAuthErrorCode, OAuthErrorData};
use futures_util::future::LocalBoxFuture;
use hmac::Hmac;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
pub trait ExtractFallback: Default + for<'de> Deserialize<'de> {}
impl<T> ExtractFallback for T where T: Default + for<'de> Deserialize<'de> {}

type AsyncPin<'a, O> = Pin<Box<dyn Future<Output = O> + 'a>>;

#[derive(Debug)]
pub struct SafeExtractor<T>(pub T);

impl<T> SafeExtractor<T>
where
    T: ExtractFallback + 'static,
{
    pub fn from_form<'a>(req: &'a HttpRequest, payload: &'a mut Payload) -> AsyncPin<'a, Self> {
        Box::pin(async move {
            match web::Form::<T>::from_request(req, payload).await {
                Ok(form) => SafeExtractor(form.into_inner()),
                Err(_) => SafeExtractor(T::default()),
            }
        })
    }
}

impl<T> FromRequest for SafeExtractor<T>
where
    T: ExtractFallback + 'static,
{
    type Error = actix_web::Error;
    type Future = LocalBoxFuture<'static, Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, payload: &mut Payload) -> Self::Future {
        let mut payload = payload.take(); // take ownership of payload
        let req = req.clone();

        Box::pin(async move {
            match *req.method() {
                actix_web::http::Method::GET | actix_web::http::Method::DELETE => {
                    match actix_web::web::Query::<T>::from_query(req.query_string()) {
                        Ok(q) => Ok(SafeExtractor(q.into_inner())),
                        Err(_) => Ok(SafeExtractor(T::default())),
                    }
                }
                _ => match actix_web::web::Form::<T>::from_request(&req, &mut payload).await {
                    Ok(f) => Ok(SafeExtractor(f.into_inner())),
                    Err(_) => Ok(SafeExtractor(T::default())),
                },
            }
        })
    }
}

impl<T> SafeExtractor<T>
where
    T: ExtractFallback + 'static,
{
    pub fn extract<'a>(req: &'a HttpRequest, payload: &'a mut Payload) -> AsyncPin<'a, Self> {
        Box::pin(async move {
            match *req.method() {
                actix_web::http::Method::GET | actix_web::http::Method::DELETE => {
                    match web::Query::<T>::from_query(req.query_string()) {
                        Ok(query) => SafeExtractor(query.into_inner()),
                        Err(_) => SafeExtractor(T::default()),
                    }
                }
                _ => match web::Form::<T>::from_request(req, payload).await {
                    Ok(form) => SafeExtractor(form.into_inner()),
                    Err(_) => SafeExtractor(T::default()),
                },
            }
        })
    }
}

pub trait OAuthValidate {
    fn validate(&self) -> Result<(), ControllerError>;
}
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Default)]
pub struct AuthorizeQuery {
    pub response_type: Option<String>,
    pub client_id: Option<String>,
    pub redirect_uri: Option<String>,
    pub scope: Option<String>,
    pub state: Option<String>,
    pub nonce: Option<String>,

    // OAuth2.0 spec requires that auth does not fail when there are unknown parameters present,
    // see RFC 6749 3.1
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

// We need to make sure we don't return errors directly, instead we need to return
// error as success request with error parameters to comply with OAuth.
impl OAuthValidate for AuthorizeQuery {
    fn validate(&self) -> Result<(), ControllerError> {
        let rt = self.response_type.as_deref().unwrap_or_default();
        let client_id = self.client_id.as_deref().unwrap_or_default();
        let redirect_uri = self.redirect_uri.as_deref().unwrap_or_default();
        let scope = self.scope.as_deref().unwrap_or_default();
        let state = self.state.as_deref().unwrap_or_default();

        if client_id.is_empty() || redirect_uri.is_empty() || scope.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidRequest.as_str().into(),
                    error_description: "client_id, redirect_uri, and scope are required".into(),
                    redirect_uri: None,
                    state: Some(state.to_string()),
                })),
                "Missing required OAuth parameters",
                None::<anyhow::Error>,
            ));
        }
        info!("rt={}", rt);
        if rt != "code" {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::UnsupportedResponseType.as_str().into(),
                    error_description: "unsupported response_type".into(),
                    redirect_uri: None, // include later only after client+URI validation
                    state: Some(state.to_string()),
                })),
                "Unsupported response_type",
                None::<anyhow::Error>,
            ));
        }

        Ok(())
    }
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
                    })),
                    "Missing grant type",
                    None::<anyhow::Error>,
                ));
            }
        }

        Ok(())
    }
}

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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(tag = "grant_type")]
pub enum GrantType {
    #[serde(rename = "authorization_code")]
    AuthorizationCode { code: String, redirect_uri: String },
    #[serde(rename = "refresh_token")]
    RefreshToken { refresh_token: String },
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct TokenResponse {
    pub access_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub expires_in: u32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Claims {
    pub sub: String,
    pub aud: String,
    pub iss: String,
    pub iat: usize,
    pub exp: usize,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ConsentQuery {
    pub client_id: String,
    pub redirect_uri: String,
    pub response_type: String,
    pub scopes: String,
    pub state: String,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ConsentDenyQuery {
    pub redirect_uri: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct UserInfoResponse {
    pub sub: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}

#[derive(serde::Serialize)]
pub struct Jwk {
    pub kty: String,
    #[serde(rename = "use")]
    pub use_: String,
    pub alg: String,
    pub kid: String,
    pub n: String,
    pub e: String,
}

#[derive(serde::Serialize)]
pub struct Jwks {
    pub keys: Vec<Jwk>,
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

    // ---------------- AuthorizeQuery ----------------

    #[test]
    fn authorize_missing_fields() {
        let q = AuthorizeQuery {
            response_type: Some("code".into()),
            client_id: None,
            redirect_uri: None,
            scope: None,
            state: Some("xyz".into()),
            nonce: None,
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

    // ---------------- TokenQuery ----------------

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

// ---------- Token hashing / pepper helpers ----------

pub type HmacSha256 = Hmac<Sha256>;
