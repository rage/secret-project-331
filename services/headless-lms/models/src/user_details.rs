use std::collections::HashMap;

use futures::Stream;

use crate::{prelude::*, users::User};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserDetail {
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub search_helper: Option<String>,
}

pub async fn get_user_details_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<UserDetail> {
    let res = sqlx::query_as!(
        UserDetail,
        "
SELECT *
FROM user_details
WHERE user_id = $1 ",
        user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_users_details_by_user_id_map(
    conn: &mut PgConnection,
    users: &[User],
) -> ModelResult<HashMap<Uuid, UserDetail>> {
    let ids = users.iter().map(|u| u.id).collect::<Vec<_>>();
    let details = sqlx::query_as!(
        UserDetail,
        "
SELECT *
FROM user_details
WHERE user_id IN (
    SELECT UNNEST($1::uuid [])
  )
",
        &ids
    )
    .fetch_all(conn)
    .await?;
    let mut res = HashMap::new();
    details.into_iter().for_each(|d| {
        res.insert(d.user_id, d);
    });
    Ok(res)
}

/// Includes all users who have returned an exercise on a course
pub fn stream_users_details_having_user_exercise_states_on_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> impl Stream<Item = sqlx::Result<UserDetail>> + '_ {
    sqlx::query_as!(
        UserDetail,
        "
SELECT *
FROM user_details
WHERE user_id in (
    SELECT DISTINCT (user_id)
    FROM user_exercise_states
    WHERE course_instance_id IN (
        SELECT id
        FROM course_instances
        WHERE course_id = $1
      )
      AND deleted_at IS NULL
  );
        ",
        course_id
    )
    .fetch(conn)
}

pub async fn search_for_user_details_by_email(
    conn: &mut PgConnection,
    email: &str,
) -> ModelResult<Vec<UserDetail>> {
    let res = sqlx::query_as!(
        UserDetail,
        "
SELECT *
FROM user_details
WHERE lower(email::text) LIKE '%' || lower($1) || '%'
LIMIT 1000;
",
        email.trim(),
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn search_for_user_details_by_other_details(
    conn: &mut PgConnection,
    search: &str,
) -> ModelResult<Vec<UserDetail>> {
    let res = sqlx::query_as!(
        UserDetail,
        "
SELECT *
FROM user_details
WHERE lower(search_helper::text) LIKE '%' || lower($1) || '%'
LIMIT 1000;
",
        search.trim(),
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn search_for_user_details_fuzzy_match(
    conn: &mut PgConnection,
    search: &str,
) -> ModelResult<Vec<UserDetail>> {
    // For email domains, the fuzzy match returns too much results that have the same domain
    // To combat this, we omit the email domain from the fuzzy match
    let search = search.split('@').next().unwrap_or(search);

    let res = sqlx::query_as!(
        UserDetail,
        "
SELECT user_id,
  created_at,
  updated_at,
  email,
  first_name,
  last_name,
  search_helper
FROM (
    SELECT *,
      LOWER($1) <<->search_helper AS dist
    FROM user_details
    ORDER BY dist, LENGTH(search_helper)
    LIMIT 100
  ) search
WHERE dist < 0.7;
",
        search.trim(),
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
