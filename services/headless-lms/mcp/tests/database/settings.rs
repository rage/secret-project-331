use headless_lms_models::peer_or_self_review_configs;
use serde_json::{Value, json};

use crate::fixture::Fixture;

#[tokio::test]
async fn settings_show_the_course_default_peer_review_config() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let read = fixture
        .call("get_course_settings", json!({"course": fixture.course_id}))
        .await;
    let default = &read["default_peer_review"];
    assert!(default["peer_reviews_to_give"].is_number(), "{read}");
    assert!(!default["questions"].as_array().unwrap().is_empty());
    assert!(default["questions"][0]["question"].is_string());
    let exercise_read = fixture
        .call(
            "get_exercise",
            json!({"course": fixture.course_id, "exercise": exercise.id}),
        )
        .await;
    assert!(exercise_read["exercise"]["reviews"]["course_default_settings"].is_string());

    let mut conn = fixture.pool.acquire().await.unwrap();
    let config = peer_or_self_review_configs::get_course_default_cms_peer_review(
        &mut conn,
        fixture.course_id,
    )
    .await
    .unwrap();
    peer_or_self_review_configs::delete(&mut conn, config.id)
        .await
        .unwrap();
    let read = fixture
        .call("get_course_settings", json!({"course": fixture.course_id}))
        .await;
    assert_eq!(read["default_peer_review"], Value::Null);
}
