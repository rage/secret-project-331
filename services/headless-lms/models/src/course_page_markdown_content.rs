use serde_json::Value;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CoursePageMarkdownContent {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub markdown_content: String,
}

// stuff for the tool
pub struct PageSyncedVersionContent {
    pub page_id: Uuid,
    pub page_revision_id: Uuid,
    pub course_id: Uuid,
    pub title: String,
    pub json_content: Option<Value>,
    pub markdown_content: Option<String>,
}

pub async fn insert(
    conn: &mut PgConnection,
    content: &str,
) -> ModelResult<CoursePageMarkdownContent> {
    let res = sqlx::query_as!(
        CoursePageMarkdownContent,
        r#"
    INSERT INTO course_page_markdown_content (markdown_content)
    VALUES ($1)
    RETURNING *
    "#,
        content
    )
    .fetch_one(conn)
    .await?;

    Ok(res)
}

/// Get latest page content that has been synced, either Markdown or json format.
pub async fn get_latest_page_content_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Option<PageSyncedVersionContent>> {
    let sync_status = sqlx::query_as!(
        PageSyncedVersionContent,
        r#"
SELECT ph.content AS json_content,
  ph.title,
  ph.id AS page_revision_id,
  ph.page_id,
  cpmc.markdown_content,
  cps.course_id
FROM page_history AS ph
  JOIN chatbot_page_sync_statuses AS cps ON ph.page_id = cps.page_id
  JOIN course_page_markdown_content AS cpmc ON cps.converted_markdown_content_id = cpmc.id
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
  AND cpmc.deleted_at IS NULL
    "#,
        page_id,
    )
    .fetch_optional(conn)
    .await?;

    Ok(sync_status)
}
