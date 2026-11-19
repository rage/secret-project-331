use headless_lms_models::{
    PKeyPolicy, course_audiences, entity_history,
    feedback::{self, FeedbackBlock, NewFeedback},
    library::agent_changesets::PublishOutcome,
    proposed_block_edits::NewProposedBlockEdit,
    proposed_page_edits::{self, NewProposedPageEdits},
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::fixture::{Fixture, TEST_CLIENT_NAME, changeset_id};

#[tokio::test]
async fn page_edit_is_staged_read_back_and_published() {
    let fixture = Fixture::new().await;
    let staged = fixture
        .edit_paragraph("Loops repeat <em>things</em>.")
        .await;
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

    fixture.publish(&staged).await;
    assert_eq!(
        fixture.paragraph_text("published").await,
        json!("Loops repeat <em>things</em>.")
    );
    let mut conn = fixture.pool.acquire().await.unwrap();
    let version = entity_history::latest_version(&mut conn, fixture.page_id, None)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(version.agent_client_name.as_deref(), Some(TEST_CLIENT_NAME));
}

#[tokio::test]
async fn invalid_blocks_stage_nothing() {
    let fixture = Fixture::new().await;
    let result = fixture
        .call_result("patch_page_content", json!({
                "course": fixture.course_id,
                "page": fixture.page_id,
                "ops": [{"op": "replace", "path": format!("/{}/attributes/content", fixture.paragraph_id), "value": "<script>alert(1)</script>"}],
            }))
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
    let template_block_names = |op: usize| -> Vec<Value> {
        structure["created"][op]["template_blocks"]
            .as_array()
            .unwrap()
            .iter()
            .map(|block| block["block_name"].clone())
            .collect()
    };
    assert_eq!(
        template_block_names(0),
        [
            json!("moocfi/hero-section"),
            json!("moocfi/pages-in-chapter"),
            json!("moocfi/exercises-in-chapter")
        ]
    );
    assert_eq!(template_block_names(1), [json!("moocfi/hero-section")]);
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

    fixture.publish(&settings).await;

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
    let previews = fixture
        .call(
            "get_preview_link",
            json!({"course": fixture.course_id, "pages": [fixture.page_id]}),
        )
        .await;
    assert_eq!(previews["previews"][0]["page"], json!(fixture.page_id));
    assert!(
        previews["previews"][0]["url"]
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

#[tokio::test]
async fn deleting_a_middle_chapter_and_page_publishes() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    let first_chapter = fixture.live_state().await.chapters[0].id;
    let added = fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [
                {"op": "add", "path": format!("/{first_chapter}/pages"), "position": "end", "value": {"label": "$after", "title": "After loops"}},
                {"op": "add", "path": format!("/{}/chapters", fixture.module_id), "position": "end", "value": {"label": "$middle", "name": "Middle"}},
                {"op": "add", "path": format!("/{}/chapters", fixture.module_id), "position": "end", "value": {"label": "$last", "name": "Last"}},
            ]}),
        )
        .await;
    fixture.publish(&added).await;
    let middle_chapter = added["labels"]["$middle"].as_str().unwrap();
    let last_chapter: Uuid = added["labels"]["$last"].as_str().unwrap().parse().unwrap();

    let removed = fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [
                {"op": "remove", "path": format!("/{}", fixture.page_id)},
                {"op": "remove", "path": format!("/{middle_chapter}")},
            ]}),
        )
        .await;
    let changeset = changeset_id(&removed);
    let revision = fixture.changeset_revision(changeset).await;
    let outcome = fixture.publish_reviewed(changeset, revision).await;
    assert!(
        matches!(outcome, PublishOutcome::Published { .. }),
        "{outcome:?}"
    );

    let live = fixture.live_state().await;
    let mut chapters: Vec<(&str, i32)> = live
        .chapters
        .iter()
        .map(|c| (c.name.as_str(), c.chapter_number))
        .collect();
    chapters.sort_by_key(|(_, number)| *number);
    assert_eq!(chapters, vec![("Basics", 1), ("Last", 2)]);
    assert!(live.page(fixture.page_id).is_none());
    let after_loops = live
        .pages
        .iter()
        .find(|p| p.title == "After loops")
        .unwrap();
    assert_eq!(after_loops.chapter_id, Some(first_chapter));
    let last_front_page = live
        .pages
        .iter()
        .find(|p| p.chapter_id == Some(last_chapter))
        .unwrap();
    assert_eq!(last_front_page.url_path, "/chapter-2");
}

#[tokio::test]
async fn a_citation_key_can_move_to_another_reference() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    let added = fixture
        .call(
            "patch_course_glossary_and_references",
            json!({"course": course, "ops": [{"op": "add", "path": "/references", "value": {"citation_key": "smith2020", "bibtex": "@misc{smith2020, title={Old}}"}}]}),
        )
        .await;
    fixture.publish(&added).await;
    let old_reference = fixture.live_state().await.references[0].id;

    let replaced = fixture
        .call(
            "patch_course_glossary_and_references",
            json!({"course": course, "ops": [
                {"op": "remove", "path": format!("/{old_reference}")},
                {"op": "add", "path": "/references", "value": {"citation_key": "smith2020", "bibtex": "@misc{smith2020, title={New}}"}},
            ]}),
        )
        .await;
    fixture.publish(&replaced).await;
    let live = fixture.live_state().await;
    assert_eq!(live.references.len(), 1);
    assert!(live.references[0].reference.contains("New"));
}

#[tokio::test]
async fn a_page_added_in_a_call_can_be_copied_in_the_same_call() {
    let fixture = Fixture::new().await;
    let course = fixture.course_id;
    let chapter = fixture
        .live_state()
        .await
        .page(fixture.page_id)
        .unwrap()
        .chapter_id
        .unwrap();
    let structure = fixture
        .call(
            "patch_course_structure",
            json!({"course": course, "ops": [
                {"op": "add", "path": format!("/{chapter}/pages"), "position": "end", "value": {"label": "$p", "title": "Recursion", "blocks": [{"name": "core/paragraph", "attributes": {"content": "Calls itself."}}]}},
                {"op": "copy", "from": "/$p", "path": "/$p", "position": "after", "label": "$c"},
            ]}),
        )
        .await;
    let copy = structure["labels"]["$c"].as_str().unwrap().to_string();
    let read = fixture
        .call(
            "get_page_content",
            json!({"course": course, "page": copy, "selectors": [{"path": "", "mode": "raw"}]}),
        )
        .await;
    assert!(
        read.to_string().contains("Calls itself."),
        "the copy has no blocks: {read}"
    );
}

#[tokio::test]
async fn an_audience_saved_again_by_id_comes_back() {
    let fixture = Fixture::new().await;
    let mut conn = fixture.pool.acquire().await.unwrap();
    let audience_id = Uuid::new_v4();
    course_audiences::upsert_course_audiences(
        &mut conn,
        fixture.course_id,
        vec![audience_id],
        vec!["Teachers".to_string()],
        vec![vec![0.0; 1536]],
    )
    .await
    .unwrap();
    course_audiences::delete_batch(&mut conn, vec![audience_id])
        .await
        .unwrap();
    assert!(
        course_audiences::get_by_course_id(&mut conn, fixture.course_id)
            .await
            .unwrap()
            .is_empty()
    );
    course_audiences::upsert_course_audiences(
        &mut conn,
        fixture.course_id,
        vec![audience_id],
        vec!["Teachers".to_string()],
        vec![vec![0.0; 1536]],
    )
    .await
    .unwrap();
    let audiences = course_audiences::get_by_course_id(&mut conn, fixture.course_id)
        .await
        .unwrap();
    assert_eq!(audiences.len(), 1);
    assert_eq!(audiences[0].id, audience_id);
}
