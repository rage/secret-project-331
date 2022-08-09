use std::{env, time::Duration};

use anyhow::{Context, Result};
use futures::{FutureExt, StreamExt};
use headless_lms_models::email_deliveries::{fetch_emails, mark_as_sent, save_err_to_email, Email};
use headless_lms_utils::email_processor::{self, EmailGutenbergBlock};
use lettre::{
    message::{header, MultiPart, SinglePart},
    Message, SmtpTransport, Transport,
};
use once_cell::sync::Lazy;
use sqlx::PgPool;

const BATCH_SIZE: usize = 100;

static MOOCFI_EMAIL: Lazy<String> =
    Lazy::new(|| env::var("MOOCFI_EMAIL").expect("No moocfi email found in the env variables."));
static EMAIL_RELAY: Lazy<String> =
    Lazy::new(|| env::var("EMAIL_RELAY").expect("No email relay found in the env variables."));
static DB_URL: Lazy<String> =
    Lazy::new(|| env::var("DATABASE_URL").expect("No db url found in the env variables."));

pub async fn mail_sender() -> Result<()> {
    tracing_subscriber::fmt().init();
    dotenv::dotenv().ok();

    let pool = PgPool::connect(&DB_URL).await?;

    let mut conn = pool.acquire().await?;

    let emails = fetch_emails(&mut conn).await?;
    let mailer = SmtpTransport::relay(&EMAIL_RELAY)?.build();

    let mut futures = tokio_stream::iter(emails)
        .map(|email| {
            let email_id = email.id;
            send_message(email, &mailer, pool.clone()).inspect(move |r| {
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
    let email_block: Vec<EmailGutenbergBlock> =
        serde_json::from_value(email.body.context("No body")?)?;

    let msg_as_plaintext = email_processor::process_content_to_plaintext(&email_block);
    let msg_as_html = email_processor::process_content_to_html(&email_block);

    let mut conn = pool.acquire().await?;
    let email_to = email.to;
    let msg = Message::builder()
        .from(MOOCFI_EMAIL.parse()?)
        .to(email
            .to
            .to_string()
            .parse()
            .with_context(|| format!("Invalid address: {}", email_to))?)
        .subject(email.subject.context("No subject")?)
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
        // should never fail
        .expect("Failed to build email");

    match mailer.send(&msg) {
        Ok(_) => mark_as_sent(email.id, &mut conn)
            .await
            .context("Couldn't mark as sent")?,
        Err(err) => save_err_to_email(email.id, err, &mut conn)
            .await
            .context("Couldn't save sent err to db")?,
    };

    Ok(())
}

pub async fn main() -> anyhow::Result<()> {
    let mut interval = tokio::time::interval(Duration::from_secs(10));
    loop {
        interval.tick().await;
        mail_sender().await?;
    }
}
