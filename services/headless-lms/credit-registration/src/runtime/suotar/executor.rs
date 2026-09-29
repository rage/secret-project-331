//! Sending one batch of a worker flow: fresh request ids, the limiter, the call, the gate record,
//! and pairing each row with its answer and audit.

use chrono::Utc;
use headless_lms_utils::services::suotar::{
    BatchEndpoint, SuotarErrorVariant, SuotarRequestItem, SuotarResponseItem, new_request_item_id,
};
use tracing::Instrument;

use super::SuotarStudyRegistry;
use super::decode::registry_error;
use super::gate::Exchange;
use crate::registry::{
    AnsweredRow, BatchEntry, BatchOptions, BatchReply, ExchangeAudit, RefusedFor, RefusedRow,
    StudentNumber,
};

/// Sends `entries` in one request to `E`, every item under a fresh requestItemId, a resent half's
/// included.
pub(super) async fn send_batch<E: BatchEndpoint, K, R, A>(
    registry: &mut SuotarStudyRegistry<'_>,
    entries: Vec<BatchEntry<K, R>>,
    options: BatchOptions,
    encode: impl Fn(&R, String) -> E::Item,
    decode: impl Fn(&SuotarResponseItem<E::Result>) -> A,
) -> BatchReply<K, R, A> {
    let endpoint = E::ENDPOINT;
    let items: Vec<E::Item> = entries
        .iter()
        .map(|entry| encode(&entry.request, new_request_item_id()))
        .collect();
    let requests = requests_json(&items);
    let sent_items: Vec<SentItem> = items
        .iter()
        .map(|item| SentItem {
            request_item_id: item.request_item_id().to_string(),
            student_number: item.student_number().cloned().map(StudentNumber::new),
        })
        .collect();
    let item_count = items.len();
    if options.is_resent_half {
        registry.gate.spend_split(endpoint, item_count);
    } else {
        registry.gate.spend(endpoint, item_count);
    }
    let context = registry.call_context(options.registration_ids);
    let span = super::request_span(endpoint, item_count);
    if options.is_resent_half {
        span.record("resent_half", true);
    }
    let requested_at = Utc::now();
    let sent = registry
        .client
        .post::<E>(context, items)
        .instrument(span)
        .await;
    let answered_at = Utc::now();
    let response = match sent {
        Ok(response) => response,
        Err(error) => {
            // Suotar validates every item before acting on any, so one bad row takes its whole
            // batch down with a malformed-request refusal, and that refusal proves nothing was
            // acted on.
            let is_isolated =
                error.variant == SuotarErrorVariant::MalformedRequest && options.may_split;
            if is_isolated && item_count > 1 {
                return BatchReply::RefusedAsMalformed {
                    entries,
                    error: registry_error(&error),
                };
            }
            let refused_for = if is_isolated {
                registry
                    .gate
                    .record(endpoint, Exchange::RefusedAlone(&error));
                RefusedFor::RowAlone
            } else {
                registry.gate.record(endpoint, Exchange::Refused(&error));
                RefusedFor::WholeBatch
            };
            let rows = entries
                .into_iter()
                .zip(sent_items)
                .zip(requests)
                .map(|((entry, sent), request)| RefusedRow {
                    row: entry.row,
                    audit: ExchangeAudit {
                        call_id: None,
                        endpoint,
                        requested_at,
                        answered_at,
                        request_item_id: sent.request_item_id,
                        request,
                        response: None,
                        sent_student_number: None,
                    },
                })
                .collect();
            return BatchReply::Refused {
                rows,
                error: registry_error(&error),
                refused_for,
            };
        }
    };
    registry.gate.record(
        endpoint,
        Exchange::answered(&response, options.all_unavailable_error),
    );
    let rows = entries
        .into_iter()
        .zip(sent_items)
        .zip(requests)
        .map(|((entry, sent), request)| {
            let request_item_id = sent.request_item_id;
            AnsweredRow {
                row: entry.row,
                answer: response.item(&request_item_id).map(&decode),
                audit: ExchangeAudit {
                    call_id: response.call_id,
                    endpoint,
                    requested_at,
                    answered_at,
                    response: response_item_json(&response.raw_response, &request_item_id),
                    request_item_id,
                    request,
                    sent_student_number: sent.student_number,
                },
            }
        })
        .collect();
    BatchReply::Answered(rows)
}

/// What the audit needs of one item after the items themselves went into the request.
struct SentItem {
    request_item_id: String,
    student_number: Option<StudentNumber>,
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
