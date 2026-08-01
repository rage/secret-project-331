//! The `resolve-enrolments` phase: which enrolment the attainment belongs to, and what we will send.
//!
//! Ends with the payload frozen and the row queued for import in `checking_enrolment`. It
//! deliberately does not write `submitting`: that state means a request may be in flight, and the
//! import phase writes it in the transaction before it sends.

use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, suotar_exchange_details,
};
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, Transition,
    claim_due, map_code, schedule_next_attempt, set_payload_snapshot, transition,
};
use headless_lms_models::library::credit_registration::classification::{
    next_attempt_at, submit_backoff_secs,
};
use headless_lms_models::library::credit_registration::enrolment_selection::{
    EnrolmentCriteria, attainment_for_course_unit, select_enrolment,
};
use headless_lms_models::library::credit_registration::outcomes::{
    submit_error_outcome, unanswered_item_outcome,
};
use headless_lms_models::library::credit_registration::payload::{
    PayloadSources, build_payload_snapshot,
};
use headless_lms_models::library::credit_registration::submission_context::{
    SubmissionContext, get_submission_contexts,
};
use headless_lms_models::suotar_api_calls::SuotarEndpoint as AuditEndpoint;
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{
    ResolveEnrolmentRequestItem, SuotarCallContext, SuotarEndpoint, SuotarItemStatus,
};
use sqlx::Connection;

use super::{
    OutcomeEvent, PhaseContext, PhaseScope, apply_outcome, counts_as_failed,
    every_item_failed_transiently, request_level_failure, response_item_json, row_facts,
};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let endpoint = SuotarEndpoint::ResolveEnrolments;
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_due(
        &mut tx,
        &[CreditRegistrationState::ReadyToSubmit],
        scope,
        endpoint.max_batch_size() as i64,
    )
    .await?;
    let ids: Vec<_> = claimed.iter().map(|row| row.id).collect();
    let mut contexts = get_submission_contexts(&mut tx, &ids).await?;

    let mut items = Vec::new();
    let mut rows = Vec::new();
    let mut items_failed = 0;
    for row in claimed {
        let Some(context) = contexts.remove(&row.id) else {
            // Nothing to build a request from, and leaving the row due would spin the phase on it
            // every ten seconds.
            warn!(
                "Credit registration {} has no completion or module to submit for.",
                row.id
            );
            schedule_next_attempt(
                &mut tx,
                row.id,
                next_attempt_at(Utc::now(), submit_backoff_secs(row.submit_retry_count)),
            )
            .await?;
            continue;
        };
        match preflight(&context) {
            Ok(item) => {
                // Claimed by moving the row out of the state this phase reads, so a second tick
                // cannot pick it up while the request is out.
                transition(
                    &mut tx,
                    row.id,
                    &Transition::to(CreditRegistrationState::CheckingEnrolment),
                )
                .await?;
                items.push(ResolveEnrolmentRequestItem {
                    // Verbatim from the row: this id is the only handle the registry's log, our
                    // audit log and a per-row test fault have on one registration.
                    request_item_id: row.request_item_id.clone(),
                    student_number: item.student_number,
                    course_code: item.course_code,
                });
                rows.push((row, context));
            }
            Err(problem) => {
                transition(&mut tx, row.id, &problem.transition()).await?;
                items_failed += 1;
            }
        }
    }
    tx.commit().await?;

    if items.is_empty() {
        return Ok(PhaseRunOutcome {
            items_processed: items_failed,
            items_failed,
            error: None,
        });
    }

    let requests: Vec<serde_json::Value> = items
        .iter()
        .map(|item| serde_json::to_value(item).unwrap_or_default())
        .collect();
    let response = ctx
        .suotar_client
        .resolve_enrolments(
            SuotarCallContext::new(
                ctx.worker_name(super::CreditRegistrationPhase::ResolveEnrolments),
            )
            .for_registrations(rows.iter().map(|(row, _)| row.id).collect()),
            items,
        )
        .await;

    let response = match response {
        Ok(response) => response,
        Err(error) => {
            return request_level_failure(
                ctx,
                AuditEndpoint::ResolveEnrolments,
                &error,
                &rows.iter().map(|(row, _)| row.clone()).collect::<Vec<_>>(),
                &requests,
            )
            .await;
        }
    };

    let mut conn = ctx.pool.acquire().await?;
    for ((row, context), request) in rows.iter().zip(requests.iter()) {
        let item = response.item(&row.request_item_id);
        let response_json = response_item_json(&response.raw_response, &row.request_item_id);
        let event = OutcomeEvent {
            suotar_api_call_id: response.call_id,
            request: Some(request),
            response: response_json.as_ref(),
            ..OutcomeEvent::default()
        };
        let facts = row_facts(row);
        let failed = match item {
            None => {
                let outcome =
                    unanswered_item_outcome(AuditEndpoint::ResolveEnrolments, row.state, &facts);
                apply_outcome(
                    &mut conn,
                    row,
                    &outcome,
                    OutcomeEvent {
                        message: Some("The study registry did not answer for this item."),
                        ..event
                    },
                )
                .await?;
                counts_as_failed(&outcome)
            }
            Some(item) if item.status == SuotarItemStatus::Error => {
                let code = map_code(AuditEndpoint::ResolveEnrolments, &item.code)
                    .unwrap_or(CreditRegistrationErrorCode::Unknown);
                let outcome = submit_error_outcome(AuditEndpoint::ResolveEnrolments, code, &facts);
                apply_outcome(
                    &mut conn,
                    row,
                    &outcome,
                    OutcomeEvent {
                        error_message: item.error.as_ref().map(|error| error.message.as_str()),
                        ..event
                    },
                )
                .await?;
                counts_as_failed(&outcome)
            }
            Some(item) => {
                let no_enrolments = Vec::new();
                let no_attainments = Vec::new();
                let (enrolments, existing) = item
                    .result
                    .as_ref()
                    .map(|result| (&result.enrolments, &result.existing_attainments))
                    .unwrap_or((&no_enrolments, &no_attainments));
                choose(&mut conn, row, context, enrolments, existing, event).await?
            }
        };
        if failed {
            items_failed += 1;
        }
    }

    let processed = i32::try_from(rows.len()).unwrap_or(i32::MAX) + items_failed;
    Ok(PhaseRunOutcome {
        items_processed: processed,
        items_failed,
        error: every_item_failed_transiently(&response)
            .then(|| "Every item of the batch came back transiently unavailable.".to_string()),
    })
}

/// Applies the choice for one answered row. Returns whether the row ended up in a failure state.
async fn choose(
    conn: &mut sqlx::PgConnection,
    row: &CreditRegistration,
    context: &SubmissionContext,
    enrolments: &[headless_lms_utils::services::suotar::SuotarEnrolment],
    existing: &[headless_lms_utils::services::suotar::ExistingAttainment],
    event: OutcomeEvent<'_>,
) -> anyhow::Result<bool> {
    let details = suotar_exchange_details(event.request, event.response);
    // Looked at before the enrolment is chosen, and deliberately so: if the registry already holds
    // the attainment the credit exists, and sending the student off to re-enrol over a stale
    // enrolment would be both wrong and unnecessary.
    let already_attained = enrolments.iter().find_map(|enrolment| {
        attainment_for_course_unit(
            existing,
            &enrolment.course_unit_id,
            &enrolment.assessment_item_id,
        )
    });
    if let Some(attained) = already_attained {
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
                    "The study registry already holds an attainment for this course unit, so \
                     nothing was submitted."
                        .to_string(),
                ),
                suotar_api_call_id: event.suotar_api_call_id,
                event_details: Some(details),
                ..Transition::to(CreditRegistrationState::Duplicate)
            },
        )
        .await?;
        return Ok(false);
    }

    let credits = context.ects_credits.unwrap_or_default();
    let attainment_date = headless_lms_models::library::credit_registration::payload::helsinki_date(
        context.completion.completion_date,
    );
    let chosen = select_enrolment(
        enrolments,
        EnrolmentCriteria {
            attainment_date,
            credits,
            configured_realisation_ids: &context.configured_realisation_ids,
        },
    );
    let chosen = match chosen {
        Ok(chosen) => chosen,
        Err(reason) => {
            let outcome = headless_lms_models::library::credit_registration::outcomes::Outcome {
                error_code: Some(reason.error_code()),
                ..submit_error_outcome(
                    AuditEndpoint::ResolveEnrolments,
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
            )
            .await?;
            return Ok(true);
        }
    };

    let built = build_payload_snapshot(
        &context.completion,
        PayloadSources {
            student_number: context.student_number.as_deref().unwrap_or_default(),
            sisu_person_id: context.sisu_person_id.as_deref().unwrap_or_default(),
            uh_course_code: context.uh_course_code.as_deref(),
            ects_credits: context.ects_credits,
            configured_grade_scale_id: context.configured_grade_scale_id.as_deref(),
            enrolment: Some(chosen),
        },
    );
    let built = match built {
        Ok(built) => built,
        Err(code) => {
            apply_outcome(
                conn,
                row,
                &submit_error_outcome(AuditEndpoint::ResolveEnrolments, code, &row_facts(row)),
                event,
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
    // A self-transition: the row stays queued for import, and the event is what records that the
    // enrolment was resolved and when.
    transition(
        conn,
        row.id,
        &Transition {
            event_kind: CreditRegistrationEventKind::SuotarResponse,
            event_message: clamped,
            suotar_api_call_id: event.suotar_api_call_id,
            event_details: Some(details),
            ..Transition::to(CreditRegistrationState::CheckingEnrolment)
        },
    )
    .await?;
    Ok(false)
}

/// What the row still needs before a request can be built for it.
struct ResolveRequest {
    student_number: String,
    course_code: String,
}

/// A row that cannot even be asked about. Each of these is either the student's to fix or a
/// teacher's, and none of them is worth a call.
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
                ..Transition::to(CreditRegistrationState::PendingStudentNumber)
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
        .clone()
        .filter(|code| !code.trim().is_empty())
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
