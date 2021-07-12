use anyhow::Result;
use sqlx::PgConnection;
use uuid::Uuid;

pub struct RegradingSubmission {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub grading_before_regrading: Uuid,
    pub grading_after_regrading: Option<Uuid>,
    pub requires_manual_review: Option<String>,
}

pub async fn insert(
    conn: &mut PgConnection,
    regrading_id: Uuid,
    submission_id: Uuid,
    grading_before_regrading_id: Uuid,
) -> Result<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO regrading_submissions (
    regrading_id,
    submission_id,
    grading_before_regrading
  )
VALUES ($1, $2, $3)
RETURNING id
",
        regrading_id,
        submission_id,
        grading_before_regrading_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_regrading_submission(
    conn: &mut PgConnection,
    regrading_submission_id: Uuid,
) -> Result<RegradingSubmission> {
    let res = sqlx::query_as!(
        RegradingSubmission,
        "
SELECT id,
  submission_id,
  grading_before_regrading,
  grading_after_regrading,
  requires_manual_review
FROM regrading_submissions
WHERE id = $1
",
        regrading_submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_regrading_submissions(
    conn: &mut PgConnection,
    regrading_id: Uuid,
) -> Result<Vec<RegradingSubmission>> {
    let res = sqlx::query_as!(
        RegradingSubmission,
        "
SELECT id,
  submission_id,
  grading_before_regrading,
  grading_after_regrading,
  requires_manual_review
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

pub async fn set_requires_manual_review(
    conn: &mut PgConnection,
    regrading_submission_id: Uuid,
    reason: &str,
) -> Result<()> {
    sqlx::query!(
        "
UPDATE regrading_submissions
SET requires_manual_review = $1
WHERE id = $2
",
        reason,
        regrading_submission_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
