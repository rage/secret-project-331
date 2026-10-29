use async_trait::async_trait;
use headless_lms_models::agent_changeset_calls::CallActor;
use pretty_assertions::assert_eq;
use serde_json::{Value, json};
use uuid::Uuid;

use super::*;
use crate::engine::{EditError, EditErrorCode};
use crate::hints::CURRENT_SKILL_VERSION;
use crate::protocol::PROTOCOL_VERSION;
use crate::test_support;
use crate::tools::args::{ChangesetArgs, GetPageContentArgs, PatchPageContentArgs};
use crate::tools::{McpScope, ToolHandler, catalog};

const COURSE: &str = "00000000-0000-4000-8000-0000000000c1";
const OTHER_COURSE: &str = "00000000-0000-4000-8000-0000000000c2";
const PAGE: &str = "00000000-0000-4000-8000-0000000000a1";
const CHANGESET: &str = "00000000-0000-4000-8000-0000000000e1";
const OTHER_CHANGESET: &str = "00000000-0000-4000-8000-0000000000e2";

struct Echo;

#[async_trait(?Send)]
impl ToolHandler<()> for Echo {
    type Args = GetPageContentArgs;

    async fn call(
        &self,
        _: &(),
        ctx: &RequestContext,
        args: GetPageContentArgs,
    ) -> Result<ToolOutcome, ToolError> {
        Ok(ToolResult::success(json!({
            "course": args.course.id(),
            "client": format!("{:?}", ctx.client.client_kind()),
        }))
        .into())
    }
}

struct Failing;

#[async_trait(?Send)]
impl ToolHandler<()> for Failing {
    type Args = PatchPageContentArgs;

    async fn call(
        &self,
        _: &(),
        _: &RequestContext,
        _: PatchPageContentArgs,
    ) -> Result<ToolOutcome, ToolError> {
        Err(EditError::new(EditErrorCode::NotFound, "no block")
            .with_fix("read the outline")
            .into())
    }
}

struct Confirming;

#[async_trait(?Send)]
impl ToolHandler<()> for Confirming {
    type Args = ChangesetArgs;
    const ASKS_FOR_CONFIRMATION: bool = true;

    async fn call(
        &self,
        _: &(),
        ctx: &RequestContext,
        _: ChangesetArgs,
    ) -> Result<ToolOutcome, ToolError> {
        if let Some(retry) = &ctx.retry {
            return Ok(
                ToolResult::success(json!({"confirmed": retry.confirmation_action()})).into(),
            );
        }
        Ok(ToolOutcome::NeedsConfirmation(ConfirmationRequest {
            message: "Confirm publishing".into(),
            url: "https://courses.mooc.fi/review/1".into(),
            elicitation_id: "e1".into(),
            fallback: ToolResult::success(
                json!({"review_url": "https://courses.mooc.fi/review/1"}),
            ),
        }))
    }
}

fn server() -> McpServer<()> {
    let registry = ToolRegistry::new(vec![
        catalog::get_page_content(Echo),
        catalog::patch_page_content(Failing),
        catalog::publish_changeset(Confirming),
    ]);
    McpServer::new(
        registry,
        ServerConfig {
            server_version: "1.0.0".into(),
            resource_metadata_url:
                "https://courses.mooc.fi/.well-known/oauth-protected-resource/api/v0/mcp".into(),
            request_state_codec: RequestStateCodec::try_new(
                b"0123456789abcdef0123456789abcdef".to_vec(),
            )
            .unwrap(),
        },
    )
}

fn principal(scopes: &[McpScope]) -> McpPrincipal {
    McpPrincipal {
        actor: CallActor {
            user_id: Uuid::from_u128(0x5e1f),
            oauth_client_id: Uuid::from_u128(0xc11e),
            oauth_grant_id: Uuid::from_u128(0x6a47),
            client_name: "Claude Code".into(),
        },
        scopes: scopes.to_vec(),
    }
}

fn all_scopes() -> McpPrincipal {
    principal(&McpScope::ALL)
}

fn meta(client: &str) -> Value {
    test_support::request_meta(client, json!({"elicitation": {"url": {}}}))
}

fn call_body(tool: &str, arguments: Value, client: &str) -> Value {
    test_support::call_body(tool, arguments, meta(client))
}

fn headers_for(body: &Value) -> RequestHeaders {
    RequestHeaders::new(test_support::request_headers(body))
}

async fn send(server: &McpServer<()>, principal: &McpPrincipal, body: &Value) -> HttpResponse {
    send_with(server, principal, body, headers_for(body)).await
}

async fn send_with(
    server: &McpServer<()>,
    principal: &McpPrincipal,
    body: &Value,
    headers: RequestHeaders,
) -> HttpResponse {
    server
        .handle(
            &(),
            principal,
            HttpRequest {
                method: "POST".into(),
                headers,
                body: Ok(body.clone()),
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
    let response = send(&server(), &all_scopes(), &body).await;
    assert_eq!(response.status, 400);
    assert_eq!(error_code(&response), -32022);
    let error = &response.body.unwrap()["error"];
    assert_eq!(error["data"]["supported"], json!(["2026-07-28"]));
    assert!(error["message"].as_str().unwrap().contains("Codex"));

    let mut call = call_body("get_page_content", json!({"course": "c", "page": "p"}), "x");
    call["params"]["_meta"]["io.modelcontextprotocol/protocolVersion"] = json!("2025-11-25");
    assert_eq!(
        error_code(&send(&server(), &all_scopes(), &call).await),
        -32022
    );
}

#[tokio::test]
async fn discover_describes_the_server() {
    let body = json!({"jsonrpc": "2.0", "id": "a", "method": "server/discover", "params": {"_meta": meta("x")}});
    let response = send(&server(), &all_scopes(), &body).await;
    assert_eq!(response.status, 200);
    let result = &response.body.unwrap()["result"];
    assert_eq!(result["supportedVersions"], json!(["2026-07-28"]));
    assert!(result["instructions"].as_str().unwrap().contains("guide"));
    assert_eq!(result["cacheScope"], json!("private"));
    assert_eq!(
        result["_meta"]["io.modelcontextprotocol/serverInfo"]["name"],
        json!("courses-moocfi")
    );
}

#[tokio::test]
async fn tools_list_follows_scopes() {
    let body =
        json!({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {"_meta": meta("x")}});
    let read_only = send(&server(), &principal(&[McpScope::MaterialRead]), &body).await;
    let result = read_only.body.unwrap()["result"].clone();
    let names: Vec<&str> = result["tools"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["name"].as_str().unwrap())
        .collect();
    assert_eq!(names, ["get_page_content"]);
    assert_eq!(result["cacheScope"], json!("private"));
    assert!(result["ttlMs"].as_u64().unwrap() > 0);

    let everything = send(&server(), &all_scopes(), &body).await;
    let names: Vec<Value> = everything.body.unwrap()["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["name"].clone())
        .collect();
    assert_eq!(
        names,
        [
            json!("get_page_content"),
            json!("patch_page_content"),
            json!("publish_changeset")
        ]
    );
}

#[tokio::test]
async fn protocol_metadata_and_headers_are_required() {
    let body = json!({"jsonrpc": "2.0", "id": 3, "method": "tools/list", "params": {}});
    let response = send(&server(), &all_scopes(), &body).await;
    assert_eq!((response.status, error_code(&response)), (400, -32602));

    let body =
        json!({"jsonrpc": "2.0", "id": 3, "method": "tools/list", "params": {"_meta": meta("x")}});
    let no_version_header = RequestHeaders::new([("Mcp-Method", "tools/list".to_string())]);
    let response = send_with(&server(), &all_scopes(), &body, no_version_header).await;
    assert_eq!((response.status, error_code(&response)), (400, -32020));

    let call = call_body(
        "get_page_content",
        json!({"course": COURSE, "page": PAGE}),
        "x",
    );
    let wrong_course = RequestHeaders::new([
        ("MCP-Protocol-Version", PROTOCOL_VERSION.to_string()),
        ("Mcp-Method", "tools/call".to_string()),
        ("Mcp-Name", "get_page_content".to_string()),
        ("Mcp-Param-Course", OTHER_COURSE.to_string()),
    ]);
    let response = send_with(&server(), &all_scopes(), &call, wrong_course).await;
    assert_eq!(error_code(&response), -32020);
}

#[tokio::test]
async fn tool_call_returns_structured_content_with_hints_inside() {
    let response = send(
        &server(),
        &all_scopes(),
        &call_body(
            "get_page_content",
            json!({"course": COURSE, "page": PAGE}),
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
        &all_scopes(),
        &call_body(
            "get_page_content",
            json!({"course": COURSE, "page": PAGE, "skill_version": CURRENT_SKILL_VERSION.to_string()}),
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
async fn ids_may_start_with_a_slash_and_must_be_uuids() {
    let with_slash = send(
        &server(),
        &all_scopes(),
        &call_body(
            "get_page_content",
            json!({"course": COURSE, "page": format!("/{PAGE}")}),
            "x",
        ),
    )
    .await;
    assert_eq!(with_slash.body.unwrap()["result"]["isError"], json!(false));

    let not_an_id = send(
        &server(),
        &all_scopes(),
        &call_body(
            "get_page_content",
            json!({"course": COURSE, "page": "p1"}),
            "x",
        ),
    )
    .await;
    let error = not_an_id.body.unwrap()["result"]["structuredContent"]["error"].clone();
    assert_eq!(error["code"], json!("invalid_arguments"));
    assert!(
        error["message"].as_str().unwrap().contains("\"p1\""),
        "{error}"
    );
}

#[tokio::test]
async fn edit_errors_teach_in_the_result() {
    let response = send(
        &server(),
        &all_scopes(),
        &call_body(
            "patch_page_content",
            json!({"course": COURSE, "page": PAGE, "ops": []}),
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
        &principal(&[McpScope::MaterialRead]),
        &call_body(
            "patch_page_content",
            json!({"course": COURSE, "page": PAGE, "ops": []}),
            "x",
        ),
    )
    .await;
    assert_eq!(response.status, 403);
    assert!(
        response
            .headers
            .iter()
            .any(|(_, v)| v.contains("insufficient_scope")
                && v.contains(r#"scope="material:read material:stage""#)),
        "{:?}",
        response.headers
    );
    let unknown = send(&server(), &all_scopes(), &call_body("nope", json!({}), "x")).await;
    assert_eq!(error_code(&unknown), -32602);
}

#[tokio::test]
async fn confirmation_round_trip_with_signed_state() {
    let server = server();
    let arguments = json!({"course": COURSE, "changeset": CHANGESET});
    let first = send(
        &server,
        &all_scopes(),
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
    let second = send(&server, &all_scopes(), &retry).await;
    let result = second.body.unwrap()["result"].clone();
    assert_eq!(result["structuredContent"]["confirmed"], json!("accept"));

    let mut other_args = call_body(
        "publish_changeset",
        json!({"course": COURSE, "changeset": OTHER_CHANGESET}),
        "claude-code",
    );
    other_args["params"]["requestState"] = json!(state);
    assert_eq!(
        error_code(&send(&server, &all_scopes(), &other_args).await),
        -32051
    );

    let mut other_user = retry.clone();
    other_user["params"]["requestState"] = json!(state);
    let mut someone_else = all_scopes();
    someone_else.actor.user_id = Uuid::from_u128(1);
    assert_eq!(
        error_code(&send(&server, &someone_else, &other_user).await),
        -32051
    );
}

#[tokio::test]
async fn codex_gets_the_text_fallback() {
    let response = send(
        &server(),
        &all_scopes(),
        &call_body(
            "publish_changeset",
            json!({"course": COURSE, "changeset": CHANGESET}),
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
    assert_eq!(
        send(&server, &all_scopes(), &notification).await.status,
        202
    );
    let batch = json!([{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}]);
    assert_eq!(send(&server, &all_scopes(), &batch).await.status, 400);
    let get = server
        .handle(
            &(),
            &all_scopes(),
            HttpRequest {
                method: "GET".into(),
                headers: RequestHeaders::default(),
                body: Ok(Value::Null),
            },
            None,
        )
        .await;
    assert_eq!(get.status, 405);
    let garbage = server
        .handle(
            &(),
            &all_scopes(),
            HttpRequest {
                method: "POST".into(),
                headers: RequestHeaders::default(),
                body: serde_json::from_slice(b"{"),
            },
            None,
        )
        .await;
    assert_eq!(error_code(&garbage), -32700);
    let ping = json!({"jsonrpc": "2.0", "id": 9, "method": "ping", "params": {"_meta": meta("x")}});
    let response = send(&server, &all_scopes(), &ping).await;
    assert_eq!((response.status, error_code(&response)), (404, -32601));
}

#[tokio::test]
async fn requests_with_an_unusable_id_are_invalid_and_responses_are_accepted() {
    for id in [json!(null), json!(true), json!({"a": 1}), json!([1])] {
        let body = json!({"jsonrpc": "2.0", "id": id, "method": "tools/list", "params": {"_meta": meta("x")}});
        let response = send(&server(), &all_scopes(), &body).await;
        assert_eq!(response.status, 400, "{id}");
        assert_eq!(error_code(&response), -32600);
        assert_eq!(response.body.unwrap()["id"], json!(null));
    }
    let without_method = json!({"jsonrpc": "2.0", "id": 1});
    assert_eq!(
        send(&server(), &all_scopes(), &without_method).await.status,
        400
    );
    let notification = json!({"jsonrpc": "2.0", "method": "notifications/initialized"});
    assert_eq!(
        send(&server(), &all_scopes(), &notification).await.status,
        202
    );
    let response = json!({"jsonrpc": "2.0", "id": 1, "result": {}});
    assert_eq!(send(&server(), &all_scopes(), &response).await.status, 202);
}
