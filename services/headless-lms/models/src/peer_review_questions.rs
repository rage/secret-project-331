use std::collections::HashMap;

use sqlx::{Postgres, QueryBuilder, Row};

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
pub struct CmsPeerReviewQuestion {
    pub id: Uuid,
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
    new_peer_review_question: &CmsPeerReviewQuestion,
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
    new_peer_review_question: &CmsPeerReviewQuestion,
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

pub async fn get_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Vec<CmsPeerReviewQuestion>> {
    let res = sqlx::query_as!(
        CmsPeerReviewQuestion,
        r#"
SELECT prq.id as id,
  prq.peer_review_id as peer_review_id,
  prq.order_number as order_number,
  prq.question as question,
  prq.question_type AS "question_type: _",
  prq.answer_required as answer_required
from pages p
  join exercises e on p.id = e.page_id
  join peer_reviews pr on e.id = pr.exercise_id
  join peer_review_questions prq on pr.id = prq.peer_review_id
where p.id = $1
  AND p.deleted_at IS NULL
  AND e.deleted_at IS NULL
  AND pr.deleted_at IS NULL
  AND prq.deleted_at IS NULL;
  "#,
        page_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

pub async fn delete_peer_review_questions_by_peer_review_ids(
    conn: &mut PgConnection,
    peer_review_ids: &[Uuid],
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
UPDATE peer_review_questions
SET deleted_at = now()
WHERE peer_review_id = ANY ($1)
RETURNING id;
    ",
        peer_review_ids
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|x| x.id)
    .collect();
    Ok(res)
}

pub async fn get_course_default_cms_peer_review_questions(
    conn: &mut PgConnection,
    peer_review_id: Uuid,
) -> ModelResult<Vec<CmsPeerReviewQuestion>> {
    let res = sqlx::query_as!(
        CmsPeerReviewQuestion,
        r#"
SELECT id,
  peer_review_id,
  order_number,
  question_type AS "question_type: _",
  question,
  answer_required
FROM peer_review_questions
where peer_review_id = $1;
    "#,
        peer_review_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

pub async fn upsert_multiple_peer_review_questions(
    conn: &mut PgConnection,
    peer_review_questions: &[CmsPeerReviewQuestion],
) -> ModelResult<Vec<CmsPeerReviewQuestion>> {
    let mut sql:QueryBuilder<Postgres> = sqlx::QueryBuilder::new("INSERT INTO peer_review_questions (peer_review_id, order_number, question_type, question, answer_required) ");

    sql.push_values(peer_review_questions, |mut x, prq| {
        x.push_bind(prq.peer_review_id)
            .push_bind(prq.order_number)
            .push_bind(prq.question.as_str())
            .push_bind(prq.question_type)
            .push_bind(prq.answer_required);
    });
    sql.push(
        " ON CONFLICT (id) DO
    UPDATE
    SET peer_review_id = excluded.peer_review_id,
      order_number = excluded.order_number,
      question_type = excluded.question_type,
      question = excluded.question,
      answer_required = excluded.answer_required,
      deleted_at = NULL RETURNING id;",
    );

    let ids = sql
        .build()
        .fetch_all(&mut *conn)
        .await?
        .iter()
        .map(|x| x.get(0))
        .collect::<Vec<_>>();

    let res = sqlx::query_as!(
        CmsPeerReviewQuestion,
        r#"
SELECT id,
  peer_review_id,
  order_number,
  question,
  question_type AS "question_type: _",
  answer_required
from peer_review_questions
WHERE id IN (
    SELECT UNNEST($1::uuid [])
  )
  AND deleted_at IS NULL;
    "#,
        &ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
