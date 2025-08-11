use crate::prelude::*;
use actix_web::{Error, FromRequest, HttpRequest, dev::Payload, web};
use domain::error::{OAuthErrorCode, OAuthErrorData};
use futures_util::future::LocalBoxFuture;
use futures_util::future::{Ready, ready};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
pub trait ExtractFallback: Default + for<'de> Deserialize<'de> {}
impl<T> ExtractFallback for T where T: Default + for<'de> Deserialize<'de> {}

type AsyncPin<'a, O> = Pin<Box<dyn Future<Output = O> + 'a>>;

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
        let client_id = self.client_id.as_deref().unwrap_or_default();
        let redirect_uri = self.redirect_uri.as_deref().unwrap_or_default();
        let scope = self.scope.as_deref().unwrap_or_default();
        let state = self.state.as_deref().unwrap_or_default();
        let nonce = self.nonce.as_deref().unwrap_or_default();

        if client_id.is_empty() || redirect_uri.is_empty() || scope.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(OAuthErrorData {
                    error: OAuthErrorCode::InvalidRequest.as_str().into(),
                    error_description: "client_id, redirect_uri, and scope are required".into(),
                    redirect_uri: None,             // ← do not include here
                    state: Some(state.to_string()), // echo state is fine
                }),
                "Missing required OAuth parameters",
                None::<anyhow::Error>,
            ));
        }

        if scope.split_whitespace().any(|s| s == "openid") && nonce.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(OAuthErrorData {
                    error: OAuthErrorCode::InvalidRequest.as_str().into(),
                    error_description: "nonce is required for OpenID Connect".into(),
                    redirect_uri: None, // ← do not include here
                    state: Some(state.to_string()),
                }),
                "Missing nonce for OpenID Connect",
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
                ControllerErrorType::OAuthError(OAuthErrorData {
                    error: OAuthErrorCode::InvalidClient.as_str().into(),
                    error_description: "client_id and client_secret are required".into(),
                    redirect_uri: None,
                    state: None,
                }),
                "Missing client credentials",
                None::<anyhow::Error>,
            ));
        }

        match &self.grant {
            Some(GrantType::AuthorizationCode { code, redirect_uri }) => {
                if code.is_empty() || redirect_uri.is_empty() {
                    return Err(ControllerError::new(
                        ControllerErrorType::OAuthError(OAuthErrorData {
                            error: OAuthErrorCode::InvalidRequest.as_str().into(),
                            error_description:
                                "code and redirect_uri are required for authorization_code grant"
                                    .into(),
                            redirect_uri: None,
                            state: None,
                        }),
                        "Missing authorization code parameters",
                        None::<anyhow::Error>,
                    ));
                }
            }
            Some(GrantType::RefreshToken { refresh_token }) => {
                if refresh_token.is_empty() {
                    return Err(ControllerError::new(
                        ControllerErrorType::OAuthError(OAuthErrorData {
                            error: OAuthErrorCode::InvalidRequest.as_str().into(),
                            error_description: "refresh_token is required".into(),
                            redirect_uri: None,
                            state: None,
                        }),
                        "Missing refresh token",
                        None::<anyhow::Error>,
                    ));
                }
            }
            None => {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(OAuthErrorData {
                        error: OAuthErrorCode::UnsupportedGrantType.as_str().into(),
                        error_description: "grant_type is required".into(),
                        redirect_uri: None,
                        state: None,
                    }),
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
pub struct UserInfoResponse {
    pub sub: String,
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
    pub scopes: String,
    pub state: String,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ConsentDenyQuery {
    pub redirect_uri: String,
    pub state: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::error::{ControllerError, ControllerErrorType};

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
                _ => panic!("Expected OAuthError with {}", expected_description),
            },
            _ => panic!("Expected Err with OAuthError"),
        }
    }

    // --------- AuthorizeQuery Tests ----------

    #[test]
    fn test_authorize_missing_fields() {
        let query = AuthorizeQuery {
            client_id: None,
            redirect_uri: None,
            scope: None,
            state: Some("xyz".into()),
            nonce: None,
            _extra: Default::default(),
        };
        let result = query.validate();
        assert_oauth_error(
            result,
            OAuthErrorCode::InvalidRequest,
            "client_id, redirect_uri, and scope are required",
        );
    }

    #[test]
    fn test_authorize_oidc_missing_nonce() {
        let query = AuthorizeQuery {
            client_id: Some("abc".into()),
            redirect_uri: Some("http://example.com".into()),
            scope: Some("openid profile".into()),
            state: Some("xyz".into()),
            nonce: None,
            _extra: Default::default(),
        };
        let result = query.validate();
        assert_oauth_error(
            result,
            OAuthErrorCode::InvalidRequest,
            "nonce is required for OpenID Connect",
        );
    }

    #[test]
    fn test_authorize_valid() {
        let query = AuthorizeQuery {
            client_id: Some("abc".into()),
            redirect_uri: Some("http://example.com".into()),
            scope: Some("openid profile".into()),
            state: Some("xyz".into()),
            nonce: Some("random".into()),
            _extra: Default::default(),
        };
        assert!(query.validate().is_ok());
    }

    // --------- TokenQuery Tests ----------

    #[test]
    fn test_token_missing_client_credentials() {
        let query = TokenQuery {
            client_id: None,
            client_secret: None,
            grant: None,
            _extra: Default::default(),
        };
        let result = query.validate();
        assert_oauth_error(
            result,
            OAuthErrorCode::InvalidClient,
            "client_id and client_secret are required",
        );
    }

    #[test]
    fn test_token_missing_grant_type() {
        let query = TokenQuery {
            client_id: Some("abc".into()),
            client_secret: Some("secret".into()),
            grant: None,
            _extra: Default::default(),
        };
        let result = query.validate();
        assert_oauth_error(
            result,
            OAuthErrorCode::UnsupportedGrantType,
            "grant_type is required",
        );
    }

    #[test]
    fn test_token_auth_code_missing_fields() {
        let query = TokenQuery {
            client_id: Some("abc".into()),
            client_secret: Some("secret".into()),
            grant: Some(GrantType::AuthorizationCode {
                code: "".into(),
                redirect_uri: "".into(),
            }),
            _extra: Default::default(),
        };
        let result = query.validate();
        assert_oauth_error(
            result,
            OAuthErrorCode::InvalidRequest,
            "code and redirect_uri are required for authorization_code grant",
        );
    }

    #[test]
    fn test_token_refresh_token_missing_field() {
        let query = TokenQuery {
            client_id: Some("abc".into()),
            client_secret: Some("secret".into()),
            grant: Some(GrantType::RefreshToken {
                refresh_token: "".into(),
            }),
            _extra: Default::default(),
        };
        let result = query.validate();
        assert_oauth_error(
            result,
            OAuthErrorCode::InvalidRequest,
            "refresh_token is required",
        );
    }

    #[test]
    fn test_token_valid_auth_code() {
        let query = TokenQuery {
            client_id: Some("abc".into()),
            client_secret: Some("secret".into()),
            grant: Some(GrantType::AuthorizationCode {
                code: "code".into(),
                redirect_uri: "http://example.com".into(),
            }),
            _extra: Default::default(),
        };
        assert!(query.validate().is_ok());
    }

    #[test]
    fn test_token_valid_refresh_token() {
        let query = TokenQuery {
            client_id: Some("abc".into()),
            client_secret: Some("secret".into()),
            grant: Some(GrantType::RefreshToken {
                refresh_token: "token".into(),
            }),
            _extra: Default::default(),
        };
        assert!(query.validate().is_ok());
    }
}
