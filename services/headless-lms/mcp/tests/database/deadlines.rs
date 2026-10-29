use headless_lms_models::{
    agent_changeset_entities::{self, RiskReason},
    agent_changesets, exercises,
    library::{
        agent_changesets::{PublishOutcome, PublishRejection, ReviewEntity, get_review},
        entity_snapshots::{ContentEntityType, EntityKey, EntitySnapshot},
    },
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::fixture::{Fixture, TestExercise, changeset_id};

const DEADLINE: &str = "2099-01-01T12:00:00+02:00";

impl Fixture {
    async fn set_exercise_deadline(&self, exercise: &TestExercise, deadline: Value) -> Value {
        self.call_result(
            "patch_exercise",
            json!({"course": self.course_id, "exercise": exercise.id, "deadline": deadline}),
        )
        .await
    }

    async fn live_exercise_row(&self, exercise: &TestExercise) -> exercises::Exercise {
        let mut conn = self.pool.acquire().await.unwrap();
        exercises::get_by_id(&mut conn, exercise.id).await.unwrap()
    }

    async fn stored_risk_reasons(&self, changeset: Uuid, page_id: Uuid) -> Vec<RiskReason> {
        let mut conn = self.pool.acquire().await.unwrap();
        agent_changeset_entities::get_one(
            &mut conn,
            changeset,
            EntityKey::new(ContentEntityType::Page, page_id),
        )
        .await
        .unwrap()
        .unwrap()
        .risk_reasons
    }
}

fn deadline_added(exercise: &TestExercise) -> RiskReason {
    RiskReason::ExerciseDeadlineAdded {
        exercise_id: exercise.id,
        deadline: DEADLINE.parse().unwrap(),
    }
}

#[tokio::test]
async fn an_added_deadline_is_risky_publishes_and_reverts() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    let naive = fixture
        .set_exercise_deadline(&exercise, json!("2099-01-01T12:00:00"))
        .await;
    assert_eq!(
        naive["structuredContent"]["error"]["code"],
        json!("invalid_value"),
        "{naive}"
    );

    let staged = fixture
        .set_exercise_deadline(&exercise, json!(DEADLINE))
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");
    let staged = &staged["structuredContent"];
    assert_eq!(staged["deadline"]["own"], json!("2099-01-01T10:00:00Z"));
    assert_eq!(staged["deadline"]["effective"], staged["deadline"]["own"]);
    assert_eq!(
        staged["warnings"][0]["code"],
        json!("own_exercise_deadline")
    );
    assert_eq!(
        staged["staged"][0]["risk_reasons"][0]["code"],
        json!("exercise_deadline_added"),
        "{staged}"
    );
    let read = fixture
        .call(
            "get_exercise",
            json!({"course": fixture.course_id, "exercise": exercise.id}),
        )
        .await;
    assert_eq!(read["exercise"]["deadline"], staged["deadline"]);

    let changeset = changeset_id(staged);
    let mut conn = fixture.pool.acquire().await.unwrap();
    let row = agent_changesets::get_by_id(&mut conn, changeset)
        .await
        .unwrap();
    let review = get_review(&mut conn, row).await.unwrap();
    let ReviewEntity::Page(page) = &review.entities[0] else {
        panic!("{:?}", review.entities[0]);
    };
    let fields: Vec<String> = page
        .change
        .field_changes
        .iter()
        .map(|change| format!("{:?}", change.field))
        .collect();
    assert_eq!(fields, vec!["ExerciseDeadline"]);

    let refused = fixture
        .call(
            "publish_changeset",
            json!({"course": fixture.course_id, "changeset": changeset}),
        )
        .await;
    assert_eq!(refused["published"], json!(false), "{refused}");
    let revision = fixture.changeset_revision(changeset).await;
    let outcome = fixture.publish_reviewed(changeset, revision).await;
    assert!(
        matches!(outcome, PublishOutcome::Published { .. }),
        "{outcome:?}"
    );
    assert_eq!(
        fixture.live_exercise_row(&exercise).await.deadline,
        Some(DEADLINE.parse().unwrap())
    );

    let reverted = fixture
        .call(
            "revert_change",
            json!({"course": fixture.course_id, "call": staged["call"]}),
        )
        .await;
    assert!(
        reverted["staged"][0].get("risk_reasons").is_none(),
        "{reverted}"
    );
    fixture.publish(&reverted).await;
    assert_eq!(fixture.live_exercise_row(&exercise).await.deadline, None);
}

#[tokio::test]
async fn every_reclassification_sees_the_deadline() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    fixture.set_draft(true).await;
    let staged = fixture
        .set_exercise_deadline(&exercise, json!(DEADLINE))
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");
    let changeset = changeset_id(&staged["structuredContent"]);
    let reviewed = fixture.changeset_revision(changeset).await;
    fixture.set_draft(false).await;

    let outcome = fixture.publish_reviewed(changeset, reviewed).await;
    assert!(
        matches!(
            outcome,
            PublishOutcome::Rejected {
                rejection: PublishRejection::ChangedSinceReview(_)
            }
        ),
        "{outcome:?}"
    );
    assert_eq!(
        fixture
            .stored_risk_reasons(changeset, fixture.page_id)
            .await,
        vec![deadline_added(&exercise)]
    );

    fixture
        .call(
            "patch_course_structure",
            json!({"course": fixture.course_id, "ops": [
                {"op": "replace", "path": format!("/{}/name", fixture.chapter_id), "value": "Renamed"},
            ]}),
        )
        .await;
    assert_eq!(
        fixture
            .stored_risk_reasons(changeset, fixture.page_id)
            .await,
        vec![deadline_added(&exercise)]
    );
    let discarded = fixture
        .call(
            "discard_changeset",
            json!({"course": fixture.course_id, "changeset": changeset, "entities": [fixture.chapter_id]}),
        )
        .await;
    assert_eq!(
        discarded["discarded"].as_array().map(Vec::len),
        Some(1),
        "{discarded}"
    );
    assert_eq!(
        fixture
            .stored_risk_reasons(changeset, fixture.page_id)
            .await,
        vec![deadline_added(&exercise)]
    );

    let refused = fixture
        .call(
            "publish_changeset",
            json!({"course": fixture.course_id, "changeset": changeset}),
        )
        .await;
    assert_eq!(
        refused["risky_entities"][0]["risk_reasons"][0]["code"],
        json!("exercise_deadline_added"),
        "{refused}"
    );
}

#[tokio::test]
async fn a_deadline_changed_live_conflicts_at_publish() {
    let fixture = Fixture::new().await;
    let exercise = fixture.add_exercise(false).await;
    fixture.set_draft(true).await;
    let staged = fixture
        .set_exercise_deadline(&exercise, json!(DEADLINE))
        .await;
    assert_eq!(staged["isError"], json!(false), "{staged}");
    let mut conn = fixture.pool.acquire().await.unwrap();
    exercises::set_deadline(&mut conn, exercise.id, Some(chrono::Utc::now()))
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
}

// Publishing is left out: the test exercise type has no service, and a moved task's specs are
// derived again on its new page.
#[tokio::test]
async fn a_moved_exercise_keeps_its_staged_deadline() {
    for is_move_first in [true, false] {
        let fixture = Fixture::new().await;
        let exercise = fixture.add_exercise(false).await;
        let other_page = fixture.add_page("Arrays", "/chapter-1/arrays").await;
        let staged = if is_move_first {
            fixture.move_exercise_to(&exercise, other_page).await;
            fixture
                .set_exercise_deadline(&exercise, json!(DEADLINE))
                .await
        } else {
            let staged = fixture
                .set_exercise_deadline(&exercise, json!(DEADLINE))
                .await;
            fixture.move_exercise_to(&exercise, other_page).await;
            staged
        };
        assert_eq!(staged["isError"], json!(false), "{staged}");
        let changeset = changeset_id(&staged["structuredContent"]);
        let read = fixture
            .call(
                "get_exercise",
                json!({"course": fixture.course_id, "exercise": exercise.id}),
            )
            .await;
        assert_eq!(read["exercise"]["page"], json!(other_page));
        assert_eq!(
            read["exercise"]["deadline"]["own"],
            json!("2099-01-01T10:00:00Z")
        );
        assert_eq!(
            fixture.stored_risk_reasons(changeset, other_page).await,
            vec![deadline_added(&exercise)],
            "move first: {is_move_first}"
        );

        let mut conn = fixture.pool.acquire().await.unwrap();
        let row = agent_changeset_entities::get_one(
            &mut conn,
            changeset,
            EntityKey::new(ContentEntityType::Page, other_page),
        )
        .await
        .unwrap()
        .unwrap();
        let Some(EntitySnapshot::Page(page)) = row.after_snapshot else {
            panic!("{row:?}");
        };
        let staged_exercise = page.exercises.iter().find(|e| e.id == exercise.id).unwrap();
        assert_eq!(staged_exercise.deadline, Some(DEADLINE.parse().unwrap()));
    }
}
