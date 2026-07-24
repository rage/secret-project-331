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
pub struct CoursePageContent {
    pub page_id: Uuid,
    pub course_id: Uuid,
    pub title: String,
    pub json_content: Value,
    /// Latest LLM-generated Markdown that has been synced to Azure.
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

/// Get latest page content, either latest Markdown that has been synced or json format.
pub async fn get_course_page_content_by_page_id(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<CoursePageContent> {
    let content = sqlx::query_as!(
        CoursePageContent,
        r#"
SELECT pages.content AS json_content,
  pages.title,
  pages.id AS page_id,
  cpmc.markdown_content,
  cps.course_id
FROM pages
  JOIN page_history AS ph ON pages.id = ph.page_id
  JOIN chatbot_page_sync_statuses AS cps ON pages.id = cps.page_id
  JOIN course_page_markdown_content AS cpmc ON cps.converted_markdown_content_id = cpmc.id
WHERE ph.id IN (
    SELECT synced_page_revision_id
    FROM chatbot_page_sync_statuses
    WHERE page_id = $1
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1
  )
  AND pages.id = $1
  AND pages.deleted_at IS NULL
  AND ph.deleted_at IS NULL
  AND cps.deleted_at IS NULL
  AND cpmc.deleted_at IS NULL
    "#,
        page_id,
    )
    .fetch_optional(&mut *conn)
    .await?;

    if let Some(s) = content {
        Ok(s)
    } else {
        // Get fall back page content as json. The course_id should not be null
        // because this result is for course page content look up.
        let fallback_content = sqlx::query_as!(
            CoursePageContent,
            r#"
SELECT pages.content AS json_content,
  pages.title,
  pages.id AS page_id,
  null as markdown_content,
  pages.course_id as "course_id!"
FROM pages
  WHERE pages.course_id IS NOT NULL
  AND pages.id = $1
  AND pages.deleted_at IS NULL
    "#,
            page_id,
        )
        .fetch_one(&mut *conn)
        .await?;

        Ok(fallback_content)
    }
}
