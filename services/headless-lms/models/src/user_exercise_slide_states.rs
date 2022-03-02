use crate::{
    exercises::{ActivityProgress, GradingProgress},
    prelude::*,
};

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct UserExerciseSlideState {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_slide_id: Uuid,
    pub user_exercise_state_id: Uuid,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
    pub activity_progress: ActivityProgress,
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_slide_id: Uuid,
    user_exercise_state_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO user_exercise_slide_states (
    exercise_slide_id,
    user_exercise_state_id
  )
VALUES ($1, $2)
RETURNING id
        ",
        exercise_slide_id,
        user_exercise_state_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get(conn: &mut PgConnection, id: Uuid) -> ModelResult<UserExerciseSlideState> {
    let res = sqlx::query_as!(
        UserExerciseSlideState,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  user_exercise_state_id,
  score_given,
  grading_progress as "grading_progress: _",
  activity_progress as "activity_progress: _"
FROM user_exercise_slide_states
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
UPDATE user_exercise_slide_states
SET deleted_at = now()
WHERE id = $1
RETURNING id
    ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
