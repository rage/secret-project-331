//! Course rosters from `list-by-course`: planning a worker iteration's requests, sending one, and
//! the interactive search behind a linking mail resend.

use futures::future::join_all;
use headless_lms_utils::services::suotar::{
    ListByCourseRequestItem, SuotarEndpoint, SuotarItemStatus, endpoints, new_request_item_id,
};
use secrecy::ExposeSecret;
use tracing::Instrument;

use super::SuotarStudyRegistry;
use super::decode::{registry_error, roster, roster_person};
use super::encode::roster_item;
use super::gate::Exchange;
use crate::registry::{
    CourseCode, RegistryError, RosterCode, RosterListing, RosterSearch, StudentNumber,
};

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ListByCourse;

pub(super) fn plan_requests(
    due: Vec<RosterCode>,
    request_limit: usize,
    is_probe: bool,
) -> Vec<Vec<RosterCode>> {
    let batch_size = ENDPOINT.max_batch_size();
    let mut requests: Vec<Vec<RosterCode>> = Vec::new();
    let mut open_batch: Option<usize> = None;
    for code in due {
        if code.is_fetched_alone {
            requests.push(vec![code]);
            continue;
        }
        match open_batch {
            Some(index) if requests[index].len() < batch_size => requests[index].push(code),
            _ => {
                open_batch = Some(requests.len());
                requests.push(vec![code]);
            }
        }
    }
    requests.truncate(request_limit);
    if is_probe && let Some(probe) = requests.first_mut() {
        probe.truncate(1);
    }
    requests
}

pub(super) async fn list(
    registry: &mut SuotarStudyRegistry<'_>,
    request: &[RosterCode],
) -> Result<RosterListing, RegistryError> {
    registry.spend(ENDPOINT, 1);
    let items: Vec<ListByCourseRequestItem> = request
        .iter()
        .map(|code| roster_item(&code.course_code, new_request_item_id()))
        .collect();
    let request_item_ids: Vec<String> = items
        .iter()
        .map(|item| item.request_item_id.clone())
        .collect();
    let span = super::request_span(ENDPOINT, items.len(), false);
    let response = registry
        .client
        .post::<endpoints::ListByCourse>(registry.call_context(), items)
        .instrument(span)
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            let refusal = registry_error(&error);
            // An outage fails a code listed alone as surely as a batch, so it still counts as one.
            let is_known_bad_code = matches!(request, [only] if only.is_fetched_alone)
                && refusal.blames_request_items()
                && !error.variant.is_transient();
            registry.record(
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
    registry.record(
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

pub(super) async fn search(
    registry: &SuotarStudyRegistry<'_>,
    codes: Vec<CourseCode>,
    student_number: &StudentNumber,
) -> RosterSearch {
    // One code per call, all at once: Suotar looks the codes of one call up one after another, and
    // the caller is waiting in the browser, so only a single code has a chance of answering within
    // the interactive timeout.
    let responses = join_all(codes.iter().map(|course_code| {
        let span = super::request_span(ENDPOINT, 1, false);
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
