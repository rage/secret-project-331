use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserMarketingConsent {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_language_groups_id: Uuid,
    pub user_id: Uuid,
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
    pub consent: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub synced_to_mailchimp_at: Option<DateTime<Utc>>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
    pub course_name: String,
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

// Fetches all user marketing consents with detailed user information for a specific course language group, if they haven't been synced to Mailchimp or if there have been updates since the last sync.
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
        umc.consent,
        umc.created_at,
        umc.updated_at,
        umc.deleted_at,
        umc.synced_to_mailchimp_at,
        u.first_name AS first_name,
        u.last_name AS last_name,
        u.email AS email,
        c.name AS course_name
    FROM user_marketing_consents AS umc
    JOIN user_details AS u ON u.user_id = umc.user_id
    JOIN courses AS c ON c.id = umc.course_id
    WHERE umc.course_language_groups_id = $1
    AND (umc.synced_to_mailchimp_at IS NULL
            OR umc.synced_to_mailchimp_at < umc.updated_at
            OR umc.synced_to_mailchimp_at < u.updated_at)
    ",
        course_language_groups_id
    )
    .fetch_all(conn)
    .await?;

    Ok(result)
}

// Used to update the synced_to_mailchimp_at to a list of users when they are successfully synced to mailchimp
pub async fn update_synced_to_mailchimp_at_to_all_synced_users(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE user_marketing_consents
SET synced_to_mailchimp_at = now()
WHERE id IN (
    SELECT UNNEST($1::uuid [])
  )
",
        &ids
    )
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
