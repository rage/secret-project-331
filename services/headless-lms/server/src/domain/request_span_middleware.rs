/*!
Middleware that wraps HTTP requests to tokio tracing spans for debugging and attaches a request id to all log messages.
*/

use super::request_id::RequestId;
use actix_http::{
    header::{HeaderName, HeaderValue},
    HttpMessage,
};
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures_util::future::LocalBoxFuture;
use std::future::{ready, Ready};
use tracing::Instrument;
use uuid::Uuid;

pub struct RequestSpan;

impl<S, B> Transform<S, ServiceRequest> for RequestSpan
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = RequestSpanMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequestSpanMiddleware { service }))
    }
}

/// Wraps HTTP requests into tokio tracing spans, helps with debugging.
pub struct RequestSpanMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for RequestSpanMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let request_id = Uuid::new_v4();
        let request_id_string = request_id.to_string();
        let request_span = tracing::info_span!("http_request", request_id = &request_id_string,);
        request_span.in_scope(|| {
            // Logging request start along with relevant information so that we can associate later log messages with the request context though the request id.
            info!(
                method =?req.method(),
                path=?req.path(),
                ip=?req.connection_info().realip_remote_addr(),
                "Start handling request.",
            );
        });

        // insert the generated id as an extension so that handlers can extract it if needed
        req.extensions_mut().insert(RequestId(request_id));

        let fut = self.service.call(req).instrument(request_span);

        Box::pin(async move {
            let mut res = fut.await?;
            let headers = res.headers_mut();
            headers.insert(
                HeaderName::from_static("request-id"),
                HeaderValue::from_str(&request_id_string)?,
            );
            Ok(res)
        })
    }
}
