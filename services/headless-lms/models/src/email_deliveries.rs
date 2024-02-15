use lettre::transport::smtp::Error;

use crate::prelude::*;

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
    // TODO: change to user.email when field exists in the db.
    pub to: Uuid,
    pub subject: Option<String>,
    pub body: Option<serde_json::Value>,
}

pub async fn fetch_emails(conn: &mut PgConnection) -> ModelResult<Vec<Email>> {
    let emails = sqlx::query_as!(
        Email,
        "
SELECT ed.id AS id,
  u.id AS to,
  et.subject AS subject,
  et.content AS body
FROM email_deliveries ed
  JOIN email_templates et ON et.id = ed.email_template_id
  JOIN users u ON u.id = ed.user_id
WHERE ed.deleted_at IS NULL
  AND ed.sent = FALSE
  AND ed.error IS NULL
LIMIT 10000;
  ",
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
    err: Error,
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
