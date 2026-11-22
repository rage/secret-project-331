//! Handlers for removed routes, logging the calls that still arrive before the routes are cleaned up.

use crate::config::server_runtime_config;
use crate::domain::request_span_middleware::client_ip;
use crate::prelude::*;
use actix_web::web::Payload;
use futures_util::StreamExt;
use headless_lms_base::hmac_sha256::hmac_sha256;
use secrecy::ExposeSecret;
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;
use std::fmt::Write;

const MAX_LOGGED_BODY_BYTES: usize = 64 * 1024;

/// Logs a request to a removed route and answers 404 with an empty body, like an unknown route.
pub async fn log_removed_route_request(request: HttpRequest, mut payload: Payload) -> HttpResponse {
    let mut body = Vec::new();
    while let Some(Ok(chunk)) = payload.next().await {
        let room = MAX_LOGGED_BODY_BYTES - body.len();
        body.extend_from_slice(&chunk[..chunk.len().min(room)]);
        if body.len() >= MAX_LOGGED_BODY_BYTES {
            break;
        }
    }

    let headers: BTreeMap<String, String> = request
        .headers()
        .iter()
        .map(|(name, value)| {
            let value = if matches!(name.as_str(), "cookie" | "authorization") {
                format!("<{} bytes>", value.len())
            } else {
                String::from_utf8_lossy(value.as_bytes()).into_owned()
            };
            (name.to_string(), value)
        })
        .collect();

    warn!(
        method = %request.method(),
        path = request.path(),
        query = request.query_string(),
        ip = ?client_ip(&request.connection_info()),
        headers = ?headers,
        body = %redact_body(&body),
        "Request to removed route",
    );
    HttpResponse::NotFound().finish()
}

fn redact_body(body: &[u8]) -> String {
    match serde_json::from_slice::<Value>(body) {
        Ok(mut value) => {
            redact_password_values(&mut value);
            value.to_string()
        }
        Err(_) => String::from_utf8_lossy(body).into_owned(),
    }
}

/// Secret values are not logged.
fn redact_password_values(value: &mut Value) {
    match value {
        Value::Object(map) => redact_object(map),
        Value::Array(items) => items.iter_mut().for_each(redact_password_values),
        _ => {}
    }
}

fn redact_object(map: &mut Map<String, Value>) {
    for (key, value) in map.iter_mut() {
        if key.to_lowercase().contains("password") {
            *value = password_summary(value);
        } else {
            redact_password_values(value);
        }
    }
}

fn password_summary(value: &Value) -> Value {
    let text = match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    };
    let key = server_runtime_config().form_context_secret.expose_secret();
    let digest = hmac_sha256(key.as_bytes(), text.as_bytes());
    let hmac = digest.iter().fold(String::new(), |mut hex, byte| {
        let _ = write!(hex, "{byte:02x}");
        hex
    });
    json!({ "len": text.chars().count(), "hmac": hmac })
}
