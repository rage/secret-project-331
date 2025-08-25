use std::{env, time::Duration};

use anyhow::{Context, Result};
use futures::{FutureExt, StreamExt};
use headless_lms_models::email_deliveries::{Email, fetch_emails, mark_as_sent, save_err_to_email};
use headless_lms_models::user_passwords::get_unused_reset_password_token_with_user_id;
use headless_lms_utils::email_processor::{self, BlockAttributes, EmailGutenbergBlock};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{
    Message, SmtpTransport, Transport,
    message::{MultiPart, SinglePart, header},
};
use once_cell::sync::Lazy;
use sqlx::PgPool;
use std::collections::HashMap;

const BATCH_SIZE: usize = 100;

static SMTP_FROM: Lazy<String> =
    Lazy::new(|| env::var("SMTP_FROM").expect("No moocfi email found in the env variables."));
static SMTP_HOST: Lazy<String> =
    Lazy::new(|| env::var("SMTP_HOST").expect("No email relay found in the env variables."));
static DB_URL: Lazy<String> =
    Lazy::new(|| env::var("DATABASE_URL").expect("No db url found in the env variables."));
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
    let mut conn = pool.acquire().await?;
    tracing::info!("Email send messages...");

    let mut email_block: Vec<EmailGutenbergBlock> =
        serde_json::from_value(email.body.context("No body")?)?;

    // Checks if emails name is "reset-password-email" and inserts users unique reset -link into the email"
    if email
        .name
        .as_deref()
        .map(|n| n.eq_ignore_ascii_case("reset-password-email"))
        .unwrap_or(false)
    {
        let token = get_unused_reset_password_token_with_user_id(&mut conn, email.user_id).await?;

        let reset_url = match token {
            Some(token_str) => format!(
                "https://courses.mooc.fi/reset-user-password/{}",
                token_str.token
            ),
            None => {
                let err = anyhow::anyhow!("No reset token found for user {}", email.user_id);
                save_err_to_email(email.id, err, &mut conn).await?;
                return Ok(());
            }
        };

        let mut replacements = HashMap::new();
        replacements.insert("RESET_LINK".to_string(), reset_url.to_string());
        email_block = insert_reset_password_link_placeholders(email_block, &replacements);
    }

    let msg_as_plaintext = email_processor::process_content_to_plaintext(&email_block);
    let msg_as_html = email_processor::process_content_to_html(&email_block);

    let email_to = &email.to;
    let msg = Message::builder()
        .from(SMTP_FROM.parse()?)
        .to(email
            .to
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

fn insert_reset_password_link_placeholders(
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

pub async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().init();
    dotenv::dotenv().ok();
    tracing::info!("Email sender starting up...");

    let pool = PgPool::connect(&DB_URL.to_string()).await?;
    let creds = Credentials::new(SMTP_USER.to_string(), SMTP_PASS.to_string());
    let mailer = SmtpTransport::relay(&SMTP_HOST)?.credentials(creds).build();

    let mut interval = tokio::time::interval(Duration::from_secs(10));
    loop {
        interval.tick().await;
        mail_sender(&pool, &mailer).await?;
    }
}
