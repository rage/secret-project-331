use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;

mod blocks;
mod newsletter_item;

use crate::programs::teacher_newsletter::newsletter_item::TeacherNewsletterItem;
use chrono::Utc;
use dotenvy::dotenv;
use headless_lms_base::config::ApplicationConfiguration;
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
use sqlx::{PgConnection, PgPool};

pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;

    let app_conf = ApplicationConfiguration::try_from_env()?;
    let base_url = app_conf.base_url;
    let database_url = ProgramConfig::database_url_with_default();
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;

    let teachers = get_teacher_newsletter_subscriptions(&mut conn).await?;

    if teachers.is_empty() {
        info!("No subscriptions found for teacher newsletter. Skipping sending.");
        return Ok(());
    }

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

    create_newsletter_items(&mut conn, courses, &period_start, &period_end, base_url).await?;

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

// Assumes that newsletter is always sent on Monday.
// Returns period from last week Monday to Sunday.
pub fn get_newsletter_period() -> (String, String) {
    let date_today = Utc::now().date_naive();
    let date_yesterday = date_today - chrono::Duration::days(1);

    let start_date = date_today - chrono::Duration::days(7);

    let period_start = start_date.format("%Y-%m-%d").to_string();
    let period_end = date_yesterday.format("%Y-%m-%d").to_string();

    (period_start, period_end)
}

async fn create_newsletter_items(
    conn: &mut PgConnection,
    courses: Vec<Course>,
    period_start: &str,
    period_end: &str,
    base_url: String,
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

        let flagged_cheaters_count_period =
            models::suspected_cheaters::get_count_in_course_by_status_custom_time_period(
                conn,
                course.id,
                models::suspected_cheaters::SuspectedCheaterStatus::Flagged,
                period_start,
                period_end,
            )
            .await?;
        let flagged_cheaters_count_total =
            models::suspected_cheaters::get_count_in_course_by_status(
                conn,
                course.id,
                models::suspected_cheaters::SuspectedCheaterStatus::Flagged,
            )
            .await?;

        let unread_feedback_count_period =
            models::feedback::get_feedback_count_for_course_custom_time_period(
                conn,
                course.id,
                period_start,
                period_end,
            )
            .await?
            .unread;
        let unread_feedback_count_total =
            models::feedback::get_feedback_count_for_course(conn, course.id)
                .await?
                .unread;

        let proposal_count_period =
            models::proposed_page_edits::get_proposal_count_for_course_custom_time_period(
                conn,
                course.id,
                period_start,
                period_end,
            )
            .await?
            .pending;
        let proposal_count_total =
            models::proposed_page_edits::get_proposal_count_for_course(conn, course.id)
                .await?
                .pending;

        let newsletter_item = TeacherNewsletterItem {
            base_url: base_url.clone(),
            course_id: course.id,
            course_name: course.name,
            returned_exercises_count,
            completed_course_count,
            started_course_count,
            flagged_cheaters_count_period,
            flagged_cheaters_count_total,
            unread_feedback_count_period: i64::from(unread_feedback_count_period),
            unread_feedback_count_total: i64::from(unread_feedback_count_total),
            proposal_count_period: i64::from(proposal_count_period),
            proposal_count_total: i64::from(proposal_count_total),
        };

        let html = newsletter_item.as_html();
        let text = newsletter_item.as_text();

        create_newsletter_item(conn, course.id, period_start, period_end, html, text).await?;
    }
    Ok(())
}
