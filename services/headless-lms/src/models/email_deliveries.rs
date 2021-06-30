use lettre::transport::smtp::Error;

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
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

pub async fn fetch_emails(conn: &mut PgConnection) -> Result<Vec<EmailDelivery>> {
    let emails = sqlx::query_as!(
        EmailDelivery,
        "
select *
from email_deliveries ed
where ed.deleted_at IS NULL
  and ed.sent = FALSE
  and ed.error IS NULL;
  ",
    )
    .fetch_all(conn)
    .await?;

    Ok(emails)
}

pub async fn mark_as_sent(email_id: Uuid, conn: &mut PgConnection) -> Result<()> {
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

pub async fn save_err_to_email(email_id: Uuid, err: Error, conn: &mut PgConnection) -> Result<()> {
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
