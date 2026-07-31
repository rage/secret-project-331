//! Minting and mailing email-ownership verification codes.
//!
//! Signup and every writer of `user_details.email` goes through here, so the code, the mail and the
//! resend cap cannot drift between them.

use chrono::Duration;
use headless_lms_models::{
    email_deliveries,
    email_templates::{self, EmailTemplateType},
    user_details, user_email_codes,
    user_email_codes::UserEmailCodePurpose,
};

use crate::prelude::*;

/// Language for the automatic sends, which have no UI language to work from.
pub const FALLBACK_EMAIL_LANGUAGE: &str = "en";

/// Mail-bomb guard, not a quota: how soon after mailing a code we refuse another.
const MIN_RESEND_INTERVAL_MINUTES: i64 = 2;

/// Wrong guesses one code tolerates before it is retired. Six digits are only safe with a cap.
pub const MAX_CODE_ATTEMPTS: i32 = 5;

const PURPOSE: UserEmailCodePurpose = UserEmailCodePurpose::EmailOwnershipVerification;

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum VerificationEmailOutcome {
    Queued,
    AlreadyVerified,
    /// A code was mailed to this address less than the resend interval ago.
    RecentlySent,
}

/// Mails a fresh verification code to the address the account holds now.
///
/// Errors when the deployment has no `verify_email_address` template: with the feature switched on by
/// env var, a missing template is a misconfiguration rather than a dormant state.
pub async fn queue_verification_email(
    conn: &mut PgConnection,
    user_id: Uuid,
    language: &str,
) -> anyhow::Result<VerificationEmailOutcome> {
    if user_details::get_email_verification(conn, user_id)
        .await?
        .is_some()
    {
        return Ok(VerificationEmailOutcome::AlreadyVerified);
    }

    // The live code is the record of the last send to the current address: an address change retires
    // it in the database trigger, so a genuine change can be mailed immediately.
    let live_code =
        user_email_codes::get_unused_user_email_code_with_user_id(conn, user_id, PURPOSE).await?;
    if let Some(live_code) = live_code
        && Utc::now() - live_code.created_at < Duration::minutes(MIN_RESEND_INTERVAL_MINUTES)
    {
        return Ok(VerificationEmailOutcome::RecentlySent);
    }

    // The lookup falls back to English, so no row means the deployment has no template at all.
    let template = email_templates::get_generic_email_template_by_type_and_language(
        conn,
        EmailTemplateType::VerifyEmailAddress,
        language,
    )
    .await
    .map_err(|e| {
        anyhow::anyhow!(
            "Email ownership verification is enabled but the verify_email_address email template is missing: {}",
            e.message()
        )
    })?;

    let mut tx = conn.begin().await?;
    let code = user_email_codes::generate_code();
    user_email_codes::insert_user_email_code(&mut tx, user_id, PURPOSE, &code).await?;
    // To the account, not to a stored address: the sender resolves the address and looks the code up
    // at send time, so nothing here holds a copy of either.
    email_deliveries::insert_email_delivery(&mut tx, user_id, template.id).await?;
    tx.commit().await?;

    Ok(VerificationEmailOutcome::Queued)
}

/// Queues the mail without letting a failure propagate: no signup or email change may be rolled back
/// because the mail queue or the template is unavailable.
///
/// `enabled` is [`ApplicationConfiguration::enable_email_ownership_verification`], passed in because
/// `sync_tmc_users` has no `ApplicationConfiguration` to read it from.
pub async fn queue_verification_email_best_effort(
    conn: &mut PgConnection,
    enabled: bool,
    user_id: Uuid,
) {
    if !enabled {
        return;
    }
    match queue_verification_email(conn, user_id, FALLBACK_EMAIL_LANGUAGE).await {
        Ok(outcome) => {
            info!("Email ownership verification mail for {user_id}: {outcome:?}");
        }
        Err(e) => {
            error!("Failed to queue email ownership verification mail for {user_id}: {e}");
        }
    }
}
