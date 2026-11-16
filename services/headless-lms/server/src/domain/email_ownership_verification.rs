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
    users,
};
use headless_lms_utils::{prelude::UtilErrorType, services::tmc::TmcClient};

use crate::prelude::*;

/// Language for the automatic sends, which have no UI language to work from.
pub const FALLBACK_EMAIL_LANGUAGE: &str = "en";

/// Mail-bomb guard, not a quota: how soon after mailing a code we refuse another.
pub const MIN_RESEND_INTERVAL_MINUTES: i64 = 2;

/// Wrong guesses one code tolerates before it is retired. Six digits are only safe with a cap.
pub const MAX_CODE_ATTEMPTS: i32 = 5;

const PURPOSE: UserEmailCodePurpose = UserEmailCodePurpose::EmailOwnershipVerification;

/// Records that the user proved control of their address by typing the code for `purpose` just
/// accepted, whatever the code was for, and copies the proven address to TMC. Keeps an earlier
/// proof.
///
/// Skipped when the user's details changed after the code was mailed: the address may have changed
/// since, and a code that went to the old one must not prove the new one. Also skipped, with a
/// warning, when TMC refuses the address or cannot be reached: these codes sign the user in, which
/// must not depend on TMC.
pub async fn record_code_as_mailbox_proof(
    conn: &mut PgConnection,
    user_id: Uuid,
    purpose: UserEmailCodePurpose,
    tmc_client: &TmcClient,
    app_conf: &ApplicationConfiguration,
) -> Result<(), ControllerError> {
    let Some(code) = user_email_codes::get_latest_user_email_code(conn, user_id, purpose).await?
    else {
        return Ok(());
    };
    let mut tx = conn.begin().await?;
    let recorded = user_details::set_email_verified_unless_changed_since(
        &mut tx,
        user_id,
        user_details::EmailVerificationMethod::EmailedCode,
        code.created_at,
    )
    .await?;
    if recorded && let Err(error) = copy_email_to_tmc(&mut tx, user_id, tmc_client, app_conf).await
    {
        warn!("Left the address of user {user_id} unverified: {error:?}");
        tx.rollback().await?;
        return Ok(());
    }
    tx.commit().await?;
    Ok(())
}

/// Copies the account's current address to TMC, where the same account signs in. Called once the
/// address is proven, last before the proof commits: TMC cannot be rolled back.
///
/// Fails with `BadRequest` when TMC refuses the address, e.g. because another account uses it.
pub async fn copy_email_to_tmc(
    conn: &mut PgConnection,
    user_id: Uuid,
    tmc_client: &TmcClient,
    app_conf: &ApplicationConfiguration,
) -> Result<(), ControllerError> {
    let Some(upstream_id) = users::get_by_id(&mut *conn, user_id)
        .await?
        .upstream_id
        .filter(|_| !app_conf.test_mode)
    else {
        return Ok(());
    };
    let email = user_details::get_user_details_by_user_id(conn, user_id)
        .await?
        .email;
    tmc_client
        .sync_user_email(email, upstream_id)
        .await
        .map_err(|error| match error.error_type() {
            UtilErrorType::TmcHttpStatusError(400 | 422) => controller_err!(
                BadRequest,
                "This email address cannot be used. It may belong to another account.".to_string(),
                error
            ),
            _ => controller_err!(
                InternalServerError,
                "Failed to update the email on TMC".to_string(),
                error
            ),
        })
}

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
    if user_details::has_mailbox_proof(conn, user_id).await? {
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

    mail_new_code(
        conn,
        user_id,
        PURPOSE,
        EmailTemplateType::VerifyEmailAddress,
        language,
    )
    .await?;
    Ok(VerificationEmailOutcome::Queued)
}

/// Mints a code for `purpose` and queues the `template_type` mail that carries it.
///
/// Errors when the deployment has no such template: the lookup falls back to English, so no row
/// means none at all.
pub async fn mail_new_code(
    conn: &mut PgConnection,
    user_id: Uuid,
    purpose: UserEmailCodePurpose,
    template_type: EmailTemplateType,
    language: &str,
) -> anyhow::Result<()> {
    let template = email_templates::get_generic_email_template_by_type_and_language(
        conn,
        template_type,
        language,
    )
    .await
    .map_err(|e| {
        anyhow::anyhow!(
            "The {template_type:?} email template is missing: {}",
            e.message()
        )
    })?;
    let mut tx = conn.begin().await?;
    let code = user_email_codes::generate_code();
    user_email_codes::insert_user_email_code(&mut tx, user_id, purpose, &code).await?;
    // To the account, not to a stored address: the sender resolves the address and looks the code up
    // at send time, so nothing here holds a copy of either.
    email_deliveries::insert_email_delivery(&mut tx, user_id, template.id).await?;
    tx.commit().await?;
    Ok(())
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
