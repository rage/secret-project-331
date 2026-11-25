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
    pub block_statuses: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct PageReadStatusUpdate {
    pub page_read: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct BlockStatusUpdate {
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
    user_id: Uuid,
    page_id: Uuid,
    status: PageReadStatusUpdate,
) -> ModelResult<PageReadStatus> {
    let res = sqlx::query_as!(
        PageReadStatus,
        r#"
INSERT INTO page_read_statuses (
    user_id,
    page_id,
    page_read,
    read_at
)
VALUES (
    $1,
    $2,
    $3,
    CASE WHEN $3 THEN NOW() ELSE NULL END
)
ON CONFLICT (user_id, page_id)
DO UPDATE SET
    page_read = EXCLUDED.page_read,
    read_at = CASE
        WHEN EXCLUDED.page_read
        THEN COALESCE(page_read_statuses.read_at, NOW())
        ELSE NULL
    END,
    updated_at = NOW(),
    deleted_at = NULL
RETURNING *
"#,
        user_id,
        page_id,
        status.page_read
    )
    .fetch_one(conn)
    .await?;

    Ok(res)
}

pub async fn upsert_block_statuses(
    conn: &mut PgConnection,
    user_id: Uuid,
    page_id: Uuid,
    block_statuses: BlockStatusUpdate,
) -> ModelResult<PageReadStatus> {
    let blocks = serde_json::to_value(block_statuses.block_statuses)?;
    if !blocks.is_object() {
        return Err(model_err!(
            Json,
            format!("Input must be a valid JSON object.")
        ));
    }
    let res = sqlx::query_as!(
        PageReadStatus,
        r#"
INSERT INTO page_read_statuses (
        user_id,
        page_id,
        page_read,
        block_statuses
)
VALUES (
        $1,
        $2,
        false,
        $3
)
ON CONFLICT (user_id, page_id)
DO UPDATE SET
        block_statuses = (
                SELECT jsonb_object_agg(
                    COALESCE(existing.key, incoming.key),
                    CASE
                        WHEN existing.key IS NULL THEN incoming.value
                        WHEN incoming.key IS NULL THEN existing.value
                        ELSE jsonb_build_object(
                            'read_units',
                            COALESCE(
                                (existing.value ->> 'read_units')::numeric,
                                0
                            ) + COALESCE(
                                (incoming.value ->> 'read_units')::numeric,
                                0
                            ),
                            'last_seen',
                            incoming.value -> 'last_seen'
                        )
                    END
                )
                FROM jsonb_each(
                    COALESCE(page_read_statuses.block_statuses, '{}'::jsonb)
                ) AS existing
                FULL JOIN jsonb_each($3::jsonb) AS incoming
                    ON existing.key = incoming.key
            )
RETURNING *
"#,
        user_id,
        page_id,
        blocks
    )
    .fetch_one(conn)
    .await?;

    Ok(res)
}
