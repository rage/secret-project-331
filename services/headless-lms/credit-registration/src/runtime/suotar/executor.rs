//! Sending one batch of a worker flow: fresh request ids, the limiter, the call, splitting a
//! malformed-request refusal, the gate record, and pairing each row with its answer and audit.

use headless_lms_utils::services::suotar::{
    BatchEndpoint, SuotarErrorVariant, SuotarRequestItem, SuotarResponseItem, new_request_item_id,
};
use tracing::Instrument;

use super::SuotarStudyRegistry;
use super::decode::registry_error;
use super::gate::Exchange;
use crate::registry::{
    AnsweredRow, BatchReply, ExchangeAudit, RefusedRow, RequestBatch, StudentNumber,
};

/// Sends `batch` in one request to `E`, every item under a fresh requestItemId, a split half's
/// included.
pub(super) async fn send_batch<E: BatchEndpoint, K, R, A>(
    registry: &mut SuotarStudyRegistry<'_>,
    batch: RequestBatch<K, R>,
    encode: impl Fn(&R, String) -> E::Item,
    decode: impl Fn(&SuotarResponseItem<E::Result>) -> A,
) -> BatchReply<K, R, A> {
    let endpoint = E::ENDPOINT;
    let items: Vec<E::Item> = batch
        .entries()
        .iter()
        .map(|entry| encode(&entry.request, new_request_item_id()))
        .collect();
    let requests = requests_json(&items);
    if batch.is_resent_half() {
        registry.spend_split(endpoint, items.len());
    } else {
        registry.spend(endpoint, items.len());
    }
    let context = registry.call_context().for_registrations(
        batch
            .entries()
            .iter()
            .map(|entry| entry.registration_id)
            .collect(),
    );
    let span = super::request_span(endpoint, items.len(), batch.is_resent_half());
    let sent = registry
        .client
        .post::<E>(context, items.clone())
        .instrument(span)
        .await;
    let response = match sent {
        Ok(response) => response,
        Err(error) => {
            // Suotar validates every item before acting on any, so one bad row takes its whole
            // batch down with a malformed-request refusal, and that refusal proves nothing was
            // acted on.
            let is_isolated =
                error.variant == SuotarErrorVariant::MalformedRequest && batch.may_split();
            if is_isolated && items.len() > 1 {
                warn!(
                    batch_size = items.len(),
                    error = error.message(),
                    "The study registry refused a batch as a whole; splitting it to find the rows it refuses"
                );
                let (first, second) = batch.split();
                return BatchReply::Split { first, second };
            }
            registry.record(
                endpoint,
                if is_isolated {
                    Exchange::RefusedAlone(&error)
                } else {
                    Exchange::Refused(&error)
                },
            );
            let rows = batch
                .into_entries()
                .into_iter()
                .zip(items)
                .zip(requests)
                .map(|((entry, item), request)| RefusedRow {
                    entry,
                    audit: ExchangeAudit {
                        call_id: None,
                        request_item_id: item.request_item_id().to_string(),
                        request,
                        response: None,
                        sent_student_number: None,
                    },
                })
                .collect();
            return BatchReply::Refused {
                rows,
                error: registry_error(&error),
                is_isolated,
            };
        }
    };
    registry.record(
        endpoint,
        Exchange::answered(&response, batch.all_unavailable_error()),
    );
    let rows = batch
        .into_entries()
        .into_iter()
        .zip(items)
        .zip(requests)
        .map(|((entry, item), request)| {
            let request_item_id = item.request_item_id().to_string();
            AnsweredRow {
                entry,
                answer: response.item(&request_item_id).map(&decode),
                audit: ExchangeAudit {
                    call_id: response.call_id,
                    response: response_item_json(&response.raw_response, &request_item_id),
                    request_item_id,
                    request,
                    sent_student_number: item.student_number().cloned().map(StudentNumber::new),
                },
            }
        })
        .collect();
    BatchReply::Answered(rows)
}

/// The request bodies as sent, kept alongside the typed items so a rejected batch can pair each row
/// with what was actually asked of it for the audit log.
fn requests_json<T: serde::Serialize>(items: &[T]) -> Vec<serde_json::Value> {
    items
        .iter()
        .map(|item| serde_json::to_value(item).unwrap_or_default())
        .collect()
}

/// The response item for one request item, read from the raw body rather than rebuilt from the
/// typed value, so the audit trail holds what actually arrived.
fn response_item_json(
    raw_response: &serde_json::Value,
    request_item_id: &str,
) -> Option<serde_json::Value> {
    raw_response
        .as_array()?
        .iter()
        .find(|item| item.get("requestItemId").and_then(|id| id.as_str()) == Some(request_item_id))
        .cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_response_item_is_found_by_its_request_item_id() {
        let raw = serde_json::json!([
            { "requestItemId": "item-1", "status": "ok", "code": "sent" },
            { "requestItemId": "item-2", "status": "error", "code": "sisuTimeout" },
        ]);
        assert_eq!(
            response_item_json(&raw, "item-2").and_then(|item| item
                .get("code")
                .and_then(|code| code.as_str().map(str::to_string))),
            Some("sisuTimeout".to_string())
        );
        assert_eq!(response_item_json(&raw, "item-9"), None);
    }
}
