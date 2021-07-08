use anyhow::Result;
use sqlx::PgConnection;
use uuid::Uuid;

pub struct RegradingSubmission {
    pub id: Uuid,
    pub submission_id: Uuid,
}

pub async fn get_regrading_submissions(
    conn: &mut PgConnection,
    regrading_id: Uuid,
) -> Result<Vec<RegradingSubmission>> {
    let res = sqlx::query_as!(
        RegradingSubmission,
        "
SELECT id,
  submission_id
FROM regrading_submissions
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
    regrading_submission_id: Uuid,
    new_grading_id: Uuid,
) -> Result<()> {
    sqlx::query!(
        "
UPDATE regrading_submissions
SET grading_after_regrading = $1
WHERE id = $2
",
        new_grading_id,
        regrading_submission_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
