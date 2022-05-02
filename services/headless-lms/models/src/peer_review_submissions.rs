use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_slide_submission_id: Uuid,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<PeerReviewSubmission> {
    let res = sqlx::query_as!(
        PeerReviewSubmission,
        "
INSERT INTO peer_review_submissions (
    user_id,
    exercise_id,
    exercise_slide_submission_id
  )
VALUES ($1, $2, $3)
RETURNING *
        ",
        user_id,
        exercise_id,
        exercise_slide_submission_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
