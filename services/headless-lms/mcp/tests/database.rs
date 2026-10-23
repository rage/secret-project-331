//! The tools against the test database, end to end through the protocol layer and the HTTP route.
//! Each test commits a fresh course of its own; set `DATABASE_URL_TEST` to use another database.

#![allow(clippy::unwrap_used)]

use std::sync::Arc;

use actix_web::{App, http::StatusCode, test, web};
use async_trait::async_trait;
use chrono::{Duration, Utc};
use futures::future::BoxFuture;
use headless_lms_base::{config::ApplicationConfiguration, jwt::JwtKey};
use headless_lms_mcp::{
    engine::glossary_references::BasicBibtexParser,
    http::{self, EndpointConfig, McpEndpoint, auth::McpAuth},
    protocol::{dispatch, headers::RequestHeaders},
    state::{ExerciseServiceClients, McpState, SpecFetcher},
    tools::{Principal, Scope},
    validator::{
        BlockSchemas, BlockValidator, ValidationOutcome, ValidationRequest, ValidatorError,
    },
};
use headless_lms_models::{
    ModelResult, PKeyPolicy,
    agent_changeset_entities::AgentChangesetEntityType,
    chapters::NewChapter,
    courses::NewCourse,
    exercise_service_info::ExerciseServiceInfoApi,
    feedback::{self, FeedbackBlock, NewFeedback},
    library::{
        content_management::{create_new_chapter, create_new_course},
        entity_snapshots,
        oauth::{mcp::all_mcp_scopes_string, token_digest_sha256},
    },
    oauth_access_token::{NewAccessTokenParams, OAuthAccessToken, TokenType},
    oauth_client::{MetadataDocumentClient, OAuthClient},
    oauth_user_client_scopes::OAuthUserClientScopes,
    organizations,
    pages::{self, NewPage, PageDetailsUpdate},
    proposed_block_edits::NewProposedBlockEdit,
    proposed_page_edits::{self, NewProposedPageEdits},
    roles::{self, RoleDomain, UserRole},
    users,
};
use headless_lms_utils::{
    document_schema_processor::GutenbergBlock, file_store::local_file_store::LocalFileStore,
};
use serde_json::{Map, Value, json};
use sqlx::{PgPool, postgres::PgPoolOptions};
use url::Url;
use uuid::Uuid;

const TEST_CLIENT_NAME: &str = "Test agent";

fn database_url() -> String {
    std::env::var("DATABASE_URL_TEST").unwrap_or_else(|_| {
        if std::env::var_os("KUBERNETES_SERVICE_HOST").is_some() {
            "postgres://headless-lms:only-for-local-development-intentionally-public@postgres/headless_lms_test".into()
        } else {
            "postgres://headless-lms@localhost:54328/headless_lms_test".into()
        }
    })
}

/// Accepts every block except ones containing `<script`, unchanged.
struct StubValidator;

#[async_trait]
impl BlockValidator for StubValidator {
    async fn validate_blocks(
        &self,
        request: &ValidationRequest<'_>,
    ) -> Result<ValidationOutcome, ValidatorError> {
        let serialized = serde_json::to_string(request.blocks).unwrap_or_default();
        if serialized.contains("<script") {
            return Ok(serde_json::from_value(json!({
                "valid": false,
                "errors": [{"clientId": null, "path": [], "code": "disallowed_markup", "message": "script isn't allowed", "fix": "remove it"}],
            }))
            .expect("valid outcome"));
        }
        Ok(ValidationOutcome {
            valid: true,
            blocks: request.blocks.to_vec(),
            errors: vec![],
        })
    }

    async fn block_schemas(&self) -> Result<BlockSchemas, ValidatorError> {
        Err(ValidatorError::Unavailable {
            reason: "stub".into(),
            retry_after: None,
        })
    }
}

fn no_spec<'a>(_: Url, _: &'a str, _: Option<&'a Value>) -> BoxFuture<'a, ModelResult<Value>> {
    Box::pin(async { panic!("the test pages have no exercises") })
}

fn no_service_info(_: Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> {
    Box::pin(async { panic!("the test pages have no exercises") })
}

fn exercise_services() -> ExerciseServiceClients {
    ExerciseServiceClients {
        spec_fetcher: Arc::new(|_| Box::new(no_spec) as SpecFetcher),
        fetch_service_info: Arc::new(no_service_info),
    }
}

struct Fixture {
    pool: PgPool,
    app_conf: ApplicationConfiguration,
    endpoint: Arc<McpEndpoint>,
    user_id: Uuid,
    course_id: Uuid,
    module_id: Uuid,
    page_id: Uuid,
    paragraph_id: Uuid,
}

impl Fixture {
    /// A live course with one chapter whose second page has one paragraph, and a teacher.
    async fn new() -> Self {
        let pool = PgPoolOptions::new()
            .max_connections(4)
            .connect(&database_url())
            .await
            .expect("the test database is reachable");
        let mut conn = pool.acquire().await.unwrap();
        let app_conf = ApplicationConfiguration::mock_conf().unwrap();
        let suffix = Uuid::new_v4().simple().to_string()[..12].to_string();
        let user_id = users::insert(
            &mut conn,
            PKeyPolicy::Generate,
            &format!("mcp-{suffix}@example.com"),
            None,
            None,
        )
        .await
        .unwrap();
        let organization_id = organizations::insert(
            &mut conn,
            PKeyPolicy::Generate,
            "MCP tests",
            &format!("mcp-{suffix}"),
            None,
            false,
        )
        .await
        .unwrap();
        let (course, _, _, module) = create_new_course(
            &mut conn,
            &app_conf,
            PKeyPolicy::Generate,
            NewCourse {
                name: format!("MCP {suffix}"),
                slug: format!("mcp-{suffix}"),
                organization_id,
                language_code: "en".to_string(),
                teacher_in_charge_name: "Teacher".to_string(),
                teacher_in_charge_email: format!("mcp-{suffix}@example.com"),
                description: "description".to_string(),
                is_draft: false,
                is_test_mode: false,
                is_unlisted: false,
                copy_user_permissions: false,
                is_joinable_by_code_only: false,
                join_code: None,
                ask_marketing_consent: false,
                flagged_answers_threshold: Some(3),
                can_add_chatbot: false,
            },
            user_id,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap();
        roles::insert(
            &mut conn,
            user_id,
            UserRole::Teacher,
            RoleDomain::Course(course.id),
        )
        .await
        .unwrap();
        let (chapter, _) = create_new_chapter(
            &mut conn,
            PKeyPolicy::Generate,
            &NewChapter {
                name: "Basics".to_string(),
                color: None,
                course_id: course.id,
                chapter_number: 1,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(module.id),
            },
            user_id,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap();
        let paragraph = GutenbergBlock::paragraph("Loops repeat things.");
        let paragraph_id = paragraph.client_id;
        let page = pages::insert_page(
            &mut conn,
            NewPage {
                exercises: vec![],
                exercise_slides: vec![],
                exercise_tasks: vec![],
                content: vec![paragraph],
                url_path: "/chapter-1/loops".to_string(),
                title: "Loops".to_string(),
                course_id: Some(course.id),
                exam_id: None,
                chapter_id: Some(chapter.id),
                front_page_of_chapter_id: None,
                content_search_language: None,
                hidden: false,
            },
            user_id,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap();
        drop(conn);

        let state = McpState::new(
            pool.clone(),
            app_conf.clone(),
            Arc::new(JwtKey::new(&app_conf.jwt_password).unwrap()),
            Arc::new(LocalFileStore {
                base_path: std::env::temp_dir().join("mcp-test-uploads"),
                base_url: "http://project-331.local/api/v0/files/uploads/".to_string(),
                cache_files_path: std::env::temp_dir(),
            }),
            Arc::new(StubValidator),
            Arc::new(BasicBibtexParser),
            exercise_services(),
        );
        let endpoint = McpEndpoint::new(
            state,
            EndpointConfig {
                server_version: "test".into(),
                resource_metadata_url:
                    "http://project-331.local/.well-known/oauth-protected-resource/api/v0/mcp"
                        .into(),
                request_state_secret: "a test secret".into(),
                current_skill_version: "0.1.0".into(),
                minimum_skill_version: "0.1.0".into(),
            },
        );
        Self {
            pool,
            app_conf,
            endpoint: Arc::new(endpoint),
            user_id,
            course_id: course.id,
            module_id: module.id,
            page_id: page.id,
            paragraph_id,
        }
    }

    fn principal(&self) -> Principal {
        Principal {
            user_id: self.user_id,
            scopes: vec![
                Scope::MaterialRead,
                Scope::MaterialStage,
                Scope::MaterialPublish,
                Scope::SettingsWrite,
            ],
            oauth_client_id: None,
            grant_id: None,
            client_name: Some(TEST_CLIENT_NAME.into()),
        }
    }

    /// The whole JSON-RPC result of a tool call; `client_capabilities` as the client declares them.
    async fn call_with(&self, tool: &str, arguments: Value, client_capabilities: Value) -> Value {
        let mut arguments = arguments;
        arguments["skill_version"] = json!("0.1.0");
        let body = request_body(tool, &arguments, client_capabilities);
        let response = self
            .endpoint
            .server
            .handle(
                &self.endpoint.state,
                Some(&self.principal()),
                dispatch::HttpRequest {
                    method: "POST",
                    headers: RequestHeaders::new(request_headers(tool, &arguments)),
                    body: &serde_json::to_vec(&body).unwrap(),
                },
                None,
            )
            .await;
        let body = response.body.expect("a response body");
        assert!(body.get("error").is_none(), "{tool} failed: {body}");
        body["result"].clone()
    }

    /// The structured result of a tool call that must succeed.
    async fn call(&self, tool: &str, arguments: Value) -> Value {
        let result = self.call_with(tool, arguments, json!({})).await;
        assert_eq!(result["isError"], json!(false), "{tool}: {result}");
        result["structuredContent"].clone()
    }

    async fn paragraph_text(&self, state: &str) -> Value {
        let read = self
            .call(
                "get_page_content",
                json!({
                    "course": self.course_id,
                    "page": self.page_id,
                    "selectors": [{"path": format!("/{}/attributes/content", self.paragraph_id), "state": state}],
                }),
            )
            .await;
        read["reads"][0]["value"].clone()
    }

    async fn edit_paragraph(&self, text: &str) -> Value {
        self.call(
            "patch_page_content",
            json!({
                "course": self.course_id,
                "page": self.page_id,
                "ops": [{"op": "replace", "path": format!("/{}/attributes/content", self.paragraph_id), "value": text}],
            }),
        )
        .await
    }
}

fn request_body(tool: &str, arguments: &Value, client_capabilities: Value) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool,
            "arguments": arguments,
            "_meta": {
                "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                "io.modelcontextprotocol/clientInfo": {"name": "test-client", "version": "1"},
                "io.modelcontextprotocol/clientCapabilities": client_capabilities,
            },
        },
    })
}

fn request_headers(tool: &str, arguments: &Value) -> Vec<(String, String)> {
    let mut headers = vec![
        ("MCP-Protocol-Version".to_string(), "2026-07-28".to_string()),
        ("Mcp-Method".to_string(), "tools/call".to_string()),
        ("Mcp-Name".to_string(), tool.to_string()),
    ];
    if let Some(course) = arguments.get("course").and_then(Value::as_str) {
        headers.push(("Mcp-Param-Course".to_string(), course.to_string()));
    }
    headers
}

#[tokio::test]
async fn page_edit_is_staged_read_back_and_published() {
    let fixture = Fixture::new().await;
    let staged = fixture
        .edit_paragraph("Loops repeat <em>things</em>.")
        .await;
    let changeset = staged["changeset"].clone();
    assert_eq!(staged["staged"][0]["entity_id"], json!(fixture.page_id));
    assert_eq!(staged["staged"][0]["operation"], json!("update"));

    assert_eq!(
        fixture.paragraph_text("staged").await,
        json!("Loops repeat <em>things</em>.")
    );
    assert_eq!(
        fixture.paragraph_text("published").await,
        json!("Loops repeat things.")
    );

    let published = fixture
        .call(
            "publish_changeset",
            json!({"course": fixture.course_id, "changeset": changeset}),
        )
        .await;
    assert_eq!(published["published"], json!(true), "{published}");
    assert_eq!(
        fixture.paragraph_text("published").await,
        json!("Loops repeat <em>things</em>.")
    );
    let mut conn = fixture.pool.acquire().await.unwrap();
    let version = entity_snapshots::latest_version(
        &mut conn,
        AgentChangesetEntityType::Page,
        fixture.page_id,
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(version.agent_client_name.as_deref(), Some(TEST_CLIENT_NAME));
}

#[tokio::test]
async fn risky_change_is_left_for_the_teacher() {
    let fixture = Fixture::new().await;
    let staged = fixture
        .call(
            "patch_course_structure",
            json!({"course": fixture.course_id, "ops": [{"op": "remove", "path": format!("/{}", fixture.page_id)}]}),
        )
        .await;
    assert_eq!(staged["staged"][0]["operation"], json!("delete"));
    assert_eq!(
        staged["staged"][0]["risk_reasons"][0]["code"],
        json!("visible_page_removed")
    );
    let arguments = json!({"course": fixture.course_id, "changeset": staged["changeset"]});

    let refused = fixture.call("publish_changeset", arguments.clone()).await;
    assert_eq!(refused["published"], json!(false));
    assert_eq!(refused["reason"], json!("needs_teacher_review"));
    assert!(
        refused["review_url"]
            .as_str()
            .unwrap()
            .contains("/agent-changesets/")
    );

    let elicited = fixture
        .call_with(
            "publish_changeset",
            arguments,
            json!({"elicitation": {"url": {}}}),
        )
        .await;
    assert_eq!(
        elicited["resultType"],
        json!("input_required"),
        "{elicited}"
    );
    assert!(elicited["requestState"].is_string());

    let structure = fixture
        .call(
            "get_course_structure",
            json!({"course": fixture.course_id, "selectors": [{"state": "published"}]}),
        )
        .await;
    assert!(structure.to_string().contains(&fixture.page_id.to_string()));
}

#[tokio::test]
async fn publish_is_refused_when_the_page_changed_live() {
    let fixture = Fixture::new().await;
    let staged = fixture.edit_paragraph("Staged text.").await;
    let mut conn = fixture.pool.acquire().await.unwrap();
    pages::update_page_details(
        &mut conn,
        fixture.page_id,
        &PageDetailsUpdate {
            title: "Renamed in the web UI".into(),
            url_path: "/chapter-1/loops".into(),
        },
    )
    .await
    .unwrap();

    let result = fixture
        .call_with(
            "publish_changeset",
            json!({"course": fixture.course_id, "changeset": staged["changeset"]}),
            json!({}),
        )
        .await;
    assert_eq!(result["isError"], json!(true));
    let error = &result["structuredContent"]["error"];
    assert_eq!(error["code"], json!("publish_conflict"));
    assert_eq!(error["conflicts"][0]["entity_id"], json!(fixture.page_id));
}

#[tokio::test]
async fn reverting_a_published_call_restores_the_page() {
    let fixture = Fixture::new().await;
    let staged = fixture.edit_paragraph("Rewritten.").await;
    fixture
        .call(
            "publish_changeset",
            json!({"course": fixture.course_id, "changeset": staged["changeset"]}),
        )
        .await;

    let history = fixture
        .call(
            "get_history",
            json!({"course": fixture.course_id, "entity": fixture.page_id}),
        )
        .await;
    assert_eq!(history["calls"][0]["call"], staged["call"]);
    assert_eq!(history["calls"][0]["changeset_status"], json!("published"));

    let reverted = fixture
        .call(
            "revert_change",
            json!({"course": fixture.course_id, "call": staged["call"]}),
        )
        .await;
    assert_eq!(reverted["reverted_call"], staged["call"]);
    assert_eq!(
        fixture.paragraph_text("staged").await,
        json!("Loops repeat things.")
    );
    fixture
        .call(
            "publish_changeset",
            json!({"course": fixture.course_id, "changeset": reverted["changeset"]}),
        )
        .await;
    assert_eq!(
        fixture.paragraph_text("published").await,
        json!("Loops repeat things.")
    );
}

#[tokio::test]
async fn invalid_blocks_stage_nothing() {
    let fixture = Fixture::new().await;
    let result = fixture
        .call_with(
            "patch_page_content",
            json!({
                "course": fixture.course_id,
                "page": fixture.page_id,
                "ops": [{"op": "replace", "path": format!("/{}/attributes/content", fixture.paragraph_id), "value": "<script>alert(1)</script>"}],
            }),
            json!({}),
        )
        .await;
    assert_eq!(result["isError"], json!(true));
    assert_eq!(
        result["structuredContent"]["error"]["code"],
        json!("invalid_blocks")
    );
    let changesets = fixture
        .call("list_changesets", json!({"course": fixture.course_id}))
        .await;
    assert_eq!(changesets["open"], json!([]));
}

/// A Bearer token for the MCP resource with `scopes`, through a client metadata document client.
async fn issue_token(fixture: &Fixture, scopes: &[&str]) -> String {
    let mut conn = fixture.pool.acquire().await.unwrap();
    let all_scopes: Vec<String> = all_mcp_scopes_string()
        .split(' ')
        .map(str::to_string)
        .collect();
    let client = OAuthClient::upsert_metadata_document_client(
        &mut conn,
        MetadataDocumentClient {
            client_id: &format!("https://agent.example.com/{}/client.json", Uuid::new_v4()),
            client_name: TEST_CLIENT_NAME,
            redirect_uris: &["http://127.0.0.1/callback".to_string()],
            client_uri: None,
            logo_uri: None,
            scopes: &all_scopes,
        },
    )
    .await
    .unwrap();
    let scopes: Vec<String> = scopes.iter().map(|s| s.to_string()).collect();
    OAuthUserClientScopes::insert(&mut conn, fixture.user_id, client.id, &scopes)
        .await
        .unwrap();
    let token = Uuid::new_v4().to_string();
    let digest = token_digest_sha256(
        &token,
        &fixture
            .app_conf
            .oauth_server_configuration
            .oauth_token_hmac_key,
    );
    let audience = vec![http::auth::mcp_resource_url(&fixture.app_conf)];
    OAuthAccessToken::insert(
        &mut conn,
        NewAccessTokenParams {
            digest: &digest,
            user_id: Some(fixture.user_id),
            client_id: client.id,
            scopes: &scopes,
            audience: Some(&audience),
            token_type: TokenType::Bearer,
            dpop_jkt: None,
            metadata: Map::new(),
            expires_at: Utc::now() + Duration::minutes(15),
        },
    )
    .await
    .unwrap();
    token
}

fn rpc_request(method: &str, params: Value, token: Option<&str>) -> test::TestRequest {
    let mut params = params;
    params["_meta"] = json!({
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": {"name": "test-client", "version": "1"},
        "io.modelcontextprotocol/clientCapabilities": {},
    });
    let mut request = test::TestRequest::post()
        .uri("/api/v0/mcp")
        .insert_header(("MCP-Protocol-Version", "2026-07-28"))
        .insert_header(("Mcp-Method", method))
        .set_json(json!({"jsonrpc": "2.0", "id": 1, "method": method, "params": params.clone()}));
    if let Some(name) = params["name"].as_str() {
        request = request.insert_header(("Mcp-Name", name.to_string()));
    }
    if let Some(course) = params["arguments"]["course"].as_str() {
        request = request.insert_header(("Mcp-Param-Course", course.to_string()));
    }
    if let Some(token) = token {
        request = request.insert_header(("Authorization", format!("Bearer {token}")));
    }
    request
}

#[actix_web::test]
async fn the_route_takes_oauth_tokens_and_enforces_their_scopes() {
    let fixture = Fixture::new().await;
    let read_only_token = issue_token(&fixture, &["material:read"]).await;
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(fixture.pool.clone()))
            .app_data(web::Data::new(fixture.app_conf.clone()))
            .app_data(web::Data::from(fixture.endpoint.clone()))
            .service(
                web::scope("/api/v0/mcp")
                    .wrap(McpAuth::new(true))
                    .configure(http::configure),
            ),
    )
    .await;

    let anonymous = test::call_service(
        &app,
        rpc_request("tools/list", json!({}), None).to_request(),
    )
    .await;
    assert_eq!(anonymous.status(), StatusCode::UNAUTHORIZED);
    let challenge = anonymous
        .headers()
        .get("WWW-Authenticate")
        .unwrap()
        .to_str()
        .unwrap();
    assert!(challenge.contains("resource_metadata="), "{challenge}");

    let listed: Value = test::call_and_read_body_json(
        &app,
        rpc_request("tools/list", json!({}), Some(&read_only_token)).to_request(),
    )
    .await;
    let names: Vec<&str> = listed["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["name"].as_str().unwrap())
        .collect();
    assert!(names.contains(&"get_page_content"));
    assert!(!names.contains(&"patch_page_content"));
    assert!(!names.contains(&"publish_changeset"));

    let write = test::call_service(
        &app,
        rpc_request(
            "tools/call",
            json!({"name": "patch_page_content", "arguments": {"course": fixture.course_id.to_string(), "page": fixture.page_id, "ops": []}}),
            Some(&read_only_token),
        )
        .to_request(),
    )
    .await;
    assert_eq!(write.status(), StatusCode::FORBIDDEN);
    let challenge = write
        .headers()
        .get("WWW-Authenticate")
        .unwrap()
        .to_str()
        .unwrap();
    assert!(challenge.contains("insufficient_scope"), "{challenge}");

    let read: Value = test::call_and_read_body_json(
        &app,
        rpc_request(
            "tools/call",
            json!({"name": "get_course_structure", "arguments": {"course": fixture.course_id.to_string()}}),
            Some(&read_only_token),
        )
        .to_request(),
    )
    .await;
    assert_eq!(read["result"]["isError"], json!(false), "{read}");
    assert!(read.to_string().contains(&fixture.page_id.to_string()));

    let courses: Value = test::call_and_read_body_json(
        &app,
        rpc_request(
            "tools/call",
            json!({"name": "list_courses", "arguments": {}}),
            Some(&read_only_token),
        )
        .to_request(),
    )
    .await;
    assert_eq!(
        courses["result"]["structuredContent"]["courses"][0]["id"],
        json!(fixture.course_id),
        "{courses}"
    );
}

#[tokio::test]
async fn structure_settings_and_glossary_edits_publish_together() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    let structure = fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [
                {"op": "add", "path": format!("/{}/chapters", fixture.module_id), "position": "end", "value": {"label": "$ch", "name": "Recursion"}},
                {"op": "add", "path": "/$ch/pages", "position": "end", "value": {"label": "$pg", "title": "Base cases", "blocks": [{"name": "core/paragraph", "attributes": {"content": "Stop somewhere."}}]}},
            ]}),
        )
        .await;
    let labels = &structure["labels"];
    let new_page = labels["$pg"].as_str().unwrap().to_string();
    fixture
        .call(
            "patch_page_content",
            json!({"course": course, "page": fixture.page_id, "ops": [
                {"op": "move", "from": format!("/{}", fixture.paragraph_id), "to_page": new_page, "path": "", "position": "end"},
            ]}),
        )
        .await;
    let settings = fixture
        .call(
            "patch_course_settings",
            json!({"course": course, "ops": [{"op": "replace", "path": "/course/is_unlisted", "value": true}]}),
        )
        .await;
    fixture
        .call(
            "patch_course_glossary_and_references",
            json!({"course": course, "ops": [{"op": "add", "path": "/glossary", "value": {"term": "Recursion", "definition": "A function calling itself."}}]}),
        )
        .await;
    let replaced = fixture
        .call(
            "find_replace",
            json!({"course": course, "find": "Stop", "replace": "Halt"}),
        )
        .await;
    assert_eq!(replaced["total"], json!(1), "{replaced}");
    let wrapped = fixture
        .call(
            "structural_replace",
            json!({"course": course, "match": {"name": "core/paragraph", "text_starts_with": "Halt"}, "action": {"wrap_in": "moocfi/infobox"}, "expected_count": 1}),
        )
        .await;
    assert_eq!(wrapped["total"], json!(1), "{wrapped}");

    let mut conn = fixture.pool.acquire().await.unwrap();
    let feedback_id = feedback::insert(
        &mut conn,
        PKeyPolicy::Generate,
        Some(fixture.user_id),
        course,
        NewFeedback {
            feedback_given: "Unclear".to_string(),
            selected_text: None,
            related_blocks: vec![FeedbackBlock {
                id: fixture.paragraph_id,
                text: None,
                order_number: None,
            }],
            page_id: fixture.page_id,
            category: None,
        },
    )
    .await
    .unwrap();
    let (proposal_id, _) = proposed_page_edits::insert(
        &mut conn,
        PKeyPolicy::Generate,
        course,
        Some(fixture.user_id),
        &NewProposedPageEdits {
            page_id: fixture.page_id,
            block_edits: vec![NewProposedBlockEdit {
                block_id: fixture.paragraph_id,
                block_attribute: "content".to_string(),
                original_text: "Stop".to_string(),
                changed_text: "Halt".to_string(),
            }],
        },
    )
    .await
    .unwrap();

    let published = fixture
        .call(
            "publish_changeset",
            json!({"course": course, "changeset": settings["changeset"]}),
        )
        .await;
    assert_eq!(published["published"], json!(true), "{published}");

    let new_page_id: Uuid = new_page.parse().unwrap();
    let feedback = feedback::get_by_id(&mut conn, feedback_id).await.unwrap();
    assert_eq!(feedback.page_id, Some(new_page_id));
    let proposal = proposed_page_edits::get_by_id(&mut conn, proposal_id)
        .await
        .unwrap();
    assert_eq!(proposal.page_id, new_page_id);

    let live = fixture
        .call(
            "get_course_structure",
            json!({"course": course, "selectors": [{"path": format!("/{}", labels["$ch"].as_str().unwrap()), "mode": "raw", "state": "published"}]}),
        )
        .await;
    let chapter = &live["reads"][0]["items"][0];
    assert_eq!(chapter["name"], json!("Recursion"), "{live}");
    assert_eq!(chapter["pages"].as_array().unwrap().len(), 2, "{live}");
    let new_page_content = fixture
        .call(
            "get_page_content",
            json!({"course": course, "page": new_page, "selectors": [{"mode": "raw", "state": "published"}]}),
        )
        .await;
    let text = new_page_content.to_string();
    assert!(text.contains("Halt somewhere."), "{text}");
    assert!(text.contains("moocfi/infobox"), "{text}");
    assert!(text.contains(&fixture.paragraph_id.to_string()), "{text}");
    let old_page = fixture
        .call(
            "get_page_content",
            json!({"course": course, "page": fixture.page_id, "selectors": [{"state": "published"}]}),
        )
        .await;
    assert!(
        !old_page
            .to_string()
            .contains(&fixture.paragraph_id.to_string())
    );

    let settings = fixture
        .call("get_course_settings", json!({"course": course}))
        .await;
    assert_eq!(settings["settings"]["course"]["is_unlisted"], json!(true));
    let glossary = fixture
        .call(
            "get_course_glossary_and_references",
            json!({"course": course}),
        )
        .await;
    assert_eq!(glossary["glossary"][0]["term"], json!("Recursion"));
    assert_eq!(glossary["staged_changes"], json!([]));
}

#[tokio::test]
async fn uploads_preview_links_and_discard() {
    let fixture = Fixture::new().await;
    let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";
    let uploaded = fixture
        .call(
            "upload_file",
            json!({"course": fixture.course_id, "file_name": "dot.png", "content_base64": png}),
        )
        .await;
    assert_eq!(uploaded["mime_type"], json!("image/png"));
    assert!(uploaded["url"].as_str().unwrap().ends_with(".png"));

    let unstaged = fixture
        .call(
            "get_preview_link",
            json!({"course": fixture.course_id, "page": fixture.page_id}),
        )
        .await;
    assert_eq!(unstaged["is_staged"], json!(false));

    let staged = fixture.edit_paragraph("Draft text.").await;
    let preview = fixture
        .call(
            "get_preview_link",
            json!({"course": fixture.course_id, "page": fixture.page_id}),
        )
        .await;
    assert!(
        preview["url"]
            .as_str()
            .unwrap()
            .starts_with("http://project-331.local/agent-preview/")
    );

    let discarded = fixture
        .call(
            "discard_changeset",
            json!({"course": fixture.course_id, "changeset": staged["changeset"]}),
        )
        .await;
    assert_eq!(discarded["status"], json!("discarded"));
    assert_eq!(
        fixture.paragraph_text("staged").await,
        json!("Loops repeat things.")
    );
}
