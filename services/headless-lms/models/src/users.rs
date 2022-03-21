use headless_lms_utils::ApplicationConfiguration;

use crate::prelude::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct User {
    pub id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub upstream_id: Option<i32>,
    pub email: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    email: &str,
    first_name: Option<&str>,
    last_name: Option<&str>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO users (email, first_name, last_name)
VALUES ($1, $2, $3)
RETURNING id
",
        email,
        first_name,
        last_name
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert_with_id(
    conn: &mut PgConnection,
    email: &str,
    first_name: Option<&str>,
    last_name: Option<&str>,
    id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO users (id, email, first_name, last_name)
VALUES ($1, $2, $3, $4)
RETURNING id
",
        id,
        email,
        first_name,
        last_name
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert_with_upstream_id_and_moocfi_id(
    conn: &mut PgConnection,
    email: &str,
    first_name: Option<&str>,
    last_name: Option<&str>,
    upstream_id: i32,
    moocfi_id: Uuid,
) -> ModelResult<User> {
    let user = sqlx::query_as!(
        User,
        r#"
INSERT INTO
  users (id, email, first_name, last_name, upstream_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;
          "#,
        moocfi_id,
        email,
        first_name,
        last_name,
        upstream_id
    )
    .fetch_one(conn)
    .await?;
    Ok(user)
}

pub async fn get_by_email(conn: &mut PgConnection, email: &str) -> ModelResult<User> {
    let user = sqlx::query_as!(
        User,
        "
SELECT *
FROM users
WHERE email = $1
        ",
        email
    )
    .fetch_one(conn)
    .await?;
    Ok(user)
}

pub async fn try_get_by_email(conn: &mut PgConnection, email: &str) -> ModelResult<Option<User>> {
    let user = sqlx::query_as!(
        User,
        "
SELECT *
FROM users
WHERE email = $1
        ",
        email
    )
    .fetch_optional(conn)
    .await?;
    Ok(user)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<User> {
    let user = sqlx::query_as!(
        User,
        "
SELECT *
FROM users
WHERE id = $1
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(user)
}

pub async fn find_by_upstream_id(
    conn: &mut PgConnection,
    upstream_id: i32,
) -> ModelResult<Option<User>> {
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
    password: String,
    application_configuration: &ApplicationConfiguration,
) -> ModelResult<User> {
    // Sanity check to ensure this is not called outside of test mode. The whole application configuration is passed to this function instead of just the boolean to make mistakes harder.
    assert!(application_configuration.test_mode);
    let user = if email == "admin@example.com" && password == "admin" {
        crate::users::get_by_email(conn, "admin@example.com").await?
    } else if email == "teacher@example.com" && password == "teacher" {
        crate::users::get_by_email(conn, "teacher@example.com").await?
    } else if email == "language.teacher@example.com" && password == "language.teacher" {
        crate::users::get_by_email(conn, "language.teacher@example.com").await?
    } else if email == "user@example.com" && password == "user" {
        crate::users::get_by_email(conn, "user@example.com").await?
    } else if email == "assistant@example.com" && password == "assistant" {
        crate::users::get_by_email(conn, "assistant@example.com").await?
    } else {
        return Err(ModelError::Generic("Invalid email or password".to_string()));
    };
    Ok(user)
}
