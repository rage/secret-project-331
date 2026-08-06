use std::collections::HashMap;

use rand::RngExt;
use utoipa::ToSchema;

use crate::email_templates::EmailTemplateType;
use crate::prelude::*;

pub const FETCH_LIMIT: i64 = 20;

/// How long a delivery keeps being retried after its first failure.
///
/// Shared by the sender and [`derive_email_send_status`], which must agree on what has failed.
pub const RETRY_WINDOW_SECS: i64 = 3 * 24 * 60 * 60;

/// How long a delivery to a raw address may keep that address after being queued.
const RECIPIENT_ADDRESS_RETENTION: &str = "1 month";

/// One purge in this many calls, matching the token cleanups. The caller schedules how often it asks.
const PURGE_CHANCE_IN: u32 = 10;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct EmailDelivery {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub email_template_id: Uuid,
    pub sent: bool,
    /// `None` for deliveries addressed to a raw address; see `recipient_email`.
    pub user_id: Option<Uuid>,
    pub recipient_email: Option<String>,
    pub placeholders: Option<serde_json::Value>,
    /// Number of failed send attempts recorded so far.
    pub retry_count: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub retryable: bool,
    pub first_failed_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
}

pub struct Email {
    pub id: Uuid,
    /// `None` when the mail goes to a raw address with no account here; substitutions must cope.
    pub user_id: Option<Uuid>,
    pub to: String,
    pub subject: Option<String>,
    pub body: Option<serde_json::Value>,
    pub template_type: Option<EmailTemplateType>,
    /// Substitutions carried on the delivery row, so a mail to a raw address needs no user lookup.
    pub placeholders: Option<serde_json::Value>,
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

/// Queues an email to a raw address, for recipients who may have no account here.
pub async fn insert_email_delivery_to_address(
    conn: &mut PgConnection,
    recipient_email: &str,
    email_template_id: Uuid,
    placeholders: &serde_json::Value,
) -> ModelResult<Uuid> {
    let template_ok = sqlx::query_scalar!(
        r#"
SELECT EXISTS(SELECT 1 FROM email_templates WHERE id = $1 AND deleted_at IS NULL) AS "template_ok!"
        "#,
        email_template_id
    )
    .fetch_one(&mut *conn)
    .await?;
    if !template_ok {
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
    recipient_email,
    email_template_id,
    placeholders
)
VALUES ($1, $2, $3, $4)
        "#,
        id,
        recipient_email,
        email_template_id,
        placeholders
    )
    .execute(conn)
    .await?;

    Ok(id)
}

pub async fn fetch_emails(conn: &mut PgConnection) -> ModelResult<Vec<Email>> {
    let emails = sqlx::query_as!(
        Email,
        r#"
WITH due AS (
    SELECT
        ed.id
    FROM email_deliveries ed
    LEFT JOIN users u ON u.id = ed.user_id
    LEFT JOIN user_details ud ON ud.user_id = ed.user_id
    JOIN email_templates et ON et.id = ed.email_template_id
    WHERE ed.deleted_at IS NULL
      AND ed.sent = FALSE
      AND ed.retryable = TRUE
      AND (ed.user_id IS NULL OR u.deleted_at IS NULL)
      AND (ed.recipient_email IS NOT NULL OR ud.email IS NOT NULL)
      AND et.deleted_at IS NULL
      AND (ed.next_retry_at IS NULL OR ed.next_retry_at <= now())
    ORDER BY coalesce(ed.next_retry_at, '-infinity'::timestamptz), ed.created_at
    -- OF ed is required, not cosmetic: rows on the nullable side of an outer join cannot be locked.
    FOR UPDATE OF ed SKIP LOCKED
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
        ed.recipient_email,
        ed.placeholders,
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
    COALESCE(c.recipient_email, ud.email) AS "to!",
    et.subject AS subject,
    et.content AS body,
    et.email_template_type AS "template_type",
    c.placeholders AS placeholders,
    c.retry_count AS retry_count,
    c.next_retry_at AS next_retry_at,
    c.retryable AS retryable,
    c.first_failed_at AS first_failed_at,
    c.last_attempt_at AS last_attempt_at
FROM claimed c
JOIN email_templates et ON et.id = c.email_template_id
LEFT JOIN user_details ud ON ud.user_id = c.user_id
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

/// What we can honestly say about an email we queued.
///
/// We only hand messages to an SMTP relay, so copy rendering this must never say "delivered" or
/// "received".
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EmailSendStatus {
    /// In our queue, not handed over yet.
    Queued,
    /// At least one attempt failed transiently; `next_retry_at` says when we try again.
    Retrying,
    /// Handed to the mail relay. Not a delivery confirmation.
    Sent,
    /// We could not hand it over at all, and will not try again.
    SendFailed,
}

/// The shared payload for every surface that reports on a queued email.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EmailSendStatusReport {
    pub email_send_status: EmailSendStatus,
    pub sent_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub retry_count: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub failure_code: Option<String>,
    pub failure_is_transient: Option<bool>,
}

/// The delivery-row facts [`derive_email_send_status`] needs, so the derivation itself is pure.
#[derive(Debug, PartialEq, Clone)]
pub struct EmailSendStatusFacts {
    pub sent: bool,
    pub retryable: bool,
    pub retry_count: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub first_failed_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    /// From the newest `email_delivery_errors` row, if any.
    pub failure_code: Option<String>,
    pub failure_is_transient: Option<bool>,
}

/// The one derivation of send status. Every surface goes through it.
pub fn derive_email_send_status(
    facts: &EmailSendStatusFacts,
    now: DateTime<Utc>,
) -> EmailSendStatusReport {
    let window_expired = facts
        .first_failed_at
        .is_some_and(|first| (now - first).num_seconds() > RETRY_WINDOW_SECS);

    let email_send_status = if facts.sent {
        EmailSendStatus::Sent
    } else if !facts.retryable || window_expired {
        EmailSendStatus::SendFailed
    } else if facts.retry_count > 0 {
        EmailSendStatus::Retrying
    } else {
        EmailSendStatus::Queued
    };

    EmailSendStatusReport {
        email_send_status,
        // There is no sent_at column; on a sent row the last attempt is the one that succeeded.
        sent_at: if facts.sent {
            facts.last_attempt_at
        } else {
            None
        },
        last_attempt_at: facts.last_attempt_at,
        retry_count: facts.retry_count,
        next_retry_at: match email_send_status {
            EmailSendStatus::Retrying => facts.next_retry_at,
            _ => None,
        },
        failure_code: facts.failure_code.clone(),
        failure_is_transient: facts.failure_is_transient,
    }
}

pub async fn get_send_statuses(
    conn: &mut PgConnection,
    email_delivery_ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, EmailSendStatusReport>> {
    let rows = sqlx::query!(
        r#"
SELECT ed.id,
  ed.sent,
  ed.retryable,
  ed.retry_count,
  ed.next_retry_at,
  ed.first_failed_at,
  ed.last_attempt_at,
  latest_error.error_code,
  latest_error.is_transient
FROM email_deliveries ed
  LEFT JOIN LATERAL (
    SELECT ede.error_code,
      ede.is_transient
    FROM email_delivery_errors ede
    WHERE ede.email_delivery_id = ed.id
      AND ede.deleted_at IS NULL
    ORDER BY ede.attempt DESC,
      ede.created_at DESC
    LIMIT 1
  ) latest_error ON TRUE
WHERE ed.id = ANY($1::uuid [])
  AND ed.deleted_at IS NULL
        "#,
        email_delivery_ids
    )
    .fetch_all(conn)
    .await?;

    let now = Utc::now();
    let res = rows
        .into_iter()
        .map(|row| {
            let facts = EmailSendStatusFacts {
                sent: row.sent,
                retryable: row.retryable,
                retry_count: row.retry_count,
                next_retry_at: row.next_retry_at,
                first_failed_at: row.first_failed_at,
                last_attempt_at: row.last_attempt_at,
                failure_code: row.error_code,
                failure_is_transient: row.is_transient,
            };
            (row.id, derive_email_send_status(&facts, now))
        })
        .collect();
    Ok(res)
}

pub async fn get_send_status(
    conn: &mut PgConnection,
    email_delivery_id: Uuid,
) -> ModelResult<Option<EmailSendStatusReport>> {
    let mut statuses = get_send_statuses(conn, &[email_delivery_id]).await?;
    Ok(statuses.remove(&email_delivery_id))
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

/// Probabilistic purge instead of a cron, in the style of the token cleanups.
///
/// Only raw-address rows ever hold an address; a delivery addressed by `user_id` resolves the address
/// from `user_details` at send time and stores nothing.
pub async fn maybe_purge_expired_recipient_addresses(conn: &mut PgConnection) -> ModelResult<u64> {
    if rand::rng().random_range(1..=PURGE_CHANCE_IN) != 1 {
        return Ok(0);
    }
    info!("Purging retained recipient addresses past their retention window");
    let result = sqlx::query!(
        r#"
UPDATE email_deliveries ed
SET recipient_email = NULL,
    placeholders = CASE
      WHEN ed.placeholders IS NULL THEN NULL
      ELSE ed.placeholders - 'EMAIL'
    END,
    -- Without an address the row can never be delivered, so retire it here instead of leaving the
    -- sender to claim it and fail. The CHECK constraint also requires this.
    retryable = CASE WHEN ed.sent THEN ed.retryable ELSE FALSE END,
    next_retry_at = CASE WHEN ed.sent THEN ed.next_retry_at ELSE NULL END,
    deleted_at = CASE
      WHEN ed.sent OR ed.deleted_at IS NOT NULL THEN ed.deleted_at
      ELSE now()
    END
WHERE ed.recipient_email IS NOT NULL
  AND ed.created_at < now() - $1::text::interval
  -- The sender stamps last_attempt_at when it claims a row and holds a five minute lease, so an hour
  -- of quiet means nothing is mid-send.
  AND (
    ed.sent
    OR ed.last_attempt_at IS NULL
    OR ed.last_attempt_at < now() - interval '1 hour'
  )
        "#,
        RECIPIENT_ADDRESS_RETENTION
    )
    .execute(conn)
    .await?;
    Ok(result.rows_affected())
}

#[cfg(test)]
mod tests {
    use chrono::Duration;

    use super::*;

    fn queued_facts() -> EmailSendStatusFacts {
        EmailSendStatusFacts {
            sent: false,
            retryable: true,
            retry_count: 0,
            next_retry_at: None,
            first_failed_at: None,
            last_attempt_at: None,
            failure_code: None,
            failure_is_transient: None,
        }
    }

    #[test]
    fn queued_when_nothing_has_been_attempted() {
        let now = Utc::now();
        let report = derive_email_send_status(&queued_facts(), now);
        assert_eq!(report.email_send_status, EmailSendStatus::Queued);
        assert_eq!(report.sent_at, None);
        assert_eq!(report.next_retry_at, None);
    }

    #[test]
    fn retrying_after_a_transient_failure_reports_when_we_try_again() {
        let now = Utc::now();
        let next_retry_at = now + Duration::minutes(5);
        let facts = EmailSendStatusFacts {
            retry_count: 1,
            next_retry_at: Some(next_retry_at),
            first_failed_at: Some(now - Duration::minutes(1)),
            last_attempt_at: Some(now - Duration::minutes(1)),
            failure_code: Some("transient".to_string()),
            failure_is_transient: Some(true),
            ..queued_facts()
        };
        let report = derive_email_send_status(&facts, now);
        assert_eq!(report.email_send_status, EmailSendStatus::Retrying);
        assert_eq!(report.next_retry_at, Some(next_retry_at));
        assert_eq!(report.failure_code.as_deref(), Some("transient"));
    }

    #[test]
    fn sent_reports_the_successful_attempt_as_sent_at() {
        let now = Utc::now();
        let handed_over_at = now - Duration::minutes(2);
        let facts = EmailSendStatusFacts {
            sent: true,
            last_attempt_at: Some(handed_over_at),
            ..queued_facts()
        };
        let report = derive_email_send_status(&facts, now);
        assert_eq!(report.email_send_status, EmailSendStatus::Sent);
        assert_eq!(report.sent_at, Some(handed_over_at));
    }

    #[test]
    fn send_failed_when_the_delivery_is_no_longer_retryable() {
        let now = Utc::now();
        let facts = EmailSendStatusFacts {
            retryable: false,
            retry_count: 1,
            first_failed_at: Some(now - Duration::minutes(1)),
            last_attempt_at: Some(now - Duration::minutes(1)),
            failure_code: Some("permanent".to_string()),
            failure_is_transient: Some(false),
            ..queued_facts()
        };
        let report = derive_email_send_status(&facts, now);
        assert_eq!(report.email_send_status, EmailSendStatus::SendFailed);
        assert_eq!(report.next_retry_at, None);
        assert_eq!(report.failure_is_transient, Some(false));
    }

    #[test]
    fn send_failed_when_the_retry_window_has_expired_even_though_the_row_still_says_retryable() {
        let now = Utc::now();
        let facts = EmailSendStatusFacts {
            retry_count: 9,
            next_retry_at: Some(now + Duration::hours(1)),
            first_failed_at: Some(now - Duration::seconds(RETRY_WINDOW_SECS + 1)),
            last_attempt_at: Some(now - Duration::hours(1)),
            failure_code: Some("transient".to_string()),
            failure_is_transient: Some(true),
            ..queued_facts()
        };
        let report = derive_email_send_status(&facts, now);
        assert_eq!(report.email_send_status, EmailSendStatus::SendFailed);
        assert_eq!(report.next_retry_at, None);
    }

    #[test]
    fn a_sent_delivery_stays_sent_even_if_earlier_attempts_failed() {
        let now = Utc::now();
        let facts = EmailSendStatusFacts {
            sent: true,
            retryable: false,
            retry_count: 2,
            first_failed_at: Some(now - Duration::seconds(RETRY_WINDOW_SECS + 1)),
            last_attempt_at: Some(now),
            failure_code: Some("transient".to_string()),
            failure_is_transient: Some(true),
            ..queued_facts()
        };
        assert_eq!(
            derive_email_send_status(&facts, now).email_send_status,
            EmailSendStatus::Sent
        );
    }
}
