use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "email_template_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EmailTemplateType {
    ResetPasswordEmail,
    DeleteUserEmail,
    ConfirmEmailCode,
    Generic,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EmailTemplate {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub content: Option<serde_json::Value>,
    pub template_type: EmailTemplateType,
    pub subject: Option<String>,
    pub exercise_completions_threshold: Option<i32>,
    pub points_threshold: Option<i32>,
    pub course_id: Option<Uuid>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EmailTemplateNew {
    pub template_type: EmailTemplateType,
    pub language: Option<String>,
    pub content: Option<serde_json::Value>,
    pub subject: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EmailTemplateUpdate {
    pub template_type: EmailTemplateType,
    pub subject: String,
    pub content: serde_json::Value,
    pub exercise_completions_threshold: Option<i32>,
    pub points_threshold: Option<i32>,
}

pub async fn get_email_templates(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<EmailTemplate>> {
    let res = sqlx::query_as!(
        EmailTemplate,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  content,
  email_template_type AS "template_type: EmailTemplateType",
  subject,
  exercise_completions_threshold,
  points_threshold,
  course_id,
  language
FROM email_templates
WHERE course_id = $1
  AND deleted_at IS NULL
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_email_templates(conn: &mut PgConnection) -> ModelResult<Vec<EmailTemplate>> {
    let res = sqlx::query_as!(
        EmailTemplate,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  content,
  email_template_type AS "template_type: EmailTemplateType",
  subject,
  exercise_completions_threshold,
  points_threshold,
  course_id,
  language
FROM email_templates
WHERE deleted_at IS NULL
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_generic_email_template_by_type_and_language(
    conn: &mut PgConnection,
    template_type: EmailTemplateType,
    language: &str,
) -> ModelResult<EmailTemplate> {
    let res = sqlx::query_as!(
        EmailTemplate,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  content,
  email_template_type AS "template_type: EmailTemplateType",
  subject,
  exercise_completions_threshold,
  points_threshold,
  course_id,
  language
FROM email_templates
WHERE email_template_type = $1
  AND course_id IS NULL
  AND deleted_at IS NULL
  AND (
    language = $2
    OR language = 'en'
    OR language IS NULL
  )
ORDER BY CASE
    WHEN language = $2 THEN 0
    WHEN language = 'en' THEN 1
    WHEN language IS NULL THEN 2
    ELSE 3
  END
LIMIT 1
        "#,
        template_type as EmailTemplateType,
        language
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert_email_template(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    email_template: EmailTemplateNew,
    subject: Option<&'_ str>,
) -> ModelResult<EmailTemplate> {
    let subject_to_use = email_template.subject.as_deref().or(subject);
    let res = sqlx::query_as!(
        EmailTemplate,
        r#"
INSERT INTO email_templates (
    email_template_type,
    course_id,
    subject,
    language,
    content
  )
VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email_template_type, language)
WHERE course_id IS NULL
  AND deleted_at IS NULL DO
UPDATE
SET subject = COALESCE(EXCLUDED.subject, email_templates.subject),
  content = COALESCE(EXCLUDED.content, email_templates.content),
  updated_at = NOW()
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  content,
  email_template_type AS "template_type: EmailTemplateType",
  subject,
  exercise_completions_threshold,
  points_threshold,
  course_id,
  language
        "#,
        email_template.template_type as EmailTemplateType,
        course_id,
        subject_to_use,
        email_template.language,
        email_template.content,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_email_template(
    conn: &mut PgConnection,
    email_template_id: Uuid,
) -> ModelResult<EmailTemplate> {
    let res = sqlx::query_as!(
        EmailTemplate,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  content,
  email_template_type AS "template_type: EmailTemplateType",
  subject,
  exercise_completions_threshold,
  points_threshold,
  course_id,
  language
FROM email_templates
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        email_template_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_email_template(
    conn: &mut PgConnection,
    email_template_id: Uuid,
    email_template_update: EmailTemplateUpdate,
) -> ModelResult<EmailTemplate> {
    let res = sqlx::query_as!(
        EmailTemplate,
        r#"
UPDATE email_templates
SET email_template_type = $1,
  subject = $2,
  content = $3,
  exercise_completions_threshold = $4,
  points_threshold = $5
WHERE id = $6
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  content,
  email_template_type AS "template_type: EmailTemplateType",
  subject,
  exercise_completions_threshold,
  points_threshold,
  course_id,
  language
  "#,
        email_template_update.template_type as EmailTemplateType,
        email_template_update.subject,
        email_template_update.content,
        email_template_update.exercise_completions_threshold,
        email_template_update.points_threshold,
        email_template_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete_email_template(
    conn: &mut PgConnection,
    email_template_id: Uuid,
) -> ModelResult<EmailTemplate> {
    let deleted = sqlx::query_as!(
        EmailTemplate,
        r#"
UPDATE email_templates
SET deleted_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  content,
  email_template_type AS "template_type: EmailTemplateType",
  subject,
  exercise_completions_threshold,
  points_threshold,
  course_id,
  language
  "#,
        email_template_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}
