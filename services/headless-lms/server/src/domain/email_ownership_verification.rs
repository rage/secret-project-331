//! Minting and mailing email-ownership verification links.
//!
//! Signup and all three writers of `user_details.email` come through here, so the token, the link and
//! the resend cap cannot drift between them.

use chrono::Duration;
use headless_lms_models::{
    email_deliveries, email_ownership_verification_tokens,
    email_templates::{self, EmailTemplateType},
    user_details,
};
use secrecy::ExposeSecret;
use serde_json::json;

use crate::config::program_config::ProgramConfig;
use crate::prelude::*;

/// Where the mailed link points when `FRONTEND_BASE_URL` is unset. Same default as the mail sender's.
const FRONTEND_BASE_URL_FALLBACK: &str = "https://courses.mooc.fi";

/// Automatic sends have no UI language to work from. The template lookup falls back to English on its
/// own, so this only makes the intent explicit at the call sites.
pub const FALLBACK_EMAIL_LANGUAGE: &str = "en";

/// How soon after mailing a link to an address we refuse to mail another to the same address. A
/// mail-bomb guard, not a quota: the resend button is the intended remedy when a mail does not arrive.
const MIN_RESEND_INTERVAL_MINUTES: i64 = 2;

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum VerificationEmailOutcome {
    Queued,
    /// The address already carries a proof, so there is nothing to prove.
    AlreadyVerified,
    /// A link to this same address is younger than the resend cap.
    RecentlySent,
}

/// Mails a verification link for `email`, which must be the address currently on the account.
pub async fn queue_verification_email(
    conn: &mut PgConnection,
    user_id: Uuid,
    email: &str,
    language: &str,
) -> anyhow::Result<VerificationEmailOutcome> {
    if user_details::get_email_verification(conn, user_id)
        .await?
        .is_some()
    {
        return Ok(VerificationEmailOutcome::AlreadyVerified);
    }

    let last_send =
        email_ownership_verification_tokens::get_last_send_time_for_address(conn, user_id, email)
            .await?;
    if let Some(last_send) = last_send
        && Utc::now() - last_send < Duration::minutes(MIN_RESEND_INTERVAL_MINUTES)
    {
        return Ok(VerificationEmailOutcome::RecentlySent);
    }

    let template = email_templates::get_generic_email_template_by_type_and_language(
        conn,
        EmailTemplateType::VerifyEmailAddress,
        language,
    )
    .await
    .map_err(|e| {
        anyhow::anyhow!(
            "No verify_email_address email template is configured for language '{language}': {e}"
        )
    })?;

    let mut tx = conn.begin().await?;
    let (token_id, token) =
        email_ownership_verification_tokens::insert(&mut tx, PKeyPolicy::Generate, user_id, email)
            .await?;
    let placeholders = json!({
        "VERIFICATION_LINK": verification_link(token.expose_secret()),
        "EMAIL": email,
    });
    // Addressed to the raw address rather than to user_id: the mail has to go to the address the link
    // was minted for, even if the account moves on to a different one before the queue drains.
    let delivery_id = email_deliveries::insert_email_delivery_to_address(
        &mut tx,
        email,
        template.id,
        &placeholders,
    )
    .await?;
    email_ownership_verification_tokens::set_email_delivery_id(&mut tx, token_id, delivery_id)
        .await?;
    tx.commit().await?;

    Ok(VerificationEmailOutcome::Queued)
}

/// Queues the mail without letting a failure propagate.
///
/// For the automatic sends: neither a signup nor an email change may be rolled back because the mail
/// queue or the template is unavailable. The user can always ask again from account settings.
pub async fn queue_verification_email_best_effort(
    conn: &mut PgConnection,
    user_id: Uuid,
    email: &str,
) {
    match queue_verification_email(conn, user_id, email, FALLBACK_EMAIL_LANGUAGE).await {
        Ok(outcome) => {
            info!("Email ownership verification mail for {user_id}: {outcome:?}");
        }
        Err(e) => {
            error!("Failed to queue email ownership verification mail for {user_id}: {e}");
        }
    }
}

/// The URL the mailed link points at. Tokens are alphanumeric, so no percent-encoding is needed.
pub fn verification_link(token: &str) -> String {
    let base = ProgramConfig::optional("FRONTEND_BASE_URL")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| FRONTEND_BASE_URL_FALLBACK.to_string());
    format!(
        "{}/email-verified?token={}",
        base.trim_end_matches('/'),
        token
    )
}
