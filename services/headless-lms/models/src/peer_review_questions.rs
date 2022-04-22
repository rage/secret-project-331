use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "peer_review_question_type", rename_all = "snake_case")]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum PeerReviewQuestionType {
    Essay,
    Scale,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewPeerReviewQuestion {
    pub peer_review_id: Uuid,
    pub order_number: i32,
    pub title: String,
    pub question_type: PeerReviewQuestionType,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewQuestion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub peer_review_id: Uuid,
    pub order_number: i32,
    pub title: String,
    pub question_type: PeerReviewQuestionType,
}

pub async fn insert(
    conn: &mut PgConnection,
    new_peer_review_question: &NewPeerReviewQuestion,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_questions (
    peer_review_id,
    order_number,
    title,
    question_type
  )
VALUES ($1, $2, $3, $4)
RETURNING id;
        ",
        new_peer_review_question.peer_review_id,
        new_peer_review_question.order_number,
        new_peer_review_question.title,
        new_peer_review_question.question_type as PeerReviewQuestionType,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<PeerReviewQuestion> {
    let res = sqlx::query_as!(
        PeerReviewQuestion,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  peer_review_id,
  order_number,
  title,
  question_type AS "question_type: _"
FROM peer_review_questions
WHERE id = $1
  AND deleted_at IS NULL;
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_by_peer_review_id(
    conn: &mut PgConnection,
    peer_review_id: Uuid,
) -> ModelResult<Vec<PeerReviewQuestion>> {
    let res = sqlx::query_as!(
        PeerReviewQuestion,
        r#"
SELECT id,
    created_at,
    updated_at,
    deleted_at,
    peer_review_id,
    order_number,
    title,
    question_type AS "question_type: _"
FROM peer_review_questions
WHERE peer_review_id = $1
    AND deleted_at IS NULL;
        "#,
        peer_review_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
