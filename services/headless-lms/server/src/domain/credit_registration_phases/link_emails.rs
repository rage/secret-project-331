//! The `link-emails` phase: turning a claimed mail slot into a queued message.
//!
//! It talks to no study registry, which is the point of it being its own phase: a wedged mail queue
//! and an unreachable Sisu are different problems. The caps and the dedup guard applied when the
//! slot was claimed, so this phase retries until the message is queued rather than deciding again.

use headless_lms_models::credit_registration_account_linking_emails::{
    LinkingMailToQueue, claim_unqueued, set_email_delivery_id,
};
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::email_deliveries::insert_email_delivery_to_address;
use headless_lms_models::email_templates::EmailTemplateType;
use headless_lms_models::library::credit_registration::account_linking::link_student_number_url;
use secrecy::ExposeSecret;
use serde_json::json;
use sqlx::PgConnection;
use uuid::Uuid;

use super::{MailQueuePhase, PhaseContext, PhaseScope, run_mail_queue_phase, template_language};

/// How many mails one iteration queues; the sender has its own rate, so this only bounds how much
/// one transaction holds open.
const QUEUE_LIMIT: i64 = 200;

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    run_mail_queue_phase::<LinkEmailsPhase>(ctx, scope).await
}

struct LinkEmailsPhase;

impl MailQueuePhase for LinkEmailsPhase {
    type Item = LinkingMailToQueue;
    type Cache = ();

    async fn claim(conn: &mut PgConnection, scope: &PhaseScope) -> anyhow::Result<Vec<Self::Item>> {
        Ok(claim_unqueued(conn, QUEUE_LIMIT, scope.course_id).await?)
    }

    fn template_type(_item: &Self::Item) -> EmailTemplateType {
        EmailTemplateType::CreditRegistrationAccountLinking
    }

    fn language(item: &Self::Item) -> String {
        template_language(&item.course_language_code)
    }

    async fn queue(
        ctx: &PhaseContext<'_>,
        conn: &mut PgConnection,
        item: &Self::Item,
        template_id: Uuid,
        _cache: &mut Self::Cache,
    ) -> anyhow::Result<()> {
        let delivery = insert_email_delivery_to_address(
            conn,
            &item.emailed_to,
            template_id,
            &placeholders(ctx.base_url, item),
        )
        .await?;
        set_email_delivery_id(conn, item.id, delivery).await?;
        Ok(())
    }

    fn missing_template_label(_template_type: EmailTemplateType, language: &str) -> String {
        language.to_string()
    }

    fn missing_templates_error_prefix() -> &'static str {
        "No credit_registration_account_linking email template for:"
    }
}

/// Stored on the delivery row because the recipient may have no account here for the sender to read
/// them from.
fn placeholders(base_url: &str, mail: &LinkingMailToQueue) -> serde_json::Value {
    json!({
        "LINK": link_student_number_url(base_url, mail.token.expose_secret()),
        "NAME": mail.first_names.clone().unwrap_or_default(),
        "STUDENT_NUMBER": mail.student_number,
        "COURSE_NAME": mail.course_name,
    })
}
