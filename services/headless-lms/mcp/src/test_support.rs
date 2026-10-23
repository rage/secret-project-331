//! Requests as an MCP client sends them and a stub block validator, for this crate's unit and
//! database tests.

use std::sync::Mutex;

use async_trait::async_trait;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::protocol::PROTOCOL_VERSION;
use crate::validator::{
    BlockSchemas, BlockValidationError, BlockValidationErrorCode, BlockValidator,
    ValidationOutcome, ValidationRequest, ValidationTarget, ValidatorError,
};

pub use crate::hints::CURRENT_SKILL_VERSION;

/// The `_meta` every request carries.
pub fn request_meta(client_name: &str, client_capabilities: Value) -> Value {
    json!({
        "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientInfo": {"name": client_name, "version": "1"},
        "io.modelcontextprotocol/clientCapabilities": client_capabilities,
    })
}

/// A JSON-RPC request with id 1 whose params carry `meta`.
pub fn request_body(method: &str, params: Value, meta: Value) -> Value {
    let mut body = json!({"jsonrpc": "2.0", "id": 1, "method": method, "params": params});
    body["params"]["_meta"] = meta;
    body
}

/// A `tools/call` request.
pub fn call_body(tool: &str, arguments: Value, meta: Value) -> Value {
    request_body(
        "tools/call",
        json!({"name": tool, "arguments": arguments}),
        meta,
    )
}

/// The headers that mirror `body`: protocol version, method, tool name and course.
pub fn request_headers(body: &Value) -> Vec<(String, String)> {
    let mut headers = vec![(
        "MCP-Protocol-Version".to_string(),
        PROTOCOL_VERSION.to_string(),
    )];
    if let Some(method) = body["method"].as_str() {
        headers.push(("Mcp-Method".to_string(), method.to_string()));
    }
    if let Some(name) = body["params"]["name"].as_str() {
        headers.push(("Mcp-Name".to_string(), name.to_string()));
    }
    if let Some(course) = body["params"]["arguments"]["course"].as_str() {
        headers.push(("Mcp-Param-Course".to_string(), course.to_string()));
    }
    headers
}

/// A validator that rejects blocks with `<script` in their attributes, trims the `content` of the
/// top-level blocks it accepts, and warns about unchanged blocks with `<b>` in theirs. Records what
/// it was asked.
#[derive(Default)]
pub struct StubValidator {
    pub calls: Mutex<usize>,
    /// The target and number of top-level blocks of each list it validated.
    pub requests: Mutex<Vec<(ValidationTarget, usize)>>,
    pub unchanged: Mutex<Vec<Uuid>>,
}

fn markup_problem(block: &GutenbergBlock, tag: &str) -> Option<BlockValidationError> {
    Value::Object(block.attributes.clone())
        .to_string()
        .contains(tag)
        .then(|| BlockValidationError {
            client_id: Some(block.client_id),
            path: vec![json!("attributes"), json!("content")],
            code: BlockValidationErrorCode::DisallowedMarkup,
            message: format!("{tag} isn't allowed"),
            fix: format!("remove the {tag} tag"),
        })
}

#[async_trait]
impl BlockValidator for StubValidator {
    async fn validate_blocks(
        &self,
        request: &ValidationRequest<'_>,
    ) -> Result<Vec<ValidationOutcome>, ValidatorError> {
        *self.calls.lock().expect("an unpoisoned lock") += 1;
        Ok(request
            .pages
            .iter()
            .map(|page| {
                self.requests
                    .lock()
                    .expect("an unpoisoned lock")
                    .push((page.target, page.blocks.len()));
                self.unchanged
                    .lock()
                    .expect("an unpoisoned lock")
                    .extend(page.unchanged_client_ids);
                let mut errors = Vec::new();
                let mut warnings = Vec::new();
                crate::engine::blocks::walk(page.blocks, &mut |block, _| {
                    errors.extend(markup_problem(block, "<script"));
                    if page.unchanged_client_ids.contains(&block.client_id) {
                        warnings.extend(markup_problem(block, "<b>"));
                    }
                });
                if !errors.is_empty() {
                    return ValidationOutcome {
                        blocks: vec![],
                        errors,
                        warnings,
                    };
                }
                let blocks = page
                    .blocks
                    .iter()
                    .cloned()
                    .map(|mut block| {
                        if let Some(Value::String(content)) = block.attributes.get_mut("content") {
                            *content = content.trim().to_string();
                        }
                        block
                    })
                    .collect();
                ValidationOutcome {
                    blocks,
                    errors: vec![],
                    warnings,
                }
            })
            .collect())
    }

    async fn block_schemas(&self) -> Result<BlockSchemas, ValidatorError> {
        Err(ValidatorError::Unavailable {
            reason: "stub".into(),
            retry_after: None,
        })
    }
}
