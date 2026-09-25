//! The `student-notifications` phase: the only thing that queues a student mail about a credit
//! registration.
//!
//! Exactly two mails exist and each row gets each at most once. Nothing else is mailed: a
//! `failed_permanent` row is a configuration problem the student cannot act on, a withdrawn one was
//! the student's own decision, and the linking mail already covers a missing student number.

use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::email_deliveries::insert_email_delivery_with_placeholders;
use headless_lms_models::email_templates::EmailTemplateType;
use headless_lms_models::library::credit_registration::student_notifications::{
    CreditRegistrationNotificationKind, STUDENT_NOTIFICATION_LIMIT, StudentNotificationToQueue,
    claim_unnotified, set_email_delivery_id,
};
use serde_json::json;
use sqlx::PgConnection;
use uuid::Uuid;

use super::{MailQueuePhase, PhaseContext, PhaseScope, run_mail_queue_phase, template_language};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    run_mail_queue_phase::<StudentNotificationsPhase>(ctx, scope).await
}

struct StudentNotificationsPhase;

impl MailQueuePhase for StudentNotificationsPhase {
    type Item = StudentNotificationToQueue;

    async fn claim(conn: &mut PgConnection, scope: &PhaseScope) -> anyhow::Result<Vec<Self::Item>> {
        Ok(claim_unnotified(conn, scope, STUDENT_NOTIFICATION_LIMIT).await?)
    }

    fn template_type(item: &Self::Item) -> EmailTemplateType {
        item.kind.email_template_type()
    }

    fn language(item: &Self::Item) -> String {
        template_language(&item.course_language_code)
    }

    async fn queue(
        ctx: &PhaseContext<'_>,
        conn: &mut PgConnection,
        item: &Self::Item,
        template_id: Uuid,
    ) -> anyhow::Result<()> {
        let placeholders = placeholders(ctx.base_url, item);
        let delivery =
            insert_email_delivery_with_placeholders(conn, item.user_id, template_id, &placeholders)
                .await?;
        set_email_delivery_id(conn, item.credit_registration_id, item.kind, delivery).await?;
        Ok(())
    }

    fn missing_template_label(template_type: EmailTemplateType, language: &str) -> String {
        format!("{template_type:?} in {language}")
    }

    fn missing_templates_error_prefix() -> &'static str {
        "No student notification email template for:"
    }
}

/// Stored on the delivery row, so the sender needs no lookup of its own.
///
/// `ENROLMENT_LINK` is empty when the module has no enrolment link; the template's sentence has to
/// read correctly without it, because a mail that only says "enrol in Sisu" is all the student gets
/// in that case.
fn placeholders(base_url: &str, notification: &StudentNotificationToQueue) -> serde_json::Value {
    let enrolment_link = match notification.kind {
        CreditRegistrationNotificationKind::ActionNeeded => {
            notification.enrolment_link.clone().unwrap_or_default()
        }
        CreditRegistrationNotificationKind::Registered => String::new(),
    };
    let language = template_language(&notification.course_language_code);
    json!({
        "NAME": notification.first_name.clone().unwrap_or_default(),
        "COURSE_NAME": notification.course_name,
        "MODULE_NAME": notification.course_module_name.clone().unwrap_or_default(),
        "CREDITS": notification
            .credits
            .map(|credits| format_credits(credits, &language))
            .unwrap_or_default(),
        "STATUS_LINK": status_page_url(base_url, notification.course_module_id),
        "ENROLMENT_LINK": enrolment_link,
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
