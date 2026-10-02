//! Validating course codes with `course-codes/validate`, as many per request as the allowance lets.

use headless_lms_utils::services::suotar::{
    SuotarEndpoint, ValidateCourseCodeRequestItem, endpoints, new_request_item_id,
};
use tracing::Instrument;

use super::SuotarStudyRegistry;
use super::decode::{course_code_verdict, registry_error};
use super::encode::course_code_item;
use super::gate::Exchange;
use crate::registry::{
    CourseCode, CourseCodeVerdicts, RegistryError, RegistryOperation, StudyRegistry,
};

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ValidateCourseCodes;

pub(super) async fn validate(
    registry: &mut SuotarStudyRegistry<'_>,
    codes: &[CourseCode],
) -> Result<CourseCodeVerdicts, RegistryError> {
    let mut verdicts = CourseCodeVerdicts::new();
    let mut unchecked = codes;
    while !unchecked.is_empty() {
        let allowance = registry.allowance(RegistryOperation::ValidateCourseCodes);
        if allowance == 0 {
            break;
        }
        let (chunk, rest) = unchecked.split_at(allowance.min(unchecked.len()));
        unchecked = rest;
        let items: Vec<ValidateCourseCodeRequestItem> = chunk
            .iter()
            .map(|course_code| course_code_item(course_code, new_request_item_id()))
            .collect();
        let request_item_ids: Vec<String> = items
            .iter()
            .map(|item| item.request_item_id.clone())
            .collect();
        registry.gate.spend(ENDPOINT, items.len());
        let span = super::request_span(ENDPOINT, items.len());
        let response = registry
            .client
            .post::<endpoints::ValidateCourseCodes>(registry.call_context(Vec::new()), items)
            .instrument(span)
            .await;
        let response = match response {
            Ok(response) => response,
            Err(error) => {
                registry.gate.record(ENDPOINT, Exchange::Refused(&error));
                debug!(
                    checked = verdicts.len(),
                    remaining = unchecked.len(),
                    "Stopped checking Suotar course codes after a refusal"
                );
                return Err(registry_error(&error));
            }
        };
        registry.gate.record(
            ENDPOINT,
            Exchange::answered(
                &response,
                "Every course code of the batch came back unavailable.",
            ),
        );
        for (course_code, request_item_id) in chunk.iter().zip(&request_item_ids) {
            if let Some(verdict) = response.item(request_item_id).and_then(course_code_verdict) {
                verdicts.insert(course_code.clone(), verdict);
            }
        }
    }
    Ok(verdicts)
}
