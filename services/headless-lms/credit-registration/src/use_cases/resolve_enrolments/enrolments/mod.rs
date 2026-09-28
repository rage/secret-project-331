//! The second half of a `resolve-enrolments` iteration: the enrolment lookup, and freezing the
//! payload the import will send.

mod decide;

use headless_lms_models::credit_registrations::{
    CreditRegistrationState, claim_due_for_resolve, get_recorded_credits_for_same_module,
    lock_live_successes_for_same_module, transition,
};
use headless_lms_models::library::credit_registration::enrolment_checks::EnrolmentCheckAnswer;
use headless_lms_models::library::credit_registration::enrolment_selection::select_enrolment;
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, missing_context_outcome, unanswered_item_outcome,
};
use headless_lms_models::library::credit_registration::study_registry::RegistryAttainment;
use headless_lms_models::library::credit_registration::submission_context::{
    SubmissionContext, get_submission_contexts,
};
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use headless_lms_utils::prelude::Utc;
use sqlx::{Connection, PgConnection};
use std::collections::HashSet;
use uuid::Uuid;

use super::{Lookup, hold};
use crate::domain::{Applied, ClaimedRegistration, Decision, PayloadChange, Prepared, Refusal};
use crate::error::CreditRegistrationResult;
use crate::registry::{
    BatchReply, EnrolmentAnswer, EnrolmentLookup, ExchangeAudit, RequestBatch, StudyRegistry,
};
use crate::use_cases::batch_flow::RegistryBatchFlow;
use crate::use_cases::contexts::BatchFlowContext;
use crate::use_cases::persist::{
    write_decision, write_decision_committing_if_written, write_unasked_outcome,
};

use decide::{
    EnrolmentLookupResult, Resolution, Unaskable, enrolment_criteria, enrolment_lookup,
    freeze_message, held_in_sisu, read_enrolment_answer, resolve, unsent_duplicate,
};

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ResolveEnrolments;

pub(super) struct ResolveEnrolments;

/// A claimed row and its frozen context: the answer is applied against what was asked, not against
/// a second read of the database.
pub(super) struct Resolvable {
    claim: ClaimedRegistration,
    context: SubmissionContext,
    lookup: Lookup,
}

impl AsRef<ClaimedRegistration> for Resolvable {
    fn as_ref(&self) -> &ClaimedRegistration {
        &self.claim
    }
}

impl RegistryBatchFlow for ResolveEnrolments {
    type Row = Resolvable;
    type Request = EnrolmentLookup;
    type Answer = EnrolmentAnswer;

    const ENDPOINT: SuotarEndpoint = ENDPOINT;
    const MAY_SPLIT: bool = true;
    const ALL_UNAVAILABLE_ERROR: &'static str = "Every item of the batch came back unavailable.";

    async fn claim(
        &mut self,
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, Self::Request>> {
        let claimed = claim_due_for_resolve(conn, ctx.scope, limit as i64).await?;
        let ids: Vec<_> = claimed.iter().map(|row| row.id).collect();
        let mut contexts = get_submission_contexts(conn, &ids).await?;

        let mut prepared = Prepared::new();
        let mut batched_student_modules = HashSet::new();
        for row in claimed {
            // Left claimable where it is: once this batch's row for the module is resolving, the
            // claim holds this one back until that one settles.
            if !batched_student_modules.insert((row.user_id, row.course_module_id)) {
                debug!(
                    credit_registration_id = %row.id,
                    "Leaving row claimable: another attempt for the same student and module is already in this batch"
                );
                continue;
            }
            let Some(context) = contexts.remove(&row.id) else {
                warn!(
                    credit_registration_id = %row.id,
                    "Credit registration has no completion or module to submit for"
                );
                let claim = ClaimedRegistration::left_in_place(row);
                write_unasked_outcome(
                    conn,
                    &claim,
                    &missing_context_outcome(&claim.facts(Utc::now())),
                    "There is no completion or module to submit for.",
                )
                .await?;
                prepared.record_decided(true);
                continue;
            };
            // Left for the next iteration's person lookup rather than frozen without the person.
            if context.student_number.is_some() && context.sisu_person_id.is_none() {
                debug!(
                    credit_registration_id = %row.id,
                    "Leaving row claimable: waiting for a Sisu person id"
                );
                continue;
            }
            match enrolment_lookup(&context) {
                Ok(request) => {
                    let lookup = Lookup::of(&row);
                    let resolvable = Resolvable {
                        claim: lookup.claim(row),
                        context,
                        lookup,
                    };
                    prepared.send(resolvable, request);
                }
                Err(problem) => {
                    match &problem {
                        Unaskable::Config(code) => {
                            warn!(
                                credit_registration_id = %row.id,
                                error_code = ?code,
                                "Course module is not configured for credit registration"
                            );
                        }
                        Unaskable::NoStudentNumber => {
                            debug!(
                                credit_registration_id = %row.id,
                                "No verified student number; sending back to pending"
                            );
                        }
                    }
                    transition(conn, row.id, &problem.transition()).await?;
                    prepared.record_decided(true);
                }
            }
        }
        hold(
            conn,
            prepared
                .sendable()
                .iter()
                .map(|entry| (entry.registration_id, entry.row.lookup)),
        )
        .await?;
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
        resolvable: &Self::Row,
        answer: Option<&Self::Answer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        let claim = &resolvable.claim;
        let row = claim.registration();
        let enrolments = answer
            .map(|answer| answer.enrolments.as_slice())
            .unwrap_or_default();
        let chosen = select_enrolment(enrolments, enrolment_criteria(&resolvable.context));
        let check = row
            .enrolment_check_anchor_at
            .is_some()
            .then(|| EnrolmentCheckAnswer {
                checked: row,
                usable_enrolment: chosen.ok(),
                listed_enrolments: enrolments,
            });
        let Some(answer) = answer else {
            let outcome = unanswered_item_outcome(ENDPOINT, row.state, &claim.facts(Utc::now()));
            let decision = Decision::new(outcome)
                .with_message("Sisu did not answer for this item.")
                .with_enrolment_check(check);
            return write_decision(conn, claim, decision, audit).await;
        };
        let lookup_result = read_enrolment_answer(answer, enrolments, chosen);
        persist_enrolment_answer(
            conn,
            resolvable,
            &lookup_result,
            &answer.existing_attainments,
            check,
            audit,
        )
        .await
    }

    fn on_refusal(&self, _resolvable: &Self::Row) -> Refusal {
        Refusal::RequestLevel
    }
}

/// Writes an answered lookup: settles the row as `duplicate` when a credit it would not beat is
/// already held, fails it when there is nothing to register against, and otherwise freezes the
/// payload and queues the row for import.
///
/// What Sisu itself holds is weighed first, before anything is locked: if the attainment exists the
/// credit does, so sending the student off to re-enrol would be wrong as well as unnecessary. Then,
/// in one transaction, what we registered from another attempt, which Suotar's copy of Sisu may
/// predate, and for an enrolment error, the credits our records hold.
async fn persist_enrolment_answer(
    conn: &mut PgConnection,
    resolvable: &Resolvable,
    lookup_result: &EnrolmentLookupResult<'_>,
    existing: &[RegistryAttainment],
    check: Option<EnrolmentCheckAnswer<'_>>,
    audit: &ExchangeAudit,
) -> CreditRegistrationResult<Applied> {
    let claim = &resolvable.claim;
    let row = claim.registration();
    let context = &resolvable.context;
    let grade_scale_id = lookup_result.grade_scale_id(existing);
    let may_be_held_in_sisu = match lookup_result {
        EnrolmentLookupResult::Listed { .. } => true,
        EnrolmentLookupResult::Refused { .. } => lookup_result.is_enrolment_error(),
    };
    // Before the transaction below: a Sisu attainment must not be written inside one.
    if may_be_held_in_sisu && let Some(attained) = held_in_sisu(existing, context, grade_scale_id) {
        let decision = unsent_duplicate(
            context,
            grade_scale_id,
            "Sisu already has an equal or better grade for this course, so nothing was submitted.",
        )
        .with_sisu_attainment(Some(attained))
        .with_enrolment_check(check);
        return write_decision(conn, claim, decision, audit).await;
    }

    let mut tx = conn.begin().await?;
    let registered = match lookup_result {
        EnrolmentLookupResult::Listed { .. } => {
            lock_live_successes_for_same_module(&mut tx, row.id).await?
        }
        EnrolmentLookupResult::Refused { .. } => Vec::new(),
    };
    let recorded = if lookup_result.is_enrolment_error() {
        get_recorded_credits_for_same_module(&mut tx, row.id).await?
    } else {
        Vec::new()
    };
    let supersedes: Vec<Uuid> = registered.iter().map(|replaced| replaced.id).collect();
    let built;
    let decision = match resolve(
        lookup_result,
        context,
        grade_scale_id,
        &registered,
        &recorded,
        row,
    ) {
        Resolution::HeldHere { message } => unsent_duplicate(context, grade_scale_id, message),
        Resolution::Fail(decision) => decision,
        Resolution::Freeze(frozen) => {
            built = frozen;
            // Only now does the row become claimable by `import`: the payload is frozen and the
            // event records when the enrolment was resolved.
            let decision = Decision::new(Outcome::to(CreditRegistrationState::CheckingEnrolment))
                .with_payload(PayloadChange::Frozen {
                    snapshot: &built.snapshot,
                    supersedes: &supersedes,
                });
            match freeze_message(&built, !registered.is_empty()) {
                Some(message) => decision.with_message(message),
                None => decision,
            }
        }
    };
    let decision = decision.with_enrolment_check(check);
    write_decision_committing_if_written(tx, claim, decision, audit).await
}
