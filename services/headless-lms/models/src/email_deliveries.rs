use crate::email_templates::EmailTemplateType;
use crate::prelude::*;

pub const FETCH_LIMIT: i64 = 20;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct EmailDelivery {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub email_template_id: Uuid,
    pub sent: bool,
    pub user_id: Uuid,
    /// Number of failed send attempts recorded so far.
    pub retry_count: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub retryable: bool,
    pub first_failed_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
}

pub struct Email {
    pub id: Uuid,
    pub user_id: Uuid,
    pub to: String,
    pub subject: Option<String>,
    pub body: Option<serde_json::Value>,
    pub template_type: Option<EmailTemplateType>,
    /// Number of failed send attempts recorded so far.
    pub retry_count: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub retryable: bool,
    pub first_failed_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
}

/// Inserts an email delivery; fails if the user or email template is soft-deleted.
pub async fn insert_email_delivery(
    conn: &mut PgConnection,
    user_id: Uuid,
    email_template_id: Uuid,
) -> ModelResult<Uuid> {
    let check = sqlx::query_as!(
        CheckUserAndTemplateRow,
        r#"
SELECT
    EXISTS(SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL) AS "user_ok!",
    EXISTS(SELECT 1 FROM email_templates WHERE id = $2 AND deleted_at IS NULL) AS "template_ok!"
        "#,
        user_id,
        email_template_id
    )
    .fetch_one(&mut *conn)
    .await?;
    if !check.user_ok {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "User not found or deleted".to_string(),
            None,
        ));
    }
    if !check.template_ok {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Email template not found or deleted".to_string(),
            None,
        ));
    }

    let id = Uuid::new_v4();
    sqlx::query!(
        r#"
INSERT INTO email_deliveries (
    id,
    user_id,
    email_template_id
)
VALUES ($1, $2, $3)
        "#,
        id,
        user_id,
        email_template_id
    )
    .execute(conn)
    .await?;

    Ok(id)
}

struct CheckUserAndTemplateRow {
    user_ok: bool,
    template_ok: bool,
}

pub async fn fetch_emails(conn: &mut PgConnection) -> ModelResult<Vec<Email>> {
    let emails = sqlx::query_as!(
        Email,
        r#"
WITH due AS (
    SELECT
        ed.id
    FROM email_deliveries ed
    JOIN users u ON u.id = ed.user_id
    JOIN user_details ud ON ud.user_id = ed.user_id
    JOIN email_templates et ON et.id = ed.email_template_id
    WHERE ed.deleted_at IS NULL
      AND ed.sent = FALSE
      AND ed.retryable = TRUE
      AND u.deleted_at IS NULL
      AND et.deleted_at IS NULL
      AND (ed.next_retry_at IS NULL OR ed.next_retry_at <= now())
    ORDER BY coalesce(ed.next_retry_at, '-infinity'::timestamptz), ed.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT $1
),
claimed AS (
    UPDATE email_deliveries ed
    SET last_attempt_at = now(),
        -- Crash-recovery lease for claimed rows; this is not retry backoff.
        next_retry_at = now() + interval '5 minutes'
    FROM due
    WHERE ed.id = due.id
    RETURNING
        ed.id,
        ed.user_id,
        ed.email_template_id,
        ed.retry_count,
        ed.next_retry_at,
        ed.retryable,
        ed.first_failed_at,
        ed.last_attempt_at
)
SELECT
    c.id AS id,
    c.user_id AS user_id,
    ud.email AS to,
    et.subject AS subject,
    et.content AS body,
    et.email_template_type AS "template_type: EmailTemplateType",
    c.retry_count AS retry_count,
    c.next_retry_at AS next_retry_at,
    c.retryable AS retryable,
    c.first_failed_at AS first_failed_at,
    c.last_attempt_at AS last_attempt_at
FROM claimed c
JOIN email_templates et ON et.id = c.email_template_id
JOIN users u ON u.id = c.user_id
JOIN user_details ud ON ud.user_id = u.id
ORDER BY c.last_attempt_at ASC;
        "#,
        FETCH_LIMIT
    )
    .fetch_all(conn)
    .await?;

    Ok(emails)
}

pub async fn mark_as_sent(conn: &mut PgConnection, email_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
update email_deliveries
set sent = TRUE,
    next_retry_at = NULL
where id = $1;
    ",
        email_id
    )
    .execute(conn)
    .await?;

    Ok(())
}

pub async fn insert_email_delivery_error(
    conn: &mut PgConnection,
    error: EmailDeliveryErrorInsert,
) -> ModelResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query!(
        r#"
INSERT INTO email_delivery_errors (
    id,
    email_delivery_id,
    attempt,
    error_message,
    error_code,
    smtp_response,
    smtp_response_code,
    is_transient
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        id,
        error.email_delivery_id,
        error.attempt,
        error.error_message,
        error.error_code,
        error.smtp_response,
        error.smtp_response_code,
        error.is_transient
    )
    .execute(conn)
    .await?;

    Ok(id)
}

pub struct EmailDeliveryErrorInsert {
    pub email_delivery_id: Uuid,
    pub attempt: i32,
    pub error_message: String,
    pub error_code: Option<String>,
    pub smtp_response: Option<String>,
    pub smtp_response_code: Option<i32>,
    pub is_transient: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct EmailDeliveryError {
    pub id: Uuid,
    pub email_delivery_id: Uuid,
    pub attempt: i32,
    pub error_message: String,
    pub error_code: Option<String>,
    pub smtp_response: Option<String>,
    pub smtp_response_code: Option<i32>,
    pub is_transient: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn increment_retry_and_schedule(
    conn: &mut PgConnection,
    email_id: Uuid,
    next_retry_at: Option<DateTime<Utc>>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE email_deliveries
SET retry_count = retry_count + 1,
    next_retry_at = $2,
    first_failed_at = COALESCE(first_failed_at, NOW())
where id = $1;
    ",
        email_id,
        next_retry_at
    )
    .execute(conn)
    .await?;

    Ok(())
}

pub async fn increment_retry_and_mark_non_retryable(
    conn: &mut PgConnection,
    email_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE email_deliveries
SET retry_count = retry_count + 1,
    first_failed_at = COALESCE(first_failed_at, NOW()),
    retryable = FALSE,
    next_retry_at = NULL
WHERE id = $1;
    ",
        email_id
    )
    .execute(conn)
    .await?;

    Ok(())
}

/// Soft-deletes unsent, still-retryable email deliveries for a user. Call when soft-deleting the user so pending deliveries are not retried.
pub async fn soft_delete_unsent_retryable_deliveries_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE email_deliveries
SET deleted_at = NOW()
WHERE user_id = $1
  AND deleted_at IS NULL
  AND sent = FALSE
  AND retryable = TRUE",
        user_id
    )
    .execute(conn)
    .await?;
    Ok(())
}
