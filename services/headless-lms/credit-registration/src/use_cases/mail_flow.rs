//! The loop the two mail phases share, and the template lookup it needs.

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::email_templates::{
    EmailTemplateType, get_generic_email_template_by_type_and_language,
};
use sqlx::{Connection, PgConnection};
use std::collections::{BTreeSet, HashMap};
use uuid::Uuid;

use crate::domain::Counts;
use crate::error::CreditRegistrationResult;
use crate::phase::PhaseScope;
use crate::use_cases::contexts::MailContext;

/// One template lookup per type and language per iteration rather than per mail. `None` means no
/// template exists, which a mail phase reports rather than failing the batch it was found in.
#[derive(Default)]
struct TemplateCache(HashMap<(EmailTemplateType, String), Option<Uuid>>);

impl TemplateCache {
    async fn id_for(
        &mut self,
        conn: &mut PgConnection,
        template_type: EmailTemplateType,
        language: &str,
    ) -> CreditRegistrationResult<Option<Uuid>> {
        let key = (template_type, language.to_string());
        if let Some(id) = self.0.get(&key) {
            return Ok(*id);
        }
        let found =
            match get_generic_email_template_by_type_and_language(conn, template_type, language)
                .await
            {
                Ok(template) => Some(template.id),
                Err(error)
                    if matches!(
                        error.error_type(),
                        headless_lms_models::ModelErrorType::RecordNotFound
                    ) =>
                {
                    None
                }
                Err(error) => return Err(error.into()),
            };
        self.0.insert(key, found);
        Ok(found)
    }
}

/// A phase whose whole body is "claim rows, look up each one's template, skip it if the template is
/// missing, otherwise queue a mail". `link-emails` and `student-notifications` are its only two
/// shapes; [`run_mail_flow`] is the loop they share.
pub(super) trait MailFlow {
    type Item;

    async fn claim(
        conn: &mut PgConnection,
        scope: &PhaseScope,
    ) -> CreditRegistrationResult<Vec<Self::Item>>;

    fn template_type(item: &Self::Item) -> EmailTemplateType;
    fn language(item: &Self::Item) -> String;

    /// Inserts the delivery and records it on the claimed item, given the template the caller
    /// already resolved.
    async fn queue(
        base_url: &str,
        conn: &mut PgConnection,
        item: &Self::Item,
        template_id: Uuid,
    ) -> CreditRegistrationResult<()>;

    /// One entry of the missing-templates report, e.g. the language alone or a type-and-language
    /// pair, depending on whether the phase has more than one template type.
    fn missing_template_label(template_type: EmailTemplateType, language: &str) -> String;

    /// The fixed lead-in of the missing-templates error message.
    fn missing_templates_error_prefix() -> &'static str;
}

/// Claims, resolves templates for, and queues mail for one iteration of a [`MailFlow`]. A mail
/// with no template is skipped rather than failing the iteration: the batch is one transaction, so an
/// error would roll back every mail that could be queued, and the claimed rows stay claimable.
pub(super) async fn run_mail_flow<P: MailFlow>(
    ctx: &MailContext<'_>,
) -> CreditRegistrationResult<Counts> {
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = P::claim(&mut tx, ctx.scope).await?;
    let claimed_count = claimed.len();
    let mut templates = TemplateCache::default();
    let mut missing_templates: BTreeSet<String> = BTreeSet::new();
    let mut skipped = 0;
    for item in &claimed {
        let template_type = P::template_type(item);
        let language = P::language(item);
        let Some(template_id) = templates.id_for(&mut tx, template_type, &language).await? else {
            debug!(
                ?template_type,
                language = %language,
                "No email template for mail; skipping"
            );
            missing_templates.insert(P::missing_template_label(template_type, &language));
            skipped += 1;
            continue;
        };
        P::queue(ctx.base_url, &mut tx, item, template_id).await?;
    }
    tx.commit().await?;

    if claimed_count > 0 {
        let claimed = claimed_count;
        let queued = claimed_count - skipped as usize;
        info!(
            claimed,
            queued, skipped, "queued {queued} mails, skipped {skipped}"
        );
    }
    let finding = (!missing_templates.is_empty()).then(|| {
        format!(
            "{} {}.",
            P::missing_templates_error_prefix(),
            missing_templates.into_iter().collect::<Vec<_>>().join(", ")
        )
    });
    Ok(
        Counts::processed_with_failures(i32::try_from(claimed_count).unwrap_or(i32::MAX), skipped)
            .with_finding(finding),
    )
}

/// Templates are stored per language and courses carry a locale. The course's language, not the
/// recipient's: the linking mail's recipient may have no account here, and an account records no UI
/// language to prefer.
pub(super) fn template_language(course_language_code: &str) -> String {
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
