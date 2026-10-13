//! Course rosters from `list-by-course`: one request of a worker iteration, and the interactive
//! search behind a linking mail resend.

use futures::future::join_all;
use headless_lms_models::credit_registrations::CreditRegistrationErrorCode;
use headless_lms_models::library::credit_registration::study_registry::RosterPerson;
use headless_lms_utils::services::suotar::{
    ListByCourseRequestItem, SuotarEndpoint, SuotarItemStatus, endpoints, new_request_item_id,
};
use secrecy::ExposeSecret;
use tracing::Instrument;

use super::decode::{registry_error, roster, roster_person};
use super::encode::roster_item;
use super::gate::Exchange;
use super::{InteractiveSuotar, SuotarStudyRegistry};
use crate::registry::{
    CourseCode, RegistryError, RosterCode, RosterListing, RosterSearch, StudentNumber,
};

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ListByCourse;

pub(super) async fn list(
    registry: &mut SuotarStudyRegistry<'_>,
    request: &[RosterCode],
) -> Result<RosterListing, RegistryError> {
    registry.gate.spend(ENDPOINT, 1);
    let items: Vec<ListByCourseRequestItem> = request
        .iter()
        .map(|code| roster_item(&code.course_code, new_request_item_id()))
        .collect();
    let request_item_ids: Vec<String> = items
        .iter()
        .map(|item| item.request_item_id.clone())
        .collect();
    let span = super::request_span(ENDPOINT, items.len());
    let response = registry
        .client
        .post::<endpoints::ListByCourse>(registry.call_context(Vec::new()), items)
        .instrument(span)
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            let refusal = registry_error(&error);
            // An outage fails a code listed alone as surely as a batch, so it still counts as one.
            let is_known_bad_code = matches!(request, [only] if only.is_fetched_alone)
                && refusal.blames_request_items()
                && !refusal.kind.is_outage();
            registry.gate.record(
                ENDPOINT,
                if is_known_bad_code {
                    Exchange::RefusedAlone(&error)
                } else {
                    Exchange::Refused(&error)
                },
            );
            return Err(refusal);
        }
    };
    registry.gate.record(
        ENDPOINT,
        Exchange::answered(
            &response,
            "Every course code of the batch came back unavailable.",
        ),
    );
    Ok(RosterListing {
        duration: response.duration,
        rosters: request
            .iter()
            .zip(&request_item_ids)
            .map(|(code, request_item_id)| roster(&response, request_item_id, &code.course_code))
            .collect(),
    })
}

pub(super) async fn fetch_one(
    registry: &InteractiveSuotar<'_>,
    course_code: &CourseCode,
) -> Option<Vec<RosterPerson>> {
    let request_item_id = new_request_item_id();
    let span = super::request_span(ENDPOINT, 1);
    let response = registry
        .client
        .post::<endpoints::ListByCourse>(
            registry.call_context(),
            vec![roster_item(course_code, request_item_id.clone())],
        )
        .instrument(span)
        .await
        .inspect_err(|error| {
            warn!(error = %error, "Could not list a course code's roster for an admin");
        })
        .ok()?;
    match roster(&response, &request_item_id, course_code) {
        Ok(people) => Some(people),
        Err(CreditRegistrationErrorCode::CourseCodeNotFound) => Some(Vec::new()),
        Err(_) => None,
    }
}

pub(super) async fn search(
    registry: &InteractiveSuotar<'_>,
    codes: &[CourseCode],
    student_number: &StudentNumber,
) -> RosterSearch {
    // One code per call, all at once: Suotar looks the codes of one call up one after another, and
    // the caller is waiting in the browser, so only a single code has a chance of answering within
    // the interactive timeout.
    let responses = join_all(codes.iter().map(|course_code| {
        let span = super::request_span(ENDPOINT, 1);
        registry
            .client
            .post::<endpoints::ListByCourse>(
                registry.call_context(),
                vec![roster_item(course_code, new_request_item_id())],
            )
            .instrument(span)
    }))
    .await;
    let mut has_unanswered_code = false;
    let mut person = None;
    for response in responses {
        let response = match response {
            Ok(response) => response,
            Err(error) => {
                warn!(
                    error = %error,
                    "Could not list a course code's roster for a linking mail resend"
                );
                has_unanswered_code = true;
                continue;
            }
        };
        person = person.or_else(|| {
            response
                .items
                .iter()
                .filter(|item| item.status == SuotarItemStatus::Ok)
                .filter_map(|item| item.result.as_ref())
                .flat_map(|result| result.people.iter())
                .find(|candidate| {
                    candidate.student_number.expose_secret() == student_number.expose()
                })
                .map(roster_person)
        });
    }
    RosterSearch {
        person,
        has_unanswered_code,
    }
}
