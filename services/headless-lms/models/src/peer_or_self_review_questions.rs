use std::collections::HashMap;

use sqlx::{Postgres, QueryBuilder, Row};

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "peer_review_question_type", rename_all = "snake_case")]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum PeerOrSelfReviewQuestionType {
    Essay,
    Scale,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CmsPeerOrSelfReviewQuestion {
    pub id: Uuid,
    pub peer_or_self_review_config_id: Uuid,
    pub order_number: i32,
    pub question: String,
    pub question_type: PeerOrSelfReviewQuestionType,
    pub answer_required: bool,
    pub weight: f32,
}

impl From<PeerOrSelfReviewQuestion> for CmsPeerOrSelfReviewQuestion {
    fn from(prq: PeerOrSelfReviewQuestion) -> Self {
        Self {
            id: prq.id,
            peer_or_self_review_config_id: prq.peer_or_self_review_config_id,
            order_number: prq.order_number,
            question: prq.question,
            question_type: prq.question_type,
            answer_required: prq.answer_required,
            weight: prq.weight,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerOrSelfReviewQuestion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub peer_or_self_review_config_id: Uuid,
    pub order_number: i32,
    pub question: String,
    pub question_type: PeerOrSelfReviewQuestionType,
    pub answer_required: bool,
    pub weight: f32,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new_peer_review_question: &CmsPeerOrSelfReviewQuestion,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_or_self_review_questions (
    id,
    peer_or_self_review_config_id,
    order_number,
    question,
    question_type
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        new_peer_review_question.peer_or_self_review_config_id,
        new_peer_review_question.order_number,
        new_peer_review_question.question,
        new_peer_review_question.question_type as PeerOrSelfReviewQuestionType,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<PeerOrSelfReviewQuestion> {
    let res = sqlx::query_as!(
        PeerOrSelfReviewQuestion,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  peer_or_self_review_config_id,
  order_number,
  question,
  question_type AS "question_type: _",
  answer_required,
  weight
FROM peer_or_self_review_questions
WHERE id = $1
  AND deleted_at IS NULL;
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_ids(
    conn: &mut PgConnection,
    id: &[Uuid],
) -> ModelResult<Vec<PeerOrSelfReviewQuestion>> {
    let res = sqlx::query_as!(
        PeerOrSelfReviewQuestion,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  peer_or_self_review_config_id,
  order_number,
  question,
  question_type AS "question_type: _",
  answer_required,
  weight
FROM peer_or_self_review_questions
WHERE id IN (
    SELECT UNNEST($1::uuid [])
  )
  AND deleted_at IS NULL;
        "#,
        id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_peer_or_self_review_configs_id(
    conn: &mut PgConnection,
    peer_review_id: Uuid,
) -> ModelResult<Vec<PeerOrSelfReviewQuestion>> {
    let res = sqlx::query_as!(
        PeerOrSelfReviewQuestion,
        r#"
SELECT id,
    created_at,
    updated_at,
    deleted_at,
    peer_or_self_review_config_id,
    order_number,
    question,
    question_type AS "question_type: _",
    answer_required,
    weight
FROM peer_or_self_review_questions
WHERE peer_or_self_review_config_id = $1
  AND deleted_at IS NULL;
        "#,
        peer_review_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_by_peer_or_self_review_config_id(
    conn: &mut PgConnection,
    peer_or_self_review_config_id: Uuid,
) -> ModelResult<Vec<PeerOrSelfReviewQuestion>> {
    let res = sqlx::query_as!(
        PeerOrSelfReviewQuestion,
        r#"
SELECT id,
    created_at,
    updated_at,
    deleted_at,
    peer_or_self_review_config_id,
    order_number,
    question,
    question_type AS "question_type: _",
    answer_required,
    weight
FROM peer_or_self_review_questions
WHERE peer_or_self_review_config_id = $1
    AND deleted_at IS NULL;
        "#,
        peer_or_self_review_config_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_by_peer_or_self_review_config_id_as_map(
    conn: &mut PgConnection,
    peer_or_self_review_config_id: Uuid,
) -> ModelResult<HashMap<Uuid, PeerOrSelfReviewQuestion>> {
    let res = get_all_by_peer_or_self_review_config_id(conn, peer_or_self_review_config_id)
        .await?
        .into_iter()
        .map(|x| (x.id, x))
        .collect();
    Ok(res)
}

pub async fn get_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Vec<CmsPeerOrSelfReviewQuestion>> {
    let res = sqlx::query_as!(
        CmsPeerOrSelfReviewQuestion,
        r#"
SELECT prq.id as id,
  prq.peer_or_self_review_config_id as peer_or_self_review_config_id,
  prq.order_number as order_number,
  prq.question as question,
  prq.question_type AS "question_type: _",
  prq.answer_required as answer_required,
  prq.weight
from pages p
  join exercises e on p.id = e.page_id
  join peer_or_self_review_configs pr on e.id = pr.exercise_id
  join peer_or_self_review_questions prq on pr.id = prq.peer_or_self_review_config_id
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

pub async fn delete_peer_or_self_review_questions_by_peer_or_self_review_config_ids(
    conn: &mut PgConnection,
    peer_or_self_review_config_ids: &[Uuid],
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
UPDATE peer_or_self_review_questions
SET deleted_at = now()
WHERE peer_or_self_review_config_id = ANY ($1)
AND deleted_at IS NULL
RETURNING id;
    ",
        peer_or_self_review_config_ids
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|x| x.id)
    .collect();
    Ok(res)
}

pub async fn get_course_default_cms_peer_or_self_review_questions(
    conn: &mut PgConnection,
    peer_or_self_review_config_id: Uuid,
) -> ModelResult<Vec<CmsPeerOrSelfReviewQuestion>> {
    let res = sqlx::query_as!(
        CmsPeerOrSelfReviewQuestion,
        r#"
SELECT id,
  peer_or_self_review_config_id,
  order_number,
  question_type AS "question_type: _",
  question,
  answer_required,
  weight
FROM peer_or_self_review_questions
where peer_or_self_review_config_id = $1
  AND deleted_at IS NULL;
    "#,
        peer_or_self_review_config_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

pub async fn upsert_multiple_peer_or_self_review_questions(
    conn: &mut PgConnection,
    peer_or_self_review_questions: &[CmsPeerOrSelfReviewQuestion],
) -> ModelResult<Vec<CmsPeerOrSelfReviewQuestion>> {
    let mut sql: QueryBuilder<Postgres> = sqlx::QueryBuilder::new(
        "INSERT INTO peer_or_self_review_questions (id, peer_or_self_review_config_id, order_number, question_type, question, answer_required) ",
    );

    sql.push_values(peer_or_self_review_questions, |mut x, prq| {
        x.push_bind(prq.id)
            .push_bind(prq.peer_or_self_review_config_id)
            .push_bind(prq.order_number)
            .push_bind(prq.question_type)
            .push_bind(prq.question.as_str())
            .push_bind(prq.answer_required);
    });
    sql.push(
        r#" ON CONFLICT (id) DO
UPDATE
SET peer_or_self_review_config_id = excluded.peer_or_self_review_config_id,
  order_number = excluded.order_number,
  question_type = excluded.question_type,
  question = excluded.question,
  answer_required = excluded.answer_required,
  deleted_at = NULL
RETURNING id;
"#,
    );

    let ids = sql
        .build()
        .fetch_all(&mut *conn)
        .await?
        .iter()
        .map(|x| x.get(0))
        .collect::<Vec<_>>();

    let res = sqlx::query_as!(
        CmsPeerOrSelfReviewQuestion,
        r#"
SELECT id,
  peer_or_self_review_config_id,
  order_number,
  question,
  question_type AS "question_type: _",
  answer_required,
  weight
from peer_or_self_review_questions
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

/** Modifies the questions in memory so that the weights sum to either 0 or 1. */
pub fn normalize_cms_peer_or_self_review_questions(
    peer_or_self_review_questions: &mut [CmsPeerOrSelfReviewQuestion],
) {
    // All scales have to be answered, skipping them does not make sense.
    for question in peer_or_self_review_questions.iter_mut() {
        if question.question_type == PeerOrSelfReviewQuestionType::Scale {
            question.answer_required = true;
        }
    }
    peer_or_self_review_questions.sort_by(|a, b| a.order_number.cmp(&b.order_number));
    info!(
        "Peer review question weights before normalization: {:?}",
        peer_or_self_review_questions
            .iter()
            .map(|x| x.weight)
            .collect::<Vec<_>>()
    );
    let (mut allowed_to_have_weight, mut not_allowed_to_have_weight) =
        peer_or_self_review_questions
            .iter_mut()
            .partition::<Vec<_>, _>(|q| q.question_type == PeerOrSelfReviewQuestionType::Scale);
    let total_weight: f32 = allowed_to_have_weight.iter().map(|x| x.weight).sum();
    if total_weight == 0.0 {
        return;
    }
    for question in allowed_to_have_weight.iter_mut() {
        question.weight /= total_weight;
    }
    for question in not_allowed_to_have_weight.iter_mut() {
        question.weight = 0.0;
    }
    info!(
        "Peer review question weights after normalization: {:?}",
        peer_or_self_review_questions
            .iter()
            .map(|x| x.weight)
            .collect::<Vec<_>>()
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_cms_peer_or_self_review_questions() {
        let mut questions = vec![
            CmsPeerOrSelfReviewQuestion {
                id: Uuid::new_v4(),
                peer_or_self_review_config_id: Uuid::new_v4(),
                order_number: 1,
                question: String::from("Question 1"),
                question_type: PeerOrSelfReviewQuestionType::Scale,
                answer_required: true,
                weight: 2.0,
            },
            CmsPeerOrSelfReviewQuestion {
                id: Uuid::new_v4(),
                peer_or_self_review_config_id: Uuid::new_v4(),
                order_number: 2,
                question: String::from("Question 2"),
                question_type: PeerOrSelfReviewQuestionType::Scale,
                answer_required: true,
                weight: 3.0,
            },
            CmsPeerOrSelfReviewQuestion {
                id: Uuid::new_v4(),
                peer_or_self_review_config_id: Uuid::new_v4(),
                order_number: 3,
                question: String::from("Question 3"),
                question_type: PeerOrSelfReviewQuestionType::Essay,
                answer_required: true,
                weight: 1.0,
            },
        ];

        normalize_cms_peer_or_self_review_questions(&mut questions);

        assert_eq!(questions[0].weight, 2.0 / 5.0);
        assert_eq!(questions[1].weight, 3.0 / 5.0);
        assert_eq!(questions[2].weight, 0.0);
    }
}
