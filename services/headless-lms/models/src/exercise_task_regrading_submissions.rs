use crate::prelude::*;

pub struct ExerciseTaskRegradingSubmission {
    pub id: Uuid,
    pub exercise_task_submission_id: Uuid,
    pub grading_before_regrading: Uuid,
    pub grading_after_regrading: Option<Uuid>,
    pub regrading_id: Uuid,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    regrading_id: Uuid,
    exercise_task_submission_id: Uuid,
    grading_before_regrading_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_task_regrading_submissions (
    id,
    regrading_id,
    exercise_task_submission_id,
    grading_before_regrading
  )
VALUES ($1, $2, $3, $4)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        regrading_id,
        exercise_task_submission_id,
        grading_before_regrading_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_regrading_submission(
    conn: &mut PgConnection,
    exercise_task_regrading_submission_id: Uuid,
) -> ModelResult<ExerciseTaskRegradingSubmission> {
    let res = sqlx::query_as!(
        ExerciseTaskRegradingSubmission,
        "
SELECT id,
  exercise_task_submission_id,
  grading_before_regrading,
  grading_after_regrading,
  regrading_id
FROM exercise_task_regrading_submissions
WHERE id = $1
",
        exercise_task_regrading_submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_regrading_submissions(
    conn: &mut PgConnection,
    regrading_id: Uuid,
) -> ModelResult<Vec<ExerciseTaskRegradingSubmission>> {
    let res = sqlx::query_as!(
        ExerciseTaskRegradingSubmission,
        "
SELECT id,
  exercise_task_submission_id,
  grading_before_regrading,
  grading_after_regrading,
  regrading_id
FROM exercise_task_regrading_submissions
WHERE regrading_id = $1
",
        regrading_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn set_grading_after_regrading(
    conn: &mut PgConnection,
    exercise_task_regrading_submission_id: Uuid,
    new_grading_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_task_regrading_submissions
SET grading_after_regrading = $1
WHERE id = $2
",
        new_grading_id,
        exercise_task_regrading_submission_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
