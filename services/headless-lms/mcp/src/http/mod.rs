//! The actix adapter for `/api/v0/mcp`: maps HTTP requests to [`McpServer::handle`] and its
//! responses back, streaming progress as server-sent events when the client accepts them.

pub mod auth;

use actix_web::{
    HttpMessage, HttpRequest, HttpResponse,
    http::{StatusCode, header},
    web::{self, Bytes, ServiceConfig},
};
use futures::stream::{self, StreamExt};
use headless_lms_models::library::oauth::mcp::McpPrincipal;
use rmcp::model::RequestStateCodec;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::sync::{mpsc, oneshot};

use crate::protocol::dispatch::{self, McpServer, ServerConfig};
use crate::protocol::headers::RequestHeaders;
use crate::state::McpState;
use crate::tools::{Principal, Scope};

/// Room for `upload_file`'s largest file (25 MB) base64-encoded.
const MAX_REQUEST_BYTES: usize = 36 * 1024 * 1024;

/// The MCP server with the state its tools run against, shared by every worker.
pub struct McpEndpoint {
    pub server: McpServer<McpState>,
    pub state: McpState,
}

/// Deployment settings of the endpoint.
pub struct EndpointConfig {
    pub server_version: String,
    /// The RFC 9728 metadata URL advertised in `WWW-Authenticate`.
    pub resource_metadata_url: String,
    /// An existing server secret; the `requestState` sealing key is derived from it.
    pub request_state_secret: String,
    pub current_skill_version: String,
    pub minimum_skill_version: String,
}

impl McpEndpoint {
    /// The endpoint with every catalog tool registered.
    pub fn new(state: McpState, config: EndpointConfig) -> Self {
        let mut server_config = ServerConfig::new(config.server_version);
        server_config.resource_metadata_url = Some(config.resource_metadata_url);
        server_config.request_state_codec =
            RequestStateCodec::try_new(request_state_key(&config.request_state_secret).to_vec())
                .ok();
        server_config.current_skill_version = config.current_skill_version;
        server_config.minimum_skill_version = config.minimum_skill_version;
        let registry = crate::handlers::registry(state.validator.clone());
        Self {
            server: McpServer::new(registry, server_config),
            state,
        }
    }
}

/// A key for sealing `requestState` that can't be used to forge the secret's other signatures.
fn request_state_key(secret: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"mcp-request-state\0");
    hasher.update(secret.as_bytes());
    hasher.finalize().into()
}

/// Adds the endpoint's route to a scope that is wrapped in [`auth::McpAuth`] and has an
/// [`McpEndpoint`] in its app data.
pub fn configure(cfg: &mut ServiceConfig) {
    cfg.app_data(web::PayloadConfig::new(MAX_REQUEST_BYTES))
        .route("", web::route().to(handle))
        .route("/", web::route().to(handle));
}

fn principal(mcp: &McpPrincipal) -> Principal {
    Principal {
        user_id: mcp.user_id,
        scopes: mcp
            .scopes
            .iter()
            .filter_map(|s| Scope::parse(s.as_str()))
            .collect(),
        oauth_client_id: Some(mcp.oauth_client_id),
        grant_id: Some(mcp.grant_id),
        client_name: Some(mcp.client_name.clone()),
    }
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

fn has_progress_token(body: &[u8]) -> bool {
    serde_json::from_slice::<Value>(body)
        .ok()
        .and_then(|message| message.pointer("/params/_meta/progressToken").cloned())
        .is_some_and(|token| token.is_string() || token.is_number())
}

fn sse_event(message: &Value) -> Bytes {
    Bytes::from(format!("event: message\ndata: {message}\n\n"))
}

async fn handle(req: HttpRequest, body: Bytes, endpoint: web::Data<McpEndpoint>) -> HttpResponse {
    let principal = req.extensions().get::<McpPrincipal>().map(principal);
    let headers = RequestHeaders::new(
        req.headers()
            .iter()
            .filter_map(|(name, value)| Some((name.as_str(), value.to_str().ok()?.to_string()))),
    );
    let method = req.method().to_string();
    if !(accepts_event_stream(&req) && has_progress_token(&body)) {
        let response = endpoint
            .server
            .handle(
                &endpoint.state,
                principal.as_ref(),
                dispatch::HttpRequest {
                    method: &method,
                    headers,
                    body: &body,
                },
                None,
            )
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
                principal.as_ref(),
                dispatch::HttpRequest {
                    method: &method,
                    headers,
                    body: &body,
                },
                Some(progress_sender),
            )
            .await;
        let _ = done_sender.send(response);
    });
    // Plain JSON unless progress comes first, so errors keep their HTTP status.
    let first = tokio::select! {
        biased;
        response = &mut done => {
            return match response {
                Ok(response) => into_actix(response),
                Err(_) => HttpResponse::InternalServerError().finish(),
            };
        }
        first = progress.recv() => first,
    };
    let Some(first) = first else {
        return match done.await {
            Ok(response) => into_actix(response),
            Err(_) => HttpResponse::InternalServerError().finish(),
        };
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
        assert!(has_progress_token(
            br#"{"params":{"_meta":{"progressToken":"t1"}}}"#
        ));
        assert!(has_progress_token(
            br#"{"params":{"_meta":{"progressToken":3}}}"#
        ));
        assert!(!has_progress_token(br#"{"params":{"_meta":{}}}"#));
        assert!(!has_progress_token(b"not json"));
    }

    #[test]
    fn request_state_key_depends_on_the_secret() {
        assert_ne!(request_state_key("a"), request_state_key("b"));
        assert_eq!(request_state_key("a"), request_state_key("a"));
    }
}
