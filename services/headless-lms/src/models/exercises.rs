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
    exercise_id: Uuid,
) -> Result<CourseMaterialExercise> {
    let exercise = sqlx::query_as!(
        Exercise,
        "SELECT * FROM exercises WHERE id = $1;",
        exercise_id
    )
    .fetch_one(&mut *conn)
    .await?;
    // Exercise task contains the actual assignment and activity
    // What exercise task to give for the student depends on the
    // exercise -- for now we'll give a random exercise task to the student
    // this could be changed by creating a policy in the exercise.
    let current_exercise_task = get_random_exercise_task(conn, exercise_id).await?;
    return Ok(CourseMaterialExercise {
        exercise,
        current_exercise_task,
        exercise_status: Some(ExerciseStatus {
            score_given: None,
            activity_progress: ActivityProgress::Initialized,
            grading_progress: GradingProgress::NotReady,
        }),
    });
}
