use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EmailTemplate {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub content: Option<serde_json::Value>,
    pub name: String,
    pub subject: Option<String>,
    pub exercise_completions_threshold: Option<i32>,
    pub points_threshold: Option<i32>,
    pub course_instance_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EmailTemplateNew {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EmailTemplateUpdate {
    pub name: String,
    pub subject: String,
    pub content: serde_json::Value,
    pub exercise_completions_threshold: Option<i32>,
    pub points_threshold: Option<i32>,
}

pub async fn get_email_templates(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Vec<EmailTemplate>> {
    let res = sqlx::query_as!(
        EmailTemplate,
        "SELECT *
FROM email_templates
WHERE course_instance_id = $1
  AND deleted_at IS NULL",
        course_instance_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn insert_email_template(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    email_template: EmailTemplateNew,
    subject: Option<&'_ str>,
) -> ModelResult<EmailTemplate> {
    let res = sqlx::query_as!(
        EmailTemplate,
        "
INSERT INTO email_templates (name, course_instance_id, subject)
VALUES ($1, $2, $3)
RETURNING *
",
        email_template.name,
        course_instance_id,
        subject,
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
        "SELECT *
FROM email_templates
WHERE id = $1
  AND deleted_at IS NULL",
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
SET name = $1,
  subject = $2,
  content = $3,
  exercise_completions_threshold = $4,
  points_threshold = $5
WHERE id = $6
RETURNING *
  "#,
        email_template_update.name,
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
SET deleted_at = now()
WHERE id = $1
RETURNING *
  "#,
        email_template_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}
