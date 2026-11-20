use headless_lms_models::library::agent_changesets::PublishOutcome;
use headless_lms_models::library::oauth::mcp::McpScope;
use serde_json::json;

use crate::fixture::{Fixture, changeset_id};

#[tokio::test]
async fn reverting_a_published_call_restores_the_page() {
    let fixture = Fixture::new().await;
    let staged = fixture.edit_paragraph("Rewritten.").await;
    fixture.publish(&staged).await;

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
    fixture.publish(&reverted).await;
    assert_eq!(
        fixture.paragraph_text("published").await,
        json!("Loops repeat things.")
    );
}

#[tokio::test]
async fn reverting_a_settings_change_needs_settings_write() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    let staged = fixture
        .call(
            "patch_course_settings",
            json!({"course": course, "ops": [{"op": "replace", "path": "/course/is_unlisted", "value": true}]}),
        )
        .await;
    fixture.publish(&staged).await;

    let without_settings_write = fixture
        .respond(
            &[
                McpScope::MaterialRead,
                McpScope::MaterialStage,
                McpScope::MaterialPublish,
            ],
            "revert_change",
            json!({"course": course, "call": staged["call"]}),
            json!({}),
        )
        .await;
    assert_eq!(without_settings_write.status, 403);
    let body = without_settings_write.body.unwrap().to_string();
    assert!(body.contains("settings:write"), "{body}");
    let changesets = fixture
        .call("list_changesets", json!({"course": course}))
        .await;
    assert_eq!(changesets["open"], json!([]));

    let reverted = fixture
        .call(
            "revert_change",
            json!({"course": course, "call": staged["call"]}),
        )
        .await;
    assert_eq!(reverted["reverted_call"], staged["call"]);
}

#[tokio::test]
async fn reverting_a_revert_of_a_settings_change_needs_settings_write() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    let staged = fixture
        .call(
            "patch_course_settings",
            json!({"course": course, "ops": [{"op": "replace", "path": format!("/{}/certification_enabled", fixture.module_id), "value": true}]}),
        )
        .await;
    let reverted = fixture
        .call(
            "revert_change",
            json!({"course": course, "call": staged["call"]}),
        )
        .await;
    let without_settings_write = fixture
        .respond(
            &[
                McpScope::MaterialRead,
                McpScope::MaterialStage,
                McpScope::MaterialPublish,
            ],
            "revert_change",
            json!({"course": course, "call": reverted["call"]}),
            json!({}),
        )
        .await;
    assert_eq!(without_settings_write.status, 403);
}

#[tokio::test]
async fn a_revert_that_would_clash_with_a_later_path_stages_nothing() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    let removed = fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [{"op": "remove", "path": format!("/{}", fixture.page_id)}]}),
        )
        .await;
    let changeset = changeset_id(&removed);
    let revision = fixture.changeset_revision(changeset).await;
    let outcome = fixture.publish_reviewed(changeset, revision).await;
    assert!(
        matches!(outcome, PublishOutcome::Published { .. }),
        "{outcome:?}"
    );
    let chapter = fixture.live_state().await.chapters[0].id;
    fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [{"op": "add", "path": format!("/{chapter}/pages"), "position": "end", "value": {"title": "Loops", "blocks": [{"name": "core/paragraph", "attributes": {"content": "New."}}]}}]}),
        )
        .await;

    let reverted = fixture
        .call_result(
            "revert_change",
            json!({"course": course, "call": removed["call"]}),
        )
        .await;
    assert_eq!(reverted["isError"], json!(true), "{reverted}");
    let error = &reverted["structuredContent"]["error"];
    assert_eq!(error["code"], json!("revert_conflict"));
    assert!(
        error["blockers"].to_string().contains("/chapter-1/loops"),
        "{error}"
    );
}
