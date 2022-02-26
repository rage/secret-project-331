use crate::{
    exercises::{ActivityProgress, GradingProgress},
    prelude::*,
};

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct UserExerciseTaskState {
    pub exercise_task_id: Uuid,
    pub user_exercise_state_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
    pub activity_progress: ActivityProgress,
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    user_exercise_state_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO user_exercise_task_states (
    exercise_task_id,
    user_exercise_state_id
  )
VALUES ($1, $2)
        ",
        exercise_task_id,
        user_exercise_state_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    user_exercise_state_id: Uuid,
) -> ModelResult<UserExerciseTaskState> {
    let res = sqlx::query_as!(
        UserExerciseTaskState,
        r#"
SELECT exercise_task_id,
  user_exercise_state_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  grading_progress as "grading_progress: _",
  activity_progress as "activity_progress: _"
FROM user_exercise_task_states
WHERE exercise_task_id = $1
  AND user_exercise_state_id = $2
  AND deleted_at IS NULL
        "#,
        exercise_task_id,
        user_exercise_state_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    user_exercise_state_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE user_exercise_task_states
SET deleted_at = now()
WHERE exercise_task_id = $1
  AND user_exercise_state_id = $2
    ",
        exercise_task_id,
        user_exercise_state_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}
