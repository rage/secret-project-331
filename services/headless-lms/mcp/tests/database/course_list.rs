use headless_lms_models::courses;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::fixture::Fixture;

impl Fixture {
    async fn listed_course(&self, course_id: Uuid) -> Value {
        let listed = self.call("list_courses", json!({})).await;
        listed["courses"]
            .as_array()
            .unwrap()
            .iter()
            .find(|course| course["id"] == json!(course_id))
            .cloned()
            .unwrap_or(Value::Null)
    }
}

#[tokio::test]
async fn courses_list_their_copy_source_and_language_versions() {
    let fixture = Fixture::new().await;
    let translation = fixture.copy_course(Some("fi"), true).await;
    let uneditable = fixture.copy_course(Some("sv"), false).await;
    let deleted = fixture.copy_course(Some("de"), true).await;
    courses::delete_course(&mut fixture.pool.acquire().await.unwrap(), deleted)
        .await
        .unwrap();
    let next_run = fixture.copy_course(None, true).await;

    let source = fixture.listed_course(fixture.course_id).await;
    assert_eq!(source["copied_from_id"], Value::Null);
    let mut versions = source["language_versions"].as_array().unwrap().clone();
    versions.sort_by_key(|version| version["id"] == json!(uneditable));
    assert_eq!(
        versions,
        vec![
            json!({"id": translation, "language_code": "fi"}),
            json!({"id": uneditable, "language_code": "sv"}),
        ]
    );
    assert_eq!(fixture.listed_course(uneditable).await, Value::Null);

    let copy = fixture.listed_course(translation).await;
    assert_eq!(copy["copied_from_id"], json!(fixture.course_id));
    assert_eq!(copy["language_group_id"], source["language_group_id"]);

    let run = fixture.listed_course(next_run).await;
    assert_eq!(run["copied_from_id"], json!(fixture.course_id));
    assert_ne!(run["language_group_id"], source["language_group_id"]);
    assert_eq!(run["language_versions"], json!([]));
}
