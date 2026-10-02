//! Looking for what a submission we lost track of would have created.

use chrono::{DateTime, Utc};
use headless_lms_data_operations::library::credit_registration::outcomes::{
    Outcome, uncertain_recheck_outcome,
};
use headless_lms_data_operations::library::credit_registration::submission_context::get_submission_contexts;
use headless_lms_models::credit_registrations::VerifyFlow;
use sqlx::PgConnection;

use super::decide::decide_recovery;
use super::lease::{Leased, VerifyAttempt, attempt_facts, claim_and_lease};
use crate::error::CreditRegistrationResult;
use crate::registry::{CourseCode, EnrolmentAnswer, EnrolmentLookup, ExchangeAudit, StudentNumber};
use crate::use_cases::batch_flow::{BatchFlowContext, Prepared, RegistryBatchFlow};
use crate::workflow::{Applied, RefusalPolicy, write_decision};

/// Looks for the attainment a submission we lost track of would have produced. The row stays
/// `submission_uncertain` unless it is found: never failed, never re-imported.
pub(super) struct UncertainRecovery;

impl RegistryBatchFlow for UncertainRecovery {
    type Extra = VerifyAttempt;
    type Request = EnrolmentLookup;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every recovery lookup came back unavailable.";
    /// Not the shared request-level outcome either: these rows must stay uncertain whatever the
    /// call did.
    const REFUSAL: RefusalPolicy<VerifyAttempt> = RefusalPolicy::KeepWaiting {
        outcome: still_uncertain,
        message: "Could not check Sisu for the credits this time.",
    };

    /// A row with nothing to ask about is left where it is: it is uncertain, which no answer of ours
    /// may turn into a failure, and its lease already schedules the next check.
    async fn claim(
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<VerifyAttempt, EnrolmentLookup>> {
        let recoveries = claim_and_lease(ctx, conn, VerifyFlow::UncertainRecovery, limit).await?;
        let contexts = get_submission_contexts(
            conn,
            &recoveries
                .iter()
                .map(|recovery| recovery.claim.id())
                .collect::<Vec<_>>(),
        )
        .await?;
        let mut prepared = Prepared::new();
        for recovery in recoveries {
            let row = recovery.claim.registration();
            let Some(context) = contexts.get(&row.id) else {
                debug!(
                    credit_registration_id = %row.id,
                    "No completion or module to recover with; leaving row uncertain"
                );
                continue;
            };
            let (Some(student_number), Some(course_code)) = (
                row.student_number
                    .clone()
                    .or_else(|| context.student_number.clone()),
                row.uh_course_code
                    .as_deref()
                    .and_then(CourseCode::parse)
                    .or_else(|| {
                        context
                            .uh_course_code
                            .as_deref()
                            .and_then(CourseCode::parse)
                    }),
            ) else {
                debug!(
                    credit_registration_id = %row.id,
                    "No student number or course code to recover with; leaving row uncertain"
                );
                continue;
            };
            let lookup = EnrolmentLookup {
                student_number: StudentNumber::new(student_number),
                course_code,
            };
            prepared.send(recovery, lookup);
        }
        Ok(prepared)
    }

    async fn apply_answer(
        conn: &mut PgConnection,
        recovery: &Leased,
        answer: Option<&EnrolmentAnswer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        let facts = attempt_facts(recovery, Utc::now());
        let decision = decide_recovery(recovery.claim.registration(), &facts, answer);
        write_decision(conn, &recovery.claim, decision, audit).await
    }
}

fn still_uncertain(recovery: &Leased, now: DateTime<Utc>) -> Outcome {
    uncertain_recheck_outcome(&attempt_facts(recovery, now))
}
