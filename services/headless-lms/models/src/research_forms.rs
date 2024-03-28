use futures::Stream;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ResearchForm {
    pub id: Uuid,
    pub course_id: Uuid,
    pub content: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewResearchForm {
    pub course_id: Uuid,
    pub content: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ResearchFormQuestion {
    pub id: Uuid,
    pub course_id: Uuid,
    pub research_consent_form_id: Uuid,
    pub question: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewResearchFormQuestion {
    pub question_id: Uuid,
    pub course_id: Uuid,
    pub research_consent_form_id: Uuid,
    pub question: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewResearchFormQuestionAnswer {
    pub user_id: Uuid,
    pub research_form_question_id: Uuid,
    pub research_consent: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ResearchFormQuestionAnswer {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub research_form_question_id: Uuid,
    pub research_consent: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl NewResearchForm {
    /// Creates `NewResearchForm` with provided values that is public by default.
    pub fn new(course_id: Uuid) -> Self {
        Self {
            course_id,
            content: Default::default(),
        }
    }

    /// Sets the content of this research form.
    pub fn set_content(mut self, content: serde_json::Value) -> Self {
        self.content = content;
        self
    }
}

pub async fn upsert_research_form(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new_research_form: &NewResearchForm,
) -> ModelResult<ResearchForm> {
    let form_res = sqlx::query_as!(
        ResearchForm,
        "
INSERT INTO course_specific_research_consent_forms (
    id,
    course_id,
    content
  )
VALUES ($1, $2, $3) ON CONFLICT (course_id, deleted_at)
DO UPDATE SET content = $3
RETURNING *
",
        pkey_policy.into_uuid(),
        new_research_form.course_id,
        serde_json::to_value(new_research_form.content.clone())?,
    )
    .fetch_one(conn)
    .await?;
    Ok(form_res)
}

pub async fn get_research_form_with_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<ResearchForm> {
    let form_res = sqlx::query_as!(
        ResearchForm,
        "
SELECT * FROM course_specific_research_consent_forms
WHERE course_id = $1
AND deleted_at IS NULL
",
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(form_res)
}

pub async fn upsert_research_form_questions(
    conn: &mut PgConnection,
    questions: &[NewResearchFormQuestion],
) -> ModelResult<Vec<ResearchFormQuestion>> {
    let mut tx = conn.begin().await?;

    let mut inserted_questions = Vec::new();

    for question in questions {
        let form_res = sqlx::query_as!(
            ResearchFormQuestion,
            "
INSERT INTO course_specific_consent_form_questions (
    id,
    course_id,
    research_consent_form_id,
    question
  )
VALUES ($1, $2, $3, $4) ON CONFLICT (id)
DO UPDATE SET question = $4,
deleted_at = NULL
RETURNING *
",
            question.question_id,
            question.course_id,
            question.research_consent_form_id,
            question.question
        )
        .fetch_one(&mut *tx)
        .await?;

        inserted_questions.push(form_res);
    }

    tx.commit().await?;

    Ok(inserted_questions)
}

pub async fn get_research_form_questions_with_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<ResearchFormQuestion>> {
    let form_res = sqlx::query_as!(
        ResearchFormQuestion,
        "
SELECT * FROM course_specific_consent_form_questions
WHERE course_id = $1
AND deleted_at IS NULL
",
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(form_res)
}

pub struct ExportedCourseResearchFormQustionAnswer {
    pub course_id: Uuid,
    pub research_consent_form_id: Uuid,
    pub research_form_question_id: Uuid,
    pub question: String,
    pub user_id: Uuid,
    pub research_consent: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub fn stream_course_research_form_user_answers(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> impl Stream<Item = sqlx::Result<ExportedCourseResearchFormQustionAnswer>> + '_ {
    sqlx::query_as!(
        ExportedCourseResearchFormQustionAnswer,
        r#"
    SELECT DISTINCT ON (a.research_form_question_id, a.user_id)
        q.course_id,
        q.research_consent_form_id,
        a.research_form_question_id,
        q.question,
        a.user_id,
        a.research_consent,
        a.created_at,
        a.updated_at
        FROM course_specific_consent_form_answers a
    LEFT JOIN course_specific_consent_form_questions q ON a.research_form_question_id = q.id
    WHERE a.course_id = $1
    AND a.deleted_at IS NULL
    AND q.deleted_at IS NULL
    ORDER BY a.user_id, a.research_form_question_id, a.updated_at DESC
    "#,
        course_id
    )
    .fetch(conn)
}

pub async fn upsert_research_form_anwser(
    conn: &mut PgConnection,
    course_id: Uuid,
    answer: &NewResearchFormQuestionAnswer,
) -> ModelResult<Uuid> {
    let form_res = sqlx::query!(
        "
INSERT INTO course_specific_consent_form_answers (
    user_id,
    course_id,
    research_form_question_id,
    research_consent
  )
VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, research_form_question_id)
DO UPDATE SET research_consent = $4
RETURNING *
",
        answer.user_id,
        course_id,
        answer.research_form_question_id,
        answer.research_consent
    )
    .fetch_one(conn)
    .await?;
    Ok(form_res.id)
}

pub async fn get_research_form_answers_with_user_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<ResearchFormQuestionAnswer>> {
    let form_res = sqlx::query_as!(
        ResearchFormQuestionAnswer,
        "
SELECT * FROM course_specific_consent_form_answers
WHERE course_id = $1 AND user_id = $2
AND deleted_at IS NULL
",
        course_id,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(form_res)
}

pub async fn get_all_research_form_answers_with_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<ResearchFormQuestionAnswer>> {
    let form_res = sqlx::query_as!(
        ResearchFormQuestionAnswer,
        "
SELECT * FROM course_specific_consent_form_answers
WHERE user_id = $1
AND deleted_at IS NULL
",
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(form_res)
}
