use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgPool};
use uuid::Uuid;

use crate::models::exercise_items::get_random_exercise_item;

use super::exercise_items::CourseMaterialExerciseItem;

#[derive(Debug, Serialize, Deserialize)]
pub struct Exercise {
    pub id: Uuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub name: String,
    pub course_id: Uuid,
    pub page_id: Uuid,
    pub deadline: Option<NaiveDateTime>,
    pub deleted: bool,
    pub score_maximum: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseMaterialExercise {
    pub exercise: Exercise,
    pub current_exercise_item: CourseMaterialExerciseItem,
    /// None for logged out users.
    pub exercise_status: Option<ExerciseStatus>,
}

/**
Indicates what is the user's completion status for a exercise.

As close as possible to LTI's activity progress for compatibility: https://www.imsglobal.org/spec/lti-ags/v2p0#activityprogress.
*/
#[derive(Debug, Serialize, Deserialize)]
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
#[sqlx(type_name = "grading_progress", rename_all = "kebab-case")]
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, sqlx::Type)]
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseStatus {
    // None when grading has not completed yet. Max score can be found from the associated exercise.
    score_given: Option<f32>,
    activity_progress: ActivityProgress,
    grading_progress: GradingProgress,
}

pub async fn get_exercise(pool: &PgPool, exercise_id: Uuid) -> Result<Exercise> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let exercise = sqlx::query_as!(
        Exercise,
        "SELECT * FROM exercises WHERE id = $1;",
        exercise_id
    )
    .fetch_one(connection)
    .await?;
    return Ok(exercise);
}

pub async fn get_exercise_by_id(pool: &PgPool, id: Uuid) -> Result<Exercise> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let exercise = sqlx::query_as!(Exercise, "SELECT * FROM exercises WHERE id = $1;", id)
        .fetch_one(connection)
        .await?;
    Ok(exercise)
}

pub async fn get_course_material_exercise(
    pool: &PgPool,
    exercise_id: Uuid,
) -> Result<CourseMaterialExercise> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let exercise = sqlx::query_as!(
        Exercise,
        "SELECT * FROM exercises WHERE id = $1;",
        exercise_id
    )
    .fetch_one(connection)
    .await?;
    // Exercise item contains the actual assignment and activity
    // What exercise item to give for the student depends on the
    // exercise -- for now we'll give a random exercise item to the student
    // this could be changed by creating a policy in the exercise.
    let current_exercise_item = get_random_exercise_item(&pool, exercise_id).await?;
    return Ok(CourseMaterialExercise {
        exercise,
        current_exercise_item,
        exercise_status: Some(ExerciseStatus {
            score_given: None,
            activity_progress: ActivityProgress::Initialized,
            grading_progress: GradingProgress::NotReady,
        }),
    });
}
