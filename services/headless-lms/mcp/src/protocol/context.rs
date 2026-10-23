//! Per-request client context from `_meta`. Every feature reads it here and has a fallback, so
//! correctness never depends on what a client declares.

use rmcp::model::{
    ClientCapabilities, Implementation, MetaObject, ProgressToken, ProtocolVersion,
    RequestMetaObject,
};
use serde_json::{Map, Value};

const META_PROGRESS_TOKEN: &str = "progressToken";

/// Clients whose wording or limits differ.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientKind {
    ClaudeCode,
    Codex,
    Other,
}

/// The calling client and what it declared in the request's `_meta`.
#[derive(Debug, Clone)]
pub struct ClientContext {
    pub protocol_version: Option<ProtocolVersion>,
    pub client_info: Option<Implementation>,
    pub capabilities: ClientCapabilities,
    pub progress_token: Option<ProgressToken>,
}

impl ClientContext {
    pub fn from_meta(meta: Map<String, Value>) -> Self {
        let progress_token = meta
            .get(META_PROGRESS_TOKEN)
            .and_then(|token| serde_json::from_value(token.clone()).ok());
        let request_meta = RequestMetaObject(MetaObject(meta));
        Self {
            protocol_version: request_meta.protocol_version(),
            client_info: request_meta.client_info(),
            capabilities: request_meta.client_capabilities().unwrap_or_default(),
            progress_token,
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

    /// Whether an `input_required` result will reach the human. Codex's opt-in 2026-07-28 path
    /// errors on these results, so it gets the text fallback.
    pub fn can_use_input_required(&self) -> bool {
        self.client_kind() != ClientKind::Codex
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
    use rmcp::model::NumberOrString;
    use serde_json::json;

    use super::*;

    fn context(meta: Value) -> ClientContext {
        ClientContext::from_meta(meta.as_object().unwrap().clone())
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
        assert_eq!(
            ctx.progress_token,
            Some(ProgressToken(NumberOrString::Number(7)))
        );
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
