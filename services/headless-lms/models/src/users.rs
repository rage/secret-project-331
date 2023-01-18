use headless_lms_utils::ApplicationConfiguration;

use crate::prelude::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct User {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub upstream_id: Option<i32>,
    pub email_domain: Option<String>,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    email: &str,
    first_name: Option<&str>,
    last_name: Option<&str>,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    let res = sqlx::query!(
        "
INSERT INTO users (id)
VALUES ($1)
RETURNING id
",
        pkey_policy.into_uuid(),
    )
    .fetch_one(&mut tx)
    .await?;

    let _res2 = sqlx::query!(
        "
INSERT INTO user_details (user_id, email, first_name, last_name)
VALUES ($1, $2, $3, $4)
",
        res.id,
        email,
        first_name,
        last_name
    )
    .fetch_one(&mut tx)
    .await?;
    tx.commit().await?;
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
    let mut tx = conn.begin().await?;
    let user = sqlx::query_as!(
        User,
        r#"
INSERT INTO
  users (id, upstream_id)
VALUES ($1, $2)
RETURNING *;
          "#,
        moocfi_id,
        upstream_id
    )
    .fetch_one(&mut tx)
    .await?;

    let _res2 = sqlx::query!(
        "
INSERT INTO user_details (user_id, email, first_name, last_name)
VALUES ($1, $2, $3, $4)
",
        user.id,
        email,
        first_name,
        last_name
    )
    .fetch_one(&mut tx)
    .await?;
    tx.commit().await?;
    Ok(user)
}

pub async fn get_by_email(conn: &mut PgConnection, email: &str) -> ModelResult<User> {
    let user = sqlx::query_as!(
        User,
        "
SELECT users.*
FROM user_details
JOIN users ON (user_details.user_id = users.id)
WHERE user_details.email = $1
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
SELECT users.*
FROM user_details
JOIN users ON (user_details.user_id = users.id)
WHERE user_details.email = $1
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
    email: &str,
    password: &str,
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
    } else if email == "creator@example.com" && password == "creator" {
        crate::users::get_by_email(conn, "creator@example.com").await?
    } else {
        return Err(ModelError::new(
            ModelErrorType::InvalidRequest,
            "Invalid email or password".to_string(),
            None,
        ));
    };
    Ok(user)
}

/// Includes all users who have returned an exercise on a course course instance
pub async fn get_all_user_ids_with_user_exercise_states_on_course_instance(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT DISTINCT user_id
FROM user_exercise_states
WHERE course_instance_id = $1
  AND deleted_at IS NULL
        ",
        course_instance_id
    )
    .map(|x| x.user_id)
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_users_by_course_instance_enrollment(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<Vec<User>> {
    let res = sqlx::query_as!(
        User,
        "
SELECT *
FROM users
WHERE id IN (
    SELECT user_id
    FROM course_instance_enrollments
    WHERE course_instance_id = $1
      AND deleted_at IS NULL
  )
",
        course_instance_id,
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(res)
}
