//! The `moocfi-report` phase: telling mooc.fi which of its completions we registered.

use headless_lms_base::config::MoocfiDelegationConfiguration;
use headless_lms_models::credit_registrations::RegistrationScope;
use headless_lms_models::external_completions;
use headless_lms_models::library::credit_registration::moocfi_report::{
    MOOCFI_REPORT_LIMIT, MoocfiReportCandidate, claim_next_for_report, mark_reported,
    record_report_failure,
};
use headless_lms_utils::services::moocfi::{
    CompletionRegistrationReport, MoocfiClient, RegisterCompletionsRequest,
};
use sqlx::{PgConnection, PgPool};
use tokio_util::sync::CancellationToken;

use crate::error::CreditRegistrationResult;
use crate::workflow::Counts;

/// Claims and reports one completion at a time, so each lease covers only its own lookup and post.
pub(crate) async fn run(
    pool: &PgPool,
    scope: &RegistrationScope,
    delegation: &MoocfiDelegationConfiguration,
    shutdown: Option<&CancellationToken>,
) -> CreditRegistrationResult<Counts> {
    let client = MoocfiClient::new(delegation);
    let mut processed = 0;
    let mut failed = 0;
    let mut first_error = None;
    for _ in 0..MOOCFI_REPORT_LIMIT {
        if shutdown.is_some_and(CancellationToken::is_cancelled) {
            break;
        }
        let mut conn = pool.acquire().await?;
        let Some(candidate) = claim_next_for_report(&mut conn, scope).await? else {
            break;
        };
        processed += 1;
        if let Err(error) = report(&mut conn, delegation, &client, &candidate).await? {
            warn!(
                external_completion_id = %candidate.external_completion_id,
                %error,
                "Could not report a registration to mooc.fi"
            );
            record_report_failure(&mut conn, &candidate, &error).await?;
            failed += 1;
            first_error.get_or_insert(error);
        }
    }
    Ok(
        Counts::processed_with_failures(processed, failed).with_finding(first_error.map(|error| {
            format!("{failed} mooc.fi registration reports failed, the first with: {error}")
        })),
    )
}

/// Posts the candidate unless the lookup finds our registration already on mooc.fi. The inner
/// `Err` is a failed report, to back off; the outer one a database failure, after which the lease
/// lapses and the next try's lookup finds whatever the post did.
async fn report(
    conn: &mut PgConnection,
    delegation: &MoocfiDelegationConfiguration,
    client: &MoocfiClient,
    candidate: &MoocfiReportCandidate,
) -> CreditRegistrationResult<Result<(), String>> {
    if let Err(error) = external_completions::fetch_and_sync(
        conn,
        delegation,
        candidate.user_id,
        candidate.moocfi_user_upstream_id,
        candidate.moocfi_course_id,
    )
    .await
    {
        return Ok(Err(error.to_string()));
    }
    let completion =
        external_completions::get_by_id(conn, candidate.external_completion_id).await?;
    if completion.reported_at.is_some() {
        return Ok(Ok(()));
    }
    if completion.upstream_missing_at.is_some() {
        return Ok(Err("the completion is no longer on mooc.fi".to_string()));
    }
    let request = RegisterCompletionsRequest {
        completions: vec![CompletionRegistrationReport {
            completion_id: candidate.moocfi_completion_id,
            student_number: candidate.student_number.clone().into(),
            registration_date: candidate.registration_date,
        }],
    };
    if let Err(error) = client.register_completions(&request).await {
        return Ok(Err(error.to_string()));
    }
    mark_reported(conn, candidate.moocfi_completion_id).await?;
    Ok(Ok(()))
}
