use crate::{
    exercise_task_gradings::UserPointsUpdateStrategy, exercises::GradingProgress, prelude::*,
};

pub struct Regrading {
    pub id: Uuid,
    pub regrading_started_at: Option<DateTime<Utc>>,
    pub regrading_completed_at: Option<DateTime<Utc>>,
    pub total_grading_progress: GradingProgress,
    pub user_points_update_strategy: UserPointsUpdateStrategy,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_points_update_strategy: UserPointsUpdateStrategy,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO regradings (user_points_update_strategy)
VALUES ($1)
RETURNING id
        ",
        user_points_update_strategy as UserPointsUpdateStrategy
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Regrading> {
    let res = sqlx::query_as!(
        Regrading,
        r#"
SELECT id,
  regrading_started_at,
  regrading_completed_at,
  total_grading_progress AS "total_grading_progress: _",
  user_points_update_strategy AS "user_points_update_strategy: _"
FROM regradings
WHERE id = $1
"#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_uncompleted_regradings_and_mark_as_started(
    conn: &mut PgConnection,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        r#"
UPDATE regradings
SET regrading_started_at = CASE
    WHEN regrading_started_at IS NULL THEN now()
    ELSE regrading_started_at
  END
WHERE regrading_completed_at IS NULL
  AND deleted_at IS NULL
RETURNING id
"#
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|r| r.id)
    .collect();

    Ok(res)
}

pub async fn set_total_grading_progress(
    conn: &mut PgConnection,
    regrading_id: Uuid,
    progress: GradingProgress,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE regradings
SET total_grading_progress = $1
WHERE id = $2
",
        progress as GradingProgress,
        regrading_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn complete_regrading(conn: &mut PgConnection, regrading_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE regradings
SET regrading_completed_at = now(),
  total_grading_progress = 'fully-graded'
WHERE id = $1
",
        regrading_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_error_message(
    conn: &mut PgConnection,
    regrading_id: Uuid,
    error_message: &str,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE regradings
SET error_message = $1
WHERE id = $2
",
        error_message,
        regrading_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
