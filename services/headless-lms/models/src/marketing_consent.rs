use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserMarketingConsent {
    pub id: Uuid,
    pub course_id: Uuid,
    pub user_id: Uuid,
    pub consent: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn upsert_marketing_consent(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: &Uuid,
    consent: bool,
) -> sqlx::Result<Uuid> {
    let result = sqlx::query!(
        r#"
      INSERT INTO user_marketing_consents (user_id, course_id, consent)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, course_id)
      DO UPDATE
      SET consent = $3
      RETURNING id
      "#,
        user_id,
        course_id,
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
      user_id,
      consent,
      created_at,
      updated_at,
      deleted_at
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
