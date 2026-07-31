//! Minting and mailing email-ownership verification links.
//!
//! Signup and every writer of `user_details.email` goes through here, so the token, the link and the
//! resend cap cannot drift between them.

use chrono::Duration;
use headless_lms_models::{
    email_deliveries, email_ownership_verification_tokens,
    email_templates::{self, EmailTemplateType},
    user_details,
};
use secrecy::ExposeSecret;
use serde_json::json;

use crate::prelude::*;

/// Language for the automatic sends, which have no UI language to work from.
pub const FALLBACK_EMAIL_LANGUAGE: &str = "en";

/// Mail-bomb guard, not a quota: how soon after mailing a link we refuse another to that address.
const MIN_RESEND_INTERVAL_MINUTES: i64 = 2;

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum VerificationEmailOutcome {
    Queued,
    AlreadyVerified,
    /// A link to this same address is younger than the resend cap.
    RecentlySent,
    /// No `verify_email_address` template exists; adding one turns the feature on.
    NotConfigured,
}

/// Mails a verification link for `email`, which must be the address currently on the account.
///
/// `base_url` is [`ApplicationConfiguration::base_url`]: the link has to point at the environment
/// that minted the token.
pub async fn queue_verification_email(
    conn: &mut PgConnection,
    base_url: &str,
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

    // The lookup falls back to English, so no row means the deployment has no template at all.
    let template = email_templates::get_generic_email_template_by_type_and_language(
        conn,
        EmailTemplateType::VerifyEmailAddress,
        language,
    )
    .await
    .optional()?;
    let Some(template) = template else {
        return Ok(VerificationEmailOutcome::NotConfigured);
    };

    let mut tx = conn.begin().await?;
    let (token_id, token) =
        email_ownership_verification_tokens::insert(&mut tx, PKeyPolicy::Generate, user_id, email)
            .await?;
    let placeholders = json!({
        "VERIFICATION_LINK": verification_link(base_url, token.expose_secret()),
        "EMAIL": email,
    });
    // To the raw address, not user_id: the mail must reach the address the link was minted for
    // even if the account moves on before the queue drains.
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

/// Queues the mail without letting a failure propagate: no signup or email change may be rolled back
/// because the mail queue or the template is unavailable.
pub async fn queue_verification_email_best_effort(
    conn: &mut PgConnection,
    base_url: &str,
    user_id: Uuid,
    email: &str,
) {
    match queue_verification_email(conn, base_url, user_id, email, FALLBACK_EMAIL_LANGUAGE).await {
        // The intended dormant state until a deployment adds the template, so info! and not error!.
        Ok(VerificationEmailOutcome::NotConfigured) => {
            info!(
                "No verify_email_address email template exists, so email ownership verification is off and no link was mailed for {user_id}"
            );
        }
        Ok(outcome) => {
            info!("Email ownership verification mail for {user_id}: {outcome:?}");
        }
        Err(e) => {
            error!("Failed to queue email ownership verification mail for {user_id}: {e}");
        }
    }
}

/// Whether this deployment can mail verification links at all. The account UI hides its verification
/// card entirely while this is false.
pub async fn verification_email_configured(conn: &mut PgConnection) -> anyhow::Result<bool> {
    Ok(email_templates::generic_template_of_type_exists(
        conn,
        EmailTemplateType::VerifyEmailAddress,
    )
    .await?)
}

/// The URL the mailed link points at. Tokens are alphanumeric, so no percent-encoding is needed.
///
/// Not `/email-verified`: tmc.mooc.fi redirects there with no token of ours and we cannot change it.
pub fn verification_link(base_url: &str, token: &str) -> String {
    format!(
        "{}/verify-email?token={}",
        base_url.trim_end_matches('/'),
        token
    )
}
