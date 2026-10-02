//! The `student-notifications` phase: the only thing that queues a student mail about a credit
//! registration.
//!
//! Exactly two mails exist and each row gets each at most once. Nothing else is mailed: a
//! `failed_permanent` row is a configuration problem the student cannot act on, a withdrawn one was
//! the student's own decision, and the linking mail already covers a missing student number.

use headless_lms_data_operations::library::credit_registration::student_notifications::{
    STUDENT_NOTIFICATION_LIMIT, StudentNotificationToQueue, claim_unnotified, set_email_delivery_id,
};
use headless_lms_models::email_deliveries::insert_email_delivery_with_placeholders;
use serde_json::json;
use sqlx::{Connection, PgPool};
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::use_cases::mail_queue::{MailQueueSummary, TemplateCache, template_language};
use crate::workflow::Counts;
use headless_lms_models::credit_registrations::RegistrationScope;

/// `base_url` is the absolute base for the mail's links, which outlive the process that wrote them.
pub(crate) async fn run(
    pool: &PgPool,
    scope: &RegistrationScope,
    base_url: &str,
) -> CreditRegistrationResult<Counts> {
    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_unnotified(&mut tx, scope, STUDENT_NOTIFICATION_LIMIT).await?;
    let mut templates = TemplateCache::default();
    let mut summary = MailQueueSummary::new(claimed.len());
    for notification in &claimed {
        let template_type = notification.kind.email_template_type();
        let language = template_language(&notification.course_language_code);
        let Some(template_id) = templates.id_for(&mut tx, template_type, &language).await? else {
            summary.skip_missing_template(
                template_type,
                &language,
                format!("{template_type:?} in {language}"),
            );
            continue;
        };
        let delivery = insert_email_delivery_with_placeholders(
            &mut tx,
            notification.user_id,
            template_id,
            &placeholders(base_url, notification, &language),
        )
        .await?;
        set_email_delivery_id(
            &mut tx,
            notification.credit_registration_id,
            notification.kind,
            delivery,
        )
        .await?;
    }
    tx.commit().await?;
    Ok(summary.finish("No student notification email template for:"))
}

/// Stored on the delivery row, so the sender needs no lookup of its own.
fn placeholders(
    base_url: &str,
    notification: &StudentNotificationToQueue,
    language: &str,
) -> serde_json::Value {
    json!({
        "NAME": notification.first_name.as_deref().unwrap_or_default(),
        "COURSE_NAME": notification.course_name,
        "MODULE_NAME": notification.course_module_name.as_deref().unwrap_or_default(),
        "CREDITS": notification
            .credits
            .map(|credits| format_credits(credits, language))
            .unwrap_or_default(),
        "STATUS_LINK": status_page_url(base_url, notification.course_module_id),
    })
}

/// `credits` as the mail's language writes a number: at most two decimals, none when whole, and a
/// decimal comma in Finnish and Swedish.
fn format_credits(credits: f32, language: &str) -> String {
    let formatted = format!("{credits:.2}");
    let formatted = formatted.trim_end_matches('0').trim_end_matches('.');
    match language {
        "fi" | "sv" => formatted.replace('.', ","),
        _ => formatted.to_string(),
    }
}

/// The page the mail sends the student to, which is where every next step already lives.
fn status_page_url(base_url: &str, course_module_id: Uuid) -> String {
    format!(
        "{}/completion-registration/{course_module_id}",
        base_url.trim_end_matches('/')
    )
}
