use crate::{models::ModelResult, utils::pagination::Pagination};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgConnection, Type};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, TS)]
#[sqlx(type_name = "history_change_reason", rename_all = "kebab-case")]
pub enum HistoryChangeReason {
    PageSaved,
    HistoryRestored,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct PageHistory {
    id: Uuid,
    created_at: DateTime<Utc>,
    content: Value,
    history_change_reason: HistoryChangeReason,
    restored_from_id: Option<Uuid>,
    author_user_id: Uuid,
}

pub async fn insert(
    conn: &mut PgConnection,
    page_id: Uuid,
    content: &Value,
    history_change_reason: HistoryChangeReason,
    author_user_id: Uuid,
    restored_from_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
  INSERT INTO page_history (
    page_id,
    content,
    history_change_reason,
    author_user_id,
    restored_from_id
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
        page_id,
        content,
        history_change_reason as HistoryChangeReason,
        author_user_id,
        restored_from_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn history(
    conn: &mut PgConnection,
    page_id: Uuid,
    pagination: &Pagination,
) -> ModelResult<Vec<PageHistory>> {
    let res = sqlx::query_as!(
        PageHistory,
        r#"
SELECT id,
  content,
  created_at,
  history_change_reason as "history_change_reason: HistoryChangeReason",
  restored_from_id,
  author_user_id
FROM page_history
WHERE page_id = $1
ORDER BY created_at
LIMIT $2
OFFSET $3
"#,
        page_id,
        pagination.limit(),
        pagination.offset()
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
