//! The second half of a `resolve-enrolments` iteration: the enrolment lookup, and freezing the
//! payload the import will send.
//!
//! [`request`] decides whether a row can be asked about, [`answer`] what the registry's answer
//! means, and [`resolution`] what that comes to for the row; the orchestration, with its
//! transaction, is here.

mod answer;
mod request;
mod resolution;

use headless_lms_models::library::credit_registration::enrolment_checks::EnrolmentCheckAnswer;
use headless_lms_models::library::credit_registration::enrolment_checks::claim_due_for_resolve;
use headless_lms_models::library::credit_registration::enrolment_selection::{
    EnrolmentCriteria, select_enrolment,
};
use headless_lms_models::library::credit_registration::outcomes::{
    missing_context, unanswered_item_outcome,
};
use headless_lms_models::library::credit_registration::submission_context::{
    SubmissionContext, get_submission_contexts,
};
use headless_lms_utils::prelude::Utc;
use sqlx::{Connection, PgConnection};

use super::{claim_for_lookup, hold_in_flight, keep_lookups_in_flight};
use crate::error::CreditRegistrationResult;
use crate::registry::{BatchRequest, EnrolmentAnswer, EnrolmentLookup, ExchangeAudit};
use crate::use_cases::batch_flow::{BatchFlowContext, Prepared, RegistryBatchFlow};
use crate::workflow::{
    Applied, Claimed, ClaimedRegistration, Decision, RefusalPolicy, write_decision,
    write_decision_committing_if_written, write_unasked_move,
};

use answer::{AnsweredLookup, EnrolmentLookupResult};
use request::{Askable, Unaskable, enrolment_lookup};
use resolution::{CompetingCredits, resolve, unsent_duplicate};

pub(super) struct ResolveEnrolments;

/// What a row's lookup was built from: the submission context, and the criteria the lookup's
/// enrolment must fit. The answer is applied against what was asked, not against a second read of
/// the database.
pub(super) struct LookupBasis {
    submission: SubmissionContext,
    criteria: EnrolmentCriteria,
}

/// A row claimed for its enrolment lookup.
pub(super) type Resolvable = Claimed<LookupBasis>;

impl RegistryBatchFlow for ResolveEnrolments {
    type Extra = LookupBasis;
    type Request = EnrolmentLookup;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every item of the batch came back unavailable.";
    const REFUSAL: RefusalPolicy<LookupBasis> = RefusalPolicy::RequestLevel;

    async fn claim(
        ctx: &BatchFlowContext<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<LookupBasis, EnrolmentLookup>> {
        let claimed =
            claim_due_for_resolve(conn, ctx.scope, i64::try_from(limit).unwrap_or(i64::MAX))
                .await?;
        let ids: Vec<_> = claimed.iter().map(|row| row.id).collect();
        let mut contexts = get_submission_contexts(conn, &ids).await?;

        let mut prepared = Prepared::new();
        for row in claimed {
            let Some(context) = contexts.remove(&row.id) else {
                warn!(
                    credit_registration_id = %row.id,
                    "Credit registration has no completion or module to submit for"
                );
                let claim = ClaimedRegistration::left_in_place(row);
                let applied =
                    write_unasked_move(conn, &claim, missing_context(&claim.facts(Utc::now())))
                        .await?;
                prepared.record_applied(claim.id(), applied);
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
                Ok(Askable { request, criteria }) => {
                    let row = Claimed {
                        claim: claim_for_lookup(row),
                        extra: LookupBasis {
                            submission: context,
                            criteria,
                        },
                    };
                    prepared.send(row, request);
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
                    // The claim holds the row's lock, so the guard only confirms the state it read.
                    let claim = ClaimedRegistration::left_in_place(row);
                    let applied = write_unasked_move(conn, &claim, problem.unasked_move()).await?;
                    prepared.record_applied(claim.id(), applied);
                }
            }
        }
        hold_in_flight(
            conn,
            prepared.sendable().iter().map(|entry| &entry.row.claim),
        )
        .await?;
        Ok(prepared)
    }

    async fn apply_answer(
        conn: &mut PgConnection,
        resolvable: &Resolvable,
        answer: Option<&EnrolmentAnswer>,
        audit: &ExchangeAudit,
    ) -> CreditRegistrationResult<Applied> {
        let claim = &resolvable.claim;
        let row = claim.registration();
        let enrolments = answer
            .map(|answer| answer.enrolments.as_slice())
            .unwrap_or_default();
        let chosen = select_enrolment(enrolments, resolvable.extra.criteria);
        let check = row
            .enrolment_check_anchor_at
            .is_some()
            .then(|| EnrolmentCheckAnswer {
                checked: row,
                usable_enrolment: chosen.ok(),
                listed_enrolments: enrolments,
            });
        let Some(answer) = answer else {
            let outcome = unanswered_item_outcome(
                EnrolmentLookup::OPERATION,
                row.state,
                &claim.facts(Utc::now()),
            );
            let decision = Decision::new(outcome)
                .with_message("Sisu did not answer for this item.")
                .with_enrolment_check(check);
            return write_decision(conn, claim, decision, audit).await;
        };
        let lookup = AnsweredLookup::new(
            resolvable,
            EnrolmentLookupResult::read(answer, chosen),
            &answer.existing_attainments,
        );
        apply_enrolment_answer(conn, &lookup, check, audit).await
    }

    async fn keep_in_flight(
        conn: &mut PgConnection,
        rows: &[&Resolvable],
    ) -> CreditRegistrationResult<()> {
        keep_lookups_in_flight(conn, rows.iter().map(|row| &row.claim)).await
    }
}

/// Writes an answered lookup: settles the row as `duplicate` when a credit it would not beat is
/// already held, fails it when there is nothing to register against, and otherwise freezes the
/// payload and queues the row for import.
///
/// What Sisu itself holds is weighed first: if the attainment exists the credit does, so sending
/// the student off to re-enrol would be wrong as well as unnecessary.
async fn apply_enrolment_answer(
    conn: &mut PgConnection,
    lookup: &AnsweredLookup<'_>,
    check: Option<EnrolmentCheckAnswer<'_>>,
    audit: &ExchangeAudit,
) -> CreditRegistrationResult<Applied> {
    // Before the transaction below: a Sisu attainment must not be written inside one.
    if let Some(attained) = lookup.held_in_sisu() {
        let decision = unsent_duplicate(
            lookup,
            "Sisu already has an equal or better grade for this course, so nothing was submitted.",
        )
        .with_sisu_attainment(Some(attained))
        .with_enrolment_check(check);
        return write_decision(conn, lookup.claim(), decision, audit).await;
    }

    // Our other attempts' successes are locked in the transaction that freezes the payload, so two
    // attempts cannot both decide theirs is the grade to send.
    let mut tx = conn.begin().await?;
    let competing = CompetingCredits::load(&mut tx, lookup).await?;
    let decision = resolve(lookup, &competing).with_enrolment_check(check);
    write_decision_committing_if_written(tx, lookup.claim(), decision, audit).await
}

#[cfg(test)]
mod fixtures {
    use headless_lms_models::credit_registrations::{
        CreditRegistrationErrorCode, CreditRegistrationState,
    };
    use headless_lms_models::library::credit_registration::payload::CompletionFacts;
    use headless_lms_models::library::credit_registration::study_registry::{
        CreditRange, RegistryEnrolment,
    };
    use headless_lms_models::secret::DbSecret;
    use uuid::Uuid;

    use super::answer::EnrolmentLookupResult;
    use super::request::enrolment_lookup;
    use super::{LookupBasis, Resolvable, SubmissionContext};
    use crate::test_fixtures::{now, registration};
    use crate::workflow::{Claimed, ClaimedRegistration};

    pub(super) fn context(grade: Option<i32>) -> SubmissionContext {
        SubmissionContext {
            registration_id: Uuid::new_v4(),
            student_number: Some(DbSecret::new("012345678")),
            sisu_person_id: Some(DbSecret::new("person-1")),
            uh_course_code: Some(" TKT10002 ".to_string()),
            ects_credits: Some(5.0),
            completion: CompletionFacts {
                passed: true,
                grade,
                completion_date: now(),
                completion_language: "en".to_string(),
            },
        }
    }

    /// A row on its first resolve, as the claim holds it.
    pub(super) fn resolvable(context: SubmissionContext) -> Resolvable {
        let Ok(askable) = enrolment_lookup(&context) else {
            panic!("fixture context must be askable");
        };
        Claimed {
            claim: ClaimedRegistration::left_in_place(registration(
                CreditRegistrationState::ResolvingEnrolment,
            )),
            extra: LookupBasis {
                submission: context,
                criteria: askable.criteria,
            },
        }
    }

    pub(super) fn enrolment(state: &str) -> RegistryEnrolment {
        RegistryEnrolment {
            id: "enrolment-1".to_string(),
            state: Some(state.to_string()),
            kind: None,
            course_unit_realisation_id: None,
            course_unit_realisation_name: None,
            activity_period: None,
            grade_scale_id: Some("sis-0-5".to_string()),
            credits: Some(CreditRange {
                min: Some(5.0),
                max: Some(5.0),
            }),
            study_right_validity_period: None,
            enrolment_date_time: None,
        }
    }

    pub(super) fn refused(code: CreditRegistrationErrorCode) -> EnrolmentLookupResult<'static> {
        EnrolmentLookupResult::Refused {
            code,
            error_message: Some("item error"),
        }
    }
}
