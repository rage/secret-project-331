use actix_http::HttpMessage;
use actix_web::FromRequest;

use crate::prelude::*;
use std::{
    convert::Infallible,
    future::{ready, Ready},
};

/// Extractor for a request's id.
/// The id is generated on extraction if it does not exist.
#[derive(Debug, Clone, Copy, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct RequestId(pub Uuid);

impl FromRequest for RequestId {
    type Error = Infallible;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(
        req: &actix_web::HttpRequest,
        _payload: &mut actix_http::Payload,
    ) -> Self::Future {
        let id = req.extensions().get::<Self>().copied().unwrap_or_else(|| {
            let new_id = RequestId(Uuid::new_v4());
            req.extensions_mut().insert(new_id);
            new_id
        });
        ready(Ok(id))
    }
}
