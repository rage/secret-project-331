use std::collections::HashMap;

use futures::Stream;

use crate::{prelude::*, users::User};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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
SELECT distinct (ud.user_id),
 ud.created_at,
 ud.updated_at,
 ud.first_name,
 ud.last_name,
 ud.email,
 ud.search_helper
FROM user_details ud
JOIN users u
  ON u.id = ud.user_id
JOIN user_exercise_states ues
  ON ud.user_id = ues.user_id
JOIN course_instances ci
  ON ci.id = ues.course_instance_id
WHERE ci.course_id = $1
  AND u.deleted_at IS NULL
  AND ues.deleted_at IS NULL
  AND ci.deleted_at IS NULL;
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

/// Retrieves all users enrolled in a specific course
pub async fn get_users_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<UserDetail>> {
    let res = sqlx::query_as!(
        UserDetail,
        "
        SELECT
            d.user_id,
            d.created_at,
            d.updated_at,
            d.email,
            d.first_name,
            d.last_name,
            d.search_helper
        FROM course_instance_enrollments e
        JOIN user_details d ON e.user_id = d.user_id
        WHERE e.course_id = $1
        AND e.deleted_at IS NULL
        ",
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}
