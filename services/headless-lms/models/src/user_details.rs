use std::collections::HashMap;

use futures::Stream;
use utoipa::ToSchema;

use crate::{prelude::*, users::User};

const MIN_FUZZY_SEARCH_TERM_LENGTH: usize = 3;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]

pub struct UserDetail {
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub search_helper: Option<String>,
    pub country: Option<String>,
    pub email_communication_consent: Option<bool>,
}

pub async fn get_user_details_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<UserDetail> {
    let res = sqlx::query_as!(
        UserDetail,
        "
SELECT user_id,
  created_at,
  updated_at,
  email,
  first_name,
  last_name,
  search_helper,
  country,
  email_communication_consent
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
SELECT user_id,
  created_at,
  updated_at,
  email,
  first_name,
  last_name,
  search_helper,
  country,
  email_communication_consent
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
 ud.search_helper,
 ud.country,
 ud.email_communication_consent
FROM user_details ud
JOIN users u
  ON u.id = ud.user_id
JOIN user_exercise_states ues
  ON ud.user_id = ues.user_id
WHERE ues.course_id = $1
  AND u.deleted_at IS NULL
  AND ues.deleted_at IS NULL
        ",
        course_id
    )
    .fetch(conn)
}

pub async fn search_for_user_details_by_email(
    conn: &mut PgConnection,
    email: &str,
) -> ModelResult<Vec<UserDetail>> {
    let email = normalize_email_search_term(email);
    if !is_fuzzy_search_term_long_enough(email) {
        return Ok(Vec::new());
    }

    // ORDER BY dist only so the GiST trigram index can serve KNN distance ordering.
    let res = sqlx::query_as!(
        UserDetail,
        "
SELECT user_id,
  created_at,
  updated_at,
  email,
  first_name,
  last_name,
  search_helper,
  country,
  email_communication_consent
FROM (
    SELECT user_id,
      created_at,
      updated_at,
      email,
      first_name,
      last_name,
      search_helper,
      country,
      email_communication_consent,
      lower($1) <<-> email_search_helper AS dist
    FROM user_details
    ORDER BY dist
    LIMIT 100
  ) search
WHERE dist < 0.7;
",
        email,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Searches user_details by exact user id.
pub async fn search_for_user_details_by_other_details(
    conn: &mut PgConnection,
    search: &str,
) -> ModelResult<Vec<UserDetail>> {
    let Some(user_id) = parse_exact_user_id_search_term(search) else {
        return Ok(Vec::new());
    };

    let res = sqlx::query_as!(
        UserDetail,
        "
SELECT user_id,
  created_at,
  updated_at,
  email,
  first_name,
  last_name,
  search_helper,
  country,
  email_communication_consent
FROM user_details
WHERE user_id = $1;
",
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn search_for_user_details_fuzzy_match(
    conn: &mut PgConnection,
    search: &str,
) -> ModelResult<Vec<UserDetail>> {
    // If a full email address reaches name search, compare only the local part against names.
    let search = normalize_name_search_term(search);
    if !is_fuzzy_search_term_long_enough(search) {
        return Ok(Vec::new());
    }

    // ORDER BY dist only — no secondary tiebreaker. Adding one (e.g. user_id)
    // would prevent the GiST trigram index from serving the distance ordering,
    // forcing a full table scan+sort. Ties at exactly equal float distances are
    // rare enough in practice that non-determinism in the LIMIT 100 is acceptable.
    let res = sqlx::query_as!(
        UserDetail,
        "
SELECT user_id,
  created_at,
  updated_at,
  email,
  first_name,
  last_name,
  search_helper,
  country,
  email_communication_consent
FROM (
    SELECT user_id,
      created_at,
      updated_at,
      email,
      first_name,
      last_name,
      search_helper,
      country,
      email_communication_consent,
      lower($1) <<-> name_search_helper AS dist
    FROM user_details
    ORDER BY dist
    LIMIT 100
  ) search
WHERE dist < 0.7;
",
        search,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

fn normalize_name_search_term(search: &str) -> &str {
    search.split('@').next().unwrap_or(search).trim()
}

fn normalize_email_search_term(search: &str) -> &str {
    search.trim()
}

fn is_fuzzy_search_term_long_enough(search: &str) -> bool {
    search.chars().count() >= MIN_FUZZY_SEARCH_TERM_LENGTH
}

fn parse_exact_user_id_search_term(search: &str) -> Option<Uuid> {
    search.trim().parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_name_search_term() {
        assert_eq!(normalize_name_search_term("  alice@example.com  "), "alice");
        assert_eq!(normalize_name_search_term("  alice  "), "alice");
    }

    #[test]
    fn normalizes_email_search_term_without_removing_domain() {
        assert_eq!(
            normalize_email_search_term("  alice@example.com  "),
            "alice@example.com"
        );
    }

    #[test]
    fn rejects_short_fuzzy_search_terms() {
        assert!(!is_fuzzy_search_term_long_enough("al"));
        assert!(is_fuzzy_search_term_long_enough("ali"));
    }

    #[test]
    fn parses_exact_user_id_search_term() {
        let user_id = Uuid::parse_str("5b177cc9-fbc3-43b5-8108-63481ff0b0e4").unwrap();

        assert_eq!(
            parse_exact_user_id_search_term("  5b177cc9-fbc3-43b5-8108-63481ff0b0e4  "),
            Some(user_id)
        );
        assert_eq!(parse_exact_user_id_search_term("not-a-user-id"), None);
    }
}

/// Retrieves all users enrolled in a specific course
pub async fn get_users_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<UserDetail>> {
    let res = sqlx::query_as!(
        UserDetail,
        r#"
SELECT d.user_id,
  d.created_at,
  d.updated_at,
  d.email,
  d.first_name,
  d.last_name,
  d.search_helper,
  d.country,
  d.email_communication_consent
FROM course_instance_enrollments e
  JOIN user_details d ON e.user_id = d.user_id
WHERE e.course_id = $1
  AND e.deleted_at IS NULL
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

/// Retrieves user details for a list of user IDs
pub async fn get_user_details_by_user_ids(
    conn: &mut PgConnection,
    user_ids: &[Uuid],
) -> ModelResult<Vec<UserDetail>> {
    let res = sqlx::query_as!(
        UserDetail,
        r#"
SELECT user_id,
  created_at,
  updated_at,
  email,
  first_name,
  last_name,
  search_helper,
  country,
  email_communication_consent
FROM user_details
WHERE user_id = ANY($1::uuid[])
        "#,
        user_ids
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

/// Retrieves user details for a list of user IDs, but only for users who are enrolled in the specified course
pub async fn get_user_details_by_user_ids_for_course(
    conn: &mut PgConnection,
    user_ids: &[Uuid],
    course_id: Uuid,
) -> ModelResult<Vec<UserDetail>> {
    let res = sqlx::query_as!(
        UserDetail,
        r#"
SELECT ud.user_id,
  ud.created_at,
  ud.updated_at,
  ud.email,
  ud.first_name,
  ud.last_name,
  ud.search_helper,
  ud.country,
  ud.email_communication_consent
FROM user_details ud
JOIN user_course_settings ucs ON ud.user_id = ucs.user_id
WHERE ud.user_id = ANY($1::uuid[])
  AND ucs.current_course_id = $2
  AND ucs.deleted_at IS NULL
        "#,
        user_ids,
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

/// Retrieves user details for a single user ID, but only if the user is enrolled in the specified course
pub async fn get_user_details_by_user_id_for_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<UserDetail> {
    let res = sqlx::query_as!(
        UserDetail,
        r#"
SELECT ud.user_id,
  ud.created_at,
  ud.updated_at,
  ud.email,
  ud.first_name,
  ud.last_name,
  ud.search_helper,
  ud.country,
  ud.email_communication_consent
FROM user_details ud
JOIN user_course_settings ucs ON ud.user_id = ucs.user_id
WHERE ud.user_id = $1
  AND ucs.current_course_id = $2
  AND ucs.deleted_at IS NULL
        "#,
        user_id,
        course_id
    )
    .fetch_one(conn)
    .await?;

    Ok(res)
}

pub async fn update_user_country(
    conn: &mut PgConnection,
    user_id: Uuid,
    country: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
UPDATE user_details
SET country = $1
WHERE user_id = $2
"#,
        country,
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Lightweight preferences struct for ECTS email opt-out, separate from UserDetail
/// to avoid touching its many SELECT queries.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct UserEctsEmailPreferences {
    pub ects_email_opt_out: bool,
}

pub async fn get_ects_unsubscribe_token(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Uuid> {
    let token = sqlx::query_scalar!(
        "SELECT ects_unsubscribe_token FROM user_details WHERE user_id = $1",
        user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(token)
}

pub async fn get_user_ects_email_preferences(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<UserEctsEmailPreferences> {
    let res = sqlx::query_as!(
        UserEctsEmailPreferences,
        "SELECT ects_email_opt_out FROM user_details WHERE user_id = $1",
        user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn set_ects_email_preference(
    conn: &mut PgConnection,
    user_id: Uuid,
    opt_out: bool,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE user_details SET ects_email_opt_out = $1 WHERE user_id = $2",
        opt_out,
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Opts a user out of ECTS reminder emails using their unsubscribe token (no login required).
/// Returns the user_id if the token was found, or None if the token did not match any user.
pub async fn opt_out_ects_email_by_unsubscribe_token(
    conn: &mut PgConnection,
    token: Uuid,
) -> ModelResult<Option<Uuid>> {
    let res = sqlx::query!(
        "UPDATE user_details SET ects_email_opt_out = true WHERE ects_unsubscribe_token = $1 RETURNING user_id",
        token,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res.map(|r| r.user_id))
}

pub async fn update_user_email_communication_consent(
    conn: &mut PgConnection,
    user_id: Uuid,
    email_communication_consent: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
UPDATE user_details
SET email_communication_consent = $1
WHERE user_id = $2
"#,
        email_communication_consent,
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_user_info(
    conn: &mut PgConnection,
    user_id: Uuid,
    email: &str,
    first_name: &str,
    last_name: &str,
    country: &str,
    email_communication_consent: bool,
) -> Result<UserDetail, sqlx::Error> {
    let updated_user = sqlx::query_as!(
        UserDetail,
        r#"
UPDATE user_details
SET email = $1,
  first_name = $2,
  last_name = $3,
  country = $4,
  email_communication_consent = $5
WHERE user_id = $6
RETURNING user_id,
  created_at,
  updated_at,
  email,
  first_name,
  last_name,
  search_helper,
  country,
  email_communication_consent
"#,
        email,
        first_name,
        last_name,
        country,
        email_communication_consent,
        user_id,
    )
    .fetch_one(conn)
    .await?;

    Ok(updated_user)
}
