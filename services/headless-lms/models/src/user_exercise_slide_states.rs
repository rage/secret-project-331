use crate::prelude::*;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct UserExerciseSlideState {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_slide_id: Uuid,
    pub user_exercise_state_id: Uuid,
    pub score_given: Option<f32>,
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

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<UserExerciseSlideState> {
    let res = sqlx::query_as!(
        UserExerciseSlideState,
        "
SELECT *
FROM user_exercise_slide_states
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_unique_index(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
    exercise_slide_id: Uuid,
) -> ModelResult<Option<UserExerciseSlideState>> {
    let res = sqlx::query_as!(
        UserExerciseSlideState,
        "
SELECT *
FROM user_exercise_slide_states
WHERE user_exercise_state_id = $1
  AND exercise_slide_id = $2
  AND deleted_at IS NULL
        ",
        user_exercise_state_id,
        exercise_slide_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_or_insert_by_unique_index(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
    exercise_slide_id: Uuid,
) -> ModelResult<UserExerciseSlideState> {
    let user_exercise_slide_state =
        get_by_unique_index(conn, user_exercise_state_id, exercise_slide_id).await?;
    if let Some(user_exercise_slide_state) = user_exercise_slide_state {
        Ok(user_exercise_slide_state)
    } else {
        let id = insert(conn, user_exercise_state_id, exercise_slide_id).await?;
        get_by_id(conn, id).await
    }
}

pub async fn get_total_score_by_user_exercise_state_id(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
) -> ModelResult<Option<f32>> {
    let res = sqlx::query!(
        "
SELECT SUM(COALESCE(score_given, 0))
FROM user_exercise_slide_states
WHERE user_exercise_state_id = $1
  AND deleted_at IS NULL
        ",
        user_exercise_state_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.sum)
}

pub async fn update_score_given(
    conn: &mut PgConnection,
    id: Uuid,
    score_given: Option<f32>,
) -> ModelResult<u64> {
    let res = sqlx::query!(
        "
UPDATE user_exercise_slide_states SET
score_given = $1
WHERE id = $2 AND deleted_at IS NULL
        ",
        score_given,
        id,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
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
