use crate::prelude::*;
use rand::Rng;
use rand::distr::{Alphanumeric, SampleString};

#[derive(sqlx::FromRow, Debug, Clone)]
pub struct EmailVerificationToken {
    pub id: Uuid,
    pub email_verification_token: String,
    pub user_id: Uuid,
    pub code: String,
    pub code_sent: bool,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub fn is_valid(token: &EmailVerificationToken) -> bool {
    let now = Utc::now();
    token.expires_at > now && token.used_at.is_none() && token.deleted_at.is_none()
}

pub async fn maybe_cleanup_expired(conn: &mut PgConnection) -> ModelResult<()> {
    let random_num = rand::rng().random_range(1..=10);
    if random_num == 1 {
        info!("Cleaning up expired email verification tokens");
        let _ = sqlx::query!(
            r#"
DELETE FROM email_verification_tokens
WHERE expires_at < NOW()
  AND deleted_at IS NULL
            "#,
        )
        .execute(conn)
        .await?;
    }
    Ok(())
}

pub async fn create_email_verification_token(
    conn: &mut PgConnection,
    user_id: Uuid,
    code: String,
) -> ModelResult<String> {
    maybe_cleanup_expired(conn).await?;

    let email_verification_token = Alphanumeric.sample_string(&mut rand::rng(), 128);

    let result = sqlx::query!(
        r#"
INSERT INTO email_verification_tokens (
    email_verification_token,
    user_id,
    code,
    expires_at
)
VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')
RETURNING email_verification_token
        "#,
        email_verification_token,
        user_id,
        code
    )
    .fetch_one(conn)
    .await?;

    Ok(result.email_verification_token)
}

pub async fn get_by_email_verification_token(
    conn: &mut PgConnection,
    token: &str,
) -> ModelResult<Option<EmailVerificationToken>> {
    maybe_cleanup_expired(conn).await?;

    let record = sqlx::query_as!(
        EmailVerificationToken,
        r#"
SELECT id,
    email_verification_token,
    user_id,
    code,
    code_sent,
    expires_at,
    used_at,
    created_at,
    updated_at,
    deleted_at
FROM email_verification_tokens
WHERE email_verification_token = $1
  AND expires_at > NOW()
  AND deleted_at IS NULL
  AND used_at IS NULL
        "#,
        token
    )
    .fetch_optional(conn)
    .await?;

    Ok(record)
}

pub async fn verify_code(
    conn: &mut PgConnection,
    email_verification_token: &str,
    code: &str,
) -> ModelResult<bool> {
    let token = get_by_email_verification_token(conn, email_verification_token).await?;

    match token {
        Some(t) => Ok(t.code == code),
        None => Ok(false),
    }
}

pub async fn mark_as_used(
    conn: &mut PgConnection,
    email_verification_token: &str,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE email_verification_tokens
SET used_at = NOW()
WHERE email_verification_token = $1
  AND deleted_at IS NULL
        "#,
        email_verification_token
    )
    .execute(conn)
    .await?;

    Ok(())
}

pub async fn mark_code_sent(
    conn: &mut PgConnection,
    email_verification_token: &str,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE email_verification_tokens
SET code_sent = TRUE
WHERE email_verification_token = $1
  AND deleted_at IS NULL
        "#,
        email_verification_token
    )
    .execute(conn)
    .await?;

    Ok(())
}
