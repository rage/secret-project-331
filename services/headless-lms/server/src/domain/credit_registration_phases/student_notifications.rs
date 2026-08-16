//! The `student-notifications` phase: the only thing that queues a student mail about a credit
//! registration.
//!
//! Exactly two mails exist and each row gets each at most once. Nothing else is mailed: a
//! `failed_permanent` row is a configuration problem the student cannot act on, a withdrawn one was
//! the student's own decision, and the linking mail already covers a missing student number.

use std::collections::BTreeSet;

use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::email_deliveries::insert_email_delivery_with_placeholders;
use headless_lms_models::library::credit_registration::student_notifications::{
    CreditRegistrationNotificationKind, STUDENT_NOTIFICATION_LIMIT, StudentNotificationToQueue,
    claim_unnotified, set_email_delivery_id,
};
use headless_lms_models::open_university_product_access_tokens::enrolment_url_for_product;
use serde_json::json;
use sqlx::{Connection, PgConnection};
use uuid::Uuid;

use super::{PhaseContext, PhaseScope, TemplateCache, template_language};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_unnotified(&mut tx, scope, STUDENT_NOTIFICATION_LIMIT).await?;
    let mut templates = TemplateCache::default();
    let mut missing_templates: BTreeSet<String> = BTreeSet::new();
    let mut skipped = 0;
    for notification in &claimed {
        let template_type = notification.kind.email_template_type();
        let language = template_language(&notification.course_language_code);
        let Some(template_id) = templates.id_for(&mut tx, template_type, &language).await? else {
            missing_templates.insert(format!("{template_type:?} in {language}"));
            skipped += 1;
            continue;
        };
        let placeholders = placeholders(ctx.base_url, &mut tx, notification).await?;
        let delivery = insert_email_delivery_with_placeholders(
            &mut tx,
            notification.user_id,
            template_id,
            &placeholders,
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

    // A missing template skips its mail rather than failing the iteration: the batch is one
    // transaction, so an error would roll back every mail that could be queued, and the row stays
    // claimable.
    Ok(PhaseRunOutcome {
        items_processed: i32::try_from(claimed.len()).unwrap_or(i32::MAX),
        items_failed: skipped,
        error: (!missing_templates.is_empty()).then(|| {
            format!(
                "No student notification email template for: {}.",
                missing_templates.into_iter().collect::<Vec<_>>().join(", ")
            )
        }),
    })
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
) -> anyhow::Result<serde_json::Value> {
    let enrolment_link = match notification.kind {
        CreditRegistrationNotificationKind::ActionNeeded => {
            enrolment_url_for_product(conn, notification.open_university_product_id.as_deref())
                .await?
                .unwrap_or_default()
        }
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
