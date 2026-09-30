//! The loop every "claim rows, send one batch, write one answer per row" flow shares: the claim's
//! transaction, splitting a batch the study registry refused as malformed, the halves held back and
//! released when a shutdown or an error stops the split, the refusals, one row's failed write not
//! costing the rest theirs, the moved-on rows and the batch summary. What goes on the wire, request
//! ids, the limiter and the breakers are the registry adapter's.

use chrono::TimeDelta;
use headless_lms_utils::prelude::Utc;
use sqlx::{Connection, PgConnection, PgPool};
use std::time::Instant;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::error_reports::ErrorReporter;
use crate::phase::CreditRegistrationPhase;
use crate::registry::{
    BatchEntry, BatchOptions, BatchReply, BatchRequest, ExchangeAudit, StudyRegistry,
};
use crate::workflow::{Applied, Claimed, Counts, RefusalPolicy, write_decision};
use headless_lms_models::credit_registrations::RegistrationScope;

/// What a [`RegistryBatchFlow`] may touch.
pub(crate) struct BatchFlowContext<'a> {
    pub pool: &'a PgPool,
    pub scope: &'a RegistrationScope,
    pub phase: CreditRegistrationPhase,
    pub errors: ErrorReporter<'a>,
    /// The worker's SIGTERM; `None` for a run no signal can stop, such as an on-demand one.
    pub shutdown: Option<&'a CancellationToken>,
    /// The longest the iteration's study registry calls may take together, which a lease keeping
    /// its rows from a concurrent iteration has to outlast.
    pub study_registry_wait: TimeDelta,
}

/// A flow whose iteration is "claim rows, decide in one transaction what may be asked, send one
/// batch, write one answer per row": `import`, `resolve-enrolments`, and each of `verify`'s two
/// flows. [`run_registry_batch_flow`] is the loop they share. Implementations hold no state.
pub(super) trait RegistryBatchFlow {
    /// What the claim read for each row alongside it, which its answer is applied with.
    type Extra;
    /// What each row asks, which also names the operation it is asked under.
    type Request: BatchRequest;

    /// The iteration's error when every item came back unavailable.
    const ALL_UNAVAILABLE_ERROR: &'static str;
    /// What the rows get when the study registry refused the whole request, which also decides
    /// whether a batch refused as malformed is split.
    const REFUSAL: RefusalPolicy<Self::Extra>;

    /// Claims at most `limit` rows and decides what may be asked about them. Whatever has to be
    /// true before the request leaves is written here, in the caller's transaction.
    async fn claim(
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Extra, Self::Request>>;

    /// Decides what one answer, or the absence of one, does to its row and writes it, with the
    /// exchange behind it. May read and write in transactions of its own on the way.
    async fn apply_answer(
        conn: &mut PgConnection,
        row: &Claimed<Self::Extra>,
        answer: Option<&<Self::Request as BatchRequest>::Answer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied>;

    /// Called before each send after a split, with every row the split still holds, so the ones
    /// waiting their turn are not taken for a worker that died mid-call.
    async fn keep_in_flight(
        _conn: &mut PgConnection,
        _rows: &[&Claimed<Self::Extra>],
    ) -> CreditRegistrationResult<()> {
        Ok(())
    }

    /// Called with every row a split still holds unsent when a shutdown or an error stops the
    /// iteration, each of which would otherwise be condemned as a lost submission.
    async fn release_unsent(
        _conn: &mut PgConnection,
        _rows: &[&Claimed<Self::Extra>],
    ) -> CreditRegistrationResult<()> {
        Ok(())
    }
}

/// What a batch flow's claim settled before anything is sent: the rows to send, each with what it
/// asks, and the rows it already wrote a decision for. Private, so the batch and the preflight's
/// counts only change together through [`Self::send`] and the `record_` methods.
pub(super) struct Prepared<Extra, Request> {
    sendable: Vec<BatchEntry<Claimed<Extra>, Request>>,
    decided: Counts,
}

impl<Extra, Request> Prepared<Extra, Request> {
    pub(super) fn new() -> Self {
        Self {
            sendable: Vec::new(),
            decided: Counts::default(),
        }
    }

    /// Puts `row` in the batch, asking `request`.
    pub(super) fn send(&mut self, row: Claimed<Extra>, request: Request) {
        self.sendable.push(BatchEntry { row, request });
    }

    /// A row the claim failed without asking.
    pub(super) fn record_failed(&mut self) {
        self.decided.record_decided(true);
    }

    /// A row the claim wrote a guarded decision for, which may have found it moved on.
    pub(super) fn record_applied(&mut self, registration_id: Uuid, applied: Applied) {
        self.decided.record_applied(registration_id, applied);
    }

    pub(super) fn sendable(&self) -> &[BatchEntry<Claimed<Extra>, Request>] {
        &self.sendable
    }

    /// The batch, and the counts the claim's own decisions start the iteration with.
    fn into_parts(self) -> (Vec<BatchEntry<Claimed<Extra>, Request>>, Counts) {
        (self.sendable, self.decided)
    }
}

/// One request's rows, still to be sent.
struct PendingBatch<Extra, R> {
    entries: Vec<BatchEntry<Claimed<Extra>, R>>,
    /// Split off a batch refused as malformed.
    is_resent_half: bool,
}

/// What the iteration put on the wire, for the batch summary.
#[derive(Default)]
struct SentTally {
    requests: i32,
    items: i32,
}

/// Runs one [`RegistryBatchFlow`] through the iteration's registry, and logs the batch summary.
///
/// `processed` counts the rows this flow wrote a decision for: the claim's included, the ones
/// another writer had moved on before the answer could be applied excluded.
pub(super) async fn run_registry_batch_flow<F: RegistryBatchFlow, R: StudyRegistry>(
    ctx: &BatchFlowContext<'_>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    let operation = <F::Request as BatchRequest>::OPERATION;
    let limit = registry.allowance(operation);
    if limit == 0 {
        return Ok(Counts::default());
    }
    let started_at = Instant::now();
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let prepared = F::claim(ctx, &mut tx, limit).await?;
    tx.commit().await?;
    // Held only for the claim; the study registry call below can pin it for the whole request
    // timeout.
    drop(conn);

    let (entries, mut counts) = prepared.into_parts();
    let claimed = counts.processed_count()
        + counts.moved_on_count()
        + i32::try_from(entries.len()).unwrap_or(i32::MAX);
    let mut sent = SentTally::default();
    // The halves a split holds back wait in whatever state the claim left them, which for import is
    // `submitting`: no phase claims that, so none of them can be sent twice meanwhile. Each answered
    // half is written before the next one is sent.
    let mut batches = Vec::new();
    if !entries.is_empty() {
        batches.push(PendingBatch {
            entries,
            is_resent_half: false,
        });
    }
    let drained = send_batches::<F, R>(ctx, registry, &mut batches, &mut counts, &mut sent).await;
    // Whatever is left was never sent: a shutdown or an error stopped the split.
    if !batches.is_empty() {
        let released = release_unsent::<F>(ctx, &batches).await;
        match (&drained, released) {
            (Ok(()), released) => released?,
            (Err(_), Ok(())) => {}
            (Err(_), Err(error)) => error!(
                phase = ctx.phase.as_str(),
                error = %error,
                "Could not release the unsent halves of a split batch"
            ),
        }
    }
    drained?;
    if claimed > 0 {
        let written = counts.processed_count();
        let waiting = counts.waiting_count();
        let failed = counts.failed_count();
        let moved_on = counts.moved_on_count();
        let SentTally {
            requests: requests_sent,
            items: items_sent,
        } = sent;
        let duration_ms = started_at.elapsed().as_millis() as u64;
        info!(
            phase = ctx.phase.as_str(),
            ?operation,
            claimed,
            requests_sent,
            items_sent,
            written,
            waiting,
            failed,
            moved_on,
            duration_ms,
            "claimed {claimed}, sent {items_sent} in {requests_sent} requests, wrote {written} \
             ({waiting} waiting, {failed} failed), moved on {moved_on}, took {duration_ms}ms"
        );
    }
    Ok(counts)
}

/// Sends `batches` one after another, splitting the ones refused as malformed, and writes each
/// row's answer. Stops early on shutdown or on an error, leaving what is still unsent in `batches`.
async fn send_batches<F: RegistryBatchFlow, R: StudyRegistry>(
    ctx: &BatchFlowContext<'_>,
    registry: &mut R,
    batches: &mut Vec<PendingBatch<F::Extra, F::Request>>,
    counts: &mut Counts,
    sent: &mut SentTally,
) -> CreditRegistrationResult<()> {
    let operation = <F::Request as BatchRequest>::OPERATION;
    while let Some(batch) = batches.pop() {
        if batch.is_resent_half {
            let may_send = may_resend::<F>(ctx, &batch, batches).await;
            if !matches!(may_send, Ok(true)) {
                // Back on the stack, so it is released with the halves still waiting.
                batches.push(batch);
                return may_send.map(|_| ());
            }
        }
        sent.requests += 1;
        sent.items += i32::try_from(batch.entries.len()).unwrap_or(i32::MAX);
        let options = BatchOptions {
            may_split: F::REFUSAL.may_split(),
            is_resent_half: batch.is_resent_half,
            all_unavailable_error: F::ALL_UNAVAILABLE_ERROR,
            registration_ids: batch
                .entries
                .iter()
                .map(|entry| entry.row.claim.id())
                .collect(),
        };
        match <F::Request as BatchRequest>::send(registry, batch.entries, options).await {
            BatchReply::RefusedAsMalformed {
                entries: mut first,
                error,
            } => {
                warn!(
                    batch_size = first.len(),
                    error = error.message.as_str(),
                    "The study registry refused a batch as a whole; splitting it to find the rows it refuses"
                );
                let second = first.split_off(first.len() / 2);
                // The stack pops the first half first.
                for entries in [second, first] {
                    batches.push(PendingBatch {
                        entries,
                        is_resent_half: true,
                    });
                }
            }
            BatchReply::Refused {
                rows,
                error,
                refused_for,
            } => {
                let mut conn = ctx.pool.acquire().await?;
                for refused in &rows {
                    let decision = F::REFUSAL.decision(
                        &refused.row,
                        operation,
                        &error,
                        refused_for,
                        Utc::now(),
                    );
                    let written =
                        write_decision(&mut conn, &refused.row.claim, decision, &refused.audit)
                            .await;
                    record_row_write(ctx, counts, refused.row.claim.id(), written).await?;
                }
            }
            BatchReply::Answered(rows) => {
                let mut conn = ctx.pool.acquire().await?;
                for answered in &rows {
                    let row = &answered.row;
                    let written =
                        F::apply_answer(&mut conn, row, answered.answer.as_ref(), &answered.audit)
                            .await;
                    record_row_write(ctx, counts, row.claim.id(), written).await?;
                }
            }
        }
    }
    Ok(())
}

/// Before a resent half: `false` once a shutdown is under way, since each half can take the whole
/// request timeout and sending the rest would outlast the termination grace period. Otherwise keeps
/// `next` and every row still `waiting` in flight.
async fn may_resend<F: RegistryBatchFlow>(
    ctx: &BatchFlowContext<'_>,
    next: &PendingBatch<F::Extra, F::Request>,
    waiting: &[PendingBatch<F::Extra, F::Request>],
) -> CreditRegistrationResult<bool> {
    if ctx.shutdown.is_some_and(CancellationToken::is_cancelled) {
        return Ok(false);
    }
    let rows: Vec<_> = std::iter::once(next)
        .chain(waiting)
        .flat_map(|pending| &pending.entries)
        .map(|entry| &entry.row)
        .collect();
    let mut conn = ctx.pool.acquire().await?;
    F::keep_in_flight(&mut conn, &rows).await?;
    Ok(true)
}

async fn release_unsent<F: RegistryBatchFlow>(
    ctx: &BatchFlowContext<'_>,
    batches: &[PendingBatch<F::Extra, F::Request>],
) -> CreditRegistrationResult<()> {
    let rows: Vec<_> = batches
        .iter()
        .flat_map(|pending| &pending.entries)
        .map(|entry| &entry.row)
        .collect();
    let mut conn = ctx.pool.acquire().await?;
    F::release_unsent(&mut conn, &rows).await
}

/// Counts one row's write. A row whose write failed is reported and counted as failed while the
/// batch's other answers are still written: dropping them would leave rows Sisu already answered for
/// to be recovered as uncertain. Only a lost database connection stops the batch.
async fn record_row_write(
    ctx: &BatchFlowContext<'_>,
    counts: &mut Counts,
    registration_id: Uuid,
    written: CreditRegistrationResult<Applied>,
) -> CreditRegistrationResult<()> {
    match written {
        Ok(applied) => counts.record_applied(registration_id, applied),
        Err(error) if error.is_db_disconnect() => return Err(error),
        Err(error) => {
            error!(
                phase = ctx.phase.as_str(),
                credit_registration_id = %registration_id,
                error = %error,
                "Could not write the study registry's answer for a credit registration; leaving it where it stands"
            );
            ctx.errors
                .report(
                    &error.cause_chain(),
                    Some(format!("{error:?}")),
                    serde_json::json!({ "credit_registration_id": registration_id }),
                )
                .await;
            counts.record_decided(true);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;

    use super::*;
    use crate::test_fixtures::registration;
    use crate::workflow::ClaimedRegistration;

    fn claimed() -> Claimed<()> {
        Claimed {
            claim: ClaimedRegistration::left_in_place(registration(State::AwaitingVerification)),
            extra: (),
        }
    }

    #[test]
    fn a_claim_keeps_its_own_decisions_apart_from_the_batch_it_sends() {
        let (first, second) = (claimed(), claimed());
        let ids = [first.claim.id(), second.claim.id()];
        let mut prepared = Prepared::new();
        prepared.send(first, "first");
        prepared.record_failed();
        prepared.send(second, "second");
        prepared.record_applied(
            Uuid::new_v4(),
            Applied::Written {
                is_failure: false,
                is_waiting: false,
            },
        );
        assert_eq!(prepared.sendable().len(), 2);
        let (sendable, decided) = prepared.into_parts();
        let sent: Vec<_> = sendable
            .iter()
            .map(|entry| (entry.row.claim.id(), entry.request))
            .collect();
        assert_eq!(sent, [(ids[0], "first"), (ids[1], "second")]);
        assert_eq!(decided.processed_count(), 2);
        assert_eq!(decided.failed_count(), 1);
        assert_eq!(decided.moved_on_count(), 0);
    }
}
