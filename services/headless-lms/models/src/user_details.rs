use std::collections::HashMap;

use futures::Stream;
use utoipa::ToSchema;

use crate::{prelude::*, users::User};

const MIN_FUZZY_SEARCH_TERM_LENGTH: usize = 3;

/// How proof of control over [`UserDetail::email`] was obtained. `AdminAsserted` is the weakest.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "email_verification_method", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EmailVerificationMethod {
    EmailedCode,
    PasswordResetBackfill,
    TmcConfirmed,
    AdminAsserted,
}

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
    /// When the user last proved control of the address in `email`. `None` means unproven. Cleared
    /// by a database trigger on every address change, so a value here always refers to `email`.
    pub email_verified_at: Option<DateTime<Utc>>,
    pub email_verified_method: Option<EmailVerificationMethod>,
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
  email_communication_consent,
  email_verified_at,
  email_verified_method
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
  email_communication_consent,
  email_verified_at,
  email_verified_method
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
 ud.email_communication_consent,
 ud.email_verified_at,
 ud.email_verified_method
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

/// None when no active user has this email. Case-insensitive, matching the users_email unique index.
pub async fn get_active_user_id_by_email_case_insensitive(
    conn: &mut PgConnection,
    email: &str,
) -> ModelResult<Option<Uuid>> {
    let id = sqlx::query_scalar!(
        "SELECT ud.user_id
         FROM user_details ud
         JOIN users u ON u.id = ud.user_id
         WHERE LOWER(ud.email) = LOWER($1)
           AND u.deleted_at IS NULL",
        email
    )
    .fetch_optional(conn)
    .await?;
    Ok(id)
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
  email_communication_consent,
  email_verified_at,
  email_verified_method
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
      email_verified_at,
      email_verified_method,
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
  email_communication_consent,
  email_verified_at,
  email_verified_method
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
  email_communication_consent,
  email_verified_at,
  email_verified_method
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
      email_verified_at,
      email_verified_method,
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
  d.email_communication_consent,
  d.email_verified_at,
  d.email_verified_method
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
  email_communication_consent,
  email_verified_at,
  email_verified_method
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
  ud.email_communication_consent,
  ud.email_verified_at,
  ud.email_verified_method
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
  ud.email_communication_consent,
  ud.email_verified_at,
  ud.email_verified_method
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

/// Writes the whole profile form, including the derived `users.email_domain`.
///
/// On an address change the `clear_email_verification` trigger nulls `email_verified_at` and
/// `email_verified_method`, so a caller wanting fresh proof must mail a new verification link.
pub async fn update_user_info(
    conn: &mut PgConnection,
    user_id: Uuid,
    email: &str,
    first_name: &str,
    last_name: &str,
    country: &str,
    email_communication_consent: bool,
) -> Result<UserDetail, sqlx::Error> {
    let mut tx = conn.begin().await?;
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
  email_communication_consent,
  email_verified_at,
  email_verified_method
"#,
        email,
        first_name,
        last_name,
        country,
        email_communication_consent,
        user_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
UPDATE users
SET email_domain = $1
WHERE id = $2
"#,
        crate::users::email_domain_from_email(email),
        user_id,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(updated_user)
}

/// Records a proof of control over the address currently in `email`.
///
/// Must not also write `email`: the `clear_email_verification` trigger would null the flag in the
/// same statement.
pub async fn set_email_verified(
    conn: &mut PgConnection,
    user_id: Uuid,
    method: EmailVerificationMethod,
    verified_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE user_details
SET email_verified_at = $2,
  email_verified_method = $3
WHERE user_id = $1
"#,
        user_id,
        verified_at,
        method as EmailVerificationMethod,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Drops a proof of control, for an admin revoking a verification. Address changes do not need it;
/// the `clear_email_verification` trigger handles those.
pub async fn clear_email_verified(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE user_details
SET email_verified_at = NULL,
  email_verified_method = NULL
WHERE user_id = $1
"#,
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Whether the address currently in `email` has a proof of control, and how it was obtained.
pub async fn get_email_verification(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Option<(DateTime<Utc>, EmailVerificationMethod)>> {
    let row = sqlx::query!(
        r#"
SELECT email_verified_at,
  email_verified_method AS "email_verified_method: EmailVerificationMethod"
FROM user_details
WHERE user_id = $1
"#,
        user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(row.email_verified_at.zip(row.email_verified_method))
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

    // One test per writer of user_details.email. No call site clears the verification flag itself,
    // so these are what notices if the clear_email_verification trigger is ever dropped. Writers A
    // and B both go through update_user_info, so they differ only in the payload sent.
    mod email_verification_trigger {
        use super::*;
        use crate::test_helper::*;

        async fn verify_now(tx: &mut PgConnection, user_id: Uuid) {
            set_email_verified(
                tx,
                user_id,
                EmailVerificationMethod::EmailedCode,
                Utc::now(),
            )
            .await
            .unwrap();
        }

        #[tokio::test]
        async fn writer_a_user_settings_edit_clears_the_flag() {
            insert_data!(:tx, :user);
            verify_now(tx.as_mut(), user).await;

            let updated = update_user_info(
                tx.as_mut(),
                user,
                "writer-a-changed@example.com",
                "Changed",
                "Name",
                "FI",
                true,
            )
            .await
            .unwrap();

            assert_eq!(updated.email, "writer-a-changed@example.com");
            assert_eq!(updated.email_verified_at, None);
            assert_eq!(updated.email_verified_method, None);
        }

        #[tokio::test]
        async fn writer_b_course_material_edit_clears_the_flag() {
            insert_data!(:tx, :user);
            let before = update_user_info(
                tx.as_mut(),
                user,
                "writer-b@example.com",
                "Course",
                "Material",
                "FI",
                true,
            )
            .await
            .unwrap();
            verify_now(tx.as_mut(), user).await;

            // The course-material form resubmits the whole profile, so only the address differs.
            let updated = update_user_info(
                tx.as_mut(),
                user,
                "writer-b-changed@example.com",
                before.first_name.as_deref().unwrap(),
                before.last_name.as_deref().unwrap(),
                before.country.as_deref().unwrap(),
                before.email_communication_consent.unwrap(),
            )
            .await
            .unwrap();

            assert_eq!(updated.email_verified_at, None);
            assert_eq!(updated.email_verified_method, None);
        }

        #[tokio::test]
        async fn writer_c_tmc_sync_clears_the_flag() {
            insert_data!(:tx);
            let upstream_id = 90_112_233;
            let user = crate::users::insert_with_upstream_id_and_moocfi_id(
                tx.as_mut(),
                "writer-c@example.com",
                None,
                None,
                upstream_id,
                Uuid::new_v4(),
            )
            .await
            .unwrap();
            verify_now(tx.as_mut(), user.id).await;

            crate::users::update_email_for_user(
                tx.as_mut(),
                &upstream_id,
                "writer-c-changed@example.com".to_string(),
            )
            .await
            .unwrap();

            assert!(
                get_email_verification(tx.as_mut(), user.id)
                    .await
                    .unwrap()
                    .is_none()
            );
        }

        #[tokio::test]
        async fn an_edit_that_leaves_the_address_alone_keeps_the_flag() {
            insert_data!(:tx, :user);
            let before = get_user_details_by_user_id(tx.as_mut(), user)
                .await
                .unwrap();
            verify_now(tx.as_mut(), user).await;

            let updated = update_user_info(
                tx.as_mut(),
                user,
                &before.email,
                "Renamed",
                "Person",
                "SE",
                false,
            )
            .await
            .unwrap();

            assert!(updated.email_verified_at.is_some());
            assert_eq!(
                updated.email_verified_method,
                Some(EmailVerificationMethod::EmailedCode)
            );
        }
    }
}
