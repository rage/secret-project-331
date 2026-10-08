//! Sending one listing request, and recording what its rosters, or its failure, say about each
//! code.

use headless_lms_models::course_module_suotar_configurations::mark_listing_failed;
use headless_lms_models::credit_registration_roster_schedules::{
    mark_alone_failed, mark_attempted, mark_batch_failed, mark_fetched, mark_window_closed,
};
use headless_lms_models::credit_registrations::CreditRegistrationErrorCode;
use headless_lms_models::library::credit_registration::outcomes::request_level_code;
use headless_lms_utils::prelude::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};

use super::CodeListing;
use super::reconcile::reconcile_roster;
use crate::error::CreditRegistrationResult;
use crate::registry::{RegistryError, RosterCode, StudyRegistry};
use crate::workflow::Counts;

/// The code Suotar answers for a code it holds no realisation of, which it stops holding two months
/// after the last one ends.
const NO_REALISATION_CODE: CreditRegistrationErrorCode =
    CreditRegistrationErrorCode::CourseCodeNotFound;

/// Sends one listing request and reconciles what came back.
pub(super) async fn fetch_course_roster<R: StudyRegistry>(
    pool: &PgPool,
    registry: &mut R,
    request: &[CodeListing],
    account_linking_since: Option<DateTime<Utc>>,
) -> CreditRegistrationResult<Counts> {
    let codes: Vec<String> = request
        .iter()
        .map(|listing| listing.code.course_code.as_str().to_string())
        .collect();
    let module_count: usize = request.iter().map(|listing| listing.modules.len()).sum();
    let attempted = i32::try_from(module_count).unwrap_or(i32::MAX);
    {
        let mut conn = pool.acquire().await?;
        mark_attempted(&mut conn, &codes).await?;
    }
    let roster_codes: Vec<RosterCode> =
        request.iter().map(|listing| listing.code.clone()).collect();
    let listed = registry.list_course_roster(&roster_codes).await;
    let mut conn = pool.acquire().await?;
    let roster_listing = match listed {
        Ok(roster_listing) => roster_listing,
        Err(error) => {
            record_roster_failure(&mut conn, request, &codes, &error).await?;
            return Ok(Counts::all_failed(attempted));
        }
    };

    let duration_ms = i32::try_from(roster_listing.duration.as_millis()).unwrap_or(i32::MAX);
    let mut items_failed = 0;
    let mut enrolments = 0;
    let mut new_mails = 0;
    // The registry answers one roster per requested code, in request order.
    for (listing, roster) in request.iter().zip(&roster_listing.rosters) {
        let course_code = listing.code.course_code.as_str();
        match roster {
            Ok(people) => {
                new_mails +=
                    reconcile_roster(&mut conn, listing, people, account_linking_since).await?;
                let person_count = i32::try_from(people.len()).unwrap_or(i32::MAX);
                enrolments += person_count;
                mark_fetched(&mut conn, course_code, person_count, duration_ms).await?;
            }
            Err(error) => {
                let error = *error;
                items_failed += i32::try_from(listing.modules.len()).unwrap_or(i32::MAX);
                for module in &listing.modules {
                    mark_listing_failed(&mut conn, module.course_module_id, error).await?;
                }
                if error == NO_REALISATION_CODE {
                    mark_window_closed(&mut conn, course_code).await?;
                } else {
                    mark_alone_failed(&mut conn, course_code, error).await?;
                }
            }
        }
    }
    let codes = request.len();
    info!(
        codes,
        enrolments,
        new_mails,
        duration_ms,
        "fetched roster: {enrolments} enrolments for {codes} codes, {new_mails} new"
    );
    Ok(Counts::processed_with_failures(attempted, items_failed))
}

/// A request Suotar failed as a whole. Suotar fails every code of a request when one fails, so the
/// codes of a failed batch are listed on their own from now on, and a code that fails alone backs
/// off.
async fn record_roster_failure(
    conn: &mut PgConnection,
    request: &[CodeListing],
    codes: &[String],
    error: &RegistryError,
) -> CreditRegistrationResult<()> {
    let code = request_level_code(error.kind);
    for module in request.iter().flat_map(|listing| &listing.modules) {
        mark_listing_failed(conn, module.course_module_id, code).await?;
    }
    if !error.blames_request_items() {
        return Ok(());
    }
    match request {
        [only] => mark_alone_failed(conn, only.code.course_code.as_str(), code).await?,
        _ => mark_batch_failed(conn, codes, code).await?,
    }
    Ok(())
}
