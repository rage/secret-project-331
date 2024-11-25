use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserMarketingConsent {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_language_groups_id: Uuid,
    pub user_id: Uuid,
    pub user_mailchimp_id: Option<String>,
    pub consent: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub synced_to_mailchimp_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserMarketingConsentWithDetails {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_language_groups_id: Uuid,
    pub user_id: Uuid,
    pub user_mailchimp_id: Option<String>,
    pub consent: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub synced_to_mailchimp_at: Option<DateTime<Utc>>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
    pub course_name: String,
    pub locale: Option<String>,
    pub completed_course: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]

pub struct MarketingMailingListAccessToken {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_language_groups_id: Uuid,
    pub server_prefix: String,
    pub access_token: String,
    pub mailchimp_mailing_list_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn upsert_marketing_consent(
    conn: &mut PgConnection,
    course_id: Uuid,
    course_language_groups_id: Uuid,
    user_id: &Uuid,
    consent: bool,
) -> sqlx::Result<Uuid> {
    let result = sqlx::query!(
        r#"
      INSERT INTO user_marketing_consents (user_id, course_id, course_language_groups_id, consent)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, course_language_groups_id)
      DO UPDATE
      SET consent = $4
      RETURNING id
      "#,
        user_id,
        course_id,
        course_language_groups_id,
        consent
    )
    .fetch_one(conn)
    .await?;

    Ok(result.id)
}

pub async fn fetch_user_marketing_consent(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: &Uuid,
) -> sqlx::Result<UserMarketingConsent> {
    let result = sqlx::query_as!(
        UserMarketingConsent,
        "
    SELECT id,
      course_id,
      course_language_groups_id,
      user_id,
      user_mailchimp_id,
      consent,
      created_at,
      updated_at,
      deleted_at,
      synced_to_mailchimp_at
    FROM user_marketing_consents
    WHERE user_id = $1 AND course_id = $2
    ",
        user_id,
        course_id,
    )
    .fetch_one(conn)
    .await?;

    Ok(result)
}

/// Fetches all user marketing consents with detailed user information for a specific course language group, if they haven't been synced to Mailchimp or if there have been updates since the last sync.
pub async fn fetch_all_unsynced_user_marketing_consents_by_course_language_groups_id(
    conn: &mut PgConnection,
    course_language_groups_id: Uuid,
) -> sqlx::Result<Vec<UserMarketingConsentWithDetails>> {
    let result = sqlx::query_as!(
        UserMarketingConsentWithDetails,
        "
    SELECT
        umc.id,
        umc.course_id,
        umc.course_language_groups_id,
        umc.user_id,
        umc.user_mailchimp_id,
        umc.consent,
        umc.created_at,
        umc.updated_at,
        umc.deleted_at,
        umc.synced_to_mailchimp_at,
        u.first_name AS first_name,
        u.last_name AS last_name,
        u.email AS email,
        c.name AS course_name,
        c.language_code AS locale,
        CASE WHEN cmc.passed IS NOT NULL THEN cmc.passed ELSE NULL END AS completed_course
    FROM user_marketing_consents AS umc
    JOIN user_details AS u ON u.user_id = umc.user_id
    JOIN courses AS c ON c.id = umc.course_id
    LEFT JOIN course_module_completions AS cmc
        ON cmc.user_id = umc.user_id AND cmc.course_id = umc.course_id
    WHERE umc.course_language_groups_id = $1
    AND (umc.synced_to_mailchimp_at IS NULL
            OR umc.synced_to_mailchimp_at < umc.updated_at)
    ",
        course_language_groups_id
    )
    .fetch_all(conn)
    .await?;

    Ok(result)
}

/// Fetches all user details that have been updated after their marketing consent was last synced to Mailchimp
pub async fn fetch_all_unsynced_updated_emails(
    conn: &mut PgConnection,
    course_language_groups_id: Uuid,
) -> sqlx::Result<Vec<UserMarketingConsentWithDetails>> {
    let result = sqlx::query_as!(
        UserMarketingConsentWithDetails,
        "
    SELECT
        umc.id,
        umc.course_id,
        umc.course_language_groups_id,
        umc.user_id,
        umc.user_mailchimp_id,
        umc.consent,
        umc.created_at,
        umc.updated_at,
        umc.deleted_at,
        umc.synced_to_mailchimp_at,
        u.first_name AS first_name,
        u.last_name AS last_name,
        u.email AS email,
        c.name AS course_name,
        c.language_code AS locale,
        CASE WHEN cmc.passed IS NOT NULL THEN cmc.passed ELSE NULL END AS completed_course
    FROM user_marketing_consents AS umc
    JOIN user_details AS u ON u.user_id = umc.user_id
    JOIN courses AS c ON c.id = umc.course_id
    LEFT JOIN course_module_completions AS cmc
        ON cmc.user_id = umc.user_id AND cmc.course_id = umc.course_id
    WHERE umc.course_language_groups_id = $1
    AND (umc.synced_to_mailchimp_at IS NULL OR umc.synced_to_mailchimp_at < u.updated_at)
    ",
        course_language_groups_id
    )
    .fetch_all(conn)
    .await?;

    Ok(result)
}

/// Used to update the synced_to_mailchimp_at to a list of users when they are successfully synced to mailchimp
pub async fn update_synced_to_mailchimp_at_to_all_synced_users(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE user_marketing_consents
SET synced_to_mailchimp_at = now()
WHERE user_id IN (
    SELECT UNNEST($1::uuid [])
  )
",
        &ids
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Used to add the user_mailchimp_ids to a list of new users when they are successfully synced to mailchimp
pub async fn update_user_mailchimp_id_at_to_all_synced_users(
    pool: &mut PgConnection,
    user_contact_pairs: Vec<(String, String)>,
) -> ModelResult<()> {
    let user_ids: Vec<String> = user_contact_pairs
        .iter()
        .map(|(user_id, _)| user_id.clone())
        .collect();
    let user_mailchimp_ids: Vec<String> = user_contact_pairs
        .iter()
        .map(|(_, mailchimp_id)| mailchimp_id.clone())
        .collect();

    let query = r#"
        UPDATE user_marketing_consents
        SET user_mailchimp_id = updated_data.user_mailchimp_id
        FROM (
            SELECT UNNEST($1::Uuid[]) AS user_id, UNNEST($2::text[]) AS user_mailchimp_id
        ) AS updated_data
        WHERE user_marketing_consents.user_id = updated_data.user_id
    "#;

    sqlx::query(query)
        .bind(&user_ids)
        .bind(&user_mailchimp_ids)
        .execute(pool)
        .await?;

    Ok(())
}

/// Updates user consents in bulk using Mailchimp data.
pub async fn update_bulk_user_consent(
    conn: &mut PgConnection,
    mailchimp_data: Vec<(String, bool, String, String)>,
) -> anyhow::Result<()> {
    let user_ids: Vec<Uuid> = mailchimp_data
        .iter()
        .filter_map(|(user_id, _, _, _)| Uuid::parse_str(user_id).ok())
        .collect();

    let consents: Vec<bool> = mailchimp_data
        .iter()
        .map(|(_, consent, _, _)| *consent)
        .collect();

    let timestamps: Vec<DateTime<Utc>> = mailchimp_data
        .iter()
        .filter_map(|(_, _, ts, _)| {
            DateTime::parse_from_rfc3339(ts)
                .ok()
                .map(|dt| dt.with_timezone(&Utc)) // Convert to Utc
        })
        .collect();

    let course_language_groups_ids: Vec<Uuid> = mailchimp_data
        .iter()
        .filter_map(|(_, _, _, lang_id)| Uuid::parse_str(lang_id).ok())
        .collect();

    let query = r#"
        UPDATE user_marketing_consents
        SET consent = updated_data.consent,
            synced_to_mailchimp_at = updated_data.last_updated
        FROM (
            SELECT UNNEST($1::Uuid[]) AS user_id,
                   UNNEST($2::bool[]) AS consent,
                   UNNEST($3::timestamptz[]) AS last_updated,
                   UNNEST($4::Uuid[]) AS course_language_groups_id
        ) AS updated_data
        WHERE user_marketing_consents.user_id = updated_data.user_id
          AND user_marketing_consents.synced_to_mailchimp_at < updated_data.last_updated
          AND user_marketing_consents.course_language_groups_id = updated_data.course_language_groups_id
    "#;

    // Execute the query
    sqlx::query(query)
        .bind(&user_ids)
        .bind(&consents)
        .bind(&timestamps)
        .bind(&course_language_groups_ids)
        .execute(conn)
        .await?;
    Ok(())
}

pub async fn fetch_all_marketing_mailing_list_access_tokens(
    conn: &mut PgConnection,
) -> sqlx::Result<Vec<MarketingMailingListAccessToken>> {
    let results = sqlx::query_as!(
        MarketingMailingListAccessToken,
        "
    SELECT
      id,
      course_id,
      course_language_groups_id,
      server_prefix,
      access_token,
      mailchimp_mailing_list_id,
      created_at,
      updated_at,
      deleted_at
    FROM marketing_mailing_list_access_tokens
    "
    )
    .fetch_all(conn)
    .await?;

    Ok(results)
}
