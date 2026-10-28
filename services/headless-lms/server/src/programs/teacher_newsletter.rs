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

    let teacher_newsletter_template = models::email_templates::get_generic_email_template_by_type_and_language(
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

    let courses = models::courses::all_courses(&mut conn).await?;

    let period_start = "2026-10-20";
    let period_end = "2026-10-27";

    for course in courses {
        let total_users =
            models::library::course_stats::get_total_users_returned_exercises_custom_time_period(
                &mut conn,
                course.id,
                period_start,
                period_end,
            )
            .await?;

        let html = as_html(total_users.count);

        let text = "Hello world".to_string();

        models::teacher_newsletter::create_newsletter_item(
            &mut conn,
            course.id,
            &period_start,
            &period_end,
            html,
            text,
        )
        .await?;
    }

    let teachers =
        models::teacher_newsletter::get_teacher_newsletter_subscriptions(&mut conn).await?;

    for teacher in teachers {
        models::email_deliveries::insert_email_delivery(
            &mut conn,
            teacher,
            teacher_newsletter_template.id,
        )
        .await?;
    }
    info!("Emails successfully inserted");
    Ok(())
}

fn as_html(total_users: i64) -> String {
    format!(
        r#"<h2 style="font-family: sans-serif; font-size: 24px; margin: 24px 0 12px; color: #1a2333;">{}</h2><table style="width: 100%; border-collapse: separate;border-spacing: 5px;"><tbody><tr><td style="border: 3px solid #EBEDEE; border-radius: 12px;"><p style="font-size: 32px; text-align: center; margin-top: 1rem; color: #1F6964">{}</p><p style="text-align: center; font-weight: 700;">Students completed the course</p></td><td style="border: 3px solid #EBEDEE; border-radius: 12px;"><p style="font-size: 32px; text-align: center; margin-top: 1rem; color: #1F6964">{}</p><p style="text-align: center; font-weight: 700;">Students returned exercises</p></td></tr></tbody></table>"#,
        total_users, total_users, total_users
    )
}
