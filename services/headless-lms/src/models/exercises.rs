use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use ts_rs::TS;
use uuid::Uuid;

use crate::models::{
    exercise_service_info::get_course_material_service_info_by_exercise_type,
    exercise_tasks::get_random_exercise_task, ModelError,
};

use super::{
    exercise_service_info::CourseMaterialExerciseServiceInfo,
    exercise_tasks::CourseMaterialExerciseTask,
    user_exercise_states::get_user_exercise_state_if_exits,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct Exercise {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub page_id: Uuid,
    pub chapter_id: Uuid,
    pub deadline: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub score_maximum: i32,
    pub order_number: i32,
    pub copied_from: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct PlaygroundExample {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub name: String,
    pub url: String,
    pub width: i32,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct PlaygroundExampleData {
    pub name: String,
    pub url: String,
    pub width: i32,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct CourseMaterialExercise {
    pub exercise: Exercise,
    pub current_exercise_task: CourseMaterialExerciseTask,
    /**
    If none, the task is not completable at the moment because the service needs to
    be configured to the system.
    */
    pub current_exercise_task_service_info: Option<CourseMaterialExerciseServiceInfo>,
    /// None for logged out users.
    pub exercise_status: Option<ExerciseStatus>,
}

/**
Indicates what is the user's completion status for a exercise.

As close as possible to LTI's activity progress for compatibility: https://www.imsglobal.org/spec/lti-ags/v2p0#activityprogress.
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type, TS)]
#[sqlx(type_name = "activity_progress", rename_all = "snake_case")]
pub enum ActivityProgress {
    /// The user has not started the activity, or the activity has been reset for that student.
    Initialized,
    /// The activity associated with the exercise has been started by the user to which the result relates.
    Started,
    /// The activity is being drafted and is available for comment.
    InProgress,
    /// The activity has been submitted at least once by the user but the user is still able make further submissions.
    Submitted,
    /// The user has completed the activity associated with the exercise.
    Completed,
}

/**

Tells what's the status of the grading progress for a user and exercise.

As close as possible LTI's grading progress for compatibility: https://www.imsglobal.org/spec/lti-ags/v2p0#gradingprogress
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type, TS)]
#[sqlx(type_name = "grading_progress", rename_all = "kebab-case")]
pub enum GradingProgress {
    /// The grading process is completed; the score value, if any, represents the current Final Grade;
    FullyGraded,
    /// Final Grade is pending, but does not require manual intervention; if a Score value is present, it indicates the current value is partial and may be updated.
    Pending,
    /// Final Grade is pending, and it does require human intervention; if a Score value is present, it indicates the current value is partial and may be updated during the manual grading.
    PendingManual,
    /// The grading could not complete.
    Failed,
    /// There is no grading process occurring; for example, the student has not yet made any submission.
    NotReady,
}

impl GradingProgress {
    pub fn is_complete(self) -> bool {
        self == Self::FullyGraded || self == Self::Failed
    }
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct ExerciseStatus {
    // None when grading has not completed yet. Max score can be found from the associated exercise.
    score_given: Option<f32>,
    activity_progress: ActivityProgress,
    grading_progress: GradingProgress,
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    name: &str,
    page_id: Uuid,
    chapter_id: Uuid,
    order_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercises (course_id, name, page_id, chapter_id, order_number)
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
        course_id,
        name,
        page_id,
        chapter_id,
        order_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Exercise> {
    let exercise = sqlx::query_as!(
        Exercise,
        "
SELECT *
FROM exercises
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise)
}

pub async fn get_exercise_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Exercise> {
    let exercise = sqlx::query_as!(Exercise, "SELECT * FROM exercises WHERE id = $1;", id)
        .fetch_one(conn)
        .await?;
    Ok(exercise)
}

pub async fn get_exercises_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Exercise>> {
    let exercises = sqlx::query_as!(
        Exercise,
        r#"
SELECT *
FROM exercises
WHERE course_id = $1
  AND deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(exercises)
}

pub async fn get_exercises_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Vec<Exercise>> {
    let exercises = sqlx::query_as!(
        Exercise,
        r#"
SELECT *
FROM exercises
WHERE page_id = $1
  AND deleted_at IS NULL
"#,
        page_id,
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(exercises)
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let course_id = sqlx::query!("SELECT course_id FROM exercises WHERE id = $1;", id)
        .fetch_one(conn)
        .await?
        .course_id;
    Ok(course_id)
}

pub async fn get_course_material_exercise(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    exercise_id: Uuid,
) -> ModelResult<CourseMaterialExercise> {
    let exercise = get_by_id(conn, exercise_id).await?;

    let mut current_course_instance_id: Option<Uuid> = None;
    // if the user is logged in, take the previously selected task or select a new one
    let selected_exercise_task = if let Some(user_id) = user_id {
        // user is logged in, see if they're enrolled on the course
        current_course_instance_id = sqlx::query!(
            r#"
SELECT course_instance_id AS id
FROM course_instance_enrollments
WHERE course_id = $1
  AND user_id = $2
  AND current = TRUE
  AND deleted_at IS NULL
"#,
            exercise.course_id,
            user_id
        )
        .fetch_optional(&mut *conn)
        .await?
        .map(|r| r.id);

        if let Some(current_course_instance_id) = current_course_instance_id {
            // user is enrolled on an instance of the given course, see if a task has already been selected
            let selected_exercise_task_id: Option<Uuid> = sqlx::query!(
                r#"
SELECT selected_exercise_task_id AS "id!"
FROM user_exercise_states
WHERE user_id = $1
  AND selected_exercise_task_id IS NOT NULL
  AND exercise_id = $2
  AND course_instance_id = $3
  AND deleted_at IS NULL
            "#,
                user_id,
                exercise.id,
                current_course_instance_id
            )
            .fetch_optional(&mut *conn)
            .await?
            .map(|r| r.id);

            if let Some(selected_exercise_task_id) = selected_exercise_task_id {
                // a task has previously been selected, return it
                sqlx::query_as!(
                    CourseMaterialExerciseTask,
                    "
SELECT id,
  exercise_id,
  exercise_type,
  assignment,
  public_spec
FROM exercise_tasks
WHERE id = $1
                ",
                    selected_exercise_task_id
                )
                .fetch_one(&mut *conn)
                .await?
            } else {
                // no task has been selected
                // Exercise task contains the actual assignment and activity
                // What exercise task to give for the student depends on the
                // exercise -- for now we'll give a random exercise task to the student
                // this could be changed by creating a policy in the exercise.
                let selected_exercise_task = get_random_exercise_task(conn, exercise_id).await?;
                sqlx::query!(
                    "
INSERT INTO user_exercise_states (
    user_id,
    exercise_id,
    course_instance_id,
    selected_exercise_task_id
  )
VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, exercise_id, course_instance_id) DO
UPDATE
SET selected_exercise_task_id = $4
",
                    user_id,
                    exercise_id,
                    current_course_instance_id,
                    selected_exercise_task.id,
                )
                .execute(&mut *conn)
                .await?;
                selected_exercise_task
            }
        } else {
            // user is not enrolled on the course, return error
            return Err(ModelError::PreconditionFailed(
                "User must be enrolled to the course".to_string(),
            ));
        }
    } else {
        // user is not logged in, get a random task
        get_random_exercise_task(conn, exercise_id).await?
    };

    let current_exercise_task_service_info = get_course_material_service_info_by_exercise_type(
        conn,
        &selected_exercise_task.exercise_type,
    )
    .await?;

    let user_exercise_state = if let Some(logged_in_user_id) = user_id {
        if let Some(current_course_instance_id) = current_course_instance_id {
            get_user_exercise_state_if_exits(
                conn,
                logged_in_user_id,
                exercise.id,
                current_course_instance_id,
            )
            .await?
        } else {
            None
        }
    } else {
        None
    };

    let mut score_given = None;
    let mut activity_progress = ActivityProgress::Initialized;
    let mut grading_progress = GradingProgress::NotReady;
    if let Some(user_exercise_state) = user_exercise_state {
        score_given = user_exercise_state.score_given;
        activity_progress = user_exercise_state.activity_progress;
        grading_progress = user_exercise_state.grading_progress;
    }

    Ok(CourseMaterialExercise {
        exercise,
        current_exercise_task: selected_exercise_task,
        exercise_status: Some(ExerciseStatus {
            score_given,
            activity_progress,
            grading_progress,
        }),
        current_exercise_task_service_info,
    })
}

pub async fn get_all_playground_examples(
    conn: &mut PgConnection,
) -> ModelResult<Vec<PlaygroundExample>> {
    let examples = sqlx::query_as!(
        PlaygroundExample,
        "
SELECT *
from playground_examples
WHERE deleted_at IS NULL;
    "
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(examples)
}

pub async fn insert_playground_example(
    conn: &mut PgConnection,
    data: PlaygroundExampleData,
) -> ModelResult<PlaygroundExample> {
    let res = sqlx::query!(
        "
INSERT INTO playground_examples (name, url, width, data)
VALUES ($1, $2, $3, $4)
RETURNING *;
    ",
        data.name,
        data.url,
        data.width,
        data.data
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(PlaygroundExample {
        id: res.id,
        created_at: res.created_at,
        updated_at: res.updated_at,
        deleted_at: res.deleted_at,
        name: res.name,
        url: res.url,
        width: res.width,
        data: res.data,
    })
}

pub async fn delete_playground_example(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<PlaygroundExample> {
    let res = sqlx::query!(
        "
UPDATE playground_examples
SET deleted_at = now()
WHERE id = $1
RETURNING *;
    ",
        id
    )
    .fetch_one(&mut *conn)
    .await
    .unwrap();

    Ok(PlaygroundExample {
        id: res.id,
        created_at: res.created_at,
        updated_at: res.updated_at,
        deleted_at: res.deleted_at,
        name: res.name,
        url: res.url,
        width: res.width,
        data: res.data,
    })
}

#[cfg(test)]
mod test {
    use serde_json::Value;

    use super::*;
    use crate::{
        models::{
            chapters, course_instance_enrollments, course_instances, courses, exercise_tasks,
            organizations, pages, users,
        },
        test_helper::Conn,
        utils::document_schema_processor::GutenbergBlock,
    };

    #[tokio::test]
    async fn selects_course_material_exercise_for_enrolled_student() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let user_id = users::insert_with_id(
            tx.as_mut(),
            "test@example.com",
            Uuid::parse_str("e656e0a1-3f55-4f52-b0ae-96855faee5e7").unwrap(),
        )
        .await
        .unwrap();
        let organization_id = organizations::insert(
            tx.as_mut(),
            "",
            "",
            "",
            Uuid::parse_str("8c34e601-b5db-4b33-a588-57cb6a5b1669").unwrap(),
        )
        .await
        .unwrap();
        let course_id = courses::insert(tx.as_mut(), "", organization_id, "", "en-US")
            .await
            .unwrap();
        let course_instance = course_instances::insert(tx.as_mut(), course_id, None, None)
            .await
            .unwrap();
        course_instance_enrollments::insert(
            tx.as_mut(),
            user_id,
            course_id,
            course_instance.id,
            true,
        )
        .await
        .unwrap();
        let chapter_id = chapters::insert(tx.as_mut(), "", course_id, 0)
            .await
            .unwrap();
        let (page_id, _) = pages::insert(tx.as_mut(), course_id, "", "", 0, user_id)
            .await
            .unwrap();
        let exercise_id = super::insert(tx.as_mut(), course_id, "", page_id, chapter_id, 0)
            .await
            .unwrap();
        let exercise_task_id = exercise_tasks::insert(
            tx.as_mut(),
            exercise_id,
            "",
            vec![GutenbergBlock {
                attributes: Value::Null,
                client_id: "".to_string(),
                inner_blocks: vec![],
                is_valid: true,
                name: "".to_string(),
            }],
            Value::Null,
            Value::Null,
            Value::Null,
        )
        .await
        .unwrap();

        let res = sqlx::query!(
            "
SELECT selected_exercise_task_id AS id
FROM user_exercise_states
WHERE user_id = $1
  AND exercise_id = $2
  AND course_instance_id = $3
",
            user_id,
            exercise_id,
            course_instance.id
        )
        .fetch_optional(tx.as_mut())
        .await
        .unwrap();
        assert!(res.is_none());

        let exercise = get_course_material_exercise(tx.as_mut(), Some(user_id), exercise_id)
            .await
            .unwrap();
        assert_eq!(exercise.current_exercise_task.id, exercise_task_id);

        let res = sqlx::query!(
            "
SELECT selected_exercise_task_id AS id
FROM user_exercise_states
WHERE user_id = $1
  AND exercise_id = $2
  AND course_instance_id = $3
",
            user_id,
            exercise_id,
            course_instance.id
        )
        .fetch_one(tx.as_mut())
        .await
        .unwrap();
        assert_eq!(res.id.unwrap(), exercise_task_id);
    }

    #[tokio::test]
    async fn insert_and_fetch_playground_example() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let inserted_data = insert_playground_example(
            tx.as_mut(),
            PlaygroundExampleData {
                name: "test".to_string(),
                url: "https:\\test.com".to_string(),
                width: 500,
                data: serde_json::json!({"data":"test"}),
            },
        )
        .await
        .unwrap();

        assert!(inserted_data.name == "test".to_string());
        assert!(inserted_data.url == "https:\\test.com".to_string());
        assert!(inserted_data.width == 500);
        assert!(inserted_data.data == serde_json::json!({"data":"test"}));

        let fetched_data = get_all_playground_examples(tx.as_mut()).await.unwrap();

        assert_eq!(fetched_data.len(), 1);
    }

    #[tokio::test]
    async fn insert_and_delete_playground_example() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let inserted_data = insert_playground_example(
            tx.as_mut(),
            PlaygroundExampleData {
                name: "test".to_string(),
                url: "https:\\test.com".to_string(),
                width: 500,
                data: serde_json::json!({"data":"test"}),
            },
        )
        .await
        .unwrap();

        assert!(inserted_data.name == "test".to_string());
        assert!(inserted_data.url == "https:\\test.com".to_string());
        assert!(inserted_data.width == 500);
        assert!(inserted_data.data == serde_json::json!({"data":"test"}));

        let res = delete_playground_example(tx.as_mut(), inserted_data.id)
            .await
            .unwrap();

        assert!(res.deleted_at != None);

        let fetched_data = get_all_playground_examples(tx.as_mut()).await.unwrap();

        assert_eq!(fetched_data.len(), 0);
    }
}
