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
