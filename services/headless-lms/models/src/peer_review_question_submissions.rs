use std::collections::HashMap;

use crate::peer_review_questions::PeerReviewQuestionType;
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
    pkey_policy: PKeyPolicy<Uuid>,
    peer_review_question_id: Uuid,
    peer_review_submission_id: Uuid,
    text_data: Option<String>,
    number_data: Option<f32>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO peer_review_question_submissions (
    id,
    peer_review_question_id,
    peer_review_submission_id,
    text_data,
    number_data
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        peer_review_question_id,
        peer_review_submission_id,
        text_data,
        number_data,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_peer_reviews_question_ids(
    conn: &mut PgConnection,
    ids: &[Uuid],
    user_id: Uuid,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Vec<PeerReviewQuestionSubmission>> {
    let res = sqlx::query_as!(
        PeerReviewQuestionSubmission,
        "
    SELECT qs.id,
        qs.created_at,
        qs.updated_at,
        qs.deleted_at,
        qs.peer_review_question_id,
        qs.peer_review_submission_id,
        qs.text_data,
        qs.number_data
    FROM peer_review_question_submissions qs
        JOIN peer_review_submissions s ON (qs.peer_review_submission_id = s.id)
        JOIN exercise_slide_submissions es ON (s.exercise_slide_submission_id = es.id)
    WHERE peer_review_question_id IN (
        SELECT UNNEST($1::uuid [])
    )
        AND s.exercise_slide_submission_id = $3
        AND es.user_id = $2
        AND qs.deleted_at IS NULL;
        ",
        ids,
        user_id,
        exercise_slide_submission_id
    )
    .fetch_all(conn)
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum PeerReviewAnswer {
    NoAnswer,
    Essay { value: String },
    Scale { value: f32 },
}

impl PeerReviewAnswer {
    fn new(
        question_type: PeerReviewQuestionType,
        text_data: Option<String>,
        number_data: Option<f32>,
    ) -> Self {
        match (question_type, text_data, number_data) {
            (PeerReviewQuestionType::Essay, Some(value), _) => Self::Essay { value },
            (PeerReviewQuestionType::Scale, _, Some(value)) => Self::Scale { value },
            _ => Self::NoAnswer,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewQuestionAndAnswer {
    pub peer_review_config_id: Uuid,
    pub peer_review_question_id: Uuid,
    pub peer_review_submission_id: Uuid,
    pub peer_review_question_submission_id: Uuid,
    pub order_number: i32,
    pub question: String,
    pub answer: PeerReviewAnswer,
    pub answer_required: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerReviewWithQuestionsAndAnswers {
    pub peer_review_submission_id: Uuid,
    pub questions_and_answers: Vec<PeerReviewQuestionAndAnswer>,
}

pub async fn get_peer_review_answers_with_questions_for_submission(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Vec<PeerReviewWithQuestionsAndAnswers>> {
    let res = sqlx::query!(
        r#"
SELECT answers.id AS peer_review_question_submission_id,
  answers.text_data,
  answers.number_data,
  questions.peer_review_config_id,
  questions.id AS peer_review_question_id,
  questions.order_number,
  questions.question,
  questions.question_type AS "question_type: PeerReviewQuestionType",
  questions.answer_required,
  submissions.id AS peer_review_submission_id
FROM peer_review_question_submissions answers
  JOIN peer_review_questions questions ON (
    answers.peer_review_question_id = questions.id
  )
  JOIN peer_review_submissions submissions ON (
    answers.peer_review_submission_id = submissions.id
  )
WHERE submissions.exercise_slide_submission_id = $1
  AND questions.deleted_at IS NULL
  AND answers.deleted_at IS NULL
  AND submissions.deleted_at IS NULL
        "#,
        exercise_slide_submission_id,
    )
    .map(|x| PeerReviewQuestionAndAnswer {
        peer_review_config_id: x.peer_review_config_id,
        peer_review_question_id: x.peer_review_question_id,
        peer_review_question_submission_id: x.peer_review_question_submission_id,
        peer_review_submission_id: x.peer_review_submission_id,
        order_number: x.order_number,
        question: x.question,
        answer: PeerReviewAnswer::new(x.question_type, x.text_data, x.number_data),
        answer_required: x.answer_required,
    })
    .fetch_all(conn)
    .await?;
    Ok(bundle_peer_review_questions_and_answers(res))
}

pub async fn get_peer_review_answers_with_questions_for_user_and_exercise(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
) -> ModelResult<Vec<PeerReviewWithQuestionsAndAnswers>> {
    let res = sqlx::query!(
        r#"
SELECT answers.id AS peer_review_question_submission_id,
  answers.text_data,
  answers.number_data,
  questions.peer_review_config_id,
  questions.id AS peer_review_question_id,
  questions.order_number,
  questions.question,
  questions.question_type AS "question_type: PeerReviewQuestionType",
  questions.answer_required,
  submissions.id AS peer_review_submission_id
FROM peer_review_question_submissions answers
  JOIN peer_review_questions questions ON (
    answers.peer_review_question_id = questions.id
  )
  JOIN peer_review_submissions submissions ON (
    answers.peer_review_submission_id = submissions.id
  )
WHERE submissions.user_id = $1
  AND submissions.exercise_id = $2
  AND questions.deleted_at IS NULL
  AND answers.deleted_at IS NULL
  AND submissions.deleted_at IS NULL
        "#,
        user_id,
        exercise_id
    )
    .map(|x| PeerReviewQuestionAndAnswer {
        peer_review_config_id: x.peer_review_config_id,
        peer_review_question_id: x.peer_review_question_id,
        peer_review_question_submission_id: x.peer_review_question_submission_id,
        peer_review_submission_id: x.peer_review_submission_id,
        order_number: x.order_number,
        question: x.question,
        answer: PeerReviewAnswer::new(x.question_type, x.text_data, x.number_data),
        answer_required: x.answer_required,
    })
    .fetch_all(conn)
    .await?;
    Ok(bundle_peer_review_questions_and_answers(res))
}

/// Groups answers to peer reviews by peer review ids.
fn bundle_peer_review_questions_and_answers(
    questions_and_answers: Vec<PeerReviewQuestionAndAnswer>,
) -> Vec<PeerReviewWithQuestionsAndAnswers> {
    let mut mapped: HashMap<Uuid, Vec<PeerReviewQuestionAndAnswer>> = HashMap::new();
    questions_and_answers.into_iter().for_each(|x| {
        mapped
            .entry(x.peer_review_submission_id)
            .or_default()
            .push(x)
    });
    mapped
        .into_iter()
        .map(|(id, qa)| PeerReviewWithQuestionsAndAnswers {
            peer_review_submission_id: id,
            questions_and_answers: qa,
        })
        .collect()
}
