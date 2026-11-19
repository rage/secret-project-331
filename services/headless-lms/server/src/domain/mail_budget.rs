//! The per-inbox daily mail budget: how many mails one inbox may be sent a day unless its proven
//! owner asked for them. Every address variant reaching the inbox shares it. Counted in
//! [`headless_lms_models::email_address_mail_budgets`].

use std::sync::LazyLock;

use chrono::Duration;
use headless_lms_models::email_address_mail_budgets;
use secrecy::ExposeSecret;

use crate::{
    config::{email_address_daily_mail_budget_from_env, form_context_secret_from_env},
    prelude::*,
};

const FALLBACK_DAILY_ALLOWANCE: i32 = 3;
const OLD_COUNTS_CLEANUP_PROBABILITY: f64 = 0.001;
const KEPT_DAYS: i64 = 2;

static DAILY_ALLOWANCE: LazyLock<i32> = LazyLock::new(|| {
    let Some(value) = email_address_daily_mail_budget_from_env() else {
        return FALLBACK_DAILY_ALLOWANCE;
    };
    // Zero would silently drop every budgeted mail while the forms still report success.
    match value.trim().parse::<i32>() {
        Ok(allowance) if allowance > 0 => allowance,
        _ => {
            error!(
                "EMAIL_ADDRESS_DAILY_MAIL_BUDGET must be a positive integer; using {FALLBACK_DAILY_ALLOWANCE}"
            );
            FALLBACK_DAILY_ALLOWANCE
        }
    }
});

/// Budgeted mails one inbox may be sent per UTC day, from `EMAIL_ADDRESS_DAILY_MAIL_BUDGET`.
pub fn daily_allowance() -> i32 {
    *DAILY_ALLOWANCE
}

/// Whether a mail to the user may be queued: always for a proven mailbox owner, otherwise only by
/// spending one mail of the inbox budget with [`try_consume_for_user`].
///
/// Call it before minting a code or token, under the same rules. When it returns false, the caller
/// must queue nothing and still answer as if the mail were sent.
pub async fn may_mail_user(conn: &mut PgConnection, user_id: Uuid) -> anyhow::Result<bool> {
    if headless_lms_models::user_details::has_mailbox_proof(conn, user_id).await? {
        return Ok(true);
    }
    try_consume_for_user(conn, user_id).await
}

/// Spends one mail of the budget of the inbox the user's account address reaches now. Returns
/// false, and spends nothing, when the day's budget is used up.
///
/// Call it in the transaction that queues the mail, after every other check has passed, and before
/// minting a code or token: minting retires the live one, which a refused mail must not do.
pub async fn try_consume_for_user(conn: &mut PgConnection, user_id: Uuid) -> anyhow::Result<bool> {
    delete_old_counts_occasionally(conn).await?;
    let email = headless_lms_models::user_details::get_user_details_by_user_id(conn, user_id)
        .await?
        .email;
    let key = email_address_mail_budgets::inbox_key(
        &email,
        // From env rather than the runtime config: sync_tmc_users mails without one.
        form_context_secret_from_env()?.expose_secret().as_bytes(),
    );
    Ok(email_address_mail_budgets::try_consume(conn, &key, daily_allowance()).await?)
}

async fn delete_old_counts_occasionally(conn: &mut PgConnection) -> ModelResult<()> {
    if !rand::rng().random_bool(OLD_COUNTS_CLEANUP_PROBABILITY) {
        return Ok(());
    }
    let cutoff = (Utc::now() - Duration::days(KEPT_DAYS)).date_naive();
    let deleted = email_address_mail_budgets::delete_older_than(conn, cutoff).await?;
    info!("Deleted {deleted} old email address mail budget counts");
    Ok(())
}
