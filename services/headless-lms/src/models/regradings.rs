use crate::models::exercises::GradingProgress;
use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use uuid::Uuid;

pub struct Regrading {
    pub id: Uuid,
    pub regrading_started_at: Option<DateTime<Utc>>,
    pub total_grading_progress: GradingProgress,
}

pub async fn get_uncompleted_regradings(conn: &mut PgConnection) -> Result<Vec<Uuid>> {
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

pub async fn set_regrading_completed_at(conn: &mut PgConnection, regrading_id: Uuid) -> Result<()> {
    sqlx::query!(
        "
UPDATE regradings
SET regrading_completed_at = now()
WHERE id = $1
",
        regrading_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
