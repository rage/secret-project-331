use crate::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct PageReadStatus {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub page_id: Uuid,
    pub page_read: bool,
    pub read_at: Option<DateTime<Utc>>,
    pub block_statuses: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct PageReadStatusUpdate {
    pub user_id: Uuid,
    pub page_id: Uuid,
    pub page_read: bool,
    pub read_at: Option<DateTime<Utc>>,
    pub block_statuses: serde_json::Value,
}

pub async fn get_by_user_and_page(
    conn: &mut PgConnection,
    user_id: Uuid,
    page_id: Uuid,
) -> ModelResult<Option<PageReadStatus>> {
    let res = sqlx::query_as!(
        PageReadStatus,
        r#"
SELECT *
FROM page_read_statuses
WHERE user_id = $1
AND page_id = $2
AND deleted_at IS NULL
"#,
        user_id,
        page_id
    )
    .fetch_optional(conn)
    .await?;

    Ok(res)
}

pub async fn upsert_page_read_status(
    conn: &mut PgConnection,
    status: PageReadStatusUpdate,
) -> ModelResult<PageReadStatus> {
    let res = sqlx::query_as!(
        PageReadStatus,
        r#"
INSERT INTO page_read_statuses (
    user_id,
    page_id,
    page_read,
    read_at,
    block_statuses
)
VALUES (
    $1,
    $2,
    $3,
    CASE WHEN $3 THEN NOW() ELSE NULL END,
    $4
)
ON CONFLICT (user_id, page_id)
DO UPDATE SET
    page_read = EXCLUDED.page_read,
    read_at = CASE
        WHEN EXCLUDED.page_read
        THEN COALESCE(page_read_statuses.read_at, NOW())
        ELSE page_read_statuses.read_at
    END,
    block_statuses = EXCLUDED.block_statuses,
    updated_at = NOW(),
    deleted_at = NULL
RETURNING *
"#,
        status.user_id,
        status.page_id,
        status.page_read,
        status.block_statuses
    )
    .fetch_one(conn)
    .await?;

    Ok(res)
}
