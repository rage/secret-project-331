use secrecy::ExposeSecret;

use crate::prelude::*;

/// The same base the scraped registration links used, so a student sees the page they saw before
/// this pipeline existed.
const OPEN_UNIVERSITY_ENROLMENT_BASE_URL: &str =
    "https://www.avoin.helsinki.fi/palvelut/esittely.aspx?s=";

/// The enrolment page a student with no usable enrolment is sent to. The token is exposed here on
/// purpose and nowhere else: it must not reach a log line or a stored response body.
pub fn enrolment_url(token: &OpenUniversityProductAccessToken) -> String {
    format!(
        "{OPEN_UNIVERSITY_ENROLMENT_BASE_URL}{}",
        token.access_token.expose_secret()
    )
}

#[derive(Debug, Clone)]
pub struct OpenUniversityProductAccessToken {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub open_university_product_id: String,
    pub access_token: DbSecret,
    pub state: String,
    pub document_state: String,
    pub suotar_token_id: Option<String>,
    pub last_refreshed_at: DateTime<Utc>,
    pub last_refresh_failed_at: Option<DateTime<Utc>>,
    pub last_refresh_error: Option<String>,
    pub consecutive_failures: i32,
}

#[derive(Debug, Clone)]
pub struct NewOpenUniversityProductAccessToken {
    pub open_university_product_id: String,
    pub access_token: DbSecret,
    pub state: String,
    pub document_state: String,
    pub suotar_token_id: Option<String>,
}

/// Stores a freshly fetched token, replacing whatever we held for the product.
pub async fn upsert(
    conn: &mut PgConnection,
    new: &NewOpenUniversityProductAccessToken,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO open_university_product_access_tokens (
    open_university_product_id,
    access_token,
    state,
    document_state,
    suotar_token_id
  )
VALUES ($1, $2, $3, $4, $5) ON CONFLICT (open_university_product_id, deleted_at) DO
UPDATE
SET access_token = $2,
  state = $3,
  document_state = $4,
  suotar_token_id = $5,
  last_refreshed_at = now(),
  last_refresh_failed_at = NULL,
  last_refresh_error = NULL,
  consecutive_failures = 0
RETURNING id
        "#,
        new.open_university_product_id,
        new.access_token.expose_secret(),
        new.state,
        new.document_state,
        new.suotar_token_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_product_id(
    conn: &mut PgConnection,
    open_university_product_id: &str,
) -> ModelResult<Option<OpenUniversityProductAccessToken>> {
    let res = sqlx::query_as!(
        OpenUniversityProductAccessToken,
        r#"
SELECT *
FROM open_university_product_access_tokens
WHERE open_university_product_id = $1
  AND deleted_at IS NULL
        "#,
        open_university_product_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_all(
    conn: &mut PgConnection,
) -> ModelResult<Vec<OpenUniversityProductAccessToken>> {
    let res = sqlx::query_as!(
        OpenUniversityProductAccessToken,
        r#"
SELECT *
FROM open_university_product_access_tokens
WHERE deleted_at IS NULL
ORDER BY open_university_product_id
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Records a failed refresh without touching the token: a stale token still beats none.
pub async fn record_refresh_failure(
    conn: &mut PgConnection,
    open_university_product_id: &str,
    error: &str,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE open_university_product_access_tokens
SET last_refresh_failed_at = now(),
  last_refresh_error = $2,
  consecutive_failures = consecutive_failures + 1
WHERE open_university_product_id = $1
  AND deleted_at IS NULL
        "#,
        open_university_product_id,
        error,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn soft_delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE open_university_product_access_tokens
SET deleted_at = now()
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}
