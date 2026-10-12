//! The `moocfi-recheck` phase: reading mooc.fi completions again before import may submit them.

use headless_lms_base::config::MoocfiDelegationConfiguration;
use headless_lms_models::credit_registrations::RegistrationScope;
use headless_lms_models::external_completions;
use headless_lms_models::library::credit_registration::moocfi_recheck::{
    MOOCFI_RECHECK_LIMIT, get_due_recheck_groups,
};
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;

use crate::error::CreditRegistrationResult;
use crate::workflow::Counts;

/// One lookup per student and mooc.fi course. A failed lookup leaves its rows to go stale, which
/// keeps import away from them until a later lookup gets through.
pub(crate) async fn run(
    pool: &PgPool,
    scope: &RegistrationScope,
    delegation: &MoocfiDelegationConfiguration,
    shutdown: Option<&CancellationToken>,
) -> CreditRegistrationResult<Counts> {
    let groups = {
        let mut conn = pool.acquire().await?;
        get_due_recheck_groups(&mut conn, scope, MOOCFI_RECHECK_LIMIT).await?
    };
    let mut processed = 0;
    let mut failed = 0;
    let mut first_error = None;
    for group in groups {
        if shutdown.is_some_and(CancellationToken::is_cancelled) {
            break;
        }
        let mut conn = pool.acquire().await?;
        processed += 1;
        if let Err(error) = external_completions::fetch_and_sync(
            &mut conn,
            delegation,
            group.user_id,
            group.moocfi_user_upstream_id,
            group.moocfi_course_id,
        )
        .await
        {
            warn!(
                user_id = %group.user_id,
                moocfi_course_id = %group.moocfi_course_id,
                %error,
                "Could not re-check mooc.fi completions"
            );
            failed += 1;
            first_error.get_or_insert_with(|| error.to_string());
        }
    }
    Ok(
        Counts::processed_with_failures(processed, failed).with_finding(
            first_error
                .map(|error| format!("{failed} mooc.fi lookups failed, the first with: {error}")),
        ),
    )
}
