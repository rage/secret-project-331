use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::models::exercise_tasks::get_random_exercise_task;

use super::exercise_tasks::CourseMaterialExerciseTask;

#[derive(Debug, Serialize, Deserialize)]
pub struct Exercise {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub page_id: Uuid,
    pub deadline: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub score_maximum: i32,
    pub order_number: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseMaterialExercise {
    pub exercise: Exercise,
    pub current_exercise_task: CourseMaterialExerciseTask,
    /// None for logged out users.
    pub exercise_status: Option<ExerciseStatus>,
}

/**
Indicates what is the user's completion status for a exercise.

As close as possible to LTI's activity progress for compatibility: https://www.imsglobal.org/spec/lti-ags/v2p0#activityprogress.
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
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
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseStatus {
    // None when grading has not completed yet. Max score can be found from the associated exercise.
    score_given: Option<f32>,
    activity_progress: ActivityProgress,
    grading_progress: GradingProgress,
}

pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    course_id: Uuid,
    page_id: Uuid,
) -> Result<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercises (course_id, name, page_id)
VALUES ($1, $2, $3)
RETURNING id
",
        course_id,
        name,
        page_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_exercise(conn: &mut PgConnection, exercise_id: Uuid) -> Result<Exercise> {
    let exercise = sqlx::query_as!(
        Exercise,
        "SELECT * FROM exercises WHERE id = $1;",
        exercise_id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise)
}

pub async fn get_exercise_by_id(conn: &mut PgConnection, id: Uuid) -> Result<Exercise> {
    let exercise = sqlx::query_as!(Exercise, "SELECT * FROM exercises WHERE id = $1;", id)
        .fetch_one(conn)
        .await?;
    Ok(exercise)
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> Result<Uuid> {
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
) -> Result<CourseMaterialExercise> {
    let exercise = get_exercise_by_id(conn, exercise_id).await?;

    // if the user is logged in, take the previously selected task or select a new one
    let selected_exercise_task = if let Some(user_id) = user_id {
        // user is logged in, see if they're enrolled on the course
        let current_course_instance_id: Option<Uuid> = sqlx::query!(
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
            anyhow::bail!("User must be enrolled to the course")
        }
    } else {
        // user is not logged in, get a random task
        get_random_exercise_task(conn, exercise_id).await?
    };

    Ok(CourseMaterialExercise {
        exercise,
        current_exercise_task: selected_exercise_task,
        exercise_status: Some(ExerciseStatus {
            score_given: None,
            activity_progress: ActivityProgress::Initialized,
            grading_progress: GradingProgress::NotReady,
        }),
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
    };

    #[tokio::test]
    #[ignore = "db not set up in CI"]
    async fn selects_course_material_exercise_for_enrolled_student() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let user_id = users::insert(tx.as_mut()).await.unwrap();
        let organization_id = organizations::insert("", "", tx.as_mut()).await.unwrap();
        let course_id = courses::insert(tx.as_mut(), "", "", organization_id)
            .await
            .unwrap();
        let course_instance_id = course_instances::insert(tx.as_mut(), course_id)
            .await
            .unwrap();
        course_instance_enrollments::insert(
            tx.as_mut(),
            user_id,
            course_id,
            course_instance_id,
            true,
        )
        .await
        .unwrap();
        let chapter_id = chapters::insert(tx.as_mut(), "", course_id, 0)
            .await
            .unwrap();
        let page_id = pages::insert(tx.as_mut(), "", Value::Null, 0, "", course_id, chapter_id)
            .await
            .unwrap();
        let exercise_id = super::insert(tx.as_mut(), "", course_id, page_id)
            .await
            .unwrap();
        let exercise_task_id = exercise_tasks::insert(
            tx.as_mut(),
            exercise_id,
            "",
            Value::Null,
            Value::Null,
            Uuid::new_v4(),
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
            course_instance_id
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
            course_instance_id
        )
        .fetch_one(tx.as_mut())
        .await
        .unwrap();
        assert_eq!(res.id.unwrap(), exercise_task_id);
    }
}
