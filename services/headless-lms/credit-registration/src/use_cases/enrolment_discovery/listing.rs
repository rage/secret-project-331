//! Sending one listing request, and recording what its enrolment lists, or its failure, say about
//! each code.

use headless_lms_models::course_module_suotar_configurations::mark_listing_failed;
use headless_lms_models::credit_registration_roster_schedules::{
    mark_alone_failed, mark_attempted, mark_batch_failed, mark_fetched,
};
use headless_lms_models::credit_registrations::CreditRegistrationErrorCode;
use headless_lms_models::library::credit_registration::outcomes::request_level_code;
use headless_lms_models::library::credit_registration::study_registry::RosterPerson;
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

/// What one listing request did.
pub(super) struct FetchedRosters {
    pub counts: Counts,
    /// Linking emails claimed, which the `link-emails` phase still has to send.
    pub new_mail_count: i32,
}

/// Sends one listing request and reconciles what came back.
pub(super) async fn fetch_course_roster<R: StudyRegistry>(
    pool: &PgPool,
    registry: &mut R,
    request: &[CodeListing],
    account_linking_since: Option<DateTime<Utc>>,
) -> CreditRegistrationResult<FetchedRosters> {
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
            return Ok(FetchedRosters {
                counts: Counts::all_failed(attempted),
                new_mail_count: 0,
            });
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
                let previous_fetch_at =
                    mark_fetched(&mut conn, course_code, person_count, duration_ms).await?;
                log_surfaced_enrolments(course_code, people, previous_fetch_at);
            }
            Err(error) => {
                let error = *error;
                items_failed += i32::try_from(listing.modules.len()).unwrap_or(i32::MAX);
                for module in &listing.modules {
                    mark_listing_failed(&mut conn, module.course_module_id, error).await?;
                }
                // Not one to back off from: a new realisation can open at any time.
                if error == NO_REALISATION_CODE {
                    mark_fetched(&mut conn, course_code, 0, duration_ms).await?;
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
    Ok(FetchedRosters {
        counts: Counts::processed_with_failures(attempted, items_failed),
        new_mail_count: new_mails,
    })
}

/// Logs each enrolment made since the code's previous fetch with the fetches it surfaced between,
/// which brackets how long Suotar's copy of Sisu takes to show an enrolment.
fn log_surfaced_enrolments(
    course_code: &str,
    people: &[RosterPerson],
    previous_fetch_at: Option<DateTime<Utc>>,
) {
    let Some(previous_fetch_at) = previous_fetch_at else {
        return;
    };
    let fetched_at = Utc::now();
    for enrolled_at in people
        .iter()
        .filter_map(RosterPerson::enrolled_at)
        .filter(|enrolled_at| *enrolled_at > previous_fetch_at)
    {
        info!(
            course_code,
            %enrolled_at,
            %previous_fetch_at,
            %fetched_at,
            surfaced_within_secs = (fetched_at - enrolled_at).num_seconds(),
            "enrolment surfaced on the enrolment list"
        );
    }
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
