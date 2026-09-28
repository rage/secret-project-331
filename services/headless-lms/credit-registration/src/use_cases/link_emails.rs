//! The `link-emails` phase: turning a claimed mail slot into a queued message.
//!
//! It talks to no study registry, which is the point of it being its own phase: a wedged mail queue
//! and an unreachable Sisu are different problems. The caps and the dedup guard applied when the
//! slot was claimed, so this phase retries until the message is queued rather than deciding again.

use headless_lms_models::credit_registration_account_linking_emails::{
    LinkingMailToQueue, claim_unqueued, set_email_delivery_id,
};
use headless_lms_models::email_deliveries::insert_email_delivery_to_address;
use headless_lms_models::email_templates::EmailTemplateType;
use headless_lms_models::library::credit_registration::account_linking::link_student_number_url;
use headless_lms_utils::secret_string::expose_option;
use secrecy::ExposeSecret;
use serde_json::json;
use sqlx::{Connection, PgPool};

use crate::error::CreditRegistrationResult;
use crate::use_cases::mail_queue::{MailQueueSummary, TemplateCache, template_language};
use crate::workflow::Counts;
use headless_lms_models::credit_registrations::RegistrationScope;

/// How many mails one iteration queues; the sender has its own rate, so this only bounds how much
/// one transaction holds open.
const QUEUE_LIMIT: i64 = 200;

const TEMPLATE: EmailTemplateType = EmailTemplateType::CreditRegistrationAccountLinking;

/// `base_url` is the absolute base for the mail's link, which outlives the process that wrote it.
pub(crate) async fn run(
    pool: &PgPool,
    scope: &RegistrationScope,
    base_url: &str,
) -> CreditRegistrationResult<Counts> {
    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_unqueued(&mut tx, QUEUE_LIMIT, scope.course_id).await?;
    let mut templates = TemplateCache::default();
    let mut summary = MailQueueSummary::new(claimed.len());
    for mail in &claimed {
        let language = template_language(&mail.course_language_code);
        let Some(template_id) = templates.id_for(&mut tx, TEMPLATE, &language).await? else {
            summary.skip_missing_template(TEMPLATE, &language, language.as_str());
            continue;
        };
        let delivery = insert_email_delivery_to_address(
            &mut tx,
            mail.emailed_to.expose_secret(),
            template_id,
            &placeholders(base_url, mail),
        )
        .await?;
        set_email_delivery_id(&mut tx, mail.id, delivery).await?;
    }
    tx.commit().await?;
    Ok(summary.finish("No credit_registration_account_linking email template for:"))
}

/// Stored on the delivery row because the recipient may have no account here for the sender to read
/// them from.
fn placeholders(base_url: &str, mail: &LinkingMailToQueue) -> serde_json::Value {
    json!({
        "LINK": link_student_number_url(base_url, mail.token.expose_secret()),
        "NAME": expose_option(&mail.first_names).unwrap_or_default(),
        "STUDENT_NUMBER": mail.student_number.expose_secret(),
        "COURSE_NAME": mail.course_name,
    })
}
