//! What the two mail phases share: the template lookup, and the accounting of what one iteration
//! queued and skipped.

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::email_templates::{
    EmailTemplateType, get_generic_email_template_by_type_and_language,
};
use sqlx::PgConnection;
use std::collections::{BTreeSet, HashMap};
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::workflow::Counts;

/// One template lookup per type and language per iteration rather than per mail. `None` means no
/// template exists, which a mail phase reports rather than failing the batch it was found in.
#[derive(Default)]
pub(super) struct TemplateCache(HashMap<(EmailTemplateType, String), Option<Uuid>>);

impl TemplateCache {
    pub(super) async fn id_for(
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

/// What one mail iteration claimed and could not queue. A mail with no template is skipped rather
/// than failing the iteration: the batch is one transaction, so an error would roll back every mail
/// that could be queued, and the claimed rows stay claimable.
pub(super) struct MailQueueSummary {
    claimed: usize,
    skipped: usize,
    missing_templates: BTreeSet<String>,
}

impl MailQueueSummary {
    pub(super) fn new(claimed: usize) -> Self {
        Self {
            claimed,
            skipped: 0,
            missing_templates: BTreeSet::new(),
        }
    }

    /// A mail left unqueued for want of a template; `label` names it in the iteration's finding.
    pub(super) fn skip_missing_template(
        &mut self,
        template_type: EmailTemplateType,
        language: &str,
        label: impl Into<String>,
    ) {
        debug!(
            ?template_type,
            language = %language,
            "No email template for mail; skipping"
        );
        self.missing_templates.insert(label.into());
        self.skipped += 1;
    }

    /// Logs the iteration and turns it into its counts, with the missing templates listed after
    /// `missing_templates_prefix` as the finding.
    pub(super) fn finish(self, missing_templates_prefix: &str) -> Counts {
        let claimed = self.claimed;
        let skipped = self.skipped;
        if claimed > 0 {
            let queued = claimed - skipped;
            info!(
                claimed,
                queued, skipped, "queued {queued} mails, skipped {skipped}"
            );
        }
        let finding = (!self.missing_templates.is_empty()).then(|| {
            format!(
                "{missing_templates_prefix} {}.",
                self.missing_templates
                    .into_iter()
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        });
        Counts::processed_with_failures(
            i32::try_from(claimed).unwrap_or(i32::MAX),
            i32::try_from(skipped).unwrap_or(i32::MAX),
        )
        .with_finding(finding)
    }
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
