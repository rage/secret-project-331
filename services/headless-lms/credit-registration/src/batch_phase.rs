//! The loop every "claim rows, send one batch, write one answer per row" flow shares.

use headless_lms_models::credit_registrations::{CreditRegistration, CreditRegistrationState};
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, isolated_malformed_request_outcome, request_level_outcome,
};
use headless_lms_utils::services::suotar::{
    BatchEndpoint, SuotarEndpoint, SuotarError, SuotarErrorVariant, SuotarRequestItem,
    SuotarResponseItem,
};
use itertools::izip;
use sqlx::{Connection, PgConnection};

use crate::apply::{Applied, OutcomeEvent, apply_outcome, row_facts};
use crate::dispatch::{Counts, Iteration};
use crate::error::CreditRegistrationResult;
use crate::study_registry_gate::Exchange;

/// What one iteration of a [`SuotarBatchPhase`] settled before it sent anything.
pub(crate) struct Prepared<Row, Item> {
    /// The rows the batch is built from, each with the request item it became.
    pub sendable: Vec<(Row, Item)>,
    /// Rows the preflight already wrote a decision for, so no answer is owed for them.
    pub decided: i32,
    /// How many of `decided` ended up carrying an error code.
    pub failed: i32,
}

impl<Row, Item> Default for Prepared<Row, Item> {
    fn default() -> Self {
        Self {
            sendable: Vec::new(),
            decided: 0,
            failed: 0,
        }
    }
}

/// The request item of a [`SuotarBatchPhase`].
pub(crate) type ItemOf<P> = <<P as SuotarBatchPhase>::Endpoint as BatchEndpoint>::Item;
/// The per-item result body of a [`SuotarBatchPhase`].
pub(crate) type ResultOf<P> = <<P as SuotarBatchPhase>::Endpoint as BatchEndpoint>::Result;

/// A phase whose iteration is "claim rows, decide in one transaction what may be asked, send one
/// batch, write one answer per row". `import`, `resolve-enrolments`, and each of `verify`'s two
/// flows; [`run_suotar_batch_phase`] is the loop they share, and the only place the transaction
/// shape, the sending, the refusals, the moved-on skipping and the counters are written down.
pub(crate) trait SuotarBatchPhase {
    type Endpoint: BatchEndpoint;
    /// A row to send for, with whatever its preflight read alongside it.
    type Row: AsRef<CreditRegistration>;

    /// The iteration's error when every item came back unavailable.
    const ALL_UNAVAILABLE_ERROR: &'static str;

    /// Claims at most `limit` rows and decides what may be asked about them. Whatever has to be
    /// true before the request leaves is written here, in the caller's transaction.
    async fn claim(
        &mut self,
        it: &Iteration<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, ItemOf<Self>>>;

    /// Applies one answer, or the absence of one, to its row.
    async fn apply(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        item: Option<&SuotarResponseItem<ResultOf<Self>>>,
        event: OutcomeEvent<'_>,
    ) -> CreditRegistrationResult<Applied>;

    /// What one row gets when the study registry refused the whole request.
    fn on_refusal(&self, row: &Self::Row) -> Refusal;

    /// Called before each send after a split, with every row the split still holds, so the ones
    /// waiting their turn are not taken for a worker that died mid-call.
    async fn keep_in_flight(
        &self,
        _conn: &mut PgConnection,
        _rows: &[&Self::Row],
    ) -> CreditRegistrationResult<()> {
        Ok(())
    }

    /// Called on shutdown with every row a split still holds unsent, which would otherwise be
    /// condemned as a lost submission.
    async fn release_unsent(
        &self,
        _conn: &mut PgConnection,
        _rows: &[&Self::Row],
    ) -> CreditRegistrationResult<()> {
        Ok(())
    }
}

/// What a row of a refused request is written as.
pub(crate) enum Refusal {
    /// The shared request-level outcome, with the row expected to still wait in `in_flight`. A
    /// malformed-request refusal proves nothing was acted on, and may be down to one row alone, so
    /// the batch is split in halves until the rows it keeps refusing are alone in theirs.
    RequestLevel { in_flight: CreditRegistrationState },
    /// Whatever the refusal, the row keeps waiting where it is, as `outcome` says: a failure to ask
    /// proves nothing about a submission that may have landed. Never split.
    KeepWaiting {
        outcome: Outcome,
        message: &'static str,
    },
}

/// Runs one flow of a [`SuotarBatchPhase`], spending and recording each request through the
/// iteration's gate.
///
/// `processed` counts the rows this flow wrote a decision for: the claim's included, the ones
/// another writer had moved on before the answer could be applied excluded.
pub(crate) async fn run_suotar_batch_phase<P: SuotarBatchPhase>(
    phase: &mut P,
    it: &mut Iteration<'_>,
) -> CreditRegistrationResult<Counts> {
    let ctx = it.ctx;
    let endpoint = P::Endpoint::ENDPOINT;
    let limit = it.registry.allowance(endpoint);
    if limit == 0 {
        return Ok(Counts::default());
    }
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let prepared = phase.claim(it, &mut tx, limit).await?;
    tx.commit().await?;
    // Held only for the claim; the Suotar call below can pin it for the whole request timeout.
    drop(conn);

    let mut counts = Counts {
        processed: prepared.decided,
        failed: prepared.failed,
        finding: None,
    };
    // The halves a split holds back wait in whatever state the claim left them, which for import is
    // `submitting`: no phase claims that, so none of them can be sent twice meanwhile. Each answered
    // half is written before the next one is sent.
    let mut batches = vec![prepared.sendable];
    let mut has_split = false;
    while let Some(batch) = batches.pop() {
        if batch.is_empty() {
            continue;
        }
        if has_split {
            let held: Vec<&P::Row> = batch
                .iter()
                .chain(batches.iter().flatten())
                .map(|(row, _)| row)
                .collect();
            let mut conn = ctx.pool.acquire().await?;
            // Each half can take the whole request timeout, so sending the rest would outlast the
            // termination grace period.
            if ctx.is_shutting_down() {
                phase.release_unsent(&mut conn, &held).await?;
                break;
            }
            phase.keep_in_flight(&mut conn, &held).await?;
        }
        let (rows, items): (Vec<_>, Vec<_>) = batch.into_iter().unzip();
        let requests = requests_json(&items);
        let request_item_ids: Vec<String> = items
            .iter()
            .map(|item| item.request_item_id().to_string())
            .collect();

        it.registry.spend(endpoint, rows.len());
        let call = it
            .call_context()
            .for_registrations(rows.iter().map(|row| row.as_ref().id).collect());
        let sent = ctx
            .suotar_client
            .post::<P::Endpoint>(call, items.clone())
            .await;
        let response = match sent {
            Ok(response) => response,
            Err(send_error) if isolates(phase, &rows, &send_error) && rows.len() > 1 => {
                warn!(
                    batch_size = rows.len(),
                    error = send_error.message(),
                    "The study registry refused a batch as a whole; splitting it to find the rows it refuses"
                );
                let mut halves: Vec<(P::Row, ItemOf<P>)> = rows
                    .into_iter()
                    .zip(items.into_iter().map(|mut item| {
                        item.renew_request_item_id();
                        item
                    }))
                    .collect();
                let second = halves.split_off(halves.len() / 2);
                batches.push(second);
                batches.push(halves);
                has_split = true;
                continue;
            }
            Err(send_error) => {
                let is_isolated = isolates(phase, &rows, &send_error);
                it.registry.record(
                    endpoint,
                    if is_isolated {
                        Exchange::RefusedAlone(&send_error)
                    } else {
                        Exchange::Refused(&send_error)
                    },
                );
                let mut conn = ctx.pool.acquire().await?;
                for (row, request, request_item_id) in izip!(&rows, &requests, &request_item_ids) {
                    let applied = apply_refusal(
                        &mut conn,
                        endpoint,
                        row.as_ref(),
                        phase.on_refusal(row),
                        is_isolated,
                        OutcomeEvent {
                            error_message: Some(send_error.message()),
                            request_item_id: Some(request_item_id),
                            request: Some(request),
                            ..OutcomeEvent::default()
                        },
                        &send_error,
                    )
                    .await?;
                    count_applied(applied, row.as_ref(), &mut counts);
                }
                continue;
            }
        };
        it.registry.record(
            endpoint,
            Exchange::answered(&response, P::ALL_UNAVAILABLE_ERROR),
        );

        let mut conn = ctx.pool.acquire().await?;
        for (row, item, request, request_item_id) in
            izip!(&rows, &items, &requests, &request_item_ids)
        {
            let response_json = response_item_json(&response.raw_response, request_item_id);
            let event = OutcomeEvent {
                suotar_api_call_id: response.call_id,
                request_item_id: Some(request_item_id),
                request: Some(request),
                response: response_json.as_ref(),
                sent_student_number: item.student_number(),
                ..OutcomeEvent::default()
            };
            let applied = phase
                .apply(&mut conn, row, response.item(request_item_id), event)
                .await?;
            count_applied(applied, row.as_ref(), &mut counts);
        }
    }
    Ok(counts)
}

/// Counts one written row, or skips one that had already moved on.
fn count_applied(applied: Applied, row: &CreditRegistration, counts: &mut Counts) {
    match applied {
        Applied::Written { is_failure } => {
            counts.processed += 1;
            counts.failed += i32::from(is_failure);
        }
        Applied::MovedOn { found } => {
            warn!(
                credit_registration_id = %row.id,
                found_state = ?found,
                "Credit registration moved on while the study registry answered; leaving it"
            );
        }
    }
}

/// The request bodies as sent, kept alongside the typed items so a rejected batch can pair each row
/// with what was actually asked of it for the audit log.
pub(crate) fn requests_json<T: serde::Serialize>(items: &[T]) -> Vec<serde_json::Value> {
    items
        .iter()
        .map(|item| serde_json::to_value(item).unwrap_or_default())
        .collect()
}

/// The response item for one request item, read from the raw body rather than rebuilt from the
/// typed value, so the audit trail holds what actually arrived.
pub(crate) fn response_item_json(
    raw_response: &serde_json::Value,
    request_item_id: &str,
) -> Option<serde_json::Value> {
    raw_response
        .as_array()?
        .iter()
        .find(|item| item.get("requestItemId").and_then(|id| id.as_str()) == Some(request_item_id))
        .cloned()
}

/// Whether a refusal of this batch is one some of its rows alone may have caused, and that proves
/// nothing was acted on: Suotar validates every item before acting on any, so one bad row takes
/// its whole batch down with a malformed-request refusal.
fn isolates<P: SuotarBatchPhase>(phase: &P, rows: &[P::Row], error: &SuotarError) -> bool {
    error.variant == SuotarErrorVariant::MalformedRequest
        && rows
            .iter()
            .all(|row| matches!(phase.on_refusal(row), Refusal::RequestLevel { .. }))
}

/// Writes what `refusal` says to one row of a refused request. `is_isolated` when a malformed
/// request was refused even with the row alone in it, which resending cannot fix, so it needs a
/// human.
async fn apply_refusal(
    conn: &mut PgConnection,
    endpoint: SuotarEndpoint,
    row: &CreditRegistration,
    refusal: Refusal,
    is_isolated: bool,
    event: OutcomeEvent<'_>,
    error: &SuotarError,
) -> CreditRegistrationResult<Applied> {
    // `in_flight` is the state the phase's own claim put the row in: the row was read before that
    // move, so its own state is stale by now.
    let (outcome, message, expected_from_state) = match refusal {
        Refusal::RequestLevel { in_flight } if is_isolated => (
            isolated_malformed_request_outcome(),
            "Sisu did not accept this row even when it was sent alone.",
            in_flight,
        ),
        Refusal::RequestLevel { in_flight } => (
            request_level_outcome(endpoint, error.variant, &row_facts(row)),
            "Sisu did not accept the whole request.",
            in_flight,
        ),
        Refusal::KeepWaiting { outcome, message } => (outcome, message, row.state),
    };
    apply_outcome(
        conn,
        row,
        &outcome,
        OutcomeEvent {
            message: Some(message),
            ..event
        },
        Some(expected_from_state),
    )
    .await
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
