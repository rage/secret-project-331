use std::{env, error::Error as StdError, time::Duration};

use anyhow::{Context, Result};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use futures::{FutureExt, StreamExt};
use headless_lms_models::email_deliveries::{
    Email, EmailDeliveryErrorInsert, FETCH_LIMIT, fetch_emails,
    increment_retry_and_mark_non_retryable, increment_retry_and_schedule,
    insert_email_delivery_error, mark_as_sent,
};
use headless_lms_models::email_templates::EmailTemplateType;
use headless_lms_models::user_passwords::get_unused_reset_password_token_with_user_id;
use headless_lms_utils::email_processor::{self, BlockAttributes, EmailGutenbergBlock};
use lettre::transport::smtp::Error as SmtpError;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{
    Message, SmtpTransport, Transport,
    message::{MultiPart, SinglePart, header},
};
use once_cell::sync::Lazy;
use rand::Rng;
use sqlx::{Connection, PgConnection, PgPool};
use std::collections::HashMap;
use uuid::Uuid;
const BATCH_SIZE: usize = FETCH_LIMIT as usize;

const FRONTEND_BASE_URL: &str = "https://courses.mooc.fi";
const BASE_BACKOFF_SECS: i64 = 60;
const MAX_BACKOFF_SECS: i64 = 24 * 60 * 60;
const MAX_RETRY_AGE_SECS: i64 = 3 * 24 * 60 * 60;
const JITTER_SECS: i64 = 30;

static SMTP_FROM: Lazy<String> =
    Lazy::new(|| env::var("SMTP_FROM").expect("No moocfi email found in the env variables."));
static SMTP_HOST: Lazy<String> =
    Lazy::new(|| env::var("SMTP_HOST").expect("No email relay found in the env variables."));
static DB_URL: Lazy<String> =
    Lazy::new(|| env::var("DATABASE_URL").expect("No db url found in the env variables."));
static SMTP_MESSAGE_ID_DOMAIN: Lazy<String> = Lazy::new(|| {
    env::var("SMTP_MESSAGE_ID_DOMAIN")
        .ok()
        .and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .or_else(|| infer_email_domain(SMTP_FROM.as_str()))
        .unwrap_or_else(|| "courses.mooc.fi".to_string())
});
static SMTP_USER: Lazy<String> =
    Lazy::new(|| env::var("SMTP_USER").expect("No smtp user found in env variables."));
static SMTP_PASS: Lazy<String> =
    Lazy::new(|| env::var("SMTP_PASS").expect("No smtp password found in env variables."));

pub async fn mail_sender(pool: &PgPool, mailer: &SmtpTransport) -> Result<()> {
    let mut conn = pool.acquire().await?;

    let emails = fetch_emails(&mut conn).await?;

    let mut futures = tokio_stream::iter(emails)
        .map(|email| {
            let email_id = email.id;
            send_message(email, mailer, pool.clone()).inspect(move |r| {
                if let Err(err) = r {
                    tracing::error!("Failed to send email {}: {}", email_id, err)
                }
            })
        })
        .buffer_unordered(BATCH_SIZE);

    while futures.next().await.is_some() {}

    Ok(())
}

pub async fn send_message(email: Email, mailer: &SmtpTransport, pool: PgPool) -> Result<()> {
    let mut conn = pool.acquire().await?;
    tracing::info!("Email send messages...");

    let now = Utc::now();
    let attempt = email.retry_count + 1;
    if retry_window_expired(email.first_failed_at, now) {
        tracing::warn!(
            "Retry window expired for email {} (first_failed_at={:?})",
            email.id,
            email.first_failed_at
        );
        record_non_retryable_failure(
            &mut conn,
            email.id,
            attempt,
            "retry_window_expired",
            format!(
                "Retry window expired before send attempt (to={}, template={:?}, first_failed_at={:?})",
                email.to, email.template_type, email.first_failed_at
            ),
        )
        .await?;
        return Ok(());
    }

    let mut email_block: Vec<EmailGutenbergBlock> =
        match email.body.as_ref().context("No body").and_then(|value| {
            serde_json::from_value(value.clone()).context("Failed to parse email body JSON")
        }) {
            Ok(blocks) => blocks,
            Err(err) => {
                record_message_build_failure(&mut conn, &email, attempt, &err).await?;
                return Ok(());
            }
        };

    if let Some(template_type) = email.template_type {
        let template_result = apply_email_template_replacements(
            &mut conn,
            template_type,
            email.id,
            email.user_id,
            email_block,
            attempt,
        )
        .await?;
        match template_result {
            TemplateApplyResult::Ready(blocks) => email_block = blocks,
            TemplateApplyResult::Abandoned => return Ok(()),
        }
    }

    let msg_as_plaintext = email_processor::process_content_to_plaintext(&email_block);
    let msg_as_html = email_processor::process_content_to_html(&email_block);

    let msg = match build_email_message(&email, attempt, msg_as_plaintext, msg_as_html) {
        Ok(msg) => msg,
        Err(err) => {
            record_message_build_failure(&mut conn, &email, attempt, &err).await?;
            return Ok(());
        }
    };

    match mailer.send(&msg) {
        Ok(_) => {
            tracing::info!("Email sent successfully {}", email.id);
            mark_as_sent(&mut conn, email.id)
                .await
                .context("Couldn't mark as sent")?;
        }
        Err(err) => {
            let is_transient = is_transient_smtp_error(&err);
            let (error_code, smtp_response, smtp_response_code) = extract_smtp_error_details(&err);

            tracing::error!(
                "SMTP send failed for {} (attempt {}, transient={}): {:?}",
                email.id,
                attempt,
                is_transient,
                err
            );

            let mut tx = (*conn)
                .begin()
                .await
                .context("Couldn't start email failure transaction")?;

            insert_email_delivery_error(
                &mut tx,
                EmailDeliveryErrorInsert {
                    email_delivery_id: email.id,
                    attempt,
                    error_message: err.to_string(),
                    error_code,
                    smtp_response,
                    smtp_response_code,
                    is_transient,
                },
            )
            .await
            .context("Couldn't insert email delivery error history")?;

            if is_transient {
                if retry_window_expired(Some(email.first_failed_at.unwrap_or(now)), now) {
                    increment_retry_and_mark_non_retryable(&mut tx, email.id)
                        .await
                        .context("Couldn't close expired retryable email")?;
                } else {
                    // `retry_count` is pre-increment from the claimed row; using it here keeps
                    // backoff aligned with the next failed-attempt number.
                    let next_retry_at = compute_next_retry_at(now, email.retry_count);
                    increment_retry_and_schedule(&mut tx, email.id, Some(next_retry_at))
                        .await
                        .context("Couldn't schedule retry")?;
                }
            } else {
                increment_retry_and_mark_non_retryable(&mut tx, email.id)
                    .await
                    .context("Couldn't close non-retryable email")?;
            }

            tx.commit()
                .await
                .context("Couldn't commit email failure transaction")?;
        }
    };

    Ok(())
}

enum TemplateApplyResult {
    Ready(Vec<EmailGutenbergBlock>),
    Abandoned,
}

async fn apply_email_template_replacements(
    conn: &mut PgConnection,
    template_type: EmailTemplateType,
    email_id: Uuid,
    user_id: Uuid,
    blocks: Vec<EmailGutenbergBlock>,
    attempt: i32,
) -> anyhow::Result<TemplateApplyResult> {
    let mut replacements = HashMap::new();

    match template_type {
        EmailTemplateType::ResetPasswordEmail => {
            if let Some(token_str) =
                get_unused_reset_password_token_with_user_id(conn, user_id).await?
            {
                let base =
                    std::env::var("FRONTEND_BASE_URL").unwrap_or(FRONTEND_BASE_URL.to_string());

                let reset_url = format!(
                    "{}/reset-user-password/{}",
                    base.trim_end_matches('/'),
                    token_str.token
                );

                replacements.insert("RESET_LINK".to_string(), reset_url);
            } else {
                let msg = anyhow::anyhow!("No reset token found for user {}", user_id);
                record_non_retryable_failure(conn, email_id, attempt, "template", msg.to_string())
                    .await?;
                return Ok(TemplateApplyResult::Abandoned);
            }
        }
        EmailTemplateType::DeleteUserEmail => {
            if let Some(code) =
                headless_lms_models::user_email_codes::get_unused_user_email_code_with_user_id(
                    conn, user_id,
                )
                .await?
            {
                replacements.insert("CODE".to_string(), code.code);
            } else {
                let msg = anyhow::anyhow!("No deletion code found for user {}", user_id);
                record_non_retryable_failure(conn, email_id, attempt, "template", msg.to_string())
                    .await?;
                return Ok(TemplateApplyResult::Abandoned);
            }
        }
        EmailTemplateType::ConfirmEmailCode => {
            if let Some(code) =
                headless_lms_models::user_email_codes::get_unused_user_email_code_with_user_id(
                    conn, user_id,
                )
                .await?
            {
                replacements.insert("CODE".to_string(), code.code);
            } else {
                let msg = anyhow::anyhow!("No verification code found for user {}", user_id);
                record_non_retryable_failure(conn, email_id, attempt, "template", msg.to_string())
                    .await?;
                return Ok(TemplateApplyResult::Abandoned);
            }
        }
        EmailTemplateType::Generic => {
            return Ok(TemplateApplyResult::Ready(blocks));
        }
    }

    Ok(TemplateApplyResult::Ready(insert_placeholders(
        blocks,
        &replacements,
    )))
}

fn insert_placeholders(
    blocks: Vec<EmailGutenbergBlock>,
    replacements: &HashMap<String, String>,
) -> Vec<EmailGutenbergBlock> {
    blocks
        .into_iter()
        .map(|mut block| {
            if let BlockAttributes::Paragraph {
                content,
                drop_cap,
                rest,
            } = block.attributes
            {
                let replaced_content = replacements.iter().fold(content, |acc, (key, value)| {
                    acc.replace(&format!("{{{{{}}}}}", key), value)
                });

                block.attributes = BlockAttributes::Paragraph {
                    content: replaced_content,
                    drop_cap,
                    rest,
                };
            }
            block
        })
        .collect()
}

fn build_email_message(
    email: &Email,
    attempt: i32,
    msg_as_plaintext: String,
    msg_as_html: String,
) -> Result<Message> {
    let email_to = &email.to;

    Message::builder()
        .from(SMTP_FROM.parse()?)
        .to(email
            .to
            .parse()
            .with_context(|| format!("Invalid address: {}", email_to))?)
        .subject(email.subject.clone().context("No subject")?)
        .message_id(Some(format!(
            "<{}-{}@{}>",
            email.id,
            attempt,
            SMTP_MESSAGE_ID_DOMAIN.as_str()
        )))
        .multipart(
            MultiPart::alternative()
                .singlepart(
                    SinglePart::builder()
                        .header(header::ContentType::TEXT_PLAIN)
                        .body(msg_as_plaintext),
                )
                .singlepart(
                    SinglePart::builder()
                        .header(header::ContentType::TEXT_HTML)
                        .body(msg_as_html),
                ),
        )
        .context("Failed to build email message")
}

fn infer_email_domain(value: &str) -> Option<String> {
    let candidate = value
        .rsplit('<')
        .next()
        .unwrap_or(value)
        .trim()
        .trim_end_matches('>')
        .trim();
    let (_, domain) = candidate.rsplit_once('@')?;
    let domain = domain.trim();
    if domain.is_empty() || domain.contains(' ') {
        None
    } else {
        Some(domain.to_string())
    }
}

async fn record_message_build_failure(
    conn: &mut PgConnection,
    email: &Email,
    attempt: i32,
    err: &anyhow::Error,
) -> Result<()> {
    tracing::error!(
        "Message construction failed for email {} (attempt {}): {:#}",
        email.id,
        attempt,
        err
    );
    record_non_retryable_failure(
        conn,
        email.id,
        attempt,
        "message_build",
        format!("Message construction failed: {err:#}"),
    )
    .await
}

pub async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().init();
    dotenv::dotenv().ok();
    tracing::info!("Email sender starting up...");

    if std::env::var("SMTP_USER").is_err() || std::env::var("SMTP_PASS").is_err() {
        tracing::warn!("SMTP user or password is missing or incorrect");
    }

    let pool = PgPool::connect(&DB_URL.to_string()).await?;
    let creds = Credentials::new(SMTP_USER.to_string(), SMTP_PASS.to_string());

    let mailer = match SmtpTransport::relay(&SMTP_HOST) {
        Ok(builder) => builder.credentials(creds).build(),
        Err(e) => {
            tracing::error!("Could not configure SMTP transport: {}", e);
            return Err(e.into());
        }
    };

    let mut interval = tokio::time::interval(Duration::from_secs(10));
    loop {
        interval.tick().await;
        mail_sender(&pool, &mailer).await?;
    }
}

fn retry_window_expired(first_failed_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    match first_failed_at {
        Some(ts) => (now - ts).num_seconds() > MAX_RETRY_AGE_SECS,
        None => false,
    }
}

fn compute_next_retry_at(now: DateTime<Utc>, retry_count: i32) -> DateTime<Utc> {
    // Saturating math + MAX_BACKOFF_SECS clamp intentionally handles outlier values safely.
    let exponent = retry_count.max(0) as u32;
    let multiplier = 2_i64.checked_pow(exponent).unwrap_or(i64::MAX);
    let backoff = BASE_BACKOFF_SECS.saturating_mul(multiplier);
    let capped = backoff.min(MAX_BACKOFF_SECS);
    let jitter = rand::rng().random_range(0..=JITTER_SECS);
    now + ChronoDuration::seconds(capped + jitter)
}

fn is_transient_smtp_error(err: &SmtpError) -> bool {
    if err.is_transient() {
        return true;
    }
    if err.is_timeout() || err.is_transport_shutdown() {
        return true;
    }
    has_io_error(err)
}

fn has_io_error(err: &SmtpError) -> bool {
    let mut source = err.source();
    while let Some(inner) = source {
        if inner.is::<std::io::Error>() {
            return true;
        }
        source = inner.source();
    }
    false
}

fn extract_smtp_error_details(err: &SmtpError) -> (Option<String>, Option<String>, Option<i32>) {
    let smtp_response_code = err.status().map(|code| i32::from(u16::from(code)));

    let error_code = if err.is_transient() {
        Some("transient".to_string())
    } else if err.is_permanent() {
        Some("permanent".to_string())
    } else if err.is_timeout() {
        Some("timeout".to_string())
    } else if has_io_error(err) {
        Some("network_io".to_string())
    } else if err.is_transport_shutdown() {
        Some("transport_shutdown".to_string())
    } else if err.is_response() {
        Some("response".to_string())
    } else if err.is_client() {
        Some("client".to_string())
    } else {
        None
    };

    let smtp_response = err.source().map(|source| source.to_string());

    (error_code, smtp_response, smtp_response_code)
}

async fn record_non_retryable_failure(
    conn: &mut PgConnection,
    email_id: Uuid,
    attempt: i32,
    error_code: &'static str,
    message: String,
) -> Result<()> {
    let mut tx = (*conn)
        .begin()
        .await
        .context("Couldn't start template failure transaction")?;

    insert_email_delivery_error(
        &mut tx,
        EmailDeliveryErrorInsert {
            email_delivery_id: email_id,
            attempt,
            error_message: message,
            error_code: Some(error_code.to_string()),
            smtp_response: None,
            smtp_response_code: None,
            is_transient: false,
        },
    )
    .await
    .context("Couldn't insert email delivery error history")?;

    increment_retry_and_mark_non_retryable(&mut tx, email_id)
        .await
        .context("Couldn't mark email as non-retryable for template error")?;

    tx.commit()
        .await
        .context("Couldn't commit template failure transaction")?;

    Ok(())
}
