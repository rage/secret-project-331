//! Looking for what a submission we lost track of would have created.

use headless_lms_models::credit_registrations::VerifyFlow;
use headless_lms_models::library::credit_registration::outcomes::uncertain_recheck_outcome;
use headless_lms_models::library::credit_registration::submission_context::get_submission_contexts;
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use sqlx::PgConnection;

use super::decide::decide_recovery;
use super::lease::{Leased, claim_and_lease};
use crate::domain::{Applied, Prepared, Refusal};
use crate::error::CreditRegistrationResult;
use crate::registry::{
    BatchReply, CourseCode, EnrolmentAnswer, EnrolmentLookup, ExchangeAudit, RequestBatch,
    StudentNumber, StudyRegistry,
};
use crate::use_cases::batch_flow::RegistryBatchFlow;
use crate::use_cases::contexts::BatchFlowContext;
use crate::use_cases::persist::write_decision;

/// Looks for the attainment a submission we lost track of would have produced. The row stays
/// `submission_uncertain` unless it is found: never failed, never re-imported.
pub(super) struct UncertainRecovery;

impl RegistryBatchFlow for UncertainRecovery {
    type Row = Leased;
    type Request = EnrolmentLookup;
    type Answer = EnrolmentAnswer;

    const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ResolveEnrolments;
    const MAY_SPLIT: bool = false;
    const ALL_UNAVAILABLE_ERROR: &'static str = "Every recovery lookup came back unavailable.";

    /// A row with nothing to ask about is left where it is: it is uncertain, which no answer of ours
    /// may turn into a failure, and its lease already schedules the next check.
    async fn claim(
        &mut self,
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, Self::Request>> {
        let recoveries =
            claim_and_lease(conn, ctx.scope, VerifyFlow::UncertainRecovery, limit).await?;
        let contexts = get_submission_contexts(
            conn,
            &recoveries
                .iter()
                .map(|recovery| recovery.claim.registration().id)
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
                    .clone()
                    .or_else(|| context.uh_course_code.clone()),
            ) else {
                debug!(
                    credit_registration_id = %row.id,
                    "No student number or course code to recover with; leaving row uncertain"
                );
                continue;
            };
            let lookup = EnrolmentLookup {
                student_number: StudentNumber::new(student_number),
                course_code: CourseCode::new(course_code),
            };
            prepared.send(recovery, lookup);
        }
        Ok(prepared)
    }

    async fn send<R: StudyRegistry>(
        registry: &mut R,
        batch: RequestBatch<Self::Row, Self::Request>,
    ) -> BatchReply<Self::Row, Self::Request, Self::Answer> {
        registry.resolve_enrolments(batch).await
    }

    async fn persist_answer(
        &self,
        conn: &mut PgConnection,
        recovery: &Self::Row,
        answer: Option<&Self::Answer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        let decision = decide_recovery(recovery.claim.registration(), &recovery.facts(), answer);
        write_decision(conn, &recovery.claim, decision, audit).await
    }

    /// Not the shared request-level outcome either: these rows must stay uncertain whatever the
    /// call did.
    fn on_refusal(&self, recovery: &Self::Row) -> Refusal {
        Refusal::KeepWaiting {
            outcome: uncertain_recheck_outcome(&recovery.facts()),
            message: "Could not check Sisu for the credits this time.",
        }
    }
}
