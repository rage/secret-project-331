use actix_web::{
    Error, FromRequest, HttpRequest,
    dev::Payload,
    http::{Method, header},
    web,
};
use futures_util::future::LocalBoxFuture;
use serde::de::DeserializeOwned;

use super::oauth_validate::OAuthValidate;

/// Wrapper for OAuth related requests.
pub struct OAuthValidated<Raw: OAuthValidate>(pub <Raw as OAuthValidate>::Output);

impl<Raw> FromRequest for OAuthValidated<Raw>
where
    Raw: DeserializeOwned + OAuthValidate + 'static,
{
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, payload: &mut Payload) -> Self::Future {
        let req = req.clone();
        let mut payload = payload.take();

        Box::pin(async move {
            let raw: Raw = match *req.method() {
                Method::GET | Method::DELETE => {
                    web::Query::<Raw>::from_query(req.query_string()).map(|q| q.into_inner())?
                }
                _ => {
                    let ct = req
                        .headers()
                        .get(header::CONTENT_TYPE)
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("");

                    if ct.starts_with("application/json") {
                        web::Json::<Raw>::from_request(&req, &mut payload)
                            .await
                            .map(|j| j.into_inner())?
                    } else {
                        web::Form::<Raw>::from_request(&req, &mut payload)
                            .await
                            .map(|f| f.into_inner())?
                    }
                }
            };

            let out = <Raw as OAuthValidate>::validate(&raw)?;

            Ok(OAuthValidated(out))
        })
    }
}
