//! The `link-emails` phase: turning a claimed mail slot into a queued message.
//!
//! It talks to no study registry, which is the point of it being its own phase: a wedged mail queue
//! and an unreachable Sisu are different problems. The caps and the dedup guard applied when the
//! slot was claimed, so this phase retries until the message is queued rather than deciding again.

use std::collections::BTreeSet;

use headless_lms_models::credit_registration_account_linking_emails::{
    LinkingMailToQueue, claim_unqueued, set_email_delivery_id,
};
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::email_deliveries::insert_email_delivery_to_address;
use headless_lms_models::email_templates::EmailTemplateType;
use headless_lms_models::library::credit_registration::account_linking::link_student_number_url;
use secrecy::ExposeSecret;
use serde_json::json;
use sqlx::Connection;

use super::{PhaseContext, PhaseScope, TemplateCache, template_language};

/// How many mails one iteration queues; the sender has its own rate, so this only bounds how much
/// one transaction holds open.
const QUEUE_LIMIT: i64 = 200;

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_unqueued(&mut tx, QUEUE_LIMIT, scope.course_id).await?;
    let mut templates = TemplateCache::default();
    let mut languages_without_a_template: BTreeSet<String> = BTreeSet::new();
    let mut skipped = 0;
    for mail in &claimed {
        let language = template_language(&mail.course_language_code);
        let Some(template_id) = templates
            .id_for(
                &mut tx,
                EmailTemplateType::CreditRegistrationAccountLinking,
                &language,
            )
            .await?
        else {
            languages_without_a_template.insert(language);
            skipped += 1;
            continue;
        };
        let delivery = insert_email_delivery_to_address(
            &mut tx,
            &mail.emailed_to,
            template_id,
            &placeholders(ctx.base_url, mail),
        )
        .await?;
        set_email_delivery_id(&mut tx, mail.id, delivery).await?;
    }
    tx.commit().await?;

    // A mail with no template is skipped rather than failing the iteration: the batch is one
    // transaction, so an error would roll back every mail that could be queued. The slot stays
    // claimable.
    Ok(PhaseRunOutcome {
        items_processed: i32::try_from(claimed.len()).unwrap_or(i32::MAX),
        items_failed: skipped,
        error: (!languages_without_a_template.is_empty()).then(|| {
            format!(
                "No credit_registration_account_linking email template for: {}.",
                languages_without_a_template
                    .into_iter()
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        }),
    })
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
