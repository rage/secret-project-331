//! JSON-RPC dispatch for one HTTP request: version negotiation, header checks, `server/discover`,
//! `tools/list` and `tools/call`, including confirmation round trips through `requestState`.

use std::time::Duration;

use headless_lms_utils::stable_digest::stable_digest;
use rmcp::model::{
    CacheScope, CallToolResult, ContentBlock, DiscoverResult, ElicitRequest, ElicitRequestParams,
    ErrorCode, ErrorData, Implementation, InputRequest, InputRequests, InputRequiredResult,
    JsonRpcError, JsonRpcResponse, JsonRpcVersion2_0, ListToolsResult, MetaObject, RequestId,
    RequestStateCodec, ResultType, SealOptions, ServerCapabilities, ToolsCapability,
};
use serde::Serialize;
use serde_json::{Map, Value, json};
use tokio::sync::mpsc::UnboundedSender;

use super::context::ClientContext;
use super::error_codes;
use super::headers::{self, PROTOCOL_VERSION_HEADER, RequestHeaders};
use super::progress::ProgressReporter;
use super::{PROTOCOL_VERSION, SETUP_DOCS_URL, www_authenticate_challenge};
use crate::hints;
use crate::instructions::SERVER_INSTRUCTIONS;
use crate::tools::{
    CONFIRMATION_KEY, ConfirmationRequest, McpPrincipal, McpScope, RequestContext, RetryState,
    Tool, ToolError, ToolOutcome, ToolRegistry, ToolResult,
};

const SERVER_INFO_META_KEY: &str = "io.modelcontextprotocol/serverInfo";
const CONFIRMATION_TTL: Duration = Duration::from_secs(15 * 60);
const SERVER_NAME: &str = "courses-mooc-fi";
const SERVER_TITLE: &str = "courses.mooc.fi course material";
/// Short, so scope and role changes show up promptly.
const TOOLS_LIST_TTL_MS: u64 = 60_000;
const DISCOVER_TTL_MS: u64 = 300_000;

/// Deployment settings of an [`McpServer`].
pub(crate) struct ServerConfig {
    pub server_version: String,
    /// The RFC 9728 metadata URL advertised in `WWW-Authenticate`.
    pub resource_metadata_url: String,
    /// Seals `requestState`.
    pub request_state_codec: RequestStateCodec,
}

/// One HTTP request to the MCP endpoint, framework-independent.
pub struct HttpRequest {
    pub method: String,
    pub headers: RequestHeaders,
    pub body: serde_json::Result<Value>,
}

/// The answer to one HTTP request, framework-independent.
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

    fn parse_error(message: impl Into<String>) -> Self {
        Self::new(400, ErrorCode::PARSE_ERROR, message)
    }

    fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(400, ErrorCode::INVALID_REQUEST, message)
    }

    /// Params the protocol layer rejects before any tool is chosen.
    fn invalid_params(message: impl Into<String>) -> Self {
        Self::new(400, ErrorCode::INVALID_PARAMS, message)
    }

    fn header_mismatch(message: impl Into<String>) -> Self {
        Self::new(400, ErrorCode::HEADER_MISMATCH, message)
    }

    fn unsupported_protocol_version(message: impl Into<String>) -> Self {
        Self::new(400, ErrorCode::UNSUPPORTED_PROTOCOL_VERSION, message)
    }

    fn method_not_found(message: impl Into<String>) -> Self {
        Self::new(404, ErrorCode::METHOD_NOT_FOUND, message)
    }

    fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(403, error_codes::UNAUTHORIZED, message)
    }

    /// A `tools/call` that passed the protocol checks but can't run; answered with HTTP 200,
    /// unlike [`RpcError::invalid_params`].
    fn tool_call(code: ErrorCode, message: impl Into<String>) -> Self {
        Self::new(200, code, message)
    }

    /// A `tools/call` that failed on the server's side; the details go to the log only.
    fn internal() -> Self {
        Self::tool_call(
            ErrorCode::INTERNAL_ERROR,
            "Internal error; the call changed nothing",
        )
    }

    fn with_data(mut self, data: Value) -> Self {
        self.data = Some(data);
        self
    }

    /// `id` is `None` when the request's id couldn't be read.
    fn into_response(self, id: Option<RequestId>) -> HttpResponse {
        let error = JsonRpcError::new(id, ErrorData::new(self.code, self.message, self.data));
        let mut response = HttpResponse::json(self.status, to_json(&error));
        response.headers.extend(self.headers);
        response
    }
}

/// The MCP server: answers each request with the tools of its registry, run against the state
/// `S`.
pub struct McpServer<S> {
    registry: ToolRegistry<S>,
    config: ServerConfig,
}

impl<S: Send + Sync + 'static> McpServer<S> {
    /// A server answering with the tools of `registry`.
    pub(crate) fn new(registry: ToolRegistry<S>, config: ServerConfig) -> Self {
        Self { registry, config }
    }

    /// Handles one request. `progress_sink`, when given, receives progress notifications the
    /// transport may stream before the response.
    pub async fn handle(
        &self,
        state: &S,
        principal: &McpPrincipal,
        request: HttpRequest,
        progress_sink: Option<UnboundedSender<Value>>,
    ) -> HttpResponse {
        if request.method != "POST" {
            let mut response = HttpResponse::empty(405);
            response.headers.push(("Allow".into(), "POST".into()));
            return response;
        }
        let mut object = match request.body {
            Ok(Value::Object(object)) => object,
            Ok(_) => {
                return RpcError::invalid_request(
                    "Invalid Request: send one JSON-RPC object per request; batches aren't supported",
                )
                .into_response(None);
            }
            Err(e) => {
                return RpcError::parse_error(format!("Parse error: {e}")).into_response(None);
            }
        };
        let is_response = object.contains_key("result") || object.contains_key("error");
        let invalid = || {
            RpcError::invalid_request(
                "Invalid Request: a request needs a string method and a string or number id",
            )
            .into_response(None)
        };
        let (id, method) = match (object.remove("id"), object.remove("method")) {
            (Some(id), Some(Value::String(method))) => match serde_json::from_value(id) {
                Ok(id) => (id, method),
                Err(_) => return invalid(),
            },
            (None, Some(Value::String(_))) => return HttpResponse::empty(202),
            (Some(_), None) if is_response => return HttpResponse::empty(202),
            _ => return invalid(),
        };
        match self
            .dispatch(
                state,
                principal,
                &request.headers,
                &method,
                object.remove("params"),
                progress_sink,
            )
            .await
        {
            Ok(result) => HttpResponse::json(
                200,
                to_json(&JsonRpcResponse {
                    jsonrpc: JsonRpcVersion2_0,
                    id,
                    result,
                }),
            ),
            Err(error) => error.into_response(Some(id)),
        }
    }

    async fn dispatch(
        &self,
        state: &S,
        principal: &McpPrincipal,
        headers: &RequestHeaders,
        method: &str,
        params: Option<Value>,
        progress_sink: Option<UnboundedSender<Value>>,
    ) -> Result<Value, RpcError> {
        if method == "initialize" {
            let requested = params
                .as_ref()
                .and_then(|p| p.get("protocolVersion"))
                .cloned()
                .unwrap_or(Value::Null);
            return Err(self.unsupported_version(requested));
        }
        let mut params = match params {
            Some(Value::Object(params)) => params,
            _ => Map::new(),
        };
        let client = ClientContext::from_meta(match params.remove("_meta") {
            Some(Value::Object(meta)) => meta,
            _ => Map::new(),
        });
        let tool_name = params
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let tool = match method {
            "tools/call" => self.registry.get(tool_name),
            _ => None,
        };
        if method != "server/discover" {
            self.check_version(&client, headers)?;
            let header_params = tool.map_or(&[][..], |tool| &tool.definition.header_params);
            headers::validate(headers, method, &params, header_params)
                .map_err(RpcError::header_mismatch)?;
        }
        match method {
            "server/discover" => Ok(self.discover()),
            "tools/list" => Ok(self.list_tools(principal)),
            "tools/call" => {
                let Some(tool) = tool else {
                    return Err(RpcError::tool_call(
                        ErrorCode::INVALID_PARAMS,
                        format!("Unknown tool: {tool_name}"),
                    ));
                };
                let progress = ProgressReporter::new(client.progress_token.clone(), progress_sink);
                self.call_tool(state, principal, client, tool, params, progress)
                    .await
            }
            other => Err(RpcError::method_not_found(format!(
                "Method not found: {other}"
            ))),
        }
    }

    fn unsupported_version(&self, requested: Value) -> RpcError {
        RpcError::unsupported_protocol_version(format!(
            "This server supports MCP protocol revision {PROTOCOL_VERSION} only. Update the agent, or enable its {PROTOCOL_VERSION} support (Codex needs an opt-in); see {SETUP_DOCS_URL}"
        ))
        .with_data(json!({"requested": requested, "supported": [PROTOCOL_VERSION], "setup": SETUP_DOCS_URL}))
    }

    fn check_version(
        &self,
        client: &ClientContext,
        headers: &RequestHeaders,
    ) -> Result<(), RpcError> {
        let Some(version) = &client.protocol_version else {
            return Err(RpcError::invalid_params(
                "Invalid params: request _meta must include io.modelcontextprotocol/protocolVersion and io.modelcontextprotocol/clientCapabilities",
            ));
        };
        if *version != PROTOCOL_VERSION {
            return Err(self.unsupported_version(json!(version)));
        }
        match headers.single(PROTOCOL_VERSION_HEADER) {
            Ok(Some(header)) if header == version.as_str() => Ok(()),
            Ok(Some(header)) => Err(RpcError::header_mismatch(format!(
                "MCP-Protocol-Version header {header} doesn't match the request _meta version {}",
                version.as_str()
            ))),
            Ok(None) => Err(RpcError::header_mismatch(
                "missing MCP-Protocol-Version header",
            )),
            Err(reason) => Err(RpcError::header_mismatch(reason)),
        }
    }

    fn server_info_meta(&self) -> MetaObject {
        let server_info =
            Implementation::new(SERVER_NAME, &self.config.server_version).with_title(SERVER_TITLE);
        MetaObject::from(Map::from_iter([(
            SERVER_INFO_META_KEY.to_string(),
            to_json(&server_info),
        )]))
    }

    fn discover(&self) -> Value {
        let mut tools = ToolsCapability::default();
        tools.list_changed = Some(false);
        let mut capabilities = ServerCapabilities::default();
        capabilities.tools = Some(tools);
        let mut result = DiscoverResult::new(vec![PROTOCOL_VERSION], capabilities);
        result.instructions = Some(SERVER_INSTRUCTIONS.to_string());
        result.ttl_ms = DISCOVER_TTL_MS;
        result.meta = Some(self.server_info_meta());
        to_json(&result)
    }

    fn list_tools(&self, principal: &McpPrincipal) -> Value {
        to_json(&ListToolsResult {
            result_type: Some(ResultType::COMPLETE),
            meta: Some(self.server_info_meta()),
            next_cursor: None,
            ttl_ms: Some(TOOLS_LIST_TTL_MS),
            cache_scope: Some(CacheScope::Private),
            tools: self.registry.listings_for(principal),
        })
    }

    async fn call_tool(
        &self,
        state: &S,
        principal: &McpPrincipal,
        client: ClientContext,
        tool: &Tool<S>,
        mut params: Map<String, Value>,
        progress: ProgressReporter,
    ) -> Result<Value, RpcError> {
        let name = tool.definition.name;
        if !principal.has_scope(tool.definition.scope) {
            return Err(self.insufficient_scope(principal, tool.definition.scope));
        }
        let mut arguments = match params.remove("arguments") {
            None | Some(Value::Null) => Map::new(),
            Some(Value::Object(arguments)) => arguments,
            Some(_) => {
                return Err(RpcError::tool_call(
                    ErrorCode::INVALID_PARAMS,
                    "arguments must be an object",
                ));
            }
        };
        let skill_version = arguments.remove("skill_version");
        let skill_hint = match hints::skill_version(skill_version.as_ref().and_then(Value::as_str))
        {
            Ok(hint) => hint,
            Err(outdated) => {
                return Ok(self.tool_result(ToolError::from(outdated).into_result()));
            }
        };
        let binding = confirmation_binding(principal, name, &arguments)?;
        let retry = match params.remove("requestState") {
            Some(Value::String(sealed)) => Some(self.open_request_state(
                &sealed,
                binding.as_bytes(),
                params.remove("inputResponses"),
            )?),
            _ => None,
        };
        let sealing_binding = tool
            .handler
            .asks_for_confirmation()
            .then_some(binding.as_str());
        let ctx = RequestContext {
            principal: principal.clone(),
            client,
            tool_name: name,
            retry,
            progress,
        };
        match tool.handler.call_with_json(state, &ctx, arguments).await {
            Ok(ToolOutcome::Complete(result)) => {
                Ok(self.tool_result(result.with_hints(skill_hint)))
            }
            Ok(ToolOutcome::NeedsConfirmation(request)) => {
                Ok(self.confirmation(&ctx, request, sealing_binding, skill_hint))
            }
            Err(ToolError::InsufficientScope { required }) => {
                Err(self.insufficient_scope(principal, required))
            }
            Err(ToolError::Internal(message)) => {
                tracing::error!(tool = %ctx.tool_name, %message, "MCP tool failed");
                Err(RpcError::internal())
            }
            Err(error) => Ok(self.tool_result(error.into_result().with_hints(skill_hint))),
        }
    }

    /// The 403 for a missing scope. Its challenge asks for the scopes the token has as well, since
    /// a client stepping up requests exactly the challenged scopes and would lose the others.
    fn insufficient_scope(&self, principal: &McpPrincipal, required: McpScope) -> RpcError {
        let scope = required.as_str();
        let mut error = RpcError::unauthorized(format!(
            "This needs the {scope} scope, which the agent's sign-in doesn't include"
        ))
        .with_data(json!({"required_scope": scope}));
        let challenged: Vec<&str> = McpScope::ALL
            .into_iter()
            .filter(|s| *s == required || principal.has_scope(*s))
            .map(McpScope::as_str)
            .collect();
        error.headers.push((
            "WWW-Authenticate".into(),
            www_authenticate_challenge(
                &self.config.resource_metadata_url,
                &challenged.join(" "),
                Some((
                    "insufficient_scope",
                    "the token lacks a scope this tool needs",
                )),
            ),
        ));
        error
    }

    fn tool_result(&self, result: ToolResult) -> Value {
        let structured = result.structured_content();
        let content = vec![ContentBlock::text(structured.to_string())];
        let mut call_result = if result.is_error {
            CallToolResult::error(content)
        } else {
            CallToolResult::success(content)
        };
        call_result.structured_content = Some(structured);
        call_result.meta = Some(self.server_info_meta());
        to_json(&call_result)
    }

    /// `binding` is `None` when the handler doesn't declare that it asks for confirmation; the
    /// text fallback is then the only safe answer.
    fn confirmation(
        &self,
        ctx: &RequestContext,
        request: ConfirmationRequest,
        binding: Option<&str>,
        skill_hint: Option<hints::Hint>,
    ) -> Value {
        let is_usable =
            ctx.client.supports_url_elicitation() && ctx.client.can_use_input_required();
        let (true, Some(binding)) = (is_usable, binding) else {
            return self.tool_result(request.fallback.with_hints(skill_hint));
        };
        let options = SealOptions::new()
            .associated_data(binding.as_bytes())
            .ttl(CONFIRMATION_TTL);
        // The confirmation is bound through the associated data; the state itself carries nothing.
        let sealed = self.config.request_state_codec.seal_with(&[], &options);
        let elicitation = ElicitRequest::new(ElicitRequestParams::UrlElicitationParams {
            meta: None,
            message: request.message,
            url: request.url,
            elicitation_id: request.elicitation_id,
        });
        let input_requests = InputRequests::from([(
            CONFIRMATION_KEY.to_string(),
            InputRequest::Elicitation(elicitation),
        )]);
        to_json(
            &InputRequiredResult::new(Some(input_requests), Some(sealed))
                .with_meta(self.server_info_meta()),
        )
    }

    fn open_request_state(
        &self,
        sealed: &str,
        associated_data: &[u8],
        responses: Option<Value>,
    ) -> Result<RetryState, RpcError> {
        let invalid = || {
            RpcError::tool_call(
                error_codes::INVALID_REQUEST_STATE,
                "requestState is invalid or expired; repeat the call without it",
            )
        };
        self.config
            .request_state_codec
            .open_with(sealed, associated_data)
            .map_err(|_| invalid())?;
        let input_responses = match responses {
            Some(Value::Object(responses)) => responses,
            _ => Map::new(),
        };
        Ok(RetryState { input_responses })
    }
}

/// Binds a confirmation to the user, the tool and its exact arguments, so a sealed state can't
/// be replayed by someone else or for another change.
fn confirmation_binding(
    principal: &McpPrincipal,
    tool: &str,
    arguments: &Map<String, Value>,
) -> Result<String, RpcError> {
    // Canonical because serde_json's `Map` keeps keys sorted (the `preserve_order` feature is off).
    let arguments = serde_json::to_vec(arguments).map_err(|error| {
        tracing::error!(%tool, %error, "MCP tool arguments didn't serialize");
        RpcError::internal()
    })?;
    Ok(stable_digest(&[
        principal.actor.user_id.as_bytes(),
        tool.as_bytes(),
        &arguments,
    ]))
}

/// A protocol value as JSON; one that doesn't serialize is logged and becomes `null`.
fn to_json(value: &impl Serialize) -> Value {
    serde_json::to_value(value).unwrap_or_else(|error| {
        tracing::error!(%error, "an MCP protocol value didn't serialize");
        Value::Null
    })
}

#[cfg(test)]
#[path = "dispatch_tests.rs"]
mod tests;
