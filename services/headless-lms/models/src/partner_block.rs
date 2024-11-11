use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PartnerBlock {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub content: Option<serde_json::Value>,
    pub course_instance_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PartnerBlockNew {
    pub course_instance_id: Uuid,
    pub content: Option<serde_json::Value>,
}

pub async fn upsert_partner_block(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    content: Option<serde_json::Value>,
) -> ModelResult<PartnerBlock> {
    let res = sqlx::query_as!(
        PartnerBlock,
        r#"
INSERT INTO partners_block (course_instance_id, content, created_at, updated_at)
VALUES ($1, $2, now(), NULL)
ON CONFLICTS (course_instance_id)
DO UPDATE
SET content = EXCLUDED.content, updates_at = now()
RETURNING *
"#,
        course_instance_id,
        content,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_partner_block(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<PartnerBlock> {
    let res = sqlx::query_as!(
        PartnerBlock,
        "SELECT *
FROM partners_block
WHERE course_instance_id = $1
  AND deleted_at IS NULL",
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete_partner_block(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<PartnerBlock> {
    let deleted = sqlx::query_as!(
        PartnerBlock,
        r#"
UPDATE partners_block
SET deleted_at = now()
WHERE course_instance_id = $1
RETURNING *
  "#,
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}
