use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub upstream_id: Option<i32>,
    pub email: String,
}

pub async fn insert(conn: &mut PgConnection, email: &str) -> Result<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO users (email)
VALUES ($1)
RETURNING id
",
        email
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert_with_upstream_id(
    conn: &mut PgConnection,
    email: &str,
    upstream_id: i32,
) -> Result<User> {
    let user = sqlx::query_as!(
        User,
        r#"
INSERT INTO
  users (email, upstream_id)
VALUES ($1, $2)
RETURNING *;
          "#,
        email,
        upstream_id
    )
    .fetch_one(conn)
    .await?;
    Ok(user)
}

pub async fn find_by_upstream_id(
    conn: &mut PgConnection,
    upstream_id: i32,
) -> Result<Option<User>> {
    let user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE upstream_id = $1",
        upstream_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(user)
}

// Only used for testing, not to use in production.
pub async fn authenticate_test_user(
    conn: &mut PgConnection,
    email: String,
    _password: String,
) -> Result<User> {
    // TODO: Add support to "authenticate" different kind of users
    let user = insert_with_upstream_id(conn, &email, 9001).await?;
    Ok(user)
}
