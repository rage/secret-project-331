use crate::email_templates::EmailTemplateType;
use crate::prelude::*;
use std::fmt::Display;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct EmailDelivery {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub email_template_id: Uuid,
    pub error: Option<String>,
    pub sent: bool,
    pub user_id: Uuid,
}

pub struct Email {
    pub id: Uuid,
    pub user_id: Uuid,
    pub to: String,
    pub subject: Option<String>,
    pub body: Option<serde_json::Value>,
    pub template_type: Option<EmailTemplateType>,
}

pub async fn insert_email_delivery(
    conn: &mut PgConnection,
    user_id: Uuid,
    email_template_id: Uuid,
) -> ModelResult<Uuid> {
    let id = Uuid::new_v4();

    sqlx::query!(
        r#"
INSERT INTO email_deliveries (
    id,
    user_id,
    email_template_id
)
VALUES ($1, $2, $3)
        "#,
        id,
        user_id,
        email_template_id
    )
    .execute(conn)
    .await?;

    Ok(id)
}

pub async fn fetch_emails(conn: &mut PgConnection) -> ModelResult<Vec<Email>> {
    let emails = sqlx::query_as!(
        Email,
        r#"
SELECT
    ed.id AS id,
    u.id AS user_id,
    ud.email AS to,
    et.subject AS subject,
    et.content AS body,
    et.email_template_type AS "template_type: EmailTemplateType"
FROM email_deliveries ed
JOIN email_templates et ON et.id = ed.email_template_id
JOIN users u ON u.id = ed.user_id
JOIN user_details ud ON ud.user_id = u.id
WHERE ed.deleted_at IS NULL
  AND ed.sent = FALSE
  AND ed.error IS NULL
LIMIT 10000;
        "#,
    )
    .fetch_all(conn)
    .await?;

    Ok(emails)
}

pub async fn mark_as_sent(email_id: Uuid, conn: &mut PgConnection) -> ModelResult<()> {
    sqlx::query!(
        "
update email_deliveries
set sent = TRUE
where id = $1;
    ",
        email_id
    )
    .execute(conn)
    .await?;

    Ok(())
}

pub async fn save_err_to_email(
    email_id: Uuid,
    err: impl Display,
    conn: &mut PgConnection,
) -> ModelResult<()> {
    sqlx::query!(
        "
update email_deliveries
set sent = FALSE,
  error = $1
where id = $2;
    ",
        err.to_string(),
        email_id
    )
    .execute(conn)
    .await?;

    Ok(())
}
