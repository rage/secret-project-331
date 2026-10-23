//! JSON-RPC dispatch for one HTTP request: version negotiation, header checks, `server/discover`,
//! `tools/list` and `tools/call`, including confirmation round trips through `requestState`.

use std::time::Duration;

use rmcp::model::{ErrorCode, RequestStateCodec, SealOptions};
use serde_json::{Map, Value, json};
use tokio::sync::mpsc::UnboundedSender;

use super::context::CapabilityContext;
use super::error_codes;
use super::headers::{self, PROTOCOL_VERSION_HEADER, RequestHeaders};
use super::progress::ProgressReporter;
use super::{PROTOCOL_VERSION, SETUP_DOCS_URL};
use crate::hints;
use crate::tools::{
    CONFIRMATION_KEY, ConfirmationRequest, Principal, RequestContext, RetryState, ToolError,
    ToolOutcome, ToolRegistry, ToolResult,
};

const SERVER_INFO_META_KEY: &str = "io.modelcontextprotocol/serverInfo";
const CONFIRMATION_TTL: Duration = Duration::from_secs(15 * 60);

pub struct ServerConfig {
    pub server_name: String,
    pub server_title: String,
    pub server_version: String,
    pub instructions: String,
    pub setup_docs_url: String,
    /// The RFC 9728 metadata URL advertised in `WWW-Authenticate`.
    pub resource_metadata_url: Option<String>,
    /// Seals `requestState`. Without it, confirmations always use the text fallback.
    pub request_state_codec: Option<RequestStateCodec>,
    /// Short, so scope and role changes show up promptly.
    pub tools_list_ttl_ms: u64,
    pub discover_ttl_ms: u64,
    /// The skill release this server is built for; older ones get a hint.
    pub current_skill_version: String,
    /// Calls from skills older than this are rejected.
    pub minimum_skill_version: String,
}

impl ServerConfig {
    pub fn new(server_version: impl Into<String>) -> Self {
        Self {
            server_name: "courses-mooc-fi".into(),
            server_title: "courses.mooc.fi course material".into(),
            server_version: server_version.into(),
            instructions: crate::instructions::SERVER_INSTRUCTIONS.into(),
            setup_docs_url: SETUP_DOCS_URL.into(),
            resource_metadata_url: None,
            request_state_codec: None,
            tools_list_ttl_ms: 60_000,
            discover_ttl_ms: 300_000,
            current_skill_version: hints::CURRENT_SKILL_VERSION.into(),
            minimum_skill_version: hints::MINIMUM_SKILL_VERSION.into(),
        }
    }
}

/// One HTTP request to the MCP endpoint, framework-independent.
pub struct HttpRequest<'a> {
    pub method: &'a str,
    pub headers: RequestHeaders,
    pub body: &'a [u8],
}

#[derive(Debug, Clone, PartialEq)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    /// None for 202/405 responses without a body.
    pub body: Option<Value>,
}

impl HttpResponse {
    fn json(status: u16, body: Value) -> Self {
        Self {
            status,
            headers: vec![("Content-Type".into(), "application/json".into())],
            body: Some(body),
        }
    }

    fn empty(status: u16) -> Self {
        Self {
            status,
            headers: Vec::new(),
            body: None,
        }
    }
}

struct RpcError {
    status: u16,
    code: ErrorCode,
    message: String,
    data: Option<Value>,
    headers: Vec<(String, String)>,
}

impl RpcError {
    fn new(status: u16, code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
            data: None,
            headers: Vec::new(),
        }
    }

    fn with_data(mut self, data: Value) -> Self {
        self.data = Some(data);
        self
    }

    fn into_response(self, id: Option<&Value>) -> HttpResponse {
        let mut error = json!({"code": self.code.0, "message": self.message});
        if let Some(data) = self.data {
            error["data"] = data;
        }
        let mut body = json!({"jsonrpc": "2.0", "error": error});
        if let Some(id) = id {
            body["id"] = id.clone();
        }
        let mut response = HttpResponse::json(self.status, body);
        response.headers.extend(self.headers);
        response
    }
}

pub struct McpServer<S> {
    registry: ToolRegistry<S>,
    config: ServerConfig,
}

impl<S: Send + Sync + 'static> McpServer<S> {
    pub fn new(registry: ToolRegistry<S>, config: ServerConfig) -> Self {
        Self { registry, config }
    }

    pub fn config(&self) -> &ServerConfig {
        &self.config
    }

    /// Handles one request. `principal` is None when no valid bearer token came with it.
    /// `progress_sink`, when given, receives progress notifications the transport may stream
    /// before the response.
    pub async fn handle(
        &self,
        state: &S,
        principal: Option<&Principal>,
        request: HttpRequest<'_>,
        progress_sink: Option<UnboundedSender<Value>>,
    ) -> HttpResponse {
        if request.method != "POST" {
            let mut response = HttpResponse::empty(405);
            response.headers.push(("Allow".into(), "POST".into()));
            return response;
        }
        let message: Value = match serde_json::from_slice(request.body) {
            Ok(message) => message,
            Err(e) => {
                return RpcError::new(400, error_codes::PARSE_ERROR, format!("Parse error: {e}"))
                    .into_response(None);
            }
        };
        let Some(object) = message.as_object() else {
            return RpcError::new(
                400,
                error_codes::INVALID_REQUEST,
                "Invalid Request: send one JSON-RPC object per request; batches aren't supported",
            )
            .into_response(None);
        };
        let id = object
            .get("id")
            .filter(|id| id.is_string() || id.is_number());
        let Some(method) = object.get("method").and_then(Value::as_str) else {
            return HttpResponse::empty(202);
        };
        let Some(id) = id else {
            return HttpResponse::empty(202);
        };
        match self
            .dispatch(
                state,
                principal,
                &request.headers,
                method,
                object.get("params"),
                progress_sink,
            )
            .await
        {
            Ok(result) => {
                HttpResponse::json(200, json!({"jsonrpc": "2.0", "id": id, "result": result}))
            }
            Err(error) => error.into_response(Some(id)),
        }
    }

    async fn dispatch(
        &self,
        state: &S,
        principal: Option<&Principal>,
        headers: &RequestHeaders,
        method: &str,
        params: Option<&Value>,
        progress_sink: Option<UnboundedSender<Value>>,
    ) -> Result<Value, RpcError> {
        if method == "initialize" {
            let requested = params
                .and_then(|p| p.get("protocolVersion"))
                .cloned()
                .unwrap_or(Value::Null);
            return Err(self.unsupported_version(requested));
        }
        let meta = params
            .and_then(|p| p.get("_meta"))
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        let capabilities = CapabilityContext::from_meta(&meta);
        if method != "server/discover" {
            self.check_version(&capabilities, headers)?;
            let header_params = if method == "tools/call" {
                params
                    .and_then(|p| p.get("name"))
                    .and_then(Value::as_str)
                    .and_then(|name| self.registry.definition(name))
                    .map(|d| d.header_params())
                    .unwrap_or_default()
            } else {
                Vec::new()
            };
            headers::validate(headers, method, params, &header_params)
                .map_err(|reason| RpcError::new(400, error_codes::HEADER_MISMATCH, reason))?;
        }
        match method {
            "server/discover" => Ok(self.discover()),
            "tools/list" => {
                let principal = self.require_principal(principal)?;
                Ok(self.list_tools(principal))
            }
            "tools/call" => {
                let principal = self.require_principal(principal)?;
                let params = params
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                let progress =
                    ProgressReporter::new(capabilities.progress_token.clone(), progress_sink);
                self.call_tool(state, principal, capabilities, params, progress)
                    .await
            }
            other => Err(RpcError::new(
                404,
                error_codes::METHOD_NOT_FOUND,
                format!("Method not found: {other}"),
            )),
        }
    }

    fn unsupported_version(&self, requested: Value) -> RpcError {
        RpcError::new(
            400,
            error_codes::UNSUPPORTED_PROTOCOL_VERSION,
            format!(
                "This server supports MCP protocol revision {PROTOCOL_VERSION} only. Update the agent, or enable its {PROTOCOL_VERSION} support (Codex needs an opt-in); see {}",
                self.config.setup_docs_url
            ),
        )
        .with_data(json!({"requested": requested, "supported": [PROTOCOL_VERSION], "setup": self.config.setup_docs_url}))
    }

    fn check_version(
        &self,
        capabilities: &CapabilityContext,
        headers: &RequestHeaders,
    ) -> Result<(), RpcError> {
        let Some(version) = &capabilities.protocol_version else {
            return Err(RpcError::new(
                400,
                error_codes::INVALID_PARAMS,
                "Invalid params: request _meta must include io.modelcontextprotocol/protocolVersion and io.modelcontextprotocol/clientCapabilities",
            ));
        };
        if version.as_str() != PROTOCOL_VERSION {
            return Err(self.unsupported_version(json!(version.as_str())));
        }
        match headers.single(PROTOCOL_VERSION_HEADER) {
            Ok(Some(header)) if header == version.as_str() => Ok(()),
            Ok(Some(header)) => Err(RpcError::new(
                400,
                error_codes::HEADER_MISMATCH,
                format!(
                    "MCP-Protocol-Version header {header} doesn't match the request _meta version {}",
                    version.as_str()
                ),
            )),
            Ok(None) => Err(RpcError::new(
                400,
                error_codes::HEADER_MISMATCH,
                "missing MCP-Protocol-Version header",
            )),
            Err(reason) => Err(RpcError::new(400, error_codes::HEADER_MISMATCH, reason)),
        }
    }

    fn require_principal<'p>(
        &self,
        principal: Option<&'p Principal>,
    ) -> Result<&'p Principal, RpcError> {
        principal.ok_or_else(|| {
            let mut error = RpcError::new(
                401,
                error_codes::UNAUTHORIZED,
                "Sign in to courses.mooc.fi: this endpoint needs an OAuth bearer token",
            );
            error
                .headers
                .push(("WWW-Authenticate".into(), self.www_authenticate(None)));
            error
        })
    }

    fn www_authenticate(&self, insufficient_scope: Option<&str>) -> String {
        let mut parts = vec![];
        if let Some(scope) = insufficient_scope {
            parts.push("error=\"insufficient_scope\"".to_string());
            parts.push(format!("scope=\"{scope}\""));
        }
        if let Some(url) = &self.config.resource_metadata_url {
            parts.push(format!("resource_metadata=\"{url}\""));
        }
        if parts.is_empty() {
            "Bearer".to_string()
        } else {
            format!("Bearer {}", parts.join(", "))
        }
    }

    fn server_info_meta(&self) -> Value {
        json!({SERVER_INFO_META_KEY: {"name": self.config.server_name, "title": self.config.server_title, "version": self.config.server_version}})
    }

    fn discover(&self) -> Value {
        json!({
            "resultType": "complete",
            "supportedVersions": [PROTOCOL_VERSION],
            "capabilities": {"tools": {"listChanged": false}},
            "instructions": self.config.instructions,
            "ttlMs": self.config.discover_ttl_ms,
            "cacheScope": "private",
            "_meta": self.server_info_meta(),
        })
    }

    fn list_tools(&self, principal: &Principal) -> Value {
        let tools: Vec<Value> = self
            .registry
            .definitions()
            .iter()
            .filter(|d| principal.has_scope(d.scope))
            .map(|d| d.to_json())
            .collect();
        json!({
            "resultType": "complete",
            "tools": tools,
            "ttlMs": self.config.tools_list_ttl_ms,
            "cacheScope": "private",
            "_meta": self.server_info_meta(),
        })
    }

    async fn call_tool(
        &self,
        state: &S,
        principal: &Principal,
        capabilities: CapabilityContext,
        params: Map<String, Value>,
        progress: ProgressReporter,
    ) -> Result<Value, RpcError> {
        let name = params
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let Some(definition) = self.registry.definition(&name) else {
            return Err(RpcError::new(
                200,
                error_codes::INVALID_PARAMS,
                format!("Unknown tool: {name}"),
            ));
        };
        if !principal.has_scope(definition.scope) {
            return Err(self.insufficient_scope(definition.scope.as_str()));
        }
        let arguments = match params.get("arguments") {
            None | Some(Value::Null) => Map::new(),
            Some(Value::Object(arguments)) => arguments.clone(),
            Some(_) => {
                return Err(RpcError::new(
                    200,
                    error_codes::INVALID_PARAMS,
                    "arguments must be an object",
                ));
            }
        };
        let skill_hint = match hints::check_skill_version(
            arguments.get("skill_version").and_then(Value::as_str),
            &self.config.current_skill_version,
            &self.config.minimum_skill_version,
        ) {
            Ok(hint) => hint,
            Err(outdated) => {
                return Ok(self.tool_result(
                    &ToolError::from(outdated)
                        .to_result()
                        .unwrap_or_else(|| ToolResult::success(json!({}))),
                ));
            }
        };
        let associated_data = confirmation_binding(principal, &name, &arguments);
        let retry = match params.get("requestState").and_then(Value::as_str) {
            None => None,
            Some(sealed) => Some(self.open_request_state(
                sealed,
                &associated_data,
                params.get("inputResponses"),
            )?),
        };
        let ctx = RequestContext {
            principal: principal.clone(),
            capabilities,
            tool_name: name.clone(),
            retry,
            progress,
        };
        let Some(handler) = self.registry.handler(&name) else {
            return Err(RpcError::new(
                200,
                error_codes::INTERNAL_ERROR,
                "tool has no handler",
            ));
        };
        let outcome = handler.call(state, &ctx, arguments).await;
        match outcome {
            Ok(ToolOutcome::Complete(result)) => {
                Ok(self.tool_result(&result.with_hints(skill_hint)))
            }
            Ok(ToolOutcome::NeedsConfirmation(request)) => {
                Ok(self.confirmation(&ctx, request, &associated_data, skill_hint))
            }
            Err(ToolError::InsufficientScope { required }) => {
                Err(self.insufficient_scope(required.as_str()))
            }
            Err(ToolError::Internal(message)) => {
                tracing::error!(tool = %name, %message, "MCP tool failed");
                Err(RpcError::new(
                    200,
                    error_codes::INTERNAL_ERROR,
                    "Internal error; the call staged nothing",
                ))
            }
            Err(error) => Ok(self.tool_result(
                &error
                    .to_result()
                    .unwrap_or_else(|| ToolResult::success(json!({})))
                    .with_hints(skill_hint),
            )),
        }
    }

    fn insufficient_scope(&self, scope: &str) -> RpcError {
        let mut error = RpcError::new(
            403,
            error_codes::UNAUTHORIZED,
            format!("This needs the {scope} scope, which the agent's sign-in doesn't include"),
        )
        .with_data(json!({"required_scope": scope}));
        error.headers.push((
            "WWW-Authenticate".into(),
            self.www_authenticate(Some(scope)),
        ));
        error
    }

    fn tool_result(&self, result: &ToolResult) -> Value {
        let structured = result.structured_content();
        json!({
            "resultType": "complete",
            "content": [{"type": "text", "text": structured.to_string()}],
            "structuredContent": structured,
            "isError": result.is_error,
            "_meta": self.server_info_meta(),
        })
    }

    fn confirmation(
        &self,
        ctx: &RequestContext,
        request: ConfirmationRequest,
        associated_data: &[u8],
        skill_hint: Option<hints::Hint>,
    ) -> Value {
        let codec = self.config.request_state_codec.as_ref();
        let usable = ctx.capabilities.supports_url_elicitation()
            && ctx.capabilities.can_use_input_required();
        let (Some(codec), true) = (codec, usable) else {
            return self.tool_result(&request.fallback.with_hints(skill_hint));
        };
        let options = SealOptions::new()
            .associated_data(associated_data)
            .ttl(CONFIRMATION_TTL);
        let Ok(sealed) = codec.seal_json_with(&request.state, &options) else {
            return self.tool_result(&request.fallback.with_hints(skill_hint));
        };
        json!({
            "resultType": "input_required",
            "inputRequests": {
                CONFIRMATION_KEY: {
                    "method": "elicitation/create",
                    "params": {"mode": "url", "message": request.message, "url": request.url, "elicitationId": request.elicitation_id},
                },
            },
            "requestState": sealed,
            "_meta": self.server_info_meta(),
        })
    }

    fn open_request_state(
        &self,
        sealed: &str,
        associated_data: &[u8],
        responses: Option<&Value>,
    ) -> Result<RetryState, RpcError> {
        let invalid = || {
            RpcError::new(
                200,
                error_codes::INVALID_REQUEST_STATE,
                "requestState is invalid or expired; repeat the call without it",
            )
        };
        let codec = self
            .config
            .request_state_codec
            .as_ref()
            .ok_or_else(invalid)?;
        let state: Value = codec
            .open_json_with(sealed, associated_data)
            .map_err(|_| invalid())?;
        let input_responses = responses
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        Ok(RetryState {
            state,
            input_responses,
        })
    }
}

/// Binds a confirmation to the user, the tool and its exact arguments, so a sealed state can't
/// be replayed by someone else or for another change.
fn confirmation_binding(
    principal: &Principal,
    tool: &str,
    arguments: &Map<String, Value>,
) -> Vec<u8> {
    let mut arguments = arguments.clone();
    arguments.remove("skill_version");
    format!(
        "{}|{tool}|{}",
        principal.user_id,
        canonical_json(&Value::Object(arguments))
    )
    .into_bytes()
}

/// JSON with object keys sorted, independent of map ordering features.
fn canonical_json(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let fields: Vec<String> = keys
                .into_iter()
                .map(|k| format!("{}:{}", Value::String(k.clone()), canonical_json(&map[k])))
                .collect();
            format!("{{{}}}", fields.join(","))
        }
        Value::Array(items) => format!(
            "[{}]",
            items
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        other => other.to_string(),
    }
}

#[cfg(test)]
#[path = "dispatch_tests.rs"]
mod tests;
