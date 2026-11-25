use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;

mod blocks;
pub mod newsletter_item;

use headless_lms_models as models;

use chrono::{DateTime, Datelike, Days, NaiveTime, Utc};
use dotenvy::dotenv;
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
use sqlx::{Connection, PgConnection, PgPool};

pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;

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

    create_newsletter_items(&mut conn, courses, period_start, period_end).await?;

    let mut tx = conn.begin().await?;

    for teacher in teachers {
        let delivery_id = models::email_deliveries::insert_email_delivery(
            &mut tx,
            teacher,
            teacher_newsletter_template.id,
        )
        .await?;

        models::teacher_newsletter::save_teacher_newsletter_delivery(
            &mut tx,
            delivery_id,
            period_start,
            period_end,
        )
        .await?;
    }

    tx.commit().await?;

    info!("Emails successfully inserted");
    Ok(())
}

// Gives period from last week Monday to Sunday
pub fn get_newsletter_period() -> (DateTime<Utc>, DateTime<Utc>) {
    let date_previous_week = Utc::now() - Days::new(7);

    // starts counting with Monday = 0
    let days_since_monday = u64::from(date_previous_week.weekday().num_days_from_monday());
    let date_monday = date_previous_week - Days::new(days_since_monday);
    let date_sunday = date_monday + Days::new(6);

    let start_of_monday = date_monday
        .with_time(NaiveTime::from_hms_nano_opt(0, 0, 0, 0).unwrap())
        .unwrap();

    let end_of_sunday = date_sunday
        .with_time(NaiveTime::from_hms_nano_opt(23, 59, 59, 999_999_999).unwrap())
        .unwrap();

    (start_of_monday, end_of_sunday)
}

async fn create_newsletter_items(
    conn: &mut PgConnection,
    courses: Vec<Course>,
    period_start: DateTime<Utc>,
    period_end: DateTime<Utc>,
) -> anyhow::Result<()> {
    // DECIDE WHAT TO DO WITH THESE
    let period_start_str = period_start.format("%Y-%m-%d").to_string();
    let period_end_str = period_end.format("%Y-%m-%d").to_string();
    for course in courses {
        let returned_exercises_count = get_total_users_returned_exercises_custom_time_period(
            conn,
            course.id,
            &period_start_str,
            &period_end_str,
        )
        .await?
        .count;
        let completed_course_count = get_total_users_completed_course_custom_time_period(
            conn,
            course.id,
            &period_start_str,
            &period_end_str,
        )
        .await?
        .count;
        let started_course_count = get_total_users_started_course_custom_time_period(
            conn,
            course.id,
            &period_start_str,
            &period_end_str,
        )
        .await?
        .count;

        let flagged_cheaters_count_period =
            models::suspected_cheaters::get_count_in_course_by_status_custom_time_period(
                conn,
                course.id,
                models::suspected_cheaters::SuspectedCheaterStatus::Flagged,
                &period_start_str,
                &period_end_str,
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
                &period_start_str,
                &period_end_str,
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
                &period_start_str,
                &period_end_str,
            )
            .await?
            .pending;
        let proposal_count_total =
            models::proposed_page_edits::get_proposal_count_for_course(conn, course.id)
                .await?
                .pending;

        create_newsletter_item(
            conn,
            course.id,
            period_start,
            period_end,
            returned_exercises_count,
            completed_course_count,
            started_course_count,
            flagged_cheaters_count_period,
            flagged_cheaters_count_total,
            i64::from(unread_feedback_count_period),
            i64::from(unread_feedback_count_total),
            i64::from(proposal_count_period),
            i64::from(proposal_count_total),
        )
        .await?;
    }
    Ok(())
}
