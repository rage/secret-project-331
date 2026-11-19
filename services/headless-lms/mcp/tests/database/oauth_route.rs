use actix_web::{App, http::StatusCode, middleware::from_fn, test, web};
use chrono::{Duration, Utc};
use headless_lms_mcp::{
    http,
    test_support::{CURRENT_SKILL_VERSION, request_body, request_headers, request_meta},
};
use headless_lms_models::{
    library::oauth::token_digest_sha256,
    oauth_access_token::{NewAccessTokenParams, OAuthAccessToken, TokenType},
};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::fixture::Fixture;

/// A Bearer token for the MCP resource with `scopes`, issued to the fixture's agent client.
async fn issue_token(fixture: &Fixture, scopes: &[&str]) -> String {
    let mut conn = fixture.pool.acquire().await.unwrap();
    let scopes: Vec<String> = scopes.iter().map(|s| s.to_string()).collect();
    let token = Uuid::new_v4().to_string();
    let digest = token_digest_sha256(
        &token,
        &fixture
            .app_conf
            .oauth_server_configuration
            .oauth_token_hmac_key,
    );
    OAuthAccessToken::insert(
        &mut conn,
        NewAccessTokenParams {
            digest: &digest,
            user_id: Some(fixture.user_id),
            client_id: fixture.oauth_client_id,
            scopes: &scopes,
            audience: Some(&[fixture.app_conf.mcp_resource_url()]),
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
    let body = request_body(method, params, request_meta("test-client", json!({})));
    let mut request = test::TestRequest::post().uri("/api/v0/mcp");
    for header in request_headers(&body) {
        request = request.insert_header(header);
    }
    if let Some(token) = token {
        request = request.insert_header(("Authorization", format!("Bearer {token}")));
    }
    request.set_json(body)
}

#[actix_web::test]
async fn the_route_takes_oauth_tokens_and_enforces_their_scopes() {
    let fixture = Fixture::new().await;
    let read_only_token = issue_token(&fixture, &["material:read"]).await;
    let app = test::init_service(
        App::new()
            .app_data(web::Data::from(fixture.endpoint.clone()))
            .service(
                web::scope("/api/v0/mcp")
                    .wrap(from_fn(http::auth::authenticate))
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
            json!({"name": "patch_page_content", "arguments": {"course": fixture.course_id.to_string(), "page": fixture.page_id, "ops": [], "skill_version": CURRENT_SKILL_VERSION.to_string()}}),
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
            json!({"name": "get_course_structure", "arguments": {"course": fixture.course_id.to_string(), "skill_version": CURRENT_SKILL_VERSION.to_string()}}),
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
            json!({"name": "list_courses", "arguments": {"skill_version": CURRENT_SKILL_VERSION.to_string()}}),
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
