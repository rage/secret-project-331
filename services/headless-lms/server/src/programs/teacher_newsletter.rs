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

// struct TeacherNewsletter {
//     base_url: &str,
//     course_id: Uuid,
//     course_name: &String,
//     returned_exercises_count: i64,
//     completed_course_count: i64,
//     started_course_count: i64,
//     flagged_cheaters_count_period: i64,
//     flagged_cheaters_count_total: i64,
//     unread_feedback_count: i64,
//     proposal_count: i64,
// }

// impl TeacherNewsletter {
//     fn as_html(&self) -> String {

//     }
// }

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

        let unread_feedback_count_period_unsigned =
            models::feedback::get_feedback_count_for_course_custom_time_period(
                conn,
                course.id,
                period_start,
                period_end,
            )
            .await?
            .unread;
        let unread_feedback_count_total_unsigned =
            models::feedback::get_feedback_count_for_course(conn, course.id)
                .await?
                .unread;
        let unread_feedback_count_period = i64::from(unread_feedback_count_period_unsigned);
        let unread_feedback_count_total = i64::from(unread_feedback_count_total_unsigned);

        let proposal_count_period_unsigned =
            models::proposed_page_edits::get_proposal_count_for_course_custom_time_period(
                conn,
                course.id,
                period_start,
                period_end,
            )
            .await?
            .pending;

        let proposal_count_total_unsigned =
            models::proposed_page_edits::get_proposal_count_for_course(conn, course.id)
                .await?
                .pending;
        let proposal_count_period = i64::from(proposal_count_period_unsigned);
        let proposal_count_total = i64::from(proposal_count_total_unsigned);

        let html = as_html(
            base_url,
            course.id,
            &course.name,
            returned_exercises_count,
            completed_course_count,
            started_course_count,
            flagged_cheaters_count_period,
            flagged_cheaters_count_total,
            unread_feedback_count_period,
            unread_feedback_count_total,
            proposal_count_period,
            proposal_count_total,
        );

        let text = as_text(
            base_url,
            course.id,
            &course.name,
            returned_exercises_count,
            completed_course_count,
            started_course_count,
            flagged_cheaters_count_period,
            flagged_cheaters_count_total,
            unread_feedback_count_period,
            unread_feedback_count_total,
            proposal_count_period,
            proposal_count_total,
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
    flagged_cheaters_count_period: i64,
    flagged_cheaters_count_total: i64,
    unread_feedback_count_period: i64,
    unread_feedback_count_total: i64,
    proposal_count_period: i64,
    proposal_count_total: i64,
) -> String {
    format!(
        r#"
        <h2 style="font-family: sans-serif; font-size: 24px; margin: 24px 0 12px; color: #1a2333;">{course_name}</h2>
        {}
        {}
        {}
        <table style="width: 100%; border-collapse: separate;border-spacing: 5px;table-layout: fixed; border-bottom: 3px dashed #EBEDEE; padding-bottom: 24px;">
            <tbody>
                <tr>{}{}{}</tr>
            </tbody>
        </table>"#,
        newsletter_section_html(
            flagged_cheaters_count_total,
            flagged_cheaters_count_period,
            "Suspected cheaters",
            "Students flagged by automatic detection as possible cheaters."
        ),
        newsletter_section_html(
            unread_feedback_count_total,
            unread_feedback_count_period,
            "Feedback",
            "Unread feedback from students."
        ),
        newsletter_section_html(
            proposal_count_total,
            proposal_count_period,
            "Proposals",
            "Proposals suggested by students regarding course material.",
        ),
        stats_box_html(returned_exercises_count, "Students returned exercises"),
        stats_box_html(completed_course_count, "Students completed course"),
        stats_box_html(started_course_count, "Students started course"),
    )
}

fn as_text(
    base_url: &str,
    course_id: Uuid,
    course_name: &String,
    returned_exercises_count: i64,
    completed_course_count: i64,
    started_course_count: i64,
    flagged_cheaters_count_period: i64,
    flagged_cheaters_count_total: i64,
    unread_feedback_count_period: i64,
    unread_feedback_count_total: i64,
    proposal_count_period: i64,
    proposal_count_total: i64,
) -> String {
    format!(
        "{}\n
        * {}
        * {}
        * {}
        * {} students returned exercises
        * {} students completed the course
        * {} students started the course\n
        ",
        course_name,
        conditional_info_text(
            base_url,
            flagged_cheaters_count_period,
            "students flagged as cheaters",
            format!("manage/courses/{course_id}/other/cheaters/suspected").as_str()
        ),
        conditional_info_text(
            base_url,
            unread_feedback_count_period,
            "unread feedback",
            format!("manage/courses/{course_id}/feedback/feedback/unread").as_str()
        ),
        conditional_info_text(
            base_url,
            proposal_count_period,
            "pending proposals",
            format!("manage/courses/{course_id}/feedback/change-requests/pending").as_str()
        ),
        returned_exercises_count,
        completed_course_count,
        started_course_count
    )
}

fn stats_box_html(count: i64, label: &str) -> String {
    format!(
        r#"
        <td style="border: 3px solid #EBEDEE; border-radius: 12px;">
            <p style="font-size: 32px; text-align: center; margin-top: 1rem; color: #1F6964; font-weight: bold;">{count}</p>
            <p style="text-align: center; font-weight: 500;">{label}</p>
        </td>
        "#
    )
}

fn conditional_info_text(base_url: &str, count: i64, label: &str, link: &str) -> String {
    if count > 0 {
        format!("{count} {label}. Take action: {base_url}/{link}")
    } else {
        format!("{count} {label}")
    }
}

pub fn get_newsletter_period() -> (String, String) {
    let date_today = Utc::now().date_naive();
    let date_yesterday = date_today - chrono::Duration::days(1);

    let start_date = date_today - chrono::Duration::days(7);

    let period_end = date_today.format("%Y-%m-%d").to_string();
    let period_start = start_date.format("%Y-%m-%d").to_string();

    (period_start, period_end)
}

fn newsletter_section_html(
    count_total: i64,
    count_period: i64,
    title: &str,
    label: &str,
) -> String {
    let counts_new = if count_total - count_period == 0 {
        count_period
    } else {
        count_total - count_period
    };
    format!(
        r#"
    <table style="border-collapse: separate; width: 100%; margin-bottom: 8px;">
        <tbody>
            <tr>
                <td style="border: 3px solid #EBEDEE; padding-left: 16px; border-radius: 12px;">
                    <h2 style="margin-top: 0; margin-bottom: 0; font-weight: 600;">{title}</h2>
                    <p>{label}</p>
                    <table style="margin-bottom: 5px;">
                        <tbody>
                            <tr>
                                <td style="padding: 0; color: #1F6964; font-size: 32px; border: none; font-weight: bold;">{count_total}</td>
                                <td style="border: none; padding: 0; padding-left: 5px;">(+{counts_new} new)</td>
                            </tr>
                        </tbody>
                    </table>
                    <span style="font-weight: 500;">Total</span>
                </td>
            </tr>
        </tbody>
    </table>
    "#
    )
}
