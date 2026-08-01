//! The `link-emails` phase: turning a claimed mail slot into a queued message.
//!
//! It talks to no study registry, which is the point of it being its own phase: a wedged mail queue
//! and an unreachable Sisu are different problems and an operator has to be able to tell them apart.
//!
//! The rate caps and the dedup guard are not here. They were applied when the slot was claimed, and a
//! slot with no delivery means a mail is owed — so this phase retries until the message is queued
//! rather than deciding again whether it should be.

use std::collections::HashMap;

use headless_lms_models::credit_registration_account_linking_emails::{
    LinkingMailToQueue, claim_unqueued, set_email_delivery_id,
};
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::email_deliveries::insert_email_delivery_to_address;
use headless_lms_models::email_templates::{
    EmailTemplateType, get_generic_email_template_by_type_and_language,
};
use headless_lms_models::library::credit_registration::account_linking::link_student_number_url;
use secrecy::ExposeSecret;
use serde_json::json;
use sqlx::{Connection, PgConnection};
use uuid::Uuid;

use super::{PhaseContext, PhaseScope};

/// How many mails one iteration queues. The sender has its own rate, so this only bounds how much
/// one transaction holds open.
const QUEUE_LIMIT: i64 = 200;

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_unqueued(&mut tx, QUEUE_LIMIT, scope.course_id).await?;
    let mut templates = TemplatesByLanguage::default();
    for mail in &claimed {
        let template_id = templates
            .id_for(&mut tx, &mail.course_language_code)
            .await?;
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

    // Never a failed item: the whole batch is one transaction, so anything that goes wrong — a
    // missing template above all — fails the iteration and leaves every slot claimable again.
    Ok(PhaseRunOutcome {
        items_processed: i32::try_from(claimed.len()).unwrap_or(i32::MAX),
        items_failed: 0,
        error: None,
    })
}

/// The substitutions the mail carries, stored on the delivery row because the recipient may have no
/// account here for the sender to read them from.
fn placeholders(base_url: &str, mail: &LinkingMailToQueue) -> serde_json::Value {
    json!({
        "LINK": link_student_number_url(base_url, mail.token.expose_secret()),
        "NAME": mail.first_names.clone().unwrap_or_default(),
        "STUDENT_NUMBER": mail.student_number,
        "COURSE_NAME": mail.course_name,
    })
}

/// One template lookup per language per iteration rather than per mail.
#[derive(Default)]
struct TemplatesByLanguage(HashMap<String, Uuid>);

impl TemplatesByLanguage {
    async fn id_for(
        &mut self,
        conn: &mut PgConnection,
        course_language_code: &str,
    ) -> anyhow::Result<Uuid> {
        let language = template_language(course_language_code);
        if let Some(id) = self.0.get(&language) {
            return Ok(*id);
        }
        let template = get_generic_email_template_by_type_and_language(
            conn,
            EmailTemplateType::CreditRegistrationAccountLinking,
            &language,
        )
        .await?;
        self.0.insert(language, template.id);
        Ok(template.id)
    }
}

/// Templates are stored per language, courses carry a locale. There is nothing better to go on: the
/// recipient has no account here whose language we could read.
fn template_language(course_language_code: &str) -> String {
    course_language_code
        .split(['-', '_'])
        .next()
        .unwrap_or(course_language_code)
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_locale_narrows_to_the_language_the_templates_are_stored_under() {
        assert_eq!(template_language("fi-FI"), "fi");
        assert_eq!(template_language("en_US"), "en");
        assert_eq!(template_language("en"), "en");
    }
}
