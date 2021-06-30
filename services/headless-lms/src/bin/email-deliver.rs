use anyhow::Result;
use futures::StreamExt;
use std::{env, thread, time};

use headless_lms_actix::models::email_deliveries::{fetch_emails, mark_as_sent, save_err_to_email};
use sqlx::{Connection, PgConnection};

use lettre::{Message, SmtpTransport, Transport};

const BATCH_SIZE: usize = 100;

pub async fn mail_sender() -> Result<()> {
    tracing_subscriber::fmt().init();
    dotenv::dotenv().ok();

    let db_url = env::var("DATABASE_URL").unwrap();
    let mut conn = PgConnection::connect(&db_url).await?;

    let mailer = SmtpTransport::relay("smtp.gmail.com").unwrap().build();

    let emails = fetch_emails(&mut conn).await?;

    let result = tokio_stream::iter(emails)
        .map(|email| async {
            let msg = Message::builder()
                .from("NoBody <nobody@domain.tld>".parse().unwrap())
                .to("Hei <hei@domain.tld>".parse().unwrap())
                .subject("email template subject")
                .body(String::from("email template body"))
                .unwrap();

            match mailer.send(&msg) {
                Ok(_) => mark_as_sent(email.id, &mut conn)
                    .await
                    .expect("marking email as sent failed, crashing the app to restart via kube"),
                Err(err) => save_err_to_email(email.id, err, &mut conn)
                    .await
                    .expect("sending message failed, crashing the app to restart via kube"),
            };

            Ok(())
        })
        .buffer_unordered(BATCH_SIZE)
        .collect();

    Ok(())
}

#[tokio::main]
pub async fn main() -> Result<()> {
    let ten_second = time::Duration::from_millis(10000);
    loop {
        mail_sender().await?;
        thread::sleep(ten_second);
    }
}
