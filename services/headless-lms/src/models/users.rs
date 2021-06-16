use anyhow::Result;
use sqlx::PgConnection;
use uuid::Uuid;

pub async fn upsert_user_id(
    conn: &mut PgConnection,
    id: Uuid,
    upstream_id: Option<i32>,
) -> Result<()> {
    sqlx::query!(
        r#"
INSERT INTO
  users (id, upstream_id)
VALUES($1, $2)
ON CONFLICT(id) DO NOTHING;
          "#,
        id,
        upstream_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn find_by_upstream_id(
    conn: &mut PgConnection,
    upstream_id: i32,
) -> Result<Option<Uuid>> {
    let id = sqlx::query!("SELECT id FROM users WHERE upstream_id = $1", upstream_id)
        .fetch_optional(conn)
        .await?
        .map(|u| u.id);
    Ok(id)
}
