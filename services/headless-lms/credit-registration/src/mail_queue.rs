//! The loop the two mail phases share, and the template lookup it needs.

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::email_templates::{
    EmailTemplateType, get_generic_email_template_by_type_and_language,
};
use sqlx::{Connection, PgConnection};
use std::collections::{BTreeSet, HashMap};
use uuid::Uuid;

use crate::dispatch::{Counts, Iteration, PhaseContext};
use crate::error::CreditRegistrationResult;
use crate::phase::PhaseScope;

/// One template lookup per type and language per iteration rather than per mail. `None` means no
/// template exists, which a mail phase reports rather than failing the batch it was found in.
#[derive(Default)]
pub(crate) struct TemplateCache(HashMap<(EmailTemplateType, String), Option<Uuid>>);

impl TemplateCache {
    pub(crate) async fn id_for(
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
/// shapes; [`run_mail_queue_phase`] is the loop they share.
pub(crate) trait MailQueuePhase {
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
        ctx: &PhaseContext<'_>,
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

/// Claims, resolves templates for, and queues mail for one iteration of a [`MailQueuePhase`]. A mail
/// with no template is skipped rather than failing the iteration: the batch is one transaction, so an
/// error would roll back every mail that could be queued, and the claimed rows stay claimable.
pub(crate) async fn run_mail_queue_phase<P: MailQueuePhase>(
    it: &Iteration<'_>,
) -> CreditRegistrationResult<Counts> {
    let mut conn = it.ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = P::claim(&mut tx, it.scope).await?;
    let mut templates = TemplateCache::default();
    let mut missing_templates: BTreeSet<String> = BTreeSet::new();
    let mut skipped = 0;
    for item in &claimed {
        let template_type = P::template_type(item);
        let language = P::language(item);
        let Some(template_id) = templates.id_for(&mut tx, template_type, &language).await? else {
            missing_templates.insert(P::missing_template_label(template_type, &language));
            skipped += 1;
            continue;
        };
        P::queue(it.ctx, &mut tx, item, template_id).await?;
    }
    tx.commit().await?;

    Ok(Counts {
        processed: i32::try_from(claimed.len()).unwrap_or(i32::MAX),
        failed: skipped,
        finding: (!missing_templates.is_empty()).then(|| {
            format!(
                "{} {}.",
                P::missing_templates_error_prefix(),
                missing_templates.into_iter().collect::<Vec<_>>().join(", ")
            )
        }),
    })
}

/// Templates are stored per language and courses carry a locale. The course's language, not the
/// recipient's: the linking mail's recipient may have no account here, and an account records no UI
/// language to prefer.
pub(crate) fn template_language(course_language_code: &str) -> String {
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
