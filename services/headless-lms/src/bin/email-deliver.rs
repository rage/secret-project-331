use anyhow::Result;
use futures::StreamExt;
use std::{env, thread, time};

use headless_lms_actix::models::email_deliveries::{
    fetch_emails, mark_as_sent, save_err_to_email, EmailDelivery,
};
use sqlx::PgPool;

use lettre::{Message, SmtpTransport, Transport};

const BATCH_SIZE: usize = 100;

pub async fn mail_sender() -> Result<()> {
    tracing_subscriber::fmt().init();
    dotenv::dotenv().ok();

    let db_url = env::var("DATABASE_URL").unwrap();
    let pool = PgPool::connect(&db_url).await?;

    let mut conn = pool.acquire().await?;

    let emails = fetch_emails(&mut conn).await?;
    let mailer = SmtpTransport::relay("smtp.gmail.com").unwrap().build();

    let result = tokio_stream::iter(emails)
        .map(|email| send_message(email, &mailer, pool.clone()))
        .buffer_unordered(BATCH_SIZE)
        .collect::<Vec<_>>();

    print!("{}", result.len());

    Ok(())
}

pub async fn send_message(
    email: EmailDelivery,
    mailer: &SmtpTransport,
    pool: PgPool,
) -> Result<bool> {
    let mut conn = pool.acquire().await?;
    let msg = Message::builder()
        .from("NoBody <nobody@domain.tld>".parse().unwrap())
        .to("Hei <hei@domain.tld>".parse().unwrap())
        .subject("email template subject")
        .body(String::from("email template body"))
        .unwrap();

    match mailer.send(&msg) {
        Ok(_) => mark_as_sent(email.id, &mut conn).await.expect("msg"),
        Err(err) => save_err_to_email(email.id, err, &mut conn)
            .await
            .expect("msg"),
    };

    Ok(true)
}

#[tokio::main]
pub async fn main() -> Result<()> {
    let ten_second = time::Duration::from_millis(10000);
    loop {
        mail_sender().await?;
        thread::sleep(ten_second);
    }
}
