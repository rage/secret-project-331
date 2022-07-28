use std::collections::HashMap;

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
    pub question: String,
    pub question_type: PeerReviewQuestionType,
    pub answer_required: bool,
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
    pub question: String,
    pub question_type: PeerReviewQuestionType,
    pub answer_required: bool,
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
    question,
    question_type,
    answer_required
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id;
        ",
        new_peer_review_question.peer_review_id,
        new_peer_review_question.order_number,
        new_peer_review_question.question,
        new_peer_review_question.question_type as PeerReviewQuestionType,
        new_peer_review_question.answer_required,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert_with_id(
    conn: &mut PgConnection,
    id: Uuid,
    new_peer_review_question: &NewPeerReviewQuestion,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_questions (
    id,
    peer_review_id,
    order_number,
    question,
    question_type,
    answer_required
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id;
        ",
        id,
        new_peer_review_question.peer_review_id,
        new_peer_review_question.order_number,
        new_peer_review_question.question,
        new_peer_review_question.question_type as PeerReviewQuestionType,
        new_peer_review_question.answer_required,
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
  question,
  question_type AS "question_type: _",
  answer_required
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

pub async fn get_by_peer_review_id(
    conn: &mut PgConnection,
    peer_review_id: Uuid,
) -> ModelResult<PeerReviewQuestion> {
    let res = sqlx::query_as!(
        PeerReviewQuestion,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  peer_review_id,
  order_number,
  question,
  question_type AS "question_type: _",
  answer_required
FROM peer_review_questions
WHERE peer_review_id = $1
  AND deleted_at IS NULL;
        "#,
        peer_review_id,
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
    question,
    question_type AS "question_type: _",
    answer_required
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

pub async fn get_all_by_peer_review_id_as_map(
    conn: &mut PgConnection,
    peer_review_id: Uuid,
) -> ModelResult<HashMap<Uuid, PeerReviewQuestion>> {
    let res = get_all_by_peer_review_id(conn, peer_review_id)
        .await?
        .into_iter()
        .map(|x| (x.id, x))
        .collect();
    Ok(res)
}
