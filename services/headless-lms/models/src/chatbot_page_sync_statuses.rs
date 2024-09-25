use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotPageSyncStatus {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub page_id: Uuid,
    pub error_message: Option<String>,
    pub synced_page_revision_id: Option<Uuid>,
}

pub async fn make_sure_sync_statuses_exist(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
) -> ModelResult<Vec<ChatbotPageSyncStatus>> {
    let res = sqlx::query_as!(
        ChatbotPageSyncStatus,
        r#"
INSERT INTO chatbot_page_sync_statuses (course_id, page_id)
SELECT course_id, id
FROM pages
WHERE course_id = ANY($1)
AND deleted_at IS NULL
AND hidden IS FALSE
ON CONFLICT (page_id, deleted_at) DO NOTHING
RETURNING *
      "#,
        course_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
