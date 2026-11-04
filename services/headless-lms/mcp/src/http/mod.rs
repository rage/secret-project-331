//! The actix adapter for `/api/v0/mcp`: maps HTTP requests to [`McpServer::handle`] and its
//! responses back, streaming progress as server-sent events when the client accepts them.

pub mod auth;

use actix_web::{
    HttpRequest, HttpResponse,
    http::{StatusCode, header},
    web::{self, Bytes, ServiceConfig},
};
use futures::stream::{self, StreamExt};
use headless_lms_models::library::oauth::mcp::McpPrincipal;
use rmcp::model::RequestStateCodec;
use secrecy::ExposeSecret;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};

use crate::protocol::dispatch::{self, McpServer, ServerConfig};
use crate::protocol::headers::RequestHeaders;
use crate::state::McpState;

/// Room for `upload_file`'s largest file (25 MB) base64-encoded.
const MAX_REQUEST_BYTES: usize = 36 * 1024 * 1024;

/// The MCP server with the state its tools run against, shared by every worker.
pub struct McpEndpoint {
    pub server: McpServer<McpState>,
    pub state: McpState,
}

impl McpEndpoint {
    /// The endpoint with every catalog tool.
    pub fn new(state: McpState) -> Self {
        let app_conf = &state.app_conf;
        let server_config = ServerConfig {
            server_version: env!("CARGO_PKG_VERSION").to_string(),
            resource_metadata_url: auth::protected_resource_metadata_url(app_conf),
            request_state_codec: RequestStateCodec::try_new(
                request_state_key(app_conf.jwt_password.expose_secret()).to_vec(),
            )
            .expect("a 32-byte key is long enough"),
        };
        Self {
            server: McpServer::new(crate::handlers::registry(), server_config),
            state,
        }
    }
}

/// A key for sealing `requestState`, derived from the JWT secret so that it can't be used to forge
/// the secret's other signatures.
fn request_state_key(secret: &str) -> [u8; 32] {
    blake3::derive_key("headless-lms mcp request state v1", secret.as_bytes())
}

/// Adds the endpoint's route to a scope that is wrapped in [`auth::authenticate`] and has an
/// [`McpEndpoint`] in its app data.
pub fn configure(cfg: &mut ServiceConfig) {
    cfg.app_data(web::PayloadConfig::new(MAX_REQUEST_BYTES))
        .route("", web::route().to(handle))
        .route("/", web::route().to(handle));
}

fn into_actix(response: dispatch::HttpResponse) -> HttpResponse {
    let mut builder = HttpResponse::build(
        StatusCode::from_u16(response.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
    );
    for (name, value) in &response.headers {
        builder.insert_header((name.as_str(), value.as_str()));
    }
    match response.body {
        Some(body) => builder.body(body.to_string()),
        None => builder.finish(),
    }
}

fn accepts_event_stream(req: &HttpRequest) -> bool {
    req.headers()
        .get_all(header::ACCEPT)
        .filter_map(|v| v.to_str().ok())
        .any(|v| v.contains("text/event-stream"))
}

fn has_progress_token(message: &serde_json::Result<Value>) -> bool {
    message
        .as_ref()
        .ok()
        .and_then(|message| message.pointer("/params/_meta/progressToken"))
        .is_some_and(|token| token.is_string() || token.is_number())
}

fn sse_event(message: &Value) -> Bytes {
    Bytes::from(format!("event: message\ndata: {message}\n\n"))
}

/// The plain JSON answer of a call that finished before streaming started.
fn finished(response: Result<dispatch::HttpResponse, oneshot::error::RecvError>) -> HttpResponse {
    match response {
        Ok(response) => into_actix(response),
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}

async fn handle(
    req: HttpRequest,
    body: Bytes,
    endpoint: web::Data<McpEndpoint>,
    principal: web::ReqData<McpPrincipal>,
) -> HttpResponse {
    let principal = principal.into_inner();
    let headers = RequestHeaders::new(
        req.headers()
            .iter()
            .filter_map(|(name, value)| Some((name.as_str(), value.to_str().ok()?.to_string()))),
    );
    let request = dispatch::HttpRequest {
        method: req.method().to_string(),
        headers,
        body: serde_json::from_slice::<Value>(&body),
    };
    if !(accepts_event_stream(&req) && has_progress_token(&request.body)) {
        let response = endpoint
            .server
            .handle(&endpoint.state, &principal, request, None)
            .await;
        return into_actix(response);
    }

    let (progress_sender, mut progress) = mpsc::unbounded_channel();
    let (done_sender, mut done) = oneshot::channel();
    let task_endpoint = endpoint.clone();
    actix_web::rt::spawn(async move {
        let response = task_endpoint
            .server
            .handle(
                &task_endpoint.state,
                &principal,
                request,
                Some(progress_sender),
            )
            .await;
        let _ = done_sender.send(response);
    });
    // Plain JSON unless progress comes first, so errors keep their HTTP status.
    let first = tokio::select! {
        biased;
        response = &mut done => return finished(response),
        first = progress.recv() => first,
    };
    let Some(first) = first else {
        return finished(done.await);
    };
    let notifications = stream::once(async move { first })
        .chain(stream::unfold(progress, |mut progress| async move {
            progress.recv().await.map(|n| (n, progress))
        }))
        .map(|n| sse_event(&n));
    let last = stream::once(async move {
        match done.await {
            Ok(response) => sse_event(&response.body.unwrap_or(Value::Null)),
            Err(_) => Bytes::new(),
        }
    });
    HttpResponse::Ok()
        .insert_header((header::CONTENT_TYPE, "text/event-stream"))
        .insert_header((header::CACHE_CONTROL, "no-cache"))
        .streaming(notifications.chain(last).map(Ok::<_, actix_web::Error>))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_token_detection() {
        let parse = |body: &[u8]| serde_json::from_slice::<Value>(body);
        assert!(has_progress_token(&parse(
            br#"{"params":{"_meta":{"progressToken":"t1"}}}"#
        )));
        assert!(has_progress_token(&parse(
            br#"{"params":{"_meta":{"progressToken":3}}}"#
        )));
        assert!(!has_progress_token(&parse(br#"{"params":{"_meta":{}}}"#)));
        assert!(!has_progress_token(&parse(b"not json")));
    }

    #[test]
    fn request_state_key_depends_on_the_secret() {
        assert_ne!(request_state_key("a"), request_state_key("b"));
        assert_eq!(request_state_key("a"), request_state_key("a"));
    }
}
