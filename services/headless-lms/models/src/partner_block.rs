use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PartnersBlock {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub content: serde_json::Value,
    pub course_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PartnerBlockNew {
    pub course_id: Uuid,
    pub content: Option<serde_json::Value>,
}

pub async fn upsert_partner_block(
    conn: &mut PgConnection,
    course_id: Uuid,
    content: Option<serde_json::Value>,
) -> ModelResult<PartnersBlock> {
    let res = sqlx::query_as!(
        PartnersBlock,
        r#"
INSERT INTO partners_blocks (course_id, content)
VALUES ($1, $2)
ON CONFLICT (course_id)
DO UPDATE
SET content = EXCLUDED.content
RETURNING *
"#,
        course_id,
        content,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_partner_block(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<PartnersBlock> {
    let res = sqlx::query_as!(
        PartnersBlock,
        "SELECT *
FROM partners_blocks
WHERE course_id = $1
  AND deleted_at IS NULL",
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete_partner_block(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<PartnersBlock> {
    let deleted = sqlx::query_as!(
        PartnersBlock,
        r#"
UPDATE partners_blocks
SET deleted_at = now()
WHERE course_id = $1
RETURNING *
  "#,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}
