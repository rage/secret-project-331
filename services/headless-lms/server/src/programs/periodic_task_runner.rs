use std::time::Duration;

use anyhow::Result;
use headless_lms_models::{
    ects_reminder_email_sends::{
        PendingEctsReminder, get_pending_follow_up_reminders, get_pending_initial_reminders,
        insert_ects_reminder_send,
    },
    email_deliveries::insert_email_delivery,
    email_templates::{EmailTemplateType, get_best_email_template_for_course},
};
use sqlx::PgPool;

use crate::config::program_config::ProgramConfig;

pub async fn main() -> Result<()> {
    tracing_subscriber::fmt().init();
    dotenvy::dotenv().ok();
    tracing::info!("Periodic task runner starting up...");

    let db_url = ProgramConfig::required("DATABASE_URL")?;
    let pool = PgPool::connect(&db_url).await?;

    let mut interval = tokio::time::interval(Duration::from_secs(3600));
    loop {
        interval.tick().await;
        if let Err(err) = run_ects_initial_reminders(&pool).await {
            tracing::error!("ECTS initial reminders failed: {:#}", err);
        }
        if let Err(err) = run_ects_follow_up_reminders(&pool).await {
            tracing::error!("ECTS follow-up reminders failed: {:#}", err);
        }
    }
}

async fn send_ects_reminder(
    pool: &PgPool,
    reminder: &PendingEctsReminder,
    email_type: &str,
    template_type: EmailTemplateType,
) -> Result<()> {
    let mut conn = pool.acquire().await?;

    let template = get_best_email_template_for_course(
        &mut conn,
        template_type,
        &reminder.completion_language,
        reminder.course_id,
    )
    .await?;

    let Some(template) = template else {
        tracing::warn!(
            email_type,
            course_id = %reminder.course_id,
            language = %reminder.completion_language,
            "No ECTS reminder template found — skipping. Create one in the email template editor."
        );
        return Ok(());
    };

    let delivery_id = insert_email_delivery(&mut conn, reminder.user_id, template.id).await?;
    insert_ects_reminder_send(
        &mut conn,
        reminder.completion_id,
        reminder.user_id,
        email_type,
        delivery_id,
    )
    .await?;

    tracing::info!(
        email_type,
        user_id = %reminder.user_id,
        completion_id = %reminder.completion_id,
        "Queued ECTS reminder email"
    );
    Ok(())
}

async fn run_ects_initial_reminders(pool: &PgPool) -> Result<()> {
    let mut conn = pool.acquire().await?;
    let pending = get_pending_initial_reminders(&mut conn).await?;
    drop(conn);

    tracing::info!("ECTS initial reminders: {} to send", pending.len());
    for reminder in &pending {
        if let Err(err) = send_ects_reminder(
            pool,
            reminder,
            "initial",
            EmailTemplateType::EctsInitialReminder,
        )
        .await
        {
            tracing::error!(
                user_id = %reminder.user_id,
                completion_id = %reminder.completion_id,
                "Failed to queue ECTS initial reminder: {:#}", err
            );
        }
    }
    Ok(())
}

async fn run_ects_follow_up_reminders(pool: &PgPool) -> Result<()> {
    let mut conn = pool.acquire().await?;
    let pending = get_pending_follow_up_reminders(&mut conn).await?;
    drop(conn);

    tracing::info!("ECTS follow-up reminders: {} to send", pending.len());
    for reminder in &pending {
        if let Err(err) = send_ects_reminder(
            pool,
            reminder,
            "follow_up",
            EmailTemplateType::EctsFollowUpReminder,
        )
        .await
        {
            tracing::error!(
                user_id = %reminder.user_id,
                completion_id = %reminder.completion_id,
                "Failed to queue ECTS follow-up reminder: {:#}", err
            );
        }
    }
    Ok(())
}
