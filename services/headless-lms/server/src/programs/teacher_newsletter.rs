use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;

use chrono::Utc;
use dotenvy::dotenv;
use sqlx::{PgConnection, PgPool};

use headless_lms_models as models;
use models::courses::Course;
use models::email_templates::{
    EmailTemplateType::TeacherNewsletter, get_generic_email_template_by_type_and_language,
};
use models::library::course_stats::{
    get_total_users_completed_course_custom_time_period,
    get_total_users_returned_exercises_custom_time_period,
    get_total_users_started_course_custom_time_period,
};
use models::teacher_newsletter::{create_newsletter_item, get_teacher_newsletter_subscriptions};

pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;

    let database_url = ProgramConfig::database_url_with_default();
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;

    let teacher_newsletter_template = get_generic_email_template_by_type_and_language(
        &mut conn,
        TeacherNewsletter,
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

    let (period_start, period_end) = get_newsletter_period();

    info!("Period start: {}, Period end: {}", period_start, period_end);

    create_newsletter_items(&mut conn, courses, &period_start, &period_end).await?;

    let teachers = get_teacher_newsletter_subscriptions(&mut conn).await?;

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

fn as_html(
    course_name: &String,
    returned_exercises_count: i64,
    completed_course_count: i64,
    started_course_count: i64,
) -> String {
    format!(
        r#"<h2 style="font-family: sans-serif; font-size: 24px; margin: 24px 0 12px; color: #1a2333;">{}</h2><table style="width: 100%; border-collapse: separate;border-spacing: 5px;"><tbody><tr><td style="border: 3px solid #EBEDEE; border-radius: 12px;"><p style="font-size: 32px; text-align: center; margin-top: 1rem; color: #1F6964">{}</p><p style="text-align: center; font-weight: 700;">Students returned exercises</p></td><td style="border: 3px solid #EBEDEE; border-radius: 12px;"><p style="font-size: 32px; text-align: center; margin-top: 1rem; color: #1F6964">{}</p><p style="text-align: center; font-weight: 700;">Students completed course</p></td><td style="border: 3px solid #EBEDEE; border-radius: 12px;"><p style="font-size: 32px; text-align: center; margin-top: 1rem; color: #1F6964">{}</p><p style="text-align: center; font-weight: 700;">Students started course</p></td></tr></tbody></table>"#,
        course_name, returned_exercises_count, completed_course_count, started_course_count
    )
}

fn as_text(
    course_name: &String,
    returned_exercises_count: i64,
    completed_course_count: i64,
    started_course_count: i64,
) -> String {
    format!(
        "{}\n\n* {} students returned exercises\n* {} students completed the course\n* {} students started the course\n",
        course_name, returned_exercises_count, completed_course_count, started_course_count
    )
}

fn get_newsletter_period() -> (String, String) {
    let date_today = Utc::now().date_naive();
    let date_yesterday = date_today - chrono::Duration::days(1);

    let start_date = date_today - chrono::Duration::days(7);

    let period_end = date_today.format("%Y-%m-%d").to_string();
    let period_start = start_date.format("%Y-%m-%d").to_string();

    (period_start, period_end)
}

async fn create_newsletter_items(
    conn: &mut PgConnection,
    courses: Vec<Course>,
    period_start: &String,
    period_end: &String,
) -> anyhow::Result<()> {
    for course in courses {
        let returned_exercises_count = get_total_users_returned_exercises_custom_time_period(
            conn,
            course.id,
            period_start,
            period_end,
        )
        .await?
        .count;
        let completed_course_count = get_total_users_completed_course_custom_time_period(
            conn,
            course.id,
            period_start,
            period_end,
        )
        .await?
        .count;
        let started_course_count = get_total_users_started_course_custom_time_period(
            conn,
            course.id,
            period_start,
            period_end,
        )
        .await?
        .count;

        let html = as_html(
            &course.name,
            returned_exercises_count,
            completed_course_count,
            started_course_count,
        );

        let text = as_text(
            &course.name,
            returned_exercises_count,
            completed_course_count,
            started_course_count,
        );

        create_newsletter_item(conn, course.id, period_start, period_end, html, text).await?;
    }
    Ok(())
}
