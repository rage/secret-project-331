use actix_web::{Error, FromRequest, HttpRequest, dev::Payload, http::Method, web};
use futures_util::future::LocalBoxFuture;
use serde::de::DeserializeOwned;

use crate::controllers::main_frontend::oauth::oauth_validate::{ControllerError, OAuthValidate};

/// Wrapper that implements FromRequest for Oauth-related structs and validates them.
pub struct OAuthValidated<T>(pub T);

impl<T, Raw> FromRequest for OAuthValidated<T>
where
    Raw: DeserializeOwned + Default + OAuthValidate<Output = T> + 'static,
    T: 'static,
{
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, payload: &mut Payload) -> Self::Future {
        let req = req.clone();
        let mut payload = payload.take();

        Box::pin(async move {
            let raw: Raw = match *req.method() {
                Method::GET | Method::DELETE => {
                    match web::Query::<Raw>::from_query(req.query_string()) {
                        Ok(q) => q.into_inner(),
                        Err(_) => Raw::default(),
                    }
                }
                _ => match web::Form::<Raw>::from_request(&req, &mut payload).await {
                    Ok(f) => f.into_inner(),
                    Err(_) => Raw::default(),
                },
            };

            let out: T = <Raw as OAuthValidate>::validate(&raw)
                .map_err(|e: ControllerError| actix_web::error::ErrorBadRequest(e))?;

            Ok(OAuthValidated(out))
        })
    }
}
