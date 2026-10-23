use std::sync::Arc;

use async_trait::async_trait;
use pretty_assertions::assert_eq;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::*;
use crate::engine::{EditError, EditErrorCode};
use crate::hints::CURRENT_SKILL_VERSION;
use crate::tools::{Scope, ToolHandler};

struct Echo;

#[async_trait]
impl ToolHandler<()> for Echo {
    async fn call(
        &self,
        _: &(),
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        Ok(ToolResult::success(json!({"arguments": arguments, "client": format!("{:?}", ctx.capabilities.client_kind())})).into())
    }
}

struct Failing;

#[async_trait]
impl ToolHandler<()> for Failing {
    async fn call(
        &self,
        _: &(),
        _: &RequestContext,
        _: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        Err(EditError::new(EditErrorCode::NotFound, "no block")
            .with_fix("read the outline")
            .into())
    }
}

struct Confirming;

#[async_trait]
impl ToolHandler<()> for Confirming {
    async fn call(
        &self,
        _: &(),
        ctx: &RequestContext,
        _: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        if let Some(retry) = &ctx.retry {
            return Ok(ToolResult::success(
                json!({"confirmed": retry.confirmation_action(), "state": retry.state}),
            )
            .into());
        }
        Ok(ToolOutcome::NeedsConfirmation(ConfirmationRequest {
            message: "Confirm publishing".into(),
            url: "https://courses.mooc.fi/review/1".into(),
            elicitation_id: "e1".into(),
            state: json!({"changeset": "cs1"}),
            fallback: ToolResult::success(
                json!({"review_url": "https://courses.mooc.fi/review/1"}),
            ),
        }))
    }
}

fn server() -> McpServer<()> {
    let registry = ToolRegistry::with_catalog()
        .register("get_page_content", Arc::new(Echo))
        .register("patch_page_content", Arc::new(Failing))
        .register("publish_changeset", Arc::new(Confirming));
    let mut config = ServerConfig::new("1.0.0");
    config.resource_metadata_url =
        Some("https://courses.mooc.fi/.well-known/oauth-protected-resource/api/v0/mcp".into());
    config.request_state_codec =
        Some(RequestStateCodec::try_new(b"0123456789abcdef0123456789abcdef".to_vec()).unwrap());
    McpServer::new(registry, config)
}

fn principal(scopes: &[Scope]) -> Principal {
    Principal {
        user_id: Uuid::nil(),
        scopes: scopes.to_vec(),
        oauth_client_id: None,
        grant_id: None,
        client_name: Some("Claude Code".into()),
    }
}

fn all_scopes() -> Principal {
    principal(&[
        Scope::MaterialRead,
        Scope::MaterialStage,
        Scope::MaterialPublish,
        Scope::SettingsWrite,
    ])
}

fn meta(client: &str) -> Value {
    json!({
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": {"name": client, "version": "1"},
        "io.modelcontextprotocol/clientCapabilities": {"elicitation": {"url": {}}},
    })
}

fn call_body(tool: &str, arguments: Value, client: &str) -> Value {
    json!({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"_meta": meta(client), "name": tool, "arguments": arguments}})
}

fn headers_for(body: &Value) -> RequestHeaders {
    let mut entries = vec![("MCP-Protocol-Version".to_string(), "2026-07-28".to_string())];
    if let Some(method) = body["method"].as_str() {
        entries.push(("Mcp-Method".into(), method.into()));
    }
    if let Some(name) = body["params"]["name"].as_str() {
        entries.push(("Mcp-Name".into(), name.into()));
    }
    if let Some(course) = body["params"]["arguments"]["course"].as_str() {
        entries.push(("Mcp-Param-Course".into(), course.into()));
    }
    RequestHeaders::new(entries)
}

async fn send(server: &McpServer<()>, principal: Option<&Principal>, body: &Value) -> HttpResponse {
    send_with(server, principal, body, headers_for(body)).await
}

async fn send_with(
    server: &McpServer<()>,
    principal: Option<&Principal>,
    body: &Value,
    headers: RequestHeaders,
) -> HttpResponse {
    let bytes = serde_json::to_vec(body).unwrap();
    server
        .handle(
            &(),
            principal,
            HttpRequest {
                method: "POST",
                headers,
                body: &bytes,
            },
            None,
        )
        .await
}

fn error_code(response: &HttpResponse) -> i64 {
    response.body.as_ref().unwrap()["error"]["code"]
        .as_i64()
        .unwrap()
}

#[tokio::test]
async fn old_revisions_get_unsupported_version_with_setup_pointer() {
    let body = json!({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}});
    let response = send(&server(), None, &body).await;
    assert_eq!(response.status, 400);
    assert_eq!(error_code(&response), -32022);
    let error = &response.body.unwrap()["error"];
    assert_eq!(error["data"]["supported"], json!(["2026-07-28"]));
    assert!(error["message"].as_str().unwrap().contains("Codex"));

    let mut call = call_body("get_page_content", json!({"course": "c", "page": "p"}), "x");
    call["params"]["_meta"]["io.modelcontextprotocol/protocolVersion"] = json!("2025-11-25");
    assert_eq!(
        error_code(&send(&server(), Some(&all_scopes()), &call).await),
        -32022
    );
}

#[tokio::test]
async fn discover_needs_no_token() {
    let body = json!({"jsonrpc": "2.0", "id": "a", "method": "server/discover", "params": {"_meta": meta("x")}});
    let response = send(&server(), None, &body).await;
    assert_eq!(response.status, 200);
    let result = &response.body.unwrap()["result"];
    assert_eq!(result["supportedVersions"], json!(["2026-07-28"]));
    assert!(result["instructions"].as_str().unwrap().contains("guide"));
    assert_eq!(result["cacheScope"], json!("private"));
    assert_eq!(
        result["_meta"]["io.modelcontextprotocol/serverInfo"]["name"],
        json!("courses-mooc-fi")
    );
}

#[tokio::test]
async fn tools_list_needs_a_token_and_follows_scopes() {
    let body =
        json!({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {"_meta": meta("x")}});
    let unauthenticated = send(&server(), None, &body).await;
    assert_eq!(unauthenticated.status, 401);
    assert!(
        unauthenticated
            .headers
            .iter()
            .any(|(n, v)| n == "WWW-Authenticate" && v.contains("resource_metadata"))
    );

    let read_only = send(&server(), Some(&principal(&[Scope::MaterialRead])), &body).await;
    let result = read_only.body.unwrap()["result"].clone();
    let names: Vec<&str> = result["tools"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["name"].as_str().unwrap())
        .collect();
    assert_eq!(names[0], "list_courses");
    assert!(names.contains(&"get_page_content"));
    assert!(!names.contains(&"patch_page_content"));
    assert_eq!(result["cacheScope"], json!("private"));
    assert!(result["ttlMs"].as_u64().unwrap() > 0);

    let everything = send(&server(), Some(&all_scopes()), &body).await;
    assert_eq!(
        everything.body.unwrap()["result"]["tools"]
            .as_array()
            .unwrap()
            .len(),
        19
    );
}

#[tokio::test]
async fn protocol_metadata_and_headers_are_required() {
    let body = json!({"jsonrpc": "2.0", "id": 3, "method": "tools/list", "params": {}});
    let response = send(&server(), Some(&all_scopes()), &body).await;
    assert_eq!((response.status, error_code(&response)), (400, -32602));

    let body =
        json!({"jsonrpc": "2.0", "id": 3, "method": "tools/list", "params": {"_meta": meta("x")}});
    let no_version_header = RequestHeaders::new([("Mcp-Method", "tools/list".to_string())]);
    let response = send_with(&server(), Some(&all_scopes()), &body, no_version_header).await;
    assert_eq!((response.status, error_code(&response)), (400, -32020));

    let call = call_body(
        "get_page_content",
        json!({"course": "c1", "page": "p"}),
        "x",
    );
    let wrong_course = RequestHeaders::new([
        ("MCP-Protocol-Version", "2026-07-28".to_string()),
        ("Mcp-Method", "tools/call".to_string()),
        ("Mcp-Name", "get_page_content".to_string()),
        ("Mcp-Param-Course", "c2".to_string()),
    ]);
    let response = send_with(&server(), Some(&all_scopes()), &call, wrong_course).await;
    assert_eq!(error_code(&response), -32020);
}

#[tokio::test]
async fn tool_call_returns_structured_content_with_hints_inside() {
    let response = send(
        &server(),
        Some(&all_scopes()),
        &call_body(
            "get_page_content",
            json!({"course": "c1", "page": "p"}),
            "claude-code",
        ),
    )
    .await;
    assert_eq!(response.status, 200);
    let result = response.body.unwrap()["result"].clone();
    assert_eq!(result["resultType"], json!("complete"));
    assert_eq!(result["isError"], json!(false));
    assert_eq!(result["structuredContent"]["client"], json!("ClaudeCode"));
    assert_eq!(
        result["structuredContent"]["hints"][0]["kind"],
        json!("skill_version")
    );
    let text: Value = serde_json::from_str(result["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(text, result["structuredContent"]);

    let current = send(
        &server(),
        Some(&all_scopes()),
        &call_body(
            "get_page_content",
            json!({"course": "c1", "page": "p", "skill_version": CURRENT_SKILL_VERSION}),
            "x",
        ),
    )
    .await;
    assert!(
        current.body.unwrap()["result"]["structuredContent"]
            .get("hints")
            .is_none()
    );
}

#[tokio::test]
async fn too_old_skill_is_a_tool_error() {
    let response = send(
        &server(),
        Some(&all_scopes()),
        &call_body(
            "get_page_content",
            json!({"course": "c1", "page": "p", "skill_version": "0.0.1"}),
            "x",
        ),
    )
    .await;
    let result = response.body.unwrap()["result"].clone();
    assert_eq!(result["isError"], json!(true));
    assert_eq!(
        result["structuredContent"]["error"]["code"],
        json!("outdated_skill")
    );
}

#[tokio::test]
async fn edit_errors_teach_in_the_result() {
    let response = send(
        &server(),
        Some(&all_scopes()),
        &call_body(
            "patch_page_content",
            json!({"course": "c1", "page": "p", "ops": []}),
            "x",
        ),
    )
    .await;
    let result = response.body.unwrap()["result"].clone();
    assert_eq!(result["isError"], json!(true));
    assert_eq!(
        result["structuredContent"]["error"]["fix"],
        json!("read the outline")
    );
}

#[tokio::test]
async fn missing_scope_is_403_and_unknown_tool_is_invalid_params() {
    let response = send(
        &server(),
        Some(&principal(&[Scope::MaterialRead])),
        &call_body(
            "patch_page_content",
            json!({"course": "c1", "page": "p", "ops": []}),
            "x",
        ),
    )
    .await;
    assert_eq!(response.status, 403);
    assert!(
        response
            .headers
            .iter()
            .any(|(_, v)| v.contains("insufficient_scope") && v.contains("material:stage"))
    );
    let unknown = send(
        &server(),
        Some(&all_scopes()),
        &call_body("nope", json!({}), "x"),
    )
    .await;
    assert_eq!(error_code(&unknown), -32602);
    let not_yet = send(
        &server(),
        Some(&all_scopes()),
        &call_body("list_courses", json!({}), "x"),
    )
    .await;
    assert_eq!(error_code(&not_yet), -32603);
}

#[tokio::test]
async fn confirmation_round_trip_with_signed_state() {
    let server = server();
    let arguments = json!({"course": "c1", "changeset": "cs1"});
    let first = send(
        &server,
        Some(&all_scopes()),
        &call_body("publish_changeset", arguments.clone(), "claude-code"),
    )
    .await;
    let result = first.body.unwrap()["result"].clone();
    assert_eq!(result["resultType"], json!("input_required"));
    assert_eq!(
        result["inputRequests"]["confirm"]["params"]["mode"],
        json!("url")
    );
    let state = result["requestState"].as_str().unwrap().to_string();

    let mut retry = call_body("publish_changeset", arguments.clone(), "claude-code");
    retry["params"]["requestState"] = json!(state);
    retry["params"]["inputResponses"] = json!({"confirm": {"action": "accept"}});
    let second = send(&server, Some(&all_scopes()), &retry).await;
    let result = second.body.unwrap()["result"].clone();
    assert_eq!(result["structuredContent"]["confirmed"], json!("accept"));
    assert_eq!(
        result["structuredContent"]["state"],
        json!({"changeset": "cs1"})
    );

    let mut other_args = call_body(
        "publish_changeset",
        json!({"course": "c1", "changeset": "cs2"}),
        "claude-code",
    );
    other_args["params"]["requestState"] = json!(state);
    assert_eq!(
        error_code(&send(&server, Some(&all_scopes()), &other_args).await),
        -32051
    );

    let mut other_user = retry.clone();
    other_user["params"]["requestState"] = json!(state);
    let mut someone_else = all_scopes();
    someone_else.user_id = Uuid::from_u128(1);
    assert_eq!(
        error_code(&send(&server, Some(&someone_else), &other_user).await),
        -32051
    );
}

#[tokio::test]
async fn codex_gets_the_text_fallback() {
    let response = send(
        &server(),
        Some(&all_scopes()),
        &call_body(
            "publish_changeset",
            json!({"course": "c1", "changeset": "cs1"}),
            "codex-mcp-client",
        ),
    )
    .await;
    let result = response.body.unwrap()["result"].clone();
    assert_eq!(result["resultType"], json!("complete"));
    assert_eq!(
        result["structuredContent"]["review_url"],
        json!("https://courses.mooc.fi/review/1")
    );
}

#[tokio::test]
async fn transport_edge_cases() {
    let server = server();
    let notification = json!({"jsonrpc": "2.0", "method": "notifications/cancelled", "params": {}});
    assert_eq!(send(&server, None, &notification).await.status, 202);
    let batch = json!([{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}]);
    assert_eq!(send(&server, None, &batch).await.status, 400);
    let get = server
        .handle(
            &(),
            None,
            HttpRequest {
                method: "GET",
                headers: RequestHeaders::default(),
                body: b"",
            },
            None,
        )
        .await;
    assert_eq!(get.status, 405);
    let garbage = server
        .handle(
            &(),
            None,
            HttpRequest {
                method: "POST",
                headers: RequestHeaders::default(),
                body: b"{",
            },
            None,
        )
        .await;
    assert_eq!(error_code(&garbage), -32700);
    let ping = json!({"jsonrpc": "2.0", "id": 9, "method": "ping", "params": {"_meta": meta("x")}});
    let response = send(&server, Some(&all_scopes()), &ping).await;
    assert_eq!((response.status, error_code(&response)), (404, -32601));
}
