use anyhow::Result;
use futures::StreamExt;
use headless_lms_actix::models::email_deliveries::{
    fetch_emails, mark_as_sent, save_err_to_email, Email,
};
use headless_lms_actix::utils::email_processor::{self, EmailGutenbergBlock};
use lettre::message::{header, MultiPart, SinglePart};
use lettre::{Message, SmtpTransport, Transport};
use once_cell::sync::Lazy;
use sqlx::PgPool;
use std::{env, time};
use tokio::time::sleep;

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

    let result = tokio_stream::iter(emails)
        .map(|email| send_message(email, &mailer, pool.clone()))
        .buffer_unordered(BATCH_SIZE)
        .collect::<Vec<_>>()
        .await;

    print!("{}", result.len());

    Ok(())
}

pub async fn send_message(email: Email, mailer: &SmtpTransport, pool: PgPool) -> Result<bool> {
    let email_block: Vec<EmailGutenbergBlock> =
        serde_json::from_value(email.body.expect("No body"))?;

    let msg_as_plaintext = email_processor::process_content_to_plaintext(&email_block);
    let msg_as_html = email_processor::process_content_to_html(&email_block);

    let mut conn = pool.acquire().await?;
    let msg = Message::builder()
        .from(MOOCFI_EMAIL.parse()?)
        .to(email.to.to_string().parse().expect("invalid email address"))
        // could also be unwrap_or("No subject")
        .subject(email.subject.expect("no subject"))
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
        .expect("Failed to build email");

    match mailer.send(&msg) {
        Ok(_) => mark_as_sent(email.id, &mut conn)
            .await
            .expect("Couldn't mark email as sent."),
        Err(err) => save_err_to_email(email.id, err, &mut conn)
            .await
            .expect("Couldn't save sent err to db."),
    };

    Ok(true)
}

#[tokio::main]
pub async fn main() -> Result<()> {
    let ten_second = time::Duration::from_millis(10000);
    loop {
        mail_sender().await?;
        sleep(ten_second).await;
    }
}
