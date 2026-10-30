use headless_lms_models::{
    agent_changesets,
    library::agent_changesets::{ReviewEntity, get_review},
    pages, peer_or_self_review_configs, peer_or_self_review_questions,
};
use serde_json::{Value, json};

use crate::fixture::{Fixture, TestExercise, changeset_id};

impl Fixture {
    async fn patch_exercise(&self, exercise: &TestExercise, arguments: Value) -> Value {
        let mut arguments = arguments;
        arguments["course"] = json!(self.course_id);
        arguments["exercise"] = json!(exercise.id);
        self.call_result("patch_exercise", arguments).await
    }

    /// The live exercise, as the CMS loads it.
    async fn live_exercise(&self, exercise: &TestExercise) -> pages::CmsPageExercise {
        let mut conn = self.pool.acquire().await.unwrap();
        let mut exercises = pages::exercises_of_pages(&mut conn, &[self.page_id])
            .await
            .unwrap();
        exercises
            .remove(&self.page_id)
            .unwrap()
            .exercises
            .into_iter()
            .find(|e| e.id == exercise.id)
            .unwrap()
    }

    async fn live_task_assignment(&self) -> Value {
        let mut conn = self.pool.acquire().await.unwrap();
        let exercises = pages::exercises_of_pages(&mut conn, &[self.page_id])
            .await
            .unwrap();
        exercises[&self.page_id].exercise_tasks[0]
            .assignment
            .clone()
    }

    async fn course_default(&self) -> peer_or_self_review_configs::CmsPeerOrSelfReviewConfig {
        let mut conn = self.pool.acquire().await.unwrap();
        peer_or_self_review_configs::get_course_default_cms_peer_review(&mut conn, self.course_id)
            .await
            .unwrap()
    }
}

fn review_paragraph(text: &str) -> Value {
    json!([{"op": "add", "path": "/review_instructions", "position": "end", "value": {"name": "core/paragraph", "attributes": {"content": text}}}])
}

#[tokio::test]
async fn name_and_instruction_edits_stage_publish_and_revert() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let read = fixture
        .call(
            "get_exercise",
            json!({"course": fixture.course_id, "exercise": exercise.id}),
        )
        .await;
    assert_eq!(read["exercise"]["name"], json!("Write a loop"));
    assert_eq!(
        read["exercise"]["reviews"]["config"],
        json!("course_default")
    );
    let paragraph_path = format!(
        "/tasks/{}/{}",
        exercise.task_id, exercise.instructions_paragraph_id
    );
    assert_eq!(read["reads"][0]["items"][0]["path"], json!(paragraph_path));

    let staged = fixture
        .patch_exercise(
            &exercise,
            json!({
                "name": "  Write a counting loop ",
                "ops": [{"op": "replace", "path": format!("{paragraph_path}/attributes/content"), "value": " Count to <em>ten</em>. "}],
            }),
        )
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");
    let staged = &staged["structuredContent"];
    assert_eq!(staged["staged"][0]["entity_id"], json!(fixture.page_id));
    assert!(
        staged["staged"][0].get("risk_reasons").is_none(),
        "{staged}"
    );

    let read = fixture
        .call(
            "get_exercise",
            json!({"course": fixture.course_id, "exercise": exercise.id, "selectors": [
                {"path": format!("{paragraph_path}/attributes/content")},
                {"path": format!("{paragraph_path}/attributes/content"), "state": "published"},
            ]}),
        )
        .await;
    assert_eq!(read["exercise"]["name"], json!("Write a counting loop"));
    assert_eq!(read["reads"][0]["value"], json!("Count to <em>ten</em>."));
    assert_eq!(
        read["reads"][1]["value"],
        json!("Write a loop that counts to ten.")
    );

    let mut conn = fixture.pool.acquire().await.unwrap();
    let changeset = agent_changesets::get_by_id(&mut conn, changeset_id(staged))
        .await
        .unwrap();
    let review = get_review(&mut conn, changeset).await.unwrap();
    let ReviewEntity::Page(page) = &review.entities[0] else {
        panic!("{:?}", review.entities[0]);
    };
    let fields: Vec<String> = page
        .change
        .field_changes
        .iter()
        .map(|change| format!("{:?}", change.field))
        .collect();
    assert_eq!(fields, vec!["ExerciseName", "TaskInstructions"]);
    assert_eq!(
        page.change.field_changes[1]
            .exercise
            .as_ref()
            .unwrap()
            .task_id,
        Some(exercise.task_id)
    );

    fixture.publish(staged).await;
    assert_eq!(
        fixture.live_exercise(&exercise).await.name,
        "Write a counting loop"
    );
    assert_eq!(
        fixture.live_task_assignment().await[0]["attributes"]["content"],
        json!("Count to <em>ten</em>.")
    );

    let reverted = fixture
        .call(
            "revert_change",
            json!({"course": fixture.course_id, "call": staged["call"]}),
        )
        .await;
    fixture.publish(&reverted).await;
    assert_eq!(fixture.live_exercise(&exercise).await.name, "Write a loop");
}

#[tokio::test]
async fn review_instructions_of_a_default_using_exercise_need_a_choice() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let refused = fixture
        .patch_exercise(&exercise, json!({"ops": review_paragraph("Be kind.")}))
        .await;
    assert_eq!(refused["isError"], json!(true));
    assert_eq!(
        refused["structuredContent"]["error"]["code"],
        json!("field_not_allowed")
    );
    let refused = fixture
        .patch_exercise(&exercise, json!({"review_config": "fork"}))
        .await;
    assert_eq!(refused["isError"], json!(true));

    let staged = fixture
        .patch_exercise(
            &exercise,
            json!({"review_config": "edit_course_default", "ops": review_paragraph("Be kind.")}),
        )
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");
    let staged = &staged["structuredContent"];
    assert_eq!(
        staged["staged"][0]["entity_type"],
        json!("course_default_review_config")
    );

    let mut conn = fixture.pool.acquire().await.unwrap();
    let changeset = agent_changesets::get_by_id(&mut conn, changeset_id(staged))
        .await
        .unwrap();
    let review = get_review(&mut conn, changeset).await.unwrap();
    let ReviewEntity::CourseDefaultReviewConfig(config) = &review.entities[0] else {
        panic!("{:?}", review.entities[0]);
    };
    assert_eq!(config.exercise_count, 1);

    fixture.publish(staged).await;
    let instructions = fixture.course_default().await.review_instructions.unwrap();
    assert_eq!(instructions[0]["attributes"]["content"], json!("Be kind."));
    assert!(
        fixture
            .live_exercise(&exercise)
            .await
            .use_course_default_peer_or_self_review_config
    );
}

#[tokio::test]
async fn fork_copies_the_default_and_use_course_default_drops_the_copy() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let default = fixture.course_default().await;
    let mut conn = fixture.pool.acquire().await.unwrap();
    let default_questions =
        peer_or_self_review_questions::get_course_default_cms_peer_or_self_review_questions(
            &mut conn, default.id,
        )
        .await
        .unwrap();
    assert!(!default_questions.is_empty());

    let staged = fixture
        .patch_exercise(
            &exercise,
            json!({"review_config": "fork", "ops": review_paragraph("Check the loop bounds.")}),
        )
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");
    fixture.publish(&staged["structuredContent"]).await;
    let forked = fixture.live_exercise(&exercise).await;
    assert!(!forked.use_course_default_peer_or_self_review_config);
    let config = forked.peer_or_self_review_config.unwrap();
    assert_ne!(config.id, default.id);
    assert_eq!(config.peer_reviews_to_give, default.peer_reviews_to_give);
    assert_eq!(
        config.review_instructions.unwrap()[0]["attributes"]["content"],
        json!("Check the loop bounds.")
    );
    let questions = forked.peer_or_self_review_questions.unwrap();
    assert_eq!(questions.len(), default_questions.len());
    assert!(
        questions
            .iter()
            .all(|q| q.peer_or_self_review_config_id == config.id)
    );
    assert!(fixture.course_default().await.review_instructions.is_none());

    let staged = fixture
        .patch_exercise(&exercise, json!({"review_config": "use_course_default"}))
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");
    let staged = &staged["structuredContent"];
    assert_eq!(
        staged["dropped_review_settings"]["question_count"],
        json!(default_questions.len())
    );
    assert_eq!(
        staged["dropped_review_settings"]["has_review_instructions"],
        json!(true)
    );
    fixture.publish(staged).await;
    let unforked = fixture.live_exercise(&exercise).await;
    assert!(unforked.use_course_default_peer_or_self_review_config);
    assert!(unforked.peer_or_self_review_config.is_none());
}

#[tokio::test]
async fn own_review_instructions_are_edited_without_a_choice() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(true).await;
    let refused = fixture
        .patch_exercise(
            &exercise,
            json!({"review_config": "edit_course_default", "ops": review_paragraph("Hm.")}),
        )
        .await;
    assert_eq!(refused["isError"], json!(true));
    let staged = fixture
        .patch_exercise(&exercise, json!({"ops": review_paragraph("Own words.")}))
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");
    fixture.publish(&staged["structuredContent"]).await;
    let config = fixture
        .live_exercise(&exercise)
        .await
        .peer_or_self_review_config
        .unwrap();
    assert_eq!(
        config.review_instructions.unwrap()[0]["attributes"]["content"],
        json!("Own words.")
    );
}

#[tokio::test]
async fn publish_conflicts_when_the_exercise_changed_live() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let staged = fixture
        .patch_exercise(&exercise, json!({"name": "Renamed"}))
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");
    let mut conn = fixture.pool.acquire().await.unwrap();
    headless_lms_models::exercises::set_exercise_to_use_exercise_specific_peer_or_self_review_config(
        &mut conn, exercise.id, true, true, true,
    )
    .await
    .unwrap();
    let result = fixture
        .call_result(
            "publish_changeset",
            json!({"course": fixture.course_id, "changeset": staged["structuredContent"]["changeset"]}),
        )
        .await;
    let error = &result["structuredContent"]["error"];
    assert_eq!(error["code"], json!("publish_conflict"), "{result}");
    assert_eq!(error["conflicts"][0]["entity_id"], json!(fixture.page_id));
}

#[tokio::test]
async fn fork_copies_the_default_as_it_is_when_published() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let staged = fixture
        .patch_exercise(
            &exercise,
            json!({"review_config": "fork", "ops": review_paragraph("Special.")}),
        )
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");

    let mut conn = fixture.pool.acquire().await.unwrap();
    let default = fixture.course_default().await;
    let questions =
        peer_or_self_review_questions::get_course_default_cms_peer_or_self_review_questions(
            &mut conn, default.id,
        )
        .await
        .unwrap();
    peer_or_self_review_configs::upsert_for_course_id(
        &mut conn,
        fixture.course_id,
        &peer_or_self_review_configs::CmsPeerOrSelfReviewConfiguration {
            peer_or_self_review_config: peer_or_self_review_configs::CmsPeerOrSelfReviewConfig {
                peer_reviews_to_give: default.peer_reviews_to_give + 1,
                ..default.clone()
            },
            peer_or_self_review_questions: questions,
        },
        None,
    )
    .await
    .unwrap();

    fixture.publish(&staged["structuredContent"]).await;
    let config = fixture
        .live_exercise(&exercise)
        .await
        .peer_or_self_review_config
        .unwrap();
    assert_eq!(
        config.peer_reviews_to_give,
        default.peer_reviews_to_give + 1
    );
    assert_eq!(
        config.review_instructions.unwrap()[0]["attributes"]["content"],
        json!("Special.")
    );
}

#[tokio::test]
async fn find_replace_edits_instructions_and_the_default_once() {
    let fixture = Fixture::new().await;
    let first = fixture.add_exercise(false).await;
    fixture.add_exercise(false).await;
    fixture
        .patch_exercise(
            &first,
            json!({"review_config": "edit_course_default", "ops": review_paragraph("Count every loop.")}),
        )
        .await;

    let found = fixture
        .call(
            "find_replace",
            json!({"course": fixture.course_id, "find": "loop", "include_exercise_names": true}),
        )
        .await;
    let matches = found["matches"].as_array().unwrap();
    let default_matches: Vec<&Value> = matches
        .iter()
        .filter(|m| m["course_default_review_config"] == json!(true))
        .collect();
    assert_eq!(default_matches.len(), 1, "{found}");
    assert!(default_matches[0].get("page_id").is_none());
    let task_matches = matches
        .iter()
        .filter(|m| {
            m["instructions"]
                .as_str()
                .unwrap_or("")
                .starts_with("/tasks/")
        })
        .count();
    assert_eq!(task_matches, 2, "{found}");
    let name_matches = matches
        .iter()
        .filter(|m| m["path"] == json!("/name"))
        .count();
    assert_eq!(name_matches, 2, "{found}");

    let replaced = fixture
        .call(
            "find_replace",
            json!({"course": fixture.course_id, "find": "loop", "replace": "cycle"}),
        )
        .await;
    assert_eq!(replaced["total"], json!(3), "{replaced}");
    fixture.publish(&replaced).await;
    let instructions = fixture.course_default().await.review_instructions.unwrap();
    assert_eq!(
        instructions[0]["attributes"]["content"],
        json!("Count every cycle.")
    );
    assert_eq!(
        fixture.live_exercise(&first).await.name,
        "Write a loop",
        "names stay without include_exercise_names"
    );
}

#[tokio::test]
async fn a_copy_takes_the_edited_instructions_and_the_source_stays_editable() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let paragraph_path = format!(
        "/tasks/{}/{}/attributes/content",
        exercise.task_id, exercise.instructions_paragraph_id
    );
    let edited = fixture
        .patch_exercise(
            &exercise,
            json!({"ops": [{"op": "replace", "path": paragraph_path, "value": "Edited."}]}),
        )
        .await;
    assert_eq!(edited["isError"], json!(false), "{edited}");

    let page = fixture
        .call(
            "get_page_content",
            json!({"course": fixture.course_id, "page": fixture.page_id}),
        )
        .await;
    let exercise_block = page["reads"][0]["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["name"] == json!("moocfi/exercise"))
        .unwrap()["path"]
        .clone();
    let copied = fixture
        .call(
            "patch_page_content",
            json!({"course": fixture.course_id, "page": fixture.page_id, "ops": [
                {"op": "copy", "from": exercise_block, "path": "", "position": "end"},
            ]}),
        )
        .await;
    let copy_id = copied["exercise_copies"][0]["new_exercise_id"].clone();
    let copy = fixture
        .call(
            "get_exercise",
            json!({"course": fixture.course_id, "exercise": copy_id}),
        )
        .await;
    let task = copy["exercise"]["tasks"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_ne!(task, exercise.task_id.to_string());
    let instructions = copy["reads"][0]["items"][0]["preview"].as_str().unwrap();
    assert!(instructions.contains("Edited."), "{copy}");

    let renamed = fixture
        .patch_exercise(&exercise, json!({"name": "Still editable"}))
        .await;
    assert_eq!(renamed["isError"], json!(false), "{renamed}");
    let source = fixture
        .call(
            "get_exercise",
            json!({"course": fixture.course_id, "exercise": exercise.id}),
        )
        .await;
    assert_eq!(source["exercise"]["name"], json!("Still editable"));
    assert_eq!(copy["exercise"]["name"], json!("Write a loop"));
}
