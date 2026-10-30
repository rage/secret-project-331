use std::collections::HashMap;

use headless_lms_models::{
    agent_changeset_entities::{self, AgentChangesetEntity},
    agent_changesets,
    library::{
        agent_changesets::{
            PublishOptions, PublishOutcome, PublishRejection, RiskBaseline, StageCall,
            StageCallOutcome, StagedEntity, StagedStateRead, publish, stage_call,
        },
        entity_snapshots::{self, ContentEntityType, EntityKey, EntitySnapshot},
    },
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::fixture::{Fixture, changeset_id, no_service_info, no_spec};

/// What a call read when it built on `row` of the open changeset.
fn read_of(changeset: Uuid, row: &AgentChangesetEntity) -> StagedStateRead {
    StagedStateRead {
        changeset_id: Some(changeset),
        entity_revisions: [(row.key(), row.revision)].into(),
        live_snapshots: HashMap::new(),
    }
}

#[tokio::test]
async fn publish_is_refused_when_the_page_changed_live() {
    let fixture = Fixture::new().await;
    let staged = fixture.edit_paragraph("Staged text.").await;
    let mut conn = fixture.pool.acquire().await.unwrap();
    fixture.rename_page_live(&mut conn).await;

    let result = fixture
        .call_result(
            "publish_changeset",
            json!({"course": fixture.course_id, "changeset": staged["changeset"]}),
        )
        .await;
    assert_eq!(result["isError"], json!(true));
    let error = &result["structuredContent"]["error"];
    assert_eq!(error["code"], json!("publish_conflict"));
    assert_eq!(error["conflicts"][0]["entity_id"], json!(fixture.page_id));
}

#[tokio::test]
async fn a_changeset_closed_mid_call_takes_nothing() {
    let fixture = Fixture::new().await;
    let staged = fixture.edit_paragraph("First edit.").await;
    let changeset = changeset_id(&staged);
    let mut conn = fixture.pool.acquire().await.unwrap();
    let row = agent_changeset_entities::get_one(
        &mut conn,
        changeset,
        EntityKey::new(ContentEntityType::Page, fixture.page_id),
    )
    .await
    .unwrap()
    .unwrap();
    let read = read_of(changeset, &row);

    let mut publisher = fixture.pool.begin().await.unwrap();
    agent_changesets::get_by_id_for_update(&mut publisher, changeset)
        .await
        .unwrap();
    let pool = fixture.pool.clone();
    let (course_id, page_id) = (fixture.course_id, fixture.page_id);
    let after = row.after_snapshot.clone();
    let actor = fixture.actor();
    let stage = tokio::spawn(async move {
        let mut conn = pool.acquire().await.unwrap();
        stage_call(
            &mut conn,
            StageCall {
                actor: &actor,
                course_id,
                tool_name: "patch_page_content",
                ops: &json!([]),
                summary: None,
                entities: vec![StagedEntity::new(
                    EntityKey::new(ContentEntityType::Page, page_id),
                    after,
                )],
                revert_of_call_id: None,
                read: &read,
                risk: &RiskBaseline::Current,
            },
        )
        .await
        .unwrap()
    });
    // Gives the call time to block on the lock; it must stage nothing in either order.
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    agent_changesets::mark_published(&mut publisher, changeset)
        .await
        .unwrap();
    publisher.commit().await.unwrap();

    let outcome = stage.await.unwrap();
    assert!(
        matches!(outcome, StageCallOutcome::ChangesetClosed),
        "{outcome:?}"
    );
    assert!(
        agent_changesets::get_open(&mut conn, fixture.user_id, fixture.course_id)
            .await
            .unwrap()
            .is_none()
    );

    let result = fixture
        .call_result("patch_page_content", json!({
                "course": fixture.course_id,
                "page": fixture.page_id,
                "ops": [{"op": "replace", "path": format!("/{}/attributes/content", fixture.paragraph_id), "value": "Second edit."}],
            }))
        .await;
    assert_eq!(result["isError"], json!(false), "{result}");
}

#[tokio::test]
async fn a_write_built_on_an_outdated_staged_state_is_refused() {
    let fixture = Fixture::new().await;
    let staged = fixture.edit_paragraph("First edit.").await;
    let changeset = changeset_id(&staged);
    let mut conn = fixture.pool.acquire().await.unwrap();
    let first = agent_changeset_entities::get_one(
        &mut conn,
        changeset,
        EntityKey::new(ContentEntityType::Page, fixture.page_id),
    )
    .await
    .unwrap()
    .unwrap();
    let outdated_read = read_of(changeset, &first);
    fixture.edit_paragraph("Parallel edit.").await;

    let actor = fixture.actor();
    let page_call = |read| StageCall {
        actor: &actor,
        course_id: fixture.course_id,
        tool_name: "patch_page_content",
        ops: &Value::Null,
        summary: None,
        entities: vec![StagedEntity::new(
            EntityKey::new(ContentEntityType::Page, fixture.page_id),
            first.after_snapshot.clone(),
        )],
        revert_of_call_id: None,
        read,
        risk: &RiskBaseline::Current,
    };
    let outcome = stage_call(&mut conn, page_call(&outdated_read))
        .await
        .unwrap();
    match outcome {
        StageCallOutcome::StaleRead { entities } => {
            assert_eq!(
                entities,
                vec![EntityKey::new(ContentEntityType::Page, fixture.page_id)]
            )
        }
        other => panic!("expected a stale read, got {other:?}"),
    }
    assert_eq!(
        fixture.paragraph_text("staged").await,
        json!("Parallel edit.")
    );

    let current = agent_changeset_entities::get_one(
        &mut conn,
        changeset,
        EntityKey::new(ContentEntityType::Page, fixture.page_id),
    )
    .await
    .unwrap()
    .unwrap();
    let current_read = read_of(changeset, &current);
    let outcome = stage_call(&mut conn, page_call(&current_read))
        .await
        .unwrap();
    assert!(
        matches!(outcome, StageCallOutcome::Staged(_)),
        "{outcome:?}"
    );
    assert_eq!(fixture.paragraph_text("staged").await, json!("First edit."));
}

#[tokio::test]
async fn a_live_edit_while_a_call_runs_is_a_stale_read() {
    let fixture = Fixture::new().await;
    let mut conn = fixture.pool.acquire().await.unwrap();
    let read_live = entity_snapshots::load_page(&mut conn, fixture.page_id)
        .await
        .unwrap()
        .unwrap();
    fixture.rename_page_live(&mut conn).await;

    let mut after = read_live.clone();
    std::sync::Arc::make_mut(&mut after.content)[0]
        .attributes
        .insert("content".into(), json!("Agent text."));
    let key = EntityKey::new(ContentEntityType::Page, fixture.page_id);
    let read = StagedStateRead {
        changeset_id: None,
        entity_revisions: HashMap::new(),
        live_snapshots: [(key, Some(EntitySnapshot::Page(read_live)))].into(),
    };
    let actor = fixture.actor();
    let outcome = stage_call(
        &mut conn,
        StageCall {
            actor: &actor,
            course_id: fixture.course_id,
            tool_name: "patch_page_content",
            ops: &Value::Null,
            summary: None,
            entities: vec![StagedEntity::Write(EntitySnapshot::Page(after))],
            revert_of_call_id: None,
            read: &read,
            risk: &RiskBaseline::Current,
        },
    )
    .await
    .unwrap();
    match outcome {
        StageCallOutcome::StaleRead { entities } => assert_eq!(entities, vec![key]),
        other => panic!("expected a stale read, got {other:?}"),
    }
}

#[tokio::test]
async fn publishing_waits_for_a_live_save_in_progress_and_reports_it() {
    let fixture = Fixture::new().await;
    let staged = fixture.edit_paragraph("Agent text.").await;
    let changeset = changeset_id(&staged);
    let revision = fixture.changeset_revision(changeset).await;

    let mut web_save = fixture.pool.begin().await.unwrap();
    fixture.rename_page_live(&mut web_save).await;
    let (pool, app_conf) = (fixture.pool.clone(), fixture.app_conf.clone());
    let publishing = tokio::spawn(async move {
        let mut conn = pool.acquire().await.unwrap();
        publish(
            &mut conn,
            changeset,
            PublishOptions {
                can_add_global_admin_only_exercise_services: false,
                reviewed_revision: Some(revision),
            },
            &app_conf,
            no_spec,
            no_service_info,
        )
        .await
        .unwrap()
    });
    // Gives the publish time to block on the page row the web save holds.
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    web_save.commit().await.unwrap();

    let outcome = publishing.await.unwrap();
    assert!(
        matches!(
            outcome,
            PublishOutcome::Rejected {
                rejection: PublishRejection::Conflicts { .. }
            }
        ),
        "{outcome:?}"
    );
    assert_eq!(
        fixture
            .live_state()
            .await
            .page(fixture.page_id)
            .unwrap()
            .title,
        "Renamed in the web UI"
    );
}
