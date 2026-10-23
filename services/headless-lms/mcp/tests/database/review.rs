use headless_lms_models::{
    agent_changesets,
    library::agent_changesets::{
        ChangedSinceReview, DiscardOutcome, DiscardRejection, EntityField, FieldValue,
        PublishOutcome, PublishRejection, ReviewEntity, discard, get_review,
    },
};
use serde_json::{Value, json};

use crate::fixture::{Fixture, changeset_id};

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
async fn publishing_from_the_review_page_needs_the_reviewed_revision() {
    let fixture = Fixture::new().await;
    let staged = fixture.edit_paragraph("Reviewed text.").await;
    let changeset = changeset_id(&staged);
    let mut conn = fixture.pool.acquire().await.unwrap();
    let opened = agent_changesets::get_by_id(&mut conn, changeset)
        .await
        .unwrap();
    let reviewed = get_review(&mut conn, opened)
        .await
        .unwrap()
        .changeset
        .revision;
    fixture.edit_paragraph("Text the teacher never saw.").await;

    let outcome = fixture.publish_reviewed(changeset, reviewed).await;
    let current = fixture.changeset_revision(changeset).await;
    assert_eq!(
        outcome,
        PublishOutcome::Rejected {
            rejection: PublishRejection::ChangedSinceReview(ChangedSinceReview {
                revision: current
            })
        }
    );
    assert_eq!(
        fixture.paragraph_text("published").await,
        json!("Loops repeat things.")
    );

    let outcome = fixture.publish_reviewed(changeset, current).await;
    assert!(
        matches!(outcome, PublishOutcome::Published { .. }),
        "{outcome:?}"
    );
    assert_eq!(
        fixture.paragraph_text("published").await,
        json!("Text the teacher never saw.")
    );
}

#[tokio::test]
async fn publishing_judges_risk_against_the_course_as_it_is_then() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    fixture.set_draft(true).await;
    let staged = fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [{"op": "remove", "path": format!("/{}", fixture.page_id)}]}),
        )
        .await;
    assert_eq!(staged["staged"][0]["risk_reasons"], Value::Null, "{staged}");
    let changeset = changeset_id(&staged);
    let staged_revision = fixture.changeset_revision(changeset).await;
    fixture.set_draft(false).await;

    let refused = fixture
        .call(
            "publish_changeset",
            json!({"course": course, "changeset": changeset}),
        )
        .await;
    assert_eq!(refused["published"], json!(false), "{refused}");
    assert_eq!(
        refused["risky_entities"][0]["risk_reasons"][0]["code"],
        json!("visible_page_removed")
    );
    assert!(fixture.live_state().await.page(fixture.page_id).is_some());

    let outcome = fixture.publish_reviewed(changeset, staged_revision).await;
    assert!(
        matches!(
            outcome,
            PublishOutcome::Rejected {
                rejection: PublishRejection::ChangedSinceReview(_)
            }
        ),
        "{outcome:?}"
    );
    let current = fixture.changeset_revision(changeset).await;
    let outcome = fixture.publish_reviewed(changeset, current).await;
    assert!(
        matches!(outcome, PublishOutcome::Published { .. }),
        "{outcome:?}"
    );
    assert!(fixture.live_state().await.page(fixture.page_id).is_none());
}

#[tokio::test]
async fn the_review_page_discards_only_the_reviewed_revision() {
    let fixture = Fixture::new().await;
    let staged = fixture.edit_paragraph("First edit.").await;
    let changeset = changeset_id(&staged);
    let reviewed = fixture.changeset_revision(changeset).await;
    fixture.edit_paragraph("Edit the teacher never saw.").await;

    let refused = discard(
        &mut fixture.pool.acquire().await.unwrap(),
        changeset,
        Some(reviewed),
    )
    .await
    .unwrap();
    assert!(
        matches!(
            refused,
            DiscardOutcome::Rejected {
                rejection: DiscardRejection::ChangedSinceReview(ChangedSinceReview { .. })
            }
        ),
        "{refused:?}"
    );
    let stale = fixture
        .call_result(
            "discard_changeset",
            json!({"course": fixture.course_id, "changeset": changeset, "revision": reviewed}),
        )
        .await;
    assert_eq!(
        stale["structuredContent"]["error"]["code"],
        json!("changeset_changed"),
        "{stale}"
    );
    assert_eq!(
        fixture.paragraph_text("staged").await,
        json!("Edit the teacher never saw.")
    );
    let current = fixture.changeset_revision(changeset).await;
    let mut conn = fixture.pool.acquire().await.unwrap();
    assert!(matches!(
        discard(&mut conn, changeset, Some(current)).await.unwrap(),
        DiscardOutcome::Discarded { .. }
    ));
}

#[tokio::test]
async fn conflicting_entities_can_be_discarded_alone() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    let staged = fixture.edit_paragraph("Staged text.").await;
    let glossary = fixture
        .call(
            "patch_course_glossary_and_references",
            json!({"course": course, "ops": [{"op": "add", "path": "/glossary", "value": {"term": "Loop", "definition": "Repetition."}}]}),
        )
        .await;
    let structure = fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [
                {"op": "add", "path": format!("/{}/chapters", fixture.module_id), "position": "end", "value": {"label": "$ch", "name": "Recursion"}},
            ]}),
        )
        .await;
    let new_chapter = structure["labels"]["$ch"].clone();
    let mut conn = fixture.pool.acquire().await.unwrap();
    fixture.rename_page_live(&mut conn).await;

    let arguments = json!({"course": course, "changeset": staged["changeset"]});
    let refused = fixture
        .call_result("publish_changeset", arguments.clone())
        .await;
    let error = &refused["structuredContent"]["error"];
    assert_eq!(error["code"], json!("publish_conflict"), "{refused}");
    assert_eq!(error["conflicts"][0]["entity_id"], json!(fixture.page_id));

    let dependent = fixture
        .call_result(
            "discard_changeset",
            json!({"course": course, "changeset": staged["changeset"], "entities": [new_chapter]}),
        )
        .await;
    assert_eq!(dependent["isError"], json!(true), "{dependent}");
    let error = &dependent["structuredContent"]["error"];
    assert_eq!(error["code"], json!("discard_conflict"));
    assert_eq!(
        error["blockers"][0]["kind"],
        json!("page_in_missing_chapter")
    );

    let discarded = fixture
        .call(
            "discard_changeset",
            json!({"course": course, "changeset": staged["changeset"], "entities": [fixture.page_id]}),
        )
        .await;
    assert_eq!(discarded["status"], json!("open"));
    assert_eq!(
        discarded["discarded"][0]["entity_id"],
        json!(fixture.page_id)
    );
    assert_eq!(
        fixture.paragraph_text("staged").await,
        json!("Loops repeat things.")
    );

    fixture.publish(&staged).await;
    let live = fixture.live_state().await;
    assert_eq!(
        live.page(fixture.page_id).unwrap().title,
        "Renamed in the web UI"
    );
    assert_eq!(live.glossary[0].term, "Loop");
    assert!(live.chapters.iter().any(|c| c.name == "Recursion"));
    assert_eq!(glossary["changeset"], staged["changeset"]);
}

#[tokio::test]
async fn a_dry_run_lists_what_it_would_stage_and_stages_nothing() {
    let fixture = Fixture::new().await;
    let dry = fixture
        .call(
            "patch_page_content",
            json!({
                "course": fixture.course_id,
                "page": fixture.page_id,
                "ops": [{"op": "replace", "path": format!("/{}/attributes/content", fixture.paragraph_id), "value": "Dry text."}],
                "dry_run": true,
            }),
        )
        .await;
    assert_eq!(dry["dry_run"], json!(true), "{dry}");
    assert_eq!(dry["would_stage"][0]["entity_id"], json!(fixture.page_id));
    assert_eq!(dry["would_stage"][0]["operation"], json!("update"));
    assert_eq!(
        dry["block_changes"][0]["block_id"],
        json!(fixture.paragraph_id)
    );
    assert_eq!(
        fixture.paragraph_text("staged").await,
        json!("Loops repeat things.")
    );
    let mut conn = fixture.pool.acquire().await.unwrap();
    assert!(
        agent_changesets::get_open(&mut conn, fixture.user_id, fixture.course_id)
            .await
            .unwrap()
            .is_none()
    );
}

#[tokio::test]
async fn the_review_names_the_entities_field_changes_point_at() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    let created = fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [
                {"op": "add", "path": format!("/{}/chapters", fixture.module_id), "position": "end", "value": {"label": "$ch", "name": "Recursion"}},
            ]}),
        )
        .await;
    let new_chapter = created["labels"]["$ch"].as_str().unwrap().to_string();
    let moved = fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [
                {"op": "move", "from": format!("/{}", fixture.page_id), "path": format!("/{new_chapter}/pages"), "position": "end"},
            ]}),
        )
        .await;
    let mut conn = fixture.pool.acquire().await.unwrap();
    let changeset = agent_changesets::get_by_id(&mut conn, changeset_id(&moved))
        .await
        .unwrap();
    let review = get_review(&mut conn, changeset).await.unwrap();
    let page = review
        .entities
        .iter()
        .find_map(|entity| match entity {
            ReviewEntity::Page(page) if page.change.entity.entity_id == fixture.page_id => {
                Some(page)
            }
            _ => None,
        })
        .unwrap();
    assert!(!page.is_content_changed);
    let chapter_change = page
        .change
        .field_changes
        .iter()
        .find(|change| change.field == EntityField::ChapterId)
        .unwrap();
    match &chapter_change.after {
        Some(FieldValue::Reference(chapter)) => assert_eq!(chapter.label, "Recursion"),
        other => panic!("expected a chapter reference, got {other:?}"),
    }
}
