use headless_lms_models::{
    exercise_slide_submissions::{self, NewExerciseSlideSubmission},
    exercise_slides,
    exercise_task_gradings::UserPointsUpdateStrategy,
    exercises,
    roles::{self, RoleDomain, UserRole},
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::fixture::{Fixture, TestExercise};

impl Fixture {
    async fn list_exercises(&self, course_id: Uuid, arguments: Value) -> Value {
        let mut arguments = arguments;
        arguments["course"] = json!(course_id);
        self.call_result("list_exercises", arguments).await
    }

    async fn add_submission(&self, exercise: &TestExercise) {
        let mut conn = self.pool.acquire().await.unwrap();
        let slide = exercise_slides::get_exercise_slides_by_exercise_id(&mut conn, exercise.id)
            .await
            .unwrap()
            .remove(0);
        exercise_slide_submissions::insert_exercise_slide_submission(
            &mut conn,
            NewExerciseSlideSubmission {
                exercise_slide_id: slide.id,
                course_id: Some(self.course_id),
                exam_id: None,
                user_id: self.user_id,
                exercise_id: exercise.id,
                user_points_update_strategy:
                    UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
            },
        )
        .await
        .unwrap();
    }
}

fn listed(result: &Value) -> &Vec<Value> {
    assert_eq!(result["isError"], json!(false), "{result}");
    result["structuredContent"]["exercises"].as_array().unwrap()
}

#[tokio::test]
async fn lists_staged_and_published_exercises() {
    let fixture = Fixture::new().await;
    let first = fixture.add_exercise(false).await;
    let second = fixture.add_exercise(true).await;
    let other_page = fixture.add_page("Arrays", "/chapter-1/arrays").await;
    fixture.add_submission(&first).await;
    let own_deadline = "2099-01-01T10:00:00Z";
    exercises::set_deadline(
        &mut fixture.pool.acquire().await.unwrap(),
        first.id,
        Some(own_deadline.parse().unwrap()),
    )
    .await
    .unwrap();
    let chapter_deadline = "2098-06-01T10:00:00Z";
    fixture
        .call(
            "patch_course_structure",
            json!({"course": fixture.course_id, "ops": [
                {"op": "replace", "path": format!("/{}/deadline", fixture.chapter_id), "value": chapter_deadline},
            ]}),
        )
        .await;
    fixture.move_exercise_to(&second, other_page).await;

    let staged = fixture.list_exercises(fixture.course_id, json!({})).await;
    let items = listed(&staged);
    assert_eq!(items.len(), 2, "{staged}");
    assert_eq!(items[0]["id"], json!(first.id));
    assert_eq!(items[0]["page"]["id"], json!(fixture.page_id));
    assert_eq!(items[0]["chapter_id"], json!(fixture.chapter_id));
    assert_eq!(items[0]["deadline_own"], json!(own_deadline));
    assert_eq!(items[0]["deadline_effective"], json!(own_deadline));
    assert_eq!(items[0]["has_submissions"], json!(true));
    assert_eq!(items[0]["review_source"], json!("default"));
    assert_eq!(items[0]["task_types"], json!(["mcp-test-exercise"]));
    assert_eq!(items[1]["id"], json!(second.id));
    assert_eq!(items[1]["page"]["id"], json!(other_page));
    assert_eq!(items[1]["order"], json!(1));
    assert_eq!(items[1]["deadline_own"], Value::Null);
    assert_eq!(items[1]["deadline_effective"], json!(chapter_deadline));
    assert!(items[1].get("has_submissions").is_none());
    assert_eq!(items[1]["review_source"], json!("own"));

    let published = fixture
        .list_exercises(fixture.course_id, json!({"state": "published"}))
        .await;
    let items = listed(&published);
    assert_eq!(items[1]["page"]["id"], json!(fixture.page_id));
    assert_eq!(items[1]["order"], json!(2));
    assert_eq!(items[1]["deadline_effective"], Value::Null);

    let page = fixture
        .list_exercises(fixture.course_id, json!({"scope": {"page": other_page}}))
        .await;
    assert_eq!(listed(&page).len(), 1);

    let first_page = fixture
        .list_exercises(fixture.course_id, json!({"limit": 1}))
        .await;
    assert_eq!(listed(&first_page).len(), 1);
    let content = &first_page["structuredContent"];
    assert_eq!(content["has_more"], json!(true));
    assert_eq!(content["total"], json!(2));
    let next = fixture
        .list_exercises(fixture.course_id, content["next"].clone())
        .await;
    assert_eq!(listed(&next)[0]["id"], json!(second.id));
    assert_eq!(next["structuredContent"]["has_more"], json!(false));
}

#[tokio::test]
async fn copies_pair_with_their_source_exercises() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let source = fixture.list_exercises(fixture.course_id, json!({})).await;
    let source_group = listed(&source)[0]["exercise_language_group_id"].clone();
    assert!(source_group.is_string(), "{source}");

    let translation = fixture.copy_course(Some("fi"), true).await;
    let copied = fixture.list_exercises(translation, json!({})).await;
    let copied = &listed(&copied)[0];
    assert_eq!(copied["copied_from"], json!(exercise.id));
    assert_eq!(copied["exercise_language_group_id"], source_group);

    let next_run = fixture.copy_course(None, true).await;
    let copied = fixture.list_exercises(next_run, json!({})).await;
    let copied = &listed(&copied)[0];
    assert_eq!(copied["copied_from"], json!(exercise.id));
    assert_ne!(copied["exercise_language_group_id"], source_group);
}

#[tokio::test]
async fn a_view_only_role_lists_nothing() {
    let fixture = Fixture::new().await;
    fixture.add_exercise(false).await;
    let course = fixture.copy_course(None, false).await;
    roles::insert(
        &mut fixture.pool.acquire().await.unwrap(),
        fixture.user_id,
        UserRole::MaterialViewer,
        RoleDomain::Course(course),
    )
    .await
    .unwrap();
    let refused = fixture.list_exercises(course, json!({})).await;
    assert_eq!(refused["isError"], json!(true), "{refused}");
}
