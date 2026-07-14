use std::collections::HashMap;

use serde_json::Value;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]

pub struct ChatbotPageSyncStatus {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub page_id: Uuid,
    pub error_message: Option<String>,
    pub synced_page_revision_id: Option<Uuid>,
    pub consecutive_failures: i32,
    pub converted_markdown_content: Option<String>,
}

pub async fn ensure_sync_statuses_exist(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, Vec<ChatbotPageSyncStatus>>> {
    sqlx::query!(
        r#"
INSERT INTO chatbot_page_sync_statuses (course_id, page_id)
SELECT course_id,
  id
FROM pages
WHERE course_id = ANY($1)
  AND deleted_at IS NULL
  AND hidden IS FALSE ON CONFLICT (page_id, deleted_at) DO NOTHING
        "#,
        course_ids
    )
    .execute(&mut *conn)
    .await?;

    let all_statuses = sqlx::query_as!(
        ChatbotPageSyncStatus,
        r#"
SELECT *
FROM chatbot_page_sync_statuses
WHERE course_id = ANY($1)
        "#,
        course_ids
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .fold(
        HashMap::<Uuid, Vec<ChatbotPageSyncStatus>>::new(),
        |mut map, status| {
            map.entry(status.course_id).or_default().push(status);
            map
        },
    );

    Ok(all_statuses)
}

pub async fn save_markdown_content(
    conn: &mut PgConnection,
    content: &String,
    page_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE chatbot_page_sync_statuses AS cps
SET converted_markdown_content = $1
WHERE cps.page_id = $2
AND cps.deleted_at IS NULL
    "#,
        &content,
        &page_id
    )
    .execute(conn)
    .await?;

    Ok(())
}

// Given a mapping from page id to the new revision id, update the sync statuses
pub async fn update_page_revision_ids(
    conn: &mut PgConnection,
    page_id_to_new_revision_id: HashMap<Uuid, Uuid>,
) -> ModelResult<()> {
    // If there are no updates to perform, return early
    if page_id_to_new_revision_id.is_empty() {
        return Ok(());
    }
    let (page_ids, revision_ids): (Vec<Uuid>, Vec<Uuid>) =
        page_id_to_new_revision_id.into_iter().unzip();

    sqlx::query!(
        r#"
UPDATE chatbot_page_sync_statuses AS cps
SET synced_page_revision_id = data.synced_page_revision_id,
    error_message = NULL,
    consecutive_failures = 0
FROM (
    SELECT unnest($1::uuid []) AS page_id,
      unnest($2::uuid []) AS synced_page_revision_id
  ) AS data
WHERE cps.page_id = data.page_id
AND cps.deleted_at IS NULL
    "#,
        &page_ids,
        &revision_ids
    )
    .execute(conn)
    .await?;

    Ok(())
}

pub async fn set_page_sync_error(
    conn: &mut PgConnection,
    page_id: Uuid,
    error_message: &str,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE chatbot_page_sync_statuses
SET error_message = $2,
    consecutive_failures = consecutive_failures + 1
WHERE page_id = $1
AND deleted_at IS NULL
    "#,
        page_id,
        error_message
    )
    .execute(conn)
    .await?;

    Ok(())
}

/// Clears sync statuses for the given page IDs.
/// This is used when pages become hidden to ensure they'll be re-synced if unhidden.
pub async fn clear_sync_statuses(conn: &mut PgConnection, page_ids: &[Uuid]) -> ModelResult<()> {
    if page_ids.is_empty() {
        return Ok(());
    }

    sqlx::query!(
        r#"
UPDATE chatbot_page_sync_statuses
SET synced_page_revision_id = NULL,
    error_message = NULL,
    consecutive_failures = 0
WHERE page_id = ANY($1)
AND deleted_at IS NULL
        "#,
        page_ids
    )
    .execute(conn)
    .await?;

    Ok(())
}

pub struct PageSyncedVersionContent {
    pub page_id: Uuid,
    pub page_revision_id: Uuid,
    pub course_id: Uuid,
    pub title: String,
    pub json_content: Option<Value>,
    pub markdown_content: Option<String>,
}

pub async fn get_latest_synced_page_content_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<PageSyncedVersionContent> {
    let sync_status: PageSyncedVersionContent = sqlx::query_as!(
        PageSyncedVersionContent,
        r#"
SELECT ph.content AS json_content,
  ph.title,
  ph.id AS page_revision_id,
  ph.page_id,
  cps.converted_markdown_content AS markdown_content,
  cps.course_id
FROM page_history AS ph
  JOIN chatbot_page_sync_statuses AS cps ON ph.page_id = cps.page_id
WHERE ph.id IN (
    SELECT synced_page_revision_id
    FROM chatbot_page_sync_statuses
    WHERE page_id = $1
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1
  )
  AND ph.deleted_at IS NULL
  AND cps.deleted_at IS NULL
    "#,
        page_id,
    )
    .fetch_one(conn)
    .await?;

    Ok(sync_status)
}
