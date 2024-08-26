use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CodeGiveaway {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub course_module_id: Option<Uuid>,
    pub enabled: bool,
}

async fn insert(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<CodeGiveaway> {
    let res = sqlx::query_as!(
        CodeGiveaway,
        r#"
INSERT INTO code_giveaways (course_id)
VALUES ($1)
RETURNING *
        "#,
        course_id
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}

async fn get_all_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CodeGiveaway>> {
    let res = sqlx::query_as!(
        CodeGiveaway,
        r#"
SELECT *
FROM code_giveaways
WHERE course_id = $1
  AND deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(res)
}

async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Option<CodeGiveaway>> {
    let res = sqlx::query_as!(
        CodeGiveaway,
        r#"
SELECT *
FROM code_giveaways
WHERE id = $1
"#,
        id
    )
    .fetch_optional(&mut *conn)
    .await?;

    Ok(res)
}

async fn set_enabled(
    conn: &mut PgConnection,
    id: Uuid,
    enabled: bool,
) -> ModelResult<CodeGiveaway> {
    let res = sqlx::query_as!(
        CodeGiveaway,
        r#"
UPDATE code_giveaways
SET enabled = $2
WHERE id = $1
RETURNING *
"#,
        id,
        enabled
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}
