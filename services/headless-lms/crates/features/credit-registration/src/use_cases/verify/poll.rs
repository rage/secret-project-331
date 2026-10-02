//! Polling what became of the submissions that have an attainment id to poll by.

use chrono::{DateTime, Utc};
use headless_lms_data_operations::library::credit_registration::outcomes::{
    Outcome, verify_inconclusive_outcome,
};
use headless_lms_models::credit_registrations::{
    AdminAttention, VerifyFlow, mark_partially_registered, reset_for_resubmission,
    set_needs_admin_attention,
};
use sqlx::{Connection, PgConnection};

use super::decide::{
    PollAnswer, decide_poll, not_registered_decision, partially_registered_decision,
};
use super::lease::{Leased, VerifyAttempt, attempt_facts, claim_and_lease};
use crate::error::CreditRegistrationResult;
use crate::registry::{AttainmentId, ExchangeAudit, VerificationAnswer, VerificationRequest};
use crate::use_cases::batch_flow::{BatchFlowContext, Prepared, RegistryBatchFlow};
use crate::workflow::{
    Applied, RefusalPolicy, write_decision, write_decision_committing_if_written,
};

const STUCK_WITHOUT_ATTAINMENT_ID_MESSAGE: &str =
    "Credit registration is awaiting verification with no submitted attainment id";

/// Polls the rows that have something to poll by.
pub(super) struct VerifyPoll;

impl RegistryBatchFlow for VerifyPoll {
    type Extra = VerifyAttempt;
    type Request = VerificationRequest;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every verify poll came back unavailable.";
    /// Deliberately not the shared request-level outcome: a failure to ask proves nothing was or
    /// was not created, and moving the row towards `failed_retryable` would let an admin resubmit
    /// it. The iteration still reports the refusal, and the gate still records it.
    const REFUSAL: RefusalPolicy<VerifyAttempt> = RefusalPolicy::KeepWaiting {
        outcome: still_polling,
        message: "Could not verify this submission this time.",
    };

    /// A row stuck without a submitted attainment id is leased like the rest, so it is not claimed
    /// again every iteration, but never sent; it is flagged for an admin and counted as failed.
    async fn claim(
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<VerifyAttempt, VerificationRequest>> {
        let mut prepared = Prepared::new();
        for poll in claim_and_lease(ctx, conn, VerifyFlow::Poll, limit).await? {
            let row = poll.claim.registration();
            let Some(submitted_attainment_id) = row.submitted_attainment_id.clone() else {
                // Reported on every lease, which backs off with the attempt count; the admin flag
                // can't mark it as reported, since an earlier move may already have raised it.
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
                if !row.needs_admin_attention {
                    set_needs_admin_attention(conn, row.id, AdminAttention::Raise).await?;
                }
                prepared.record_failed();
                continue;
            };
            let request = VerificationRequest {
                submitted_attainment_id: AttainmentId::new(submitted_attainment_id),
            };
            prepared.send(poll, request);
        }
        Ok(prepared)
    }

    async fn apply_answer(
        conn: &mut PgConnection,
        poll: &Leased,
        answer: Option<&VerificationAnswer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        let claim = &poll.claim;
        let facts = attempt_facts(poll, Utc::now());
        let row_error = answer.and_then(|answer| answer.error_message.as_deref());
        match decide_poll(claim.registration().state, answer, &facts) {
            PollAnswer::Decided(decision) => {
                write_decision(conn, claim, (*decision).with_row_error(row_error), audit).await
            }
            // Kept even if the row moved on: when a poll first saw the partial registration is a
            // fact about Sisu, not about this move.
            PollAnswer::PartiallyRegistered => {
                let partially_registered_at = mark_partially_registered(conn, claim.id()).await?;
                let decision = partially_registered_decision(&facts, partially_registered_at)
                    .with_row_error(row_error);
                write_decision(conn, claim, decision, audit).await
            }
            // The reset rolls back with a row that moved on.
            PollAnswer::NotRegistered => {
                let mut tx = conn.begin().await?;
                let reimport_count = reset_for_resubmission(&mut tx, claim.id()).await?;
                let decision =
                    not_registered_decision(&facts, reimport_count).with_row_error(row_error);
                write_decision_committing_if_written(tx, claim, decision, audit).await
            }
        }
    }
}

fn still_polling(poll: &Leased, now: DateTime<Utc>) -> Outcome {
    verify_inconclusive_outcome(poll.claim.registration().state, &attempt_facts(poll, now))
}
