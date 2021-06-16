use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// private fields to guarantee that this struct can only be created through FromRequest
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub upstream_id: Option<i32>,
}

pub async fn upsert_user_id(pool: &PgPool, id: Uuid, upstream_id: Option<i32>) -> Result<User> {
    let mut connection = pool.acquire().await?;
    let user = sqlx::query_as!(
        User,
        r#"
INSERT INTO
  users (id, upstream_id)
VALUES($1, $2)
ON CONFLICT(id) DO NOTHING
RETURNING *;
          "#,
        id,
        upstream_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(user)
}

pub async fn find_by_upstream_id(pool: &PgPool, upstream_id: i32) -> Result<Option<User>> {
    let mut connection = pool.acquire().await?;
    let user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE upstream_id = $1",
        upstream_id
    )
    .fetch_optional(&mut connection)
    .await?;
    Ok(user)
}
