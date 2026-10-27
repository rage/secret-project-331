use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;

use dotenvy::dotenv;
use headless_lms_models as models;
use sqlx::PgPool;

pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;
    let database_url = ProgramConfig::database_url_with_default();
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;

    let newsletter_template = models::email_templates::get_generic_email_template_by_type_and_language(
        &mut conn,
        models::email_templates::EmailTemplateType::TeacherNewsletter,
        "en",
    )
    .await
    .map_err(|_e| {
        anyhow::anyhow!(
            "Teacher newsletter email template not configured. Missing template 'teacher-newsletter-email' for language '{}'",
            "en"
        )
    })?;

    let teachers =
        models::teacher_newsletter_management::get_users_subscribed_to_teacher_newsletter(
            &mut conn,
        )
        .await?;

    for teacher in teachers {
        models::email_deliveries::insert_email_delivery(&mut conn, teacher, newsletter_template.id)
            .await?;
    }
    info!("Emails successfully inserted");
    Ok(())
}
