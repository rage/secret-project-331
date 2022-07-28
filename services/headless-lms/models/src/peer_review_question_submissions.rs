use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewQuestionSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
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

pub async fn get_by_peer_review_question_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<PeerReviewQuestionSubmission> {
    let res = sqlx::query_as!(
        PeerReviewQuestionSubmission,
        "
    SELECT id,
    created_at,
    updated_at,
    deleted_at,
    peer_review_question_id,
    peer_review_submission_id,
    text_data,
    number_data
    FROM peer_review_question_submissions
    WHERE peer_review_question_id = $1
        AND deleted_at IS NULL;
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_received_question_submissions_for_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Vec<PeerReviewQuestionSubmission>> {
    let res = sqlx::query_as!(
        PeerReviewQuestionSubmission,
        "
SELECT prqs.*
FROM peer_review_submissions prs
  JOIN peer_review_question_submissions prqs on prs.id = prqs.peer_review_submission_id
WHERE prs.exercise_slide_submission_id = $1
  AND prs.deleted_at IS NULL
  AND prqs.deleted_at IS NULL
    ",
        exercise_slide_submission_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
