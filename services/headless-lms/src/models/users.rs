use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn upsert_user_id(pool: &PgPool, id: Uuid, upstream_id: Option<i32>) -> Result<()> {
    let mut connection = pool.acquire().await?;
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
    .execute(&mut connection)
    .await?;
    Ok(())
}

pub async fn find_by_upstream_id(pool: &PgPool, upstream_id: i32) -> Result<Option<Uuid>> {
    let mut connection = pool.acquire().await?;
    let id = sqlx::query!("SELECT id FROM users WHERE upstream_id = $1", upstream_id)
        .fetch_optional(&mut connection)
        .await?
        .map(|u| u.id);
    Ok(id)
}
