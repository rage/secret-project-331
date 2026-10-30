use serde_json::{Value, json};
use uuid::Uuid;

use crate::fixture::Fixture;

impl Fixture {
    /// The course's pages as get_course_structure lists them in `state`, top-level ones first.
    async fn structure_pages(&self, course_id: Uuid, state: &str) -> Vec<Value> {
        let read = self
            .call(
                "get_course_structure",
                json!({"course": course_id, "selectors": [{"path": "/course", "mode": "raw", "state": state}]}),
            )
            .await;
        let course = &read["reads"][0]["items"][0];
        let mut pages: Vec<Value> = course["pages"].as_array().cloned().unwrap_or_default();
        for module in course["modules"].as_array().unwrap() {
            for chapter in module["chapters"].as_array().unwrap() {
                pages.extend(chapter["pages"].as_array().unwrap().iter().cloned());
            }
        }
        pages
    }

    async fn page_group(&self, course_id: Uuid, page_id: Value, state: &str) -> Value {
        self.structure_pages(course_id, state)
            .await
            .into_iter()
            .find(|page| page["id"] == page_id)
            .unwrap()["page_language_group_id"]
            .clone()
    }

    async fn first_chapter(&self, course_id: Uuid) -> String {
        let read = self
            .call(
                "get_course_structure",
                json!({"course": course_id, "selectors": [{"path": "/course", "mode": "raw"}]}),
            )
            .await;
        read["reads"][0]["items"][0]["modules"][0]["chapters"][0]["id"]
            .as_str()
            .unwrap()
            .to_string()
    }

    /// Stages a new page at the end of the course's first chapter, paired with `pair_with`.
    async fn add_paired_page(&self, course_id: Uuid, pair_with: Option<Uuid>) -> Value {
        let chapter = self.first_chapter(course_id).await;
        let mut page = json!({"label": "$p", "title": "Arrays", "blocks": [{"name": "core/paragraph", "attributes": {"content": "Arrays."}}]});
        if let Some(source) = pair_with {
            page["pair_with"] = json!(source);
        }
        self.call_result(
            "patch_course_structure",
            json!({"course": course_id, "ops": [
                {"op": "add", "path": format!("/{chapter}/pages"), "position": "end", "value": page},
            ]}),
        )
        .await
    }

    async fn publish_course(&self, course_id: Uuid, staged: &Value) {
        let published = self
            .call(
                "publish_changeset",
                json!({"course": course_id, "changeset": staged["changeset"]}),
            )
            .await;
        assert_eq!(published["published"], json!(true), "{published}");
    }
}

fn staged_page(result: &Value) -> Value {
    assert_eq!(result["isError"], json!(false), "{result}");
    result["structuredContent"]["labels"]["$p"].clone()
}

fn refusal(result: &Value) -> String {
    assert_eq!(result["isError"], json!(true), "{result}");
    result["structuredContent"]["error"]["message"]
        .as_str()
        .unwrap()
        .to_string()
}

#[tokio::test]
async fn copies_and_new_pages_get_their_page_language_groups() {
    let fixture = Fixture::new().await;
    let source_group = fixture
        .page_group(fixture.course_id, json!(fixture.page_id), "staged")
        .await;
    assert!(source_group.is_string());

    let translation = fixture.copy_course(Some("fi"), true).await;
    let translated_page = fixture
        .structure_pages(translation, "staged")
        .await
        .into_iter()
        .find(|page| page["title"] == json!("Loops"))
        .unwrap();
    assert_eq!(translated_page["page_language_group_id"], source_group);

    let added = fixture.add_paired_page(fixture.course_id, None).await;
    let new_page = staged_page(&added);
    assert_eq!(
        fixture
            .page_group(fixture.course_id, new_page.clone(), "staged")
            .await,
        Value::Null
    );
    fixture
        .publish_course(fixture.course_id, &added["structuredContent"])
        .await;
    let new_group = fixture
        .page_group(fixture.course_id, new_page, "published")
        .await;
    assert!(new_group.is_string());
    assert_ne!(new_group, source_group);
}

#[tokio::test]
async fn pair_with_joins_the_source_pages_group() {
    let fixture = Fixture::new().await;
    let translation = fixture.copy_course(Some("fi"), true).await;
    let source_page = fixture.add_page("Arrays", "/chapter-1/arrays").await;
    let source_group = fixture
        .page_group(fixture.course_id, json!(source_page), "published")
        .await;

    let added = fixture
        .add_paired_page(translation, Some(source_page))
        .await;
    let new_page = staged_page(&added);
    assert_eq!(
        fixture
            .page_group(translation, new_page.clone(), "staged")
            .await,
        source_group
    );
    fixture
        .publish_course(translation, &added["structuredContent"])
        .await;
    assert_eq!(
        fixture.page_group(translation, new_page, "published").await,
        source_group
    );

    let again = fixture
        .add_paired_page(translation, Some(source_page))
        .await;
    assert!(refusal(&again).contains("already has its version"));
}

#[tokio::test]
async fn pair_with_refuses_unrelated_staged_and_already_paired_pages() {
    let fixture = Fixture::new().await;
    let translation = fixture.copy_course(Some("fi"), true).await;
    let already_paired = fixture
        .add_paired_page(translation, Some(fixture.page_id))
        .await;
    assert!(refusal(&already_paired).contains("already has its version"));

    let next_run = fixture.copy_course(None, true).await;
    let unrelated = fixture
        .add_paired_page(next_run, Some(fixture.page_id))
        .await;
    assert!(refusal(&unrelated).contains("isn't in a language version"));

    let staged_source = fixture.add_paired_page(fixture.course_id, None).await;
    let staged_source: Uuid = staged_page(&staged_source)
        .as_str()
        .unwrap()
        .parse()
        .unwrap();
    let unpublished = fixture
        .add_paired_page(translation, Some(staged_source))
        .await;
    assert!(refusal(&unpublished).contains("publish the source page first"));
}

#[tokio::test]
async fn publish_refuses_a_pairing_the_course_regained_a_page_for() {
    let fixture = Fixture::new().await;
    let translation = fixture.copy_course(Some("fi"), true).await;
    let translated_page = fixture
        .structure_pages(translation, "staged")
        .await
        .into_iter()
        .find(|page| page["title"] == json!("Loops"))
        .unwrap()["id"]
        .clone();
    // Keeps the paired page's order number clear of the removed page's, so the discard is allowed.
    staged_page(&fixture.add_paired_page(translation, None).await);
    let removed = fixture
        .call_result(
            "patch_course_structure",
            json!({"course": translation, "ops": [{"op": "remove", "path": format!("/{}", translated_page.as_str().unwrap())}]}),
        )
        .await;
    assert_eq!(removed["isError"], json!(false), "{removed}");
    let added = fixture
        .add_paired_page(translation, Some(fixture.page_id))
        .await;
    staged_page(&added);
    fixture
        .call(
            "discard_changeset",
            json!({"course": translation, "changeset": added["structuredContent"]["changeset"], "entities": [translated_page]}),
        )
        .await;

    let published = fixture
        .call_result(
            "publish_changeset",
            json!({"course": translation, "changeset": added["structuredContent"]["changeset"]}),
        )
        .await;
    assert!(refusal(&published).contains("already has its version"));
}
