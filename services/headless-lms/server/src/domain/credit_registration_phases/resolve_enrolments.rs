//! The `resolve-enrolments` phase: which enrolment the attainment belongs to, and what we will send.
//!
//! Ends with the payload frozen and the row queued for import in `checking_enrolment`, never
//! `submitting`: that state means a request may be in flight, and is the import phase's to write.
//!
//! The row spends the Suotar round trip itself in `resolving_enrolment`, not `checking_enrolment`:
//! `import`'s claim query reads the latter, and the row's own claim lock is gone as soon as the
//! preflight transaction below commits. Landing in a state `import` does not claim keeps a second
//! tick of `import` from sending a request before the enrolment this one resolves is known.
//!
//! Each iteration first looks up the Sisu person for links that lack one; see
//! [`super::resolve_person_ids`].

use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, suotar_exchange_details,
};
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, Transition,
    claim_due, increment_submit_retry_count, set_payload_snapshot, transition,
};
use headless_lms_models::library::credit_registration::classification::map_code;
use headless_lms_models::library::credit_registration::enrolment_selection::{
    EnrolmentCriteria, attained_candidates, select_enrolment,
};
use headless_lms_models::library::credit_registration::grade_mapping::{
    GradeComparison, GradeSource, compare_grades, map_grade,
};
use headless_lms_models::library::credit_registration::outcomes::{
    missing_context_outcome, submit_error_outcome, unanswered_item_outcome,
};
use headless_lms_models::library::credit_registration::payload::{
    PayloadSources, build_payload_snapshot,
};
use headless_lms_models::library::credit_registration::submission_context::{
    SubmissionContext, get_submission_contexts,
};
use headless_lms_models::secret::DbSecret;
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::services::suotar::{
    ATTAINMENT_TYPE_COURSE_UNIT, EnrolmentResolutionResult, ResolveEnrolmentRequestItem,
    SuotarBatchResponse, SuotarCallContext, SuotarEndpoint, SuotarItemStatus, SuotarResponseItem,
    new_request_item_id,
};
use sqlx::PgConnection;

use super::resolve_person_ids::ResolvePersonIds;
use super::{
    OutcomeEvent, PhaseContext, PhaseScope, Prepared, SuotarBatchPhase, apply_outcome,
    apply_request_level_outcome, counts_as_failed, outcome_transition, row_facts,
    run_suotar_batch_phase,
};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let persons = run_suotar_batch_phase(&mut ResolvePersonIds, ctx, scope).await?;
    let enrolments = run_suotar_batch_phase(&mut ResolveEnrolments, ctx, scope).await?;
    // The first error stands for the iteration.
    let (first, second) = if persons.error.is_some() {
        (persons, enrolments)
    } else {
        (enrolments, persons)
    };
    Ok(PhaseRunOutcome {
        items_processed: first.items_processed + second.items_processed,
        items_failed: first.items_failed + second.items_failed,
        ..first
    })
}

struct ResolveEnrolments;

impl SuotarBatchPhase for ResolveEnrolments {
    /// The frozen context travels with the row: the answer is applied against what was asked, not
    /// against a second read of the database.
    type Row = (CreditRegistration, SubmissionContext);
    type Item = ResolveEnrolmentRequestItem;
    type Result = EnrolmentResolutionResult;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every item of the batch came back unavailable.";

    async fn prepare(
        &mut self,
        _ctx: &PhaseContext<'_>,
        conn: &mut PgConnection,
        scope: &PhaseScope,
    ) -> anyhow::Result<Prepared<Self::Row, Self::Item>> {
        let claimed = claim_due(
            conn,
            &[CreditRegistrationState::ReadyToSubmit],
            scope,
            SuotarEndpoint::ResolveEnrolments.max_batch_size() as i64,
        )
        .await?;
        let ids: Vec<_> = claimed.iter().map(|row| row.id).collect();
        let mut contexts = get_submission_contexts(conn, &ids).await?;

        let mut prepared = Prepared::default();
        for row in claimed {
            let Some(context) = contexts.remove(&row.id) else {
                warn!(
                    "Credit registration {} has no completion or module to submit for.",
                    row.id
                );
                let outcome = missing_context_outcome(&row_facts(&row));
                if outcome.increment_submit_retry_count {
                    increment_submit_retry_count(conn, row.id).await?;
                }
                transition(
                    conn,
                    row.id,
                    &Transition {
                        event_message: Some(
                            "There is no completion or module to submit for.".to_string(),
                        ),
                        ..outcome_transition(&outcome, Some(row.state))
                    },
                )
                .await?;
                prepared.decided += 1;
                prepared.failed += 1;
                continue;
            };
            // Left for the next iteration's person lookup rather than frozen without the person.
            if context.student_number.is_some() && context.sisu_person_id.is_none() {
                continue;
            }
            match preflight(&context) {
                Ok(item) => {
                    // Moved out of the state this phase reads, so a second tick cannot pick it up
                    // while the request is out; `resolving_enrolment` rather than
                    // `checking_enrolment` so `import` cannot claim it either before the payload
                    // below is actually frozen.
                    transition(
                        conn,
                        row.id,
                        &Transition::to(CreditRegistrationState::ResolvingEnrolment),
                    )
                    .await?;
                    let request = ResolveEnrolmentRequestItem {
                        request_item_id: new_request_item_id(),
                        student_number: item.student_number.into(),
                        course_code: item.course_code,
                    };
                    prepared.sendable.push(((row, context), request));
                }
                Err(problem) => {
                    transition(conn, row.id, &problem.transition()).await?;
                    prepared.decided += 1;
                    prepared.failed += 1;
                }
            }
        }
        Ok(prepared)
    }

    fn registration((row, _): &Self::Row) -> &CreditRegistration {
        row
    }

    fn sent_student_number((_, context): &Self::Row) -> Option<&DbSecret> {
        context.student_number.as_ref()
    }

    async fn send(
        &self,
        ctx: &PhaseContext<'_>,
        rows: &[Self::Row],
        items: Vec<Self::Item>,
    ) -> Result<SuotarBatchResponse<Self::Result>, UtilError> {
        ctx.suotar_client
            .resolve_enrolments(
                SuotarCallContext::new(
                    ctx.worker_name(super::CreditRegistrationPhase::ResolveEnrolments),
                )
                .for_registrations(rows.iter().map(|(row, _)| row.id).collect()),
                items,
            )
            .await
    }

    async fn apply(
        &self,
        conn: &mut PgConnection,
        (row, context): &Self::Row,
        item: Option<&SuotarResponseItem<Self::Result>>,
        event: OutcomeEvent<'_>,
    ) -> anyhow::Result<bool> {
        apply_answer(conn, row, context, item, event).await
    }

    async fn apply_request_rejection(
        &self,
        conn: &mut PgConnection,
        (row, _): &Self::Row,
        request: &serde_json::Value,
        request_item_id: &str,
        error: &UtilError,
    ) -> anyhow::Result<bool> {
        apply_request_level_outcome(
            conn,
            SuotarEndpoint::ResolveEnrolments,
            row,
            request,
            request_item_id,
            error,
            CreditRegistrationState::ResolvingEnrolment,
        )
        .await
    }
}

/// Applies the study registry's answer for one row. Returns whether the row ended up in a failure
/// state; errors with `PreconditionFailed` if the row left `resolving_enrolment` meanwhile.
async fn apply_answer(
    conn: &mut PgConnection,
    row: &CreditRegistration,
    context: &SubmissionContext,
    item: Option<&SuotarResponseItem<EnrolmentResolutionResult>>,
    event: OutcomeEvent<'_>,
) -> anyhow::Result<bool> {
    let facts = row_facts(row);
    match item {
        None => {
            let outcome =
                unanswered_item_outcome(SuotarEndpoint::ResolveEnrolments, row.state, &facts);
            apply_outcome(
                conn,
                row,
                &outcome,
                OutcomeEvent {
                    message: Some("The study registry did not answer for this item."),
                    ..event
                },
                Some(CreditRegistrationState::ResolvingEnrolment),
            )
            .await?;
            Ok(counts_as_failed(&outcome))
        }
        Some(item) if item.status == SuotarItemStatus::Error => {
            let code = map_code(SuotarEndpoint::ResolveEnrolments, &item.code)
                .unwrap_or(CreditRegistrationErrorCode::Unknown);
            let outcome = submit_error_outcome(SuotarEndpoint::ResolveEnrolments, code, &facts);
            apply_outcome(
                conn,
                row,
                &outcome,
                OutcomeEvent {
                    error_message: item.error.as_ref().map(|error| error.message.as_str()),
                    ..event
                },
                Some(CreditRegistrationState::ResolvingEnrolment),
            )
            .await?;
            Ok(counts_as_failed(&outcome))
        }
        Some(item) => {
            let no_enrolments = Vec::new();
            let no_attainments = Vec::new();
            let (enrolments, existing) = item
                .result
                .as_ref()
                .map(|result| (&result.enrolments, &result.existing_attainments))
                .unwrap_or((&no_enrolments, &no_attainments));
            choose(conn, row, context, enrolments, existing, event).await
        }
    }
}

/// Applies the choice for one answered row. Returns whether the row ended up in a failure state.
async fn choose(
    conn: &mut PgConnection,
    row: &CreditRegistration,
    context: &SubmissionContext,
    enrolments: &[headless_lms_utils::services::suotar::SuotarEnrolment],
    existing: &[headless_lms_utils::services::suotar::ExistingAttainment],
    event: OutcomeEvent<'_>,
) -> anyhow::Result<bool> {
    let details = suotar_exchange_details(event.request, event.response);
    let credits = context.ects_credits.unwrap_or_default();
    let attainment_date =
        headless_lms_utils::helsinki_time::helsinki_date(context.completion.completion_date);
    let chosen = select_enrolment(
        enrolments,
        EnrolmentCriteria {
            attainment_date,
            credits,
        },
    );
    // The scale the grade would go out on; all enrolments on one course code share it in practice.
    let enrolment_grade_scale_id = chosen
        .ok()
        .and_then(|enrolment| enrolment.grade_scale_id.as_deref())
        .or_else(|| {
            enrolments
                .iter()
                .find_map(|enrolment| enrolment.grade_scale_id.as_deref())
        });
    // Before the enrolment problems below: if the registry already holds the attainment the credit
    // exists, so sending the student off to re-enrol would be wrong as well as unnecessary.
    let candidates = attained_candidates(existing);
    // The course unit attainment, when there is one: it is the one `sisu_attainment_id` holds.
    let blocking_attainment = candidates
        .iter()
        .max_by_key(|attainment| {
            (
                attainment.attainment_type == ATTAINMENT_TYPE_COURSE_UNIT,
                attainment.registration_date,
                attainment.attainment_date,
            )
        })
        .filter(|_| !improves_on_all(&candidates, context, enrolment_grade_scale_id));
    if let Some(attained) = blocking_attainment {
        headless_lms_models::credit_registrations::set_sisu_attainment_if_unclaimed(
            conn,
            row.id,
            &attained.id,
            Some(&attained.attainment_type),
        )
        .await?;
        transition(
            conn,
            row.id,
            &Transition {
                event_kind: CreditRegistrationEventKind::SuotarResponse,
                event_message: Some(
                    "The study registry already holds an attainment at least as good for this \
                     course, so nothing was submitted."
                        .to_string(),
                ),
                suotar_api_call_id: event.suotar_api_call_id,
                request_item_id: event.request_item_id.map(str::to_string),
                event_details: Some(details),
                // The row spent the Suotar round trip unlocked, so an admin action may have already
                // moved it out of `resolving_enrolment`.
                expected_from_state: Some(CreditRegistrationState::ResolvingEnrolment),
                ..Transition::to(CreditRegistrationState::Duplicate)
            },
        )
        .await?;
        return Ok(false);
    }

    let chosen = match chosen {
        Ok(chosen) => chosen,
        Err(reason) => {
            let outcome = headless_lms_models::library::credit_registration::outcomes::Outcome {
                error_code: Some(reason.error_code()),
                ..submit_error_outcome(
                    SuotarEndpoint::ResolveEnrolments,
                    reason.error_code(),
                    &row_facts(row),
                )
            };
            apply_outcome(
                conn,
                row,
                &outcome,
                OutcomeEvent {
                    message: Some(reason.message()),
                    ..event
                },
                Some(CreditRegistrationState::ResolvingEnrolment),
            )
            .await?;
            return Ok(true);
        }
    };

    let absent = DbSecret::new("");
    let built = build_payload_snapshot(
        &context.completion,
        PayloadSources {
            student_number: context.student_number.as_ref().unwrap_or(&absent),
            sisu_person_id: context.sisu_person_id.as_ref(),
            uh_course_code: context.uh_course_code.as_deref(),
            ects_credits: context.ects_credits,
            enrolment: Some(chosen),
        },
    );
    let built = match built {
        Ok(built) => built,
        Err(code) => {
            apply_outcome(
                conn,
                row,
                &submit_error_outcome(SuotarEndpoint::ResolveEnrolments, code, &row_facts(row)),
                event,
                Some(CreditRegistrationState::ResolvingEnrolment),
            )
            .await?;
            return Ok(true);
        }
    };
    set_payload_snapshot(conn, row.id, &built.snapshot).await?;
    let clamped = built.clamped_credits_from.map(|from| {
        format!(
            "Credits adjusted from {from} to {} to fit the enrolment's range.",
            built.snapshot.credits
        )
    });
    // Only now does the row become claimable by `import`: the payload is frozen and the event
    // records when the enrolment was resolved.
    transition(
        conn,
        row.id,
        &Transition {
            event_kind: CreditRegistrationEventKind::SuotarResponse,
            event_message: clamped,
            suotar_api_call_id: event.suotar_api_call_id,
            request_item_id: event.request_item_id.map(str::to_string),
            event_details: Some(details),
            expected_from_state: Some(CreditRegistrationState::ResolvingEnrolment),
            ..Transition::to(CreditRegistrationState::CheckingEnrolment)
        },
    )
    .await?;
    Ok(false)
}

/// Whether the grade we would send beats every attainment the registry already holds for the
/// course, which is what Suotar requires of an improvement.
///
/// Stricter than Suotar where the two differ: an equal grade never submits (Suotar would let a
/// later date or more credits through), and neither does a grade on a scale that does not rank
/// against a held one, or a held attainment missing its grade.
fn improves_on_all(
    candidates: &[&headless_lms_utils::services::suotar::ExistingAttainment],
    context: &SubmissionContext,
    enrolment_grade_scale_id: Option<&str>,
) -> bool {
    map_grade(GradeSource {
        passed: context.completion.passed,
        grade: context.completion.grade,
        enrolment_grade_scale_id,
    })
    .is_ok_and(|mapped| {
        candidates.iter().all(|attained| {
            let (Some(grade_scale_id), Some(grade_id)) =
                (&attained.grade_scale_id, &attained.grade_id)
            else {
                return false;
            };
            compare_grades(grade_scale_id, grade_id, &mapped) == GradeComparison::Better
        })
    })
}

struct ResolveRequest {
    student_number: DbSecret,
    course_code: String,
}

/// A row that cannot even be asked about: each of these is the student's or a teacher's to fix, and
/// none of them is worth a call.
enum Preflight {
    NoStudentNumber,
    Config(CreditRegistrationErrorCode),
}

impl Preflight {
    fn transition(&self) -> Transition {
        match self {
            Self::NoStudentNumber => Transition {
                event_message: Some(
                    "No verified student number is linked to the account.".to_string(),
                ),
                ..Transition::to(CreditRegistrationState::Pending)
            },
            Self::Config(code) => Transition {
                error_code: Some(*code),
                needs_admin_attention: Some(true),
                event_message: Some(
                    "The module is not configured for credit registration.".to_string(),
                ),
                ..Transition::to(CreditRegistrationState::FailedPermanent)
            },
        }
    }
}

fn preflight(context: &SubmissionContext) -> Result<ResolveRequest, Preflight> {
    let student_number = context
        .student_number
        .clone()
        .ok_or(Preflight::NoStudentNumber)?;
    let course_code = context
        .uh_course_code
        .as_deref()
        .map(str::trim)
        .filter(|code| !code.is_empty())
        .map(str::to_string)
        .ok_or(Preflight::Config(
            CreditRegistrationErrorCode::MissingUhCourseCode,
        ))?;
    if context.ects_credits.is_none() {
        return Err(Preflight::Config(
            CreditRegistrationErrorCode::MissingEctsCredits,
        ));
    }
    Ok(ResolveRequest {
        student_number,
        course_code,
    })
}
