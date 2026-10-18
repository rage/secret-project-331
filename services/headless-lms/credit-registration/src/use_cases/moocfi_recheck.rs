//! The `moocfi-recheck` phase: reading mooc.fi completions again before import may submit them.

use headless_lms_base::config::MoocfiDelegationConfiguration;
use headless_lms_models::credit_registrations::RegistrationScope;
use headless_lms_models::external_completions::{self, UpstreamCompletions};
use headless_lms_models::library::credit_registration::moocfi_recheck::{
    MOOCFI_RECHECK_LIMIT, get_due_recheck_groups,
};
use headless_lms_utils::services::moocfi::MoocfiClient;
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::workflow::{Counts, RequestTally};

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
    let client = MoocfiClient::new(delegation);
    let mut tally = RequestTally::default();
    for group in groups {
        if shutdown.is_some_and(CancellationToken::is_cancelled) {
            break;
        }
        match lookup_and_sync(
            pool,
            delegation,
            &client,
            group.user_id,
            group.moocfi_user_upstream_id,
            group.moocfi_course_id,
        )
        .await?
        {
            Ok(()) => tally.record_success(),
            Err(error) => {
                warn!(
                    user_id = %group.user_id,
                    moocfi_course_id = %group.moocfi_course_id,
                    %error,
                    "Could not re-check mooc.fi completions"
                );
                tally.record_failure(error);
            }
        }
    }
    Ok(tally.into_counts("mooc.fi lookups"))
}

/// Reads the student's completions of one mooc.fi course from mooc.fi and syncs them, holding no
/// connection during the lookup. The inner `Err` is a failed lookup or sync.
pub(crate) async fn lookup_and_sync(
    pool: &PgPool,
    delegation: &MoocfiDelegationConfiguration,
    client: &MoocfiClient,
    user_id: Uuid,
    moocfi_user_upstream_id: i32,
    moocfi_course_id: Uuid,
) -> CreditRegistrationResult<Result<(), String>> {
    let completions = match client
        .get_user_completions(moocfi_course_id, moocfi_user_upstream_id)
        .await
    {
        Ok(completions) => completions,
        Err(error) => return Ok(Err(error.to_string())),
    };
    let mut conn = pool.acquire().await?;
    let synced = external_completions::sync_from_upstream(
        &mut conn,
        UpstreamCompletions {
            user_id,
            moocfi_user_upstream_id,
            moocfi_course_id,
            completions: &completions,
            organization_slug: &delegation.organization_slug,
        },
    )
    .await;
    Ok(synced.map_err(|error| error.to_string()))
}
