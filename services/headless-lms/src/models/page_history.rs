use crate::{
    models::{
        pages::{CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask},
        ModelResult,
    },
    utils::pagination::Pagination,
};
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
    title: String,
    content: Value,
    history_change_reason: HistoryChangeReason,
    restored_from_id: Option<Uuid>,
    author_user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct PageHistoryContent {
    pub content: serde_json::Value,
    pub exercises: Vec<CmsPageExercise>,
    pub exercise_slides: Vec<CmsPageExerciseSlide>,
    pub exercise_tasks: Vec<CmsPageExerciseTask>,
}

pub async fn insert(
    conn: &mut PgConnection,
    page_id: Uuid,
    title: &str,
    content: &PageHistoryContent,
    history_change_reason: HistoryChangeReason,
    author_user_id: Uuid,
    restored_from_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
  INSERT INTO page_history (
    page_id,
    title,
    content,
    history_change_reason,
    author_user_id,
    restored_from_id
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
",
        page_id,
        title,
        serde_json::to_value(content)?,
        history_change_reason as HistoryChangeReason,
        author_user_id,
        restored_from_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_history_content_and_title(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<(PageHistoryContent, String)> {
    let record = sqlx::query!(
        "
SELECT content, title
FROM page_history
WHERE id = $1
  AND deleted_at IS NULL;
        ",
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok((serde_json::from_value(record.content)?, record.title))
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
  title,
  content,
  created_at,
  history_change_reason as "history_change_reason: HistoryChangeReason",
  restored_from_id,
  author_user_id
FROM page_history
WHERE page_id = $1
ORDER BY created_at DESC, id
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

pub async fn history_count(conn: &mut PgConnection, page_id: Uuid) -> ModelResult<i64> {
    let res = sqlx::query!(
        "
SELECT COUNT(*) AS count
FROM page_history
WHERE page_id = $1
",
        page_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.count.unwrap_or_default())
}
