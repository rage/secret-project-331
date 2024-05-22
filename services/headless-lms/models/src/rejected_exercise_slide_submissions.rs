use crate::{
    library::grading::{StudentExerciseSlideSubmission, StudentExerciseTaskSubmission},
    prelude::*,
};

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct RejectedExerciseSlideSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub exercise_slide_id: Uuid,
}

pub async fn insert_rejected_exercise_slide_submission(
    conn: &mut PgConnection,
    rejected_submission: &StudentExerciseSlideSubmission,
    user_id: Uuid,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    let res = sqlx::query!(
        "
INSERT INTO rejected_exercise_slide_submissions (user_id, exercise_slide_id)
VALUES ($1, $2)
RETURNING id
        ",
        user_id,
        rejected_submission.exercise_slide_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    for task in &rejected_submission.exercise_task_submissions {
        insert_rejected_exercise_task_submission(&mut *tx, task, res.id).await?;
    }

    tx.commit().await?;
    Ok(res.id)
}

/// Used internally only by the `insert_rejected_exercise_slide_submission` function.
async fn insert_rejected_exercise_task_submission(
    conn: &mut PgConnection,
    rejected_submission: &StudentExerciseTaskSubmission,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO rejected_exercise_task_submissions (rejected_exercise_slide_submission_id, data_json)
VALUES ($1, $2)
RETURNING id
        ",
        exercise_slide_submission_id,
        rejected_submission.data_json,
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(res.id)
}
