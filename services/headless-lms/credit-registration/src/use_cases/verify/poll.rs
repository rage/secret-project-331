//! Polling what became of the submissions that have an attainment id to poll by.

use headless_lms_models::credit_registrations::{
    VerifyFlow, mark_partially_registered, reset_for_resubmission,
};
use headless_lms_models::library::credit_registration::outcomes::verify_inconclusive_outcome;
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use sqlx::{Connection, PgConnection};

use super::decide::{
    PollAnswer, decide_poll, not_registered_decision, partially_registered_decision,
};
use super::lease::{Leased, claim_and_lease};
use crate::domain::{Applied, Prepared, Refusal};
use crate::error::CreditRegistrationResult;
use crate::registry::{
    AttainmentId, BatchReply, ExchangeAudit, RequestBatch, StudyRegistry, VerificationAnswer,
    VerificationRequest,
};
use crate::use_cases::batch_flow::RegistryBatchFlow;
use crate::use_cases::contexts::BatchFlowContext;
use crate::use_cases::persist::{write_decision, write_decision_committing_if_written};

const STUCK_WITHOUT_ATTAINMENT_ID_MESSAGE: &str =
    "Credit registration is awaiting verification with no submitted attainment id";

/// Polls the rows that have something to poll by.
pub(super) struct VerifyPoll;

impl RegistryBatchFlow for VerifyPoll {
    type Row = Leased;
    type Request = VerificationRequest;
    type Answer = VerificationAnswer;

    const ENDPOINT: SuotarEndpoint = SuotarEndpoint::VerifyAttainments;
    const MAY_SPLIT: bool = false;
    const ALL_UNAVAILABLE_ERROR: &'static str = "Every verify poll came back unavailable.";

    /// A row stuck without a submitted attainment id is leased like the rest, so it is not claimed
    /// again every iteration, but never sent.
    async fn claim(
        &mut self,
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, Self::Request>> {
        let mut prepared = Prepared::new();
        for poll in claim_and_lease(conn, ctx.scope, VerifyFlow::Poll, limit).await? {
            let row = poll.claim.registration();
            let Some(submitted_attainment_id) = row.submitted_attainment_id.clone() else {
                error!(
                    credit_registration_id = %row.id,
                    "Credit registration is awaiting verification with no submitted attainment id; stuck"
                );
                ctx.errors
                    .report(
                        STUCK_WITHOUT_ATTAINMENT_ID_MESSAGE,
                        None,
                        serde_json::json!({ "credit_registration_id": row.id }),
                    )
                    .await;
                continue;
            };
            let request = VerificationRequest {
                submitted_attainment_id: AttainmentId::new(submitted_attainment_id),
            };
            prepared.send(poll, request);
        }
        Ok(prepared)
    }

    async fn send<R: StudyRegistry>(
        registry: &mut R,
        batch: RequestBatch<Self::Row, Self::Request>,
    ) -> BatchReply<Self::Row, Self::Request, Self::Answer> {
        registry.verify_attainments(batch).await
    }

    async fn persist_answer(
        &self,
        conn: &mut PgConnection,
        poll: &Self::Row,
        answer: Option<&Self::Answer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        persist_poll_answer(conn, poll, answer, audit).await
    }

    /// Deliberately not the shared request-level outcome: a failure to ask proves nothing was or
    /// was not created, and moving the row towards `failed_retryable` would let an admin resubmit
    /// it. The iteration still reports the refusal, and the gate still records it.
    fn on_refusal(&self, poll: &Self::Row) -> Refusal {
        Refusal::KeepWaiting {
            outcome: verify_inconclusive_outcome(poll.claim.registration().state, &poll.facts()),
            message: "Could not verify this submission this time.",
        }
    }
}

/// Writes one poll's answer.
async fn persist_poll_answer(
    conn: &mut PgConnection,
    poll: &Leased,
    answer: Option<&VerificationAnswer>,
    audit: &ExchangeAudit,
) -> CreditRegistrationResult<Applied> {
    let claim = &poll.claim;
    let id = claim.registration().id;
    let facts = poll.facts();
    let row_error = answer.and_then(|answer| answer.error_message.as_deref());
    match decide_poll(claim.registration().state, answer, &facts) {
        PollAnswer::Decided(decision) => write_decision(conn, claim, decision, audit).await,
        // Kept even if the row moved on: when a poll first saw the partial registration is a
        // fact about Sisu, not about this move.
        PollAnswer::PartiallyRegistered => {
            let partially_registered_at = mark_partially_registered(conn, id).await?;
            let decision = partially_registered_decision(&facts, partially_registered_at)
                .with_row_error(row_error);
            write_decision(conn, claim, decision, audit).await
        }
        // The reset rolls back with a row that moved on.
        PollAnswer::NotRegistered => {
            let mut tx = conn.begin().await?;
            let reimport_count = reset_for_resubmission(&mut tx, id).await?;
            let decision =
                not_registered_decision(&facts, reimport_count).with_row_error(row_error);
            write_decision_committing_if_written(tx, claim, decision, audit).await
        }
    }
}
