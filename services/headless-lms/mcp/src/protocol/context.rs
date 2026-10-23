//! Per-request client context from `_meta`. Every feature reads it here and has a fallback, so
//! correctness never depends on what a client declares.

use rmcp::model::{
    ClientCapabilities, Implementation, MetaObject, ProtocolVersion, RequestMetaObject,
};
use serde_json::{Map, Value};

const META_LOG_LEVEL: &str = "io.modelcontextprotocol/logLevel";
const META_PROGRESS_TOKEN: &str = "progressToken";

/// Clients whose wording or limits differ.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientKind {
    ClaudeCode,
    Codex,
    Other,
}

#[derive(Debug, Clone)]
pub struct CapabilityContext {
    pub protocol_version: Option<ProtocolVersion>,
    pub client_info: Option<Implementation>,
    pub capabilities: ClientCapabilities,
    /// Per-request log level, if the client asked for one.
    pub log_level: Option<String>,
    pub progress_token: Option<Value>,
    /// W3C trace context, to join the request into existing tracing spans.
    pub traceparent: Option<String>,
    pub tracestate: Option<String>,
}

impl CapabilityContext {
    pub fn from_meta(meta: &Map<String, Value>) -> Self {
        let request_meta = RequestMetaObject(MetaObject(meta.clone()));
        Self {
            protocol_version: request_meta.protocol_version(),
            client_info: request_meta.client_info(),
            capabilities: request_meta.client_capabilities().unwrap_or_default(),
            log_level: meta
                .get(META_LOG_LEVEL)
                .and_then(Value::as_str)
                .map(str::to_string),
            progress_token: meta
                .get(META_PROGRESS_TOKEN)
                .filter(|v| v.is_string() || v.is_number())
                .cloned(),
            traceparent: request_meta.0.get_traceparent().map(str::to_string),
            tracestate: request_meta.0.get_tracestate().map(str::to_string),
        }
    }

    pub fn client_kind(&self) -> ClientKind {
        let name = self
            .client_info
            .as_ref()
            .map(|c| c.name.to_lowercase())
            .unwrap_or_default();
        if name.contains("claude") {
            ClientKind::ClaudeCode
        } else if name.contains("codex") {
            ClientKind::Codex
        } else {
            ClientKind::Other
        }
    }

    pub fn supports_url_elicitation(&self) -> bool {
        self.capabilities
            .elicitation
            .as_ref()
            .is_some_and(|e| e.url.is_some())
    }

    pub fn supports_form_elicitation(&self) -> bool {
        self.capabilities
            .elicitation
            .as_ref()
            .is_some_and(|e| e.form.is_some() || e.url.is_none())
    }

    /// Whether an `input_required` result will reach the human. Codex's opt-in 2026-07-28 path
    /// errors on these results, so it gets the text fallback.
    pub fn can_use_input_required(&self) -> bool {
        self.client_kind() != ClientKind::Codex
    }

    /// The tasks extension; nothing requires it, long operations just run inline without it.
    pub fn supports_tasks(&self) -> bool {
        self.capabilities.supports_tasks()
    }

    /// Serialized result size reads aim under: Codex drops the middle of results over about
    /// 10 KB, Claude Code moves results over about 50k characters to a file.
    pub fn result_budget_bytes(&self) -> usize {
        match self.client_kind() {
            ClientKind::Codex => 8_000,
            ClientKind::ClaudeCode => 40_000,
            ClientKind::Other => 16_000,
        }
    }

    /// A smaller budget for `read_back`, which follows a write summary in the same result.
    pub fn read_back_budget_bytes(&self) -> usize {
        self.result_budget_bytes() / 2
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn context(meta: Value) -> CapabilityContext {
        CapabilityContext::from_meta(meta.as_object().unwrap())
    }

    #[test]
    fn reads_client_info_and_capabilities() {
        let ctx = context(json!({
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientInfo": {"name": "claude-code", "version": "3.0.0"},
            "io.modelcontextprotocol/clientCapabilities": {"elicitation": {"url": {}}},
            "progressToken": 7,
            "traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
        }));
        assert_eq!(ctx.client_kind(), ClientKind::ClaudeCode);
        assert!(ctx.supports_url_elicitation());
        assert!(ctx.can_use_input_required());
        assert_eq!(ctx.progress_token, Some(json!(7)));
        assert!(ctx.traceparent.is_some());
        assert_eq!(ctx.protocol_version, Some(ProtocolVersion::V_2026_07_28));
    }

    #[test]
    fn codex_gets_fallbacks() {
        let ctx = context(json!({
            "io.modelcontextprotocol/clientInfo": {"name": "codex-mcp-client", "version": "0.9"},
            "io.modelcontextprotocol/clientCapabilities": {"elicitation": {"url": {}}},
        }));
        assert!(!ctx.can_use_input_required());
        assert_eq!(ctx.result_budget_bytes(), 8_000);
        assert!(!context(json!({})).supports_url_elicitation());
    }
}
