use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewQuestionSubmission {
    pub id: Uuid,
    pub created_at: Uuid,
    pub updated_at: Uuid,
    pub deleted_at: Uuid,
    pub peer_review_question_id: Uuid,
    pub peer_review_submission_id: Uuid,
    pub text_data: Option<String>,
    pub number_data: Option<f32>,
}

pub async fn insert(
    conn: &mut PgConnection,
    peer_review_question_id: Uuid,
    peer_review_submission_id: Uuid,
    text_data: Option<String>,
    number_data: Option<f32>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_question_submissions (
    peer_review_question_id,
    peer_review_submission_id,
    text_data,
    number_data
  )
VALUES ($1, $2, $3, $4)
RETURNING id
        ",
        peer_review_question_id,
        peer_review_submission_id,
        text_data,
        number_data,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
