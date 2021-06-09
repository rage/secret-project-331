use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn upsert_user_id(pool: &PgPool, id: Uuid, legacy_id: Option<i32>) -> Result<()> {
    let mut connection = pool.acquire().await?;
    sqlx::query!(
        r#"
INSERT INTO
  users (id, legacy_id)
VALUES($1, $2)
ON CONFLICT(id) DO NOTHING;
          "#,
        id,
        legacy_id
    )
    .execute(&mut connection)
    .await?;
    Ok(())
}
