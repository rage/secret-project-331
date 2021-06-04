use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn upsert_user_id(pool: &PgPool, id: &Uuid) -> Result<()> {
    let mut connection = pool.acquire().await?;
    sqlx::query!(
        r#"
INSERT INTO
  users (id)
VALUES($1)
ON CONFLICT(id) DO NOTHING;
          "#,
        id
    )
    .execute(&mut connection)
    .await?;
    Ok(())
}
