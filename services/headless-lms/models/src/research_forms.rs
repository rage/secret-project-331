use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
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

pub async fn insert_research_form(
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

/*
pub async fn insert_research_form_questions(
    conn: &mut PgConnection,
    new_research_form: &NewResearchForm,
) -> ModelResult<Uuid> {
    let mut questions =  serde_json::to_value(new_research_form.content.clone())?.map() ??
    let mut tx = conn.begin().await?;
    let form_res = sqlx::query!(
        "
INSERT INTO course_specific_research_consent_form_questions (
    course_id,
    research_consent_form_id,
    question
  )
VALUES ($1, $2, $3)
RETURNING id
",
        new_research_form.course_id,
        question,
        new_research_form.id
    )
    .fetch_one(&mut tx)
    .await?;
    Ok(form_res.id)
}
*/

pub async fn get_research_form_with_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<ResearchForm> {
    let mut tx = conn.begin().await?;
    let form_res = sqlx::query_as!(
        ResearchForm,
        "
SELECT * FROM course_specific_research_consent_forms
WHERE course_id = $1
AND deleted_at IS NULL
",
        course_id,
    )
    .fetch_one(&mut tx)
    .await?;
    Ok(form_res)
}
