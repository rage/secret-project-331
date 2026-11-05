use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;

use chrono::Utc;
use dotenvy::dotenv;
use headless_lms_base::config::ApplicationConfiguration;
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
use uuid::Uuid;

pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;

    let app_conf = ApplicationConfiguration::try_from_env()?;
    let base_url = &app_conf.base_url;
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

    create_newsletter_items(&mut conn, courses, &period_start, &period_end, base_url).await?;

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

async fn create_newsletter_items(
    conn: &mut PgConnection,
    courses: Vec<Course>,
    period_start: &String,
    period_end: &String,
    base_url: &str,
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
        let flagged_cheaters_count =
            models::suspected_cheaters::get_count_in_course_by_status_custom_time_period(
                conn,
                course.id,
                models::suspected_cheaters::SuspectedCheaterStatus::Flagged,
                period_start,
                period_end,
            )
            .await?;
        let unread_feedback_count_unsigned =
            models::feedback::get_feedback_count_for_course_custom_time_period(
                conn,
                course.id,
                period_start,
                period_end,
            )
            .await?
            .unread;
        let unread_feedback_count = i64::from(unread_feedback_count_unsigned);
        let proposal_count_unsigned =
            models::proposed_page_edits::get_proposal_count_for_course_custom_time_period(
                conn,
                course.id,
                period_start,
                period_end,
            )
            .await?
            .pending;
        let proposal_count = i64::from(proposal_count_unsigned);
        let html = as_html(
            base_url,
            course.id,
            &course.name,
            returned_exercises_count,
            completed_course_count,
            started_course_count,
            flagged_cheaters_count,
            unread_feedback_count,
            proposal_count,
        );

        let text = as_text(
            &course.name,
            returned_exercises_count,
            completed_course_count,
            started_course_count,
            flagged_cheaters_count,
            unread_feedback_count,
        );

        create_newsletter_item(conn, course.id, period_start, period_end, html, text).await?;
    }
    Ok(())
}

fn as_html(
    base_url: &str,
    course_id: Uuid,
    course_name: &String,
    returned_exercises_count: i64,
    completed_course_count: i64,
    started_course_count: i64,
    flagged_cheaters_count: i64,
    unread_feedback_count: i64,
    proposal_count: i64,
) -> String {
    format!(
        r#"<h2 style="font-family: sans-serif; font-size: 24px; margin: 24px 0 12px; color: #1a2333;">{}</h2><table style="width: 100%; border-collapse: separate;border-spacing: 5px;table-layout: fixed"><tbody><tr>{}{}{}<tr>{}{}{}</tr></tbody></table>"#,
        course_name,
        warning_box_html(
            base_url,
            flagged_cheaters_count,
            "Students flagged as cheaters",
            format!("manage/courses/{course_id}/other/cheaters/suspected").as_str()
        ),
        warning_box_html(
            base_url,
            unread_feedback_count,
            "Unread feedback",
            format!("manage/courses/{course_id}/feedback/feedback/unread").as_str()
        ),
        warning_box_html(
            base_url,
            proposal_count,
            "Pending proposals",
            format!("manage/courses/{course_id}/feedback/change-requests/pending").as_str()
        ),
        regular_box_html(returned_exercises_count, "Students returned exercises"),
        regular_box_html(completed_course_count, "Students completed course"),
        regular_box_html(started_course_count, "Students started course"),
    )
}

fn as_text(
    course_name: &String,
    returned_exercises_count: i64,
    completed_course_count: i64,
    started_course_count: i64,
    flagged_cheaters_count: i64,
    unread_feedback_count: i64,
) -> String {
    format!(
        "{course_name}\n\n* {returned_exercises_count} students returned exercises\n* {completed_course_count} students completed the course\n* {started_course_count} students started the course\n* {flagged_cheaters_count} students flagged as cheaters\n* {unread_feedback_count} unread feedback\n\n"
    )
}

fn warning_box_html(base_url: &str, count: i64, label: &str, link: &str) -> String {
    let border_color = if count > 0 { "#ffd444" } else { "#EBEDEE" };
    let bg_color = if count > 0 {
        "rgba(255, 212, 68, 0.12)"
    } else {
        "none"
    };
    let button_display = if count > 0 { "inline-block" } else { "none" };

    // BUILD THE BUTTON AS TABLE INSTEAD!?
    format!(
        r#"<td style="border: 3px solid {border_color}; background: {bg_color}; border-radius: 12px;">
            <p style="font-size: 32px; text-align: center; margin-top: 1rem;">{count}</p>
            <p style="text-align: center; font-weight: 700; color: #1a2333;">{label}</p>
            <p style="text-align: center; margin: 0;">
                <a href="{base_url}/{link}" style="text-decoration: none; background-color: #1F6964; color: #ffffff; padding: 12px 24px; font-weight: 600; border-radius: 6px; display: {button_display};">Take action</a>
            </p>
        </td>"#
    )
}

fn regular_box_html(count: i64, label: &str) -> String {
    format!(
        r#"
        <td style="border: 3px solid #EBEDEE; border-radius: 12px;">
        <p style="font-size: 32px; text-align: center; margin-top: 1rem; color: #1F6964">{count}</p>
        <p style="text-align: center; font-weight: 700;">{label}</p>
        </td>
        "#
    )
}

pub fn get_newsletter_period() -> (String, String) {
    let date_today = Utc::now().date_naive();
    let date_yesterday = date_today - chrono::Duration::days(1);

    let start_date = date_today - chrono::Duration::days(7);

    let period_end = date_today.format("%Y-%m-%d").to_string();
    let period_start = start_date.format("%Y-%m-%d").to_string();

    (period_start, period_end)
}
