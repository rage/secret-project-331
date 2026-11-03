//! The `moocfi-report` phase: telling mooc.fi about each registration we made of its completions.

use std::collections::HashMap;
use std::collections::hash_map::Entry;

use headless_lms_base::config::MoocfiDelegationConfiguration;
use headless_lms_models::credit_registrations::RegistrationScope;
use headless_lms_models::library::credit_registration::moocfi_report::{
    MOOCFI_REPORT_LIMIT, MoocfiReportCandidate, claim_next_for_report, mark_reported,
    record_report_failure,
};
use headless_lms_utils::services::moocfi::{
    CompletionRegistrationReport, DelegatedCompletion, DelegatedCompletionRegistration,
    MoocfiClient, RegisterCompletionsRequest,
};
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use super::moocfi_recheck::lookup_and_sync;
use crate::error::CreditRegistrationResult;
use crate::workflow::{Counts, RequestTally};

/// A student's completions of one mooc.fi course as this run last read them, with the
/// registrations it has posted since.
type Lookups = HashMap<(Uuid, Uuid), Vec<DelegatedCompletion>>;

/// Claims and reports one registration at a time, so each lease covers only its own lookup and
/// post.
pub(crate) async fn run(
    pool: &PgPool,
    scope: &RegistrationScope,
    delegation: &MoocfiDelegationConfiguration,
    shutdown: Option<&CancellationToken>,
) -> CreditRegistrationResult<Counts> {
    let client = MoocfiClient::new(delegation);
    let mut tally = RequestTally::default();
    // One lookup returns all of a student's completions of a course, so it serves the rest of
    // their candidates in this run too.
    let mut lookups = Lookups::new();
    for _ in 0..MOOCFI_REPORT_LIMIT {
        if shutdown.is_some_and(CancellationToken::is_cancelled) {
            break;
        }
        let claimed = {
            let mut conn = pool.acquire().await?;
            claim_next_for_report(&mut conn, scope).await?
        };
        let Some(candidate) = claimed else {
            break;
        };
        match report(pool, delegation, &client, &candidate, &mut lookups).await? {
            Ok(()) => tally.record_success(),
            Err(error) => {
                warn!(
                    credit_registration_id = %candidate.credit_registration_id,
                    %error,
                    "Could not report a registration to mooc.fi"
                );
                let mut conn = pool.acquire().await?;
                record_report_failure(&mut conn, &candidate, &error).await?;
                tally.record_failure(error);
            }
        }
    }
    Ok(tally.into_counts("mooc.fi registration reports"))
}

/// Posts the candidate unless the lookup shows this registration on mooc.fi already. The inner
/// `Err` is a failed report, to back off; the outer one a database failure, after which the lease
/// lapses and the next try's lookup finds whatever the post did.
async fn report(
    pool: &PgPool,
    delegation: &MoocfiDelegationConfiguration,
    client: &MoocfiClient,
    candidate: &MoocfiReportCandidate,
    lookups: &mut Lookups,
) -> CreditRegistrationResult<Result<(), String>> {
    let completions = match lookups.entry((candidate.user_id, candidate.moocfi_course_id)) {
        Entry::Occupied(entry) => entry.into_mut(),
        Entry::Vacant(entry) => match lookup_and_sync(
            pool,
            delegation,
            client,
            candidate.user_id,
            candidate.moocfi_user_upstream_id,
            candidate.moocfi_course_id,
        )
        .await?
        {
            Ok(completions) => entry.insert(completions),
            Err(error) => return Ok(Err(error)),
        },
    };
    let Some(completion) = completions
        .iter_mut()
        .find(|completion| completion.id == candidate.moocfi_completion_id)
    else {
        return Ok(Err("the completion is no longer on mooc.fi".to_string()));
    };
    if is_on_moocfi(completion, candidate, &delegation.organization_slug) {
        let mut conn = pool.acquire().await?;
        mark_reported(&mut conn, candidate).await?;
        return Ok(Ok(()));
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
    let mut conn = pool.acquire().await?;
    mark_reported(&mut conn, candidate).await?;
    completion
        .registrations
        .push(DelegatedCompletionRegistration {
            organization_slug: Some(delegation.organization_slug.clone()),
            registration_date: Some(candidate.registration_date),
            created_at: chrono::Utc::now(),
        });
    Ok(Ok(()))
}

/// Whether mooc.fi holds our registration of the completion with the candidate's registration
/// date, which is unique among our registrations of the completion and in whole milliseconds, as
/// mooc.fi keeps it.
fn is_on_moocfi(
    completion: &DelegatedCompletion,
    candidate: &MoocfiReportCandidate,
    organization_slug: &str,
) -> bool {
    completion.registrations.iter().any(|registration| {
        registration.organization_slug.as_deref() == Some(organization_slug)
            && registration.registration_date.is_some_and(|date| {
                date.timestamp_millis() == candidate.registration_date.timestamp_millis()
            })
    })
}
