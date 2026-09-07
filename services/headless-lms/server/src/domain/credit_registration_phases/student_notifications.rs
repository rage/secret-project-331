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
use headless_lms_models::open_university_product_access_tokens::enrolment_url_for_product;
use serde_json::json;
use sqlx::PgConnection;
use std::collections::HashMap;
use uuid::Uuid;

use super::{MailQueuePhase, PhaseContext, PhaseScope, run_mail_queue_phase, template_language};

/// One [`enrolment_url_for_product`] lookup per product id per phase run, rather than per row: many
/// claimed rows share the same module's product.
#[derive(Default)]
struct ProductUrlCache(HashMap<Option<String>, Option<String>>);

impl ProductUrlCache {
    async fn url_for(
        &mut self,
        conn: &mut PgConnection,
        open_university_product_id: Option<&str>,
    ) -> anyhow::Result<Option<String>> {
        let key = open_university_product_id.map(str::to_string);
        if let Some(url) = self.0.get(&key) {
            return Ok(url.clone());
        }
        let url = enrolment_url_for_product(conn, open_university_product_id).await?;
        self.0.insert(key, url.clone());
        Ok(url)
    }
}

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    run_mail_queue_phase::<StudentNotificationsPhase>(ctx, scope).await
}

struct StudentNotificationsPhase;

impl MailQueuePhase for StudentNotificationsPhase {
    type Item = StudentNotificationToQueue;
    type Cache = ProductUrlCache;

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
        cache: &mut Self::Cache,
    ) -> anyhow::Result<()> {
        let placeholders = placeholders(ctx.base_url, conn, item, cache).await?;
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
/// `ENROLMENT_LINK` is empty when the module has no product or no resolved token; the template's
/// sentence has to read correctly without it, because a mail that only says "enrol in Sisu" is all
/// the student gets in that case.
async fn placeholders(
    base_url: &str,
    conn: &mut PgConnection,
    notification: &StudentNotificationToQueue,
    product_urls: &mut ProductUrlCache,
) -> anyhow::Result<serde_json::Value> {
    let enrolment_link = match notification.kind {
        CreditRegistrationNotificationKind::ActionNeeded => product_urls
            .url_for(conn, notification.open_university_product_id.as_deref())
            .await?
            .unwrap_or_default(),
        CreditRegistrationNotificationKind::Registered => String::new(),
    };
    Ok(json!({
        "NAME": notification.first_name.clone().unwrap_or_default(),
        "COURSE_NAME": notification.course_name,
        "MODULE_NAME": notification.course_module_name.clone().unwrap_or_default(),
        "CREDITS": notification.ects_credits.map(|credits| credits.to_string()).unwrap_or_default(),
        "STATUS_LINK": status_page_url(base_url, notification.course_module_id),
        "ENROLMENT_LINK": enrolment_link,
    }))
}

/// The page the mail sends the student to, which is where every next step already lives.
fn status_page_url(base_url: &str, course_module_id: Uuid) -> String {
    format!(
        "{}/completion-registration/{course_module_id}",
        base_url.trim_end_matches('/')
    )
}
