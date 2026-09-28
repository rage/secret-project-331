//! The `import` phase: the one call that creates something in the study registry.
//!
//! A row is committed as `submitting` before the request leaves. Only Suotar's own `notRegistered`
//! leads from that state or `submission_uncertain` back into a batch: a second import on a guess
//! would put a second attainment on a real transcript, and we could neither see it nor undo it.

mod claim;
mod decide;

use headless_lms_models::credit_registrations::{restamp_submitting, transition_unless_moved_on};
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use headless_lms_utils::prelude::Utc;
use sqlx::PgConnection;

use crate::domain::{Applied, ClaimedRegistration, Counts, Prepared, Refusal, transitions};
use crate::error::CreditRegistrationResult;
use crate::registry::{
    AttainmentSubmission, BatchReply, ExchangeAudit, ImportAnswer, RequestBatch, StudyRegistry,
};
use crate::use_cases::batch_flow::{RegistryBatchFlow, run_registry_batch_flow};
use crate::use_cases::contexts::BatchFlowContext;
use crate::use_cases::persist::write_decision;

use claim::claim_import_candidates;
use decide::decide_import_answer;

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ImportAttainments;

pub(crate) async fn run<R: StudyRegistry>(
    ctx: &BatchFlowContext<'_>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    run_registry_batch_flow(&mut Import, ctx, registry).await
}

struct Import;

impl RegistryBatchFlow for Import {
    type Row = ClaimedRegistration;
    type Request = AttainmentSubmission;
    type Answer = ImportAnswer;

    const ENDPOINT: SuotarEndpoint = ENDPOINT;
    const MAY_SPLIT: bool = true;
    const ALL_UNAVAILABLE_ERROR: &'static str =
        "Every item of the batch timed out in Sisu or came back unavailable.";

    async fn claim(
        &mut self,
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, Self::Request>> {
        claim_import_candidates(ctx, conn, limit).await
    }

    async fn send<R: StudyRegistry>(
        registry: &mut R,
        batch: RequestBatch<Self::Row, Self::Request>,
    ) -> BatchReply<Self::Row, Self::Request, Self::Answer> {
        registry.import_attainments(batch).await
    }

    async fn persist_answer(
        &self,
        conn: &mut PgConnection,
        claim: &Self::Row,
        answer: Option<&Self::Answer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        let decision = decide_import_answer(claim.registration(), answer, &claim.facts(Utc::now()));
        write_decision(conn, claim, decision, audit).await
    }

    fn on_refusal(&self, _claim: &Self::Row) -> Refusal {
        Refusal::RequestLevel
    }

    async fn keep_in_flight(
        &self,
        conn: &mut PgConnection,
        rows: &[&Self::Row],
    ) -> CreditRegistrationResult<()> {
        restamp_submitting(
            conn,
            &rows
                .iter()
                .map(|claim| claim.registration().id)
                .collect::<Vec<_>>(),
        )
        .await?;
        Ok(())
    }

    async fn release_unsent(
        &self,
        conn: &mut PgConnection,
        rows: &[&Self::Row],
    ) -> CreditRegistrationResult<()> {
        for claim in rows {
            transition_unless_moved_on(
                conn,
                claim.registration().id,
                &transitions::released_unsent_split_half(),
            )
            .await?;
        }
        Ok(())
    }
}
