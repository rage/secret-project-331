//! The loop every "claim rows, send one batch, write one answer per row" flow shares.

use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use headless_lms_utils::prelude::Utc;
use sqlx::{Connection, PgConnection};
use std::time::Instant;
use tokio_util::sync::CancellationToken;

use crate::domain::{Applied, ClaimedRegistration, Counts, Prepared, Refusal, refusal_decision};
use crate::error::CreditRegistrationResult;
use crate::registry::{BatchReply, ExchangeAudit, RequestBatch, StudyRegistry};
use crate::use_cases::contexts::BatchFlowContext;
use crate::use_cases::persist::write_decision;

/// A flow whose iteration is "claim rows, decide in one transaction what may be asked, send one
/// batch, write one answer per row". `import`, `resolve-enrolments`, and each of `verify`'s two
/// flows; [`run_registry_batch_flow`] is the loop they share, and the only place the transaction
/// shape, the sending, the refusals, the moved-on skipping and the counters are written down.
pub(super) trait RegistryBatchFlow {
    /// A claimed row to send for, with whatever its preflight read alongside it.
    type Row: AsRef<ClaimedRegistration>;
    type Request;
    type Answer;

    const ENDPOINT: SuotarEndpoint;
    /// Whether a whole-request refusal may be split to find the one row it blames: true exactly
    /// when [`Self::on_refusal`] returns [`Refusal::RequestLevel`] for every row.
    const MAY_SPLIT: bool;
    /// The iteration's error when every item came back unavailable.
    const ALL_UNAVAILABLE_ERROR: &'static str;

    /// Claims at most `limit` rows and decides what may be asked about them. Whatever has to be
    /// true before the request leaves is written here, in the caller's transaction.
    async fn claim(
        &mut self,
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, Self::Request>>;

    /// Sends one batch through the registry operation this flow asks.
    async fn send<R: StudyRegistry>(
        registry: &mut R,
        batch: RequestBatch<Self::Row, Self::Request>,
    ) -> BatchReply<Self::Row, Self::Request, Self::Answer>;

    /// Writes one answer, or the absence of one, to its row, with the exchange behind it.
    async fn persist_answer(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        answer: Option<&Self::Answer>,
        audit: &ExchangeAudit,
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

/// Runs one [`RegistryBatchFlow`] through the iteration's registry, and logs the batch summary.
///
/// `processed` counts the rows this flow wrote a decision for: the claim's included, the ones
/// another writer had moved on before the answer could be applied excluded.
pub(super) async fn run_registry_batch_flow<F: RegistryBatchFlow, R: StudyRegistry>(
    flow: &mut F,
    ctx: &BatchFlowContext<'_>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    let endpoint = F::ENDPOINT;
    let limit = registry.allowance(endpoint);
    if limit == 0 {
        return Ok(Counts::default());
    }
    let started_at = Instant::now();
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let prepared = flow.claim(ctx, &mut tx, limit).await?;
    tx.commit().await?;
    // Held only for the claim; the study registry call below can pin it for the whole request
    // timeout.
    drop(conn);

    let (entries, mut counts) = prepared.into_parts();
    let claimed = counts.processed_count() + i32::try_from(entries.len()).unwrap_or(i32::MAX);
    let mut requests_sent = 0;
    let mut items_sent = 0;
    let may_split = F::MAY_SPLIT;
    // The halves a split holds back wait in whatever state the claim left them, which for import is
    // `submitting`: no phase claims that, so none of them can be sent twice meanwhile. Each answered
    // half is written before the next one is sent.
    let mut batches = vec![RequestBatch::new(
        entries,
        may_split,
        F::ALL_UNAVAILABLE_ERROR,
    )];
    while let Some(batch) = batches.pop() {
        if batch.entries().is_empty() {
            continue;
        }
        if batch.is_resent_half() {
            let held: Vec<&F::Row> = batch
                .entries()
                .iter()
                .chain(batches.iter().flat_map(RequestBatch::entries))
                .map(|entry| &entry.row)
                .collect();
            let mut conn = ctx.pool.acquire().await?;
            // Each half can take the whole request timeout, so sending the rest would outlast the
            // termination grace period.
            if ctx.shutdown.is_some_and(CancellationToken::is_cancelled) {
                flow.release_unsent(&mut conn, &held).await?;
                break;
            }
            flow.keep_in_flight(&mut conn, &held).await?;
        }
        requests_sent += 1;
        items_sent += i32::try_from(batch.entries().len()).unwrap_or(i32::MAX);
        match F::send(registry, batch).await {
            BatchReply::Split { first, second } => {
                batches.push(second);
                batches.push(first);
            }
            BatchReply::Refused {
                rows,
                error,
                is_isolated,
            } => {
                let mut conn = ctx.pool.acquire().await?;
                for refused in &rows {
                    let claim = refused.entry.row.as_ref();
                    let decision = refusal_decision(
                        endpoint,
                        claim,
                        flow.on_refusal(&refused.entry.row),
                        &error,
                        is_isolated,
                        Utc::now(),
                    );
                    let applied =
                        write_decision(&mut conn, claim, decision, &refused.audit).await?;
                    counts.record_applied(claim.registration().id, applied);
                }
            }
            BatchReply::Answered(rows) => {
                let mut conn = ctx.pool.acquire().await?;
                for answered in &rows {
                    let row = &answered.entry.row;
                    let applied = flow
                        .persist_answer(&mut conn, row, answered.answer.as_ref(), &answered.audit)
                        .await?;
                    counts.record_applied(row.as_ref().registration().id, applied);
                }
            }
        }
    }
    if claimed > 0 {
        let written = counts.processed_count();
        let failed = counts.failed_count();
        let moved_on = counts.moved_on_count();
        let duration_ms = started_at.elapsed().as_millis() as u64;
        info!(
            phase = ctx.phase.as_str(),
            ?endpoint,
            claimed,
            requests_sent,
            items_sent,
            written,
            failed,
            moved_on,
            duration_ms,
            "claimed {claimed}, sent {items_sent} in {requests_sent} requests, wrote {written} \
             ({failed} failed), moved on {moved_on}, took {duration_ms}ms"
        );
    }
    Ok(counts)
}
