use headless_lms_models::{
    PKeyPolicy, exercise_slides,
    exercise_tasks::{self, NewExerciseTask},
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::fixture::{Fixture, TestExercise};

impl Fixture {
    /// Adds a quizzes task with all three specs to the exercise's slide.
    async fn add_quiz_task(&self, exercise: &TestExercise, private_spec: Value) -> Uuid {
        let mut conn = self.pool.acquire().await.unwrap();
        let slide = exercise_slides::get_exercise_slides_by_exercise_id(&mut conn, exercise.id)
            .await
            .unwrap()
            .remove(0);
        exercise_tasks::insert(
            &mut conn,
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: slide.id,
                exercise_type: "quizzes".to_string(),
                assignment: vec![],
                public_spec: Some(json!({"items": [{"options": ["for", "while"]}]})),
                private_spec: Some(private_spec),
                model_solution_spec: Some(json!({"correct": ["for"]})),
                order_number: 1,
            },
        )
        .await
        .unwrap()
    }

    async fn read_specs(&self, exercise: Value, path: String) -> Value {
        self.call_result(
            "get_exercise",
            json!({"course": self.course_id, "exercise": exercise, "selectors": [{"path": path}]}),
        )
        .await
    }
}

fn quiz_spec() -> Value {
    json!({"items": [{"options": [{"text": "for", "correct": true}, {"text": "while", "correct": false}]}]})
}

#[tokio::test]
async fn specs_of_each_task_type_are_read_together() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let quiz_task = fixture.add_quiz_task(&exercise, quiz_spec()).await;

    let read = fixture
        .read_specs(json!(exercise.id), format!("/tasks/{quiz_task}/specs"))
        .await;
    assert_eq!(read["isError"], json!(false), "{read}");
    let specs = &read["structuredContent"]["reads"][0];
    assert_eq!(specs["value"]["private_spec"], quiz_spec());
    assert_eq!(
        specs["value"]["model_solution_spec"],
        json!({"correct": ["for"]})
    );
    assert!(
        specs["note"]
            .as_str()
            .unwrap()
            .contains("only authoritative")
    );
    assert!(specs.get("derived_at_publish").is_none());

    let other = fixture
        .read_specs(
            json!(exercise.id),
            format!("/tasks/{}/specs/private_spec", exercise.task_id),
        )
        .await;
    assert_eq!(
        other["structuredContent"]["reads"][0]["value"],
        json!({}),
        "{other}"
    );
    let pointer = fixture
        .read_specs(
            json!(exercise.id),
            format!("/tasks/{quiz_task}/specs/private_spec/items/0/options/1/text"),
        )
        .await;
    assert_eq!(
        pointer["structuredContent"]["reads"][0]["value"],
        json!("while")
    );
}

#[tokio::test]
async fn a_staged_copy_has_its_derived_specs_at_publish() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let quiz_task = fixture.add_quiz_task(&exercise, quiz_spec()).await;
    let page = fixture
        .call(
            "get_page_content",
            json!({"course": fixture.course_id, "page": fixture.page_id}),
        )
        .await;
    let block = page["reads"][0]["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["exercise_id"] == json!(exercise.id))
        .unwrap()["path"]
        .clone();
    let copied = fixture
        .call(
            "patch_page_content",
            json!({"course": fixture.course_id, "page": fixture.page_id, "ops": [
                {"op": "copy", "from": block, "path": "", "position": "end"},
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
    let copied_task = copy["exercise"]["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|task| task["exercise_type"] == json!("quizzes"))
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_ne!(copied_task, quiz_task.to_string());

    let read = fixture
        .read_specs(copy_id, format!("/tasks/{copied_task}/specs"))
        .await;
    let specs = &read["structuredContent"]["reads"][0];
    assert_eq!(specs["value"]["private_spec"], quiz_spec(), "{read}");
    assert_eq!(specs["value"]["public_spec"], Value::Null);
    assert!(specs["derived_at_publish"].is_string());
}

#[tokio::test]
async fn a_spec_over_the_budget_is_read_in_parts() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let items: Vec<Value> = (0..200)
        .map(|n| json!({"id": n, "text": "Which loop repeats a block a known number of times? ".repeat(4)}))
        .collect();
    let quiz_task = fixture
        .add_quiz_task(&exercise, json!({"items": items}))
        .await;

    let whole = fixture
        .read_specs(json!(exercise.id), format!("/tasks/{quiz_task}/specs"))
        .await;
    let error = &whole["structuredContent"]["error"];
    assert_eq!(error["code"], json!("too_large"), "{whole}");
    let private = format!("/tasks/{quiz_task}/specs/private_spec");
    assert_eq!(error["details"]["paths"][0]["path"], json!(private));

    let items = fixture
        .read_specs(json!(exercise.id), format!("{private}/items"))
        .await;
    let error = &items["structuredContent"]["error"];
    assert_eq!(error["code"], json!("too_large"), "{items}");
    assert_eq!(error["details"]["paths"].as_array().unwrap().len(), 100);
    let first = error["details"]["paths"][0]["path"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(first, format!("{private}/items/0"));
    let item = fixture.read_specs(json!(exercise.id), first).await;
    assert_eq!(
        item["structuredContent"]["reads"][0]["value"]["id"],
        json!(0),
        "{item}"
    );
}
