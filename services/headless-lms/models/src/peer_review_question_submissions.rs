use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewQuestionSubmission {
    pub id: Uuid,
    pub created_at: Uuid,
    pub updated_at: Uuid,
    pub deleted_at: Uuid,
    pub peer_review_question_id: Uuid,
    pub peer_review_submission_id: Uuid,
    pub data_json: serde_json::Value,
}

pub async fn insert(
    conn: &mut PgConnection,
    peer_review_question_id: Uuid,
    peer_review_submission_id: Uuid,
    data_json: serde_json::Value,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_question_submissions (
    peer_review_question_id,
    peer_review_submission_id,
    data_json
  )
VALUES ($1, $2, $3)
RETURNING id
        ",
        peer_review_question_id,
        peer_review_submission_id,
        data_json,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
