//! The `import` phase: the one call that creates something in the study registry.
//!
//! A row is committed as `submitting` before the request leaves. Only Suotar's own `notRegistered`
//! leads from that state or `submission_uncertain` back into a batch: a second import on a guess
//! would put a second attainment on a real transcript, and we could neither see it nor undo it.

mod claim;
mod decide;

use headless_lms_models::credit_registrations::restamp_submitting;
use headless_lms_models::library::credit_registration::outcomes::released_unsent_split_half;
use headless_lms_utils::prelude::Utc;
use sqlx::PgConnection;

use crate::error::CreditRegistrationResult;
use crate::registry::{AttainmentSubmission, ExchangeAudit, ImportAnswer, StudyRegistry};
use crate::use_cases::batch_flow::{
    BatchFlowContext, Prepared, RegistryBatchFlow, run_registry_batch_flow,
};
use crate::workflow::{
    Applied, Claimed, Counts, RefusalPolicy, write_decision, write_unasked_move,
};

use claim::claim_import_candidates;
use decide::decide_import_answer;

pub(crate) async fn run<R: StudyRegistry>(
    ctx: &BatchFlowContext<'_>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    run_registry_batch_flow::<Import, _>(ctx, registry).await
}

struct Import;

impl RegistryBatchFlow for Import {
    type Extra = ();
    type Request = AttainmentSubmission;

    const ALL_UNAVAILABLE_ERROR: &'static str =
        "Every item of the batch timed out in Sisu or came back unavailable.";
    const REFUSAL: RefusalPolicy<()> = RefusalPolicy::RequestLevel;

    async fn claim(
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<(), AttainmentSubmission>> {
        claim_import_candidates(ctx, conn, limit).await
    }

    async fn apply_answer(
        conn: &mut PgConnection,
        row: &Claimed<()>,
        answer: Option<&ImportAnswer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        let claim = &row.claim;
        let decision = decide_import_answer(claim.registration(), answer, &claim.facts(Utc::now()));
        write_decision(conn, claim, decision, audit).await
    }

    async fn keep_in_flight(
        conn: &mut PgConnection,
        rows: &[&Claimed<()>],
    ) -> CreditRegistrationResult<()> {
        restamp_submitting(
            conn,
            &rows.iter().map(|row| row.claim.id()).collect::<Vec<_>>(),
        )
        .await?;
        Ok(())
    }

    async fn release_unsent(
        conn: &mut PgConnection,
        rows: &[&Claimed<()>],
    ) -> CreditRegistrationResult<()> {
        for row in rows {
            write_unasked_move(conn, &row.claim, released_unsent_split_half()).await?;
        }
        Ok(())
    }
}
