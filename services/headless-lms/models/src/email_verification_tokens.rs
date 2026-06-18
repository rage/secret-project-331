use crate::prelude::*;
use rand::RngExt;
use rand::distr::{Alphanumeric, SampleString};
use secrecy::ExposeSecret;

#[derive(sqlx::FromRow, Debug, Clone)]
pub struct EmailVerificationToken {
    pub id: Uuid,
    pub email_verification_token: DbSecret,
    pub user_id: Uuid,
    pub code: DbSecret,
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
    code: DbSecret,
) -> ModelResult<DbSecret> {
    maybe_cleanup_expired(conn).await?;

    let email_verification_token = DbSecret::new(Alphanumeric.sample_string(&mut rand::rng(), 128));

    let result = sqlx::query!(
        r#"
INSERT INTO email_verification_tokens (
    email_verification_token,
    user_id,
    code,
    expires_at
)
VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')
RETURNING *
        "#,
        email_verification_token.expose_secret(),
        user_id,
        code.expose_secret()
    )
    .fetch_one(conn)
    .await?;

    Ok(result.email_verification_token)
}

pub async fn get_by_email_verification_token(
    conn: &mut PgConnection,
    token: &DbSecret,
) -> ModelResult<Option<EmailVerificationToken>> {
    maybe_cleanup_expired(conn).await?;

    let record = sqlx::query_as!(
        EmailVerificationToken,
        r#"
SELECT *
FROM email_verification_tokens
WHERE email_verification_token = $1
  AND expires_at > NOW()
  AND deleted_at IS NULL
  AND used_at IS NULL
        "#,
        token.expose_secret()
    )
    .fetch_optional(conn)
    .await?;

    Ok(record)
}

pub async fn verify_code(
    conn: &mut PgConnection,
    email_verification_token: &DbSecret,
    code: &DbSecret,
) -> ModelResult<bool> {
    let token = get_by_email_verification_token(conn, email_verification_token).await?;

    match token {
        Some(t) => Ok(t.code.expose_secret() == code.expose_secret()),
        None => Ok(false),
    }
}

pub async fn mark_as_used(
    conn: &mut PgConnection,
    email_verification_token: &DbSecret,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE email_verification_tokens
SET used_at = NOW()
WHERE email_verification_token = $1
  AND deleted_at IS NULL
  AND used_at IS NULL
  AND expires_at > NOW()
        "#,
        email_verification_token.expose_secret()
    )
    .execute(conn)
    .await?;

    Ok(())
}

pub async fn mark_code_sent(
    conn: &mut PgConnection,
    email_verification_token: &DbSecret,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE email_verification_tokens
SET code_sent = TRUE
WHERE email_verification_token = $1
  AND deleted_at IS NULL
        "#,
        email_verification_token.expose_secret()
    )
    .execute(conn)
    .await?;

    Ok(())
}
