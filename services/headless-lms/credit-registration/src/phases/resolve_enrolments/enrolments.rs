//! The second half of a `resolve-enrolments` iteration: the enrolment lookup, and freezing the
//! payload the import will send.

use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, LiveSuccessForModule,
    RecordedCredit, Transition, claim_due_for_resolve, get_recorded_credits_for_same_module,
    lock_live_successes_for_same_module, transition,
};
use headless_lms_models::library::credit_registration::classification::{
    is_enrolment_error, map_code,
};
use headless_lms_models::library::credit_registration::enrolment_checks::EnrolmentCheckAnswer;
use headless_lms_models::library::credit_registration::enrolment_selection::{
    EnrolmentCriteria, NoUsableEnrolment, attained_candidates, preferred_attainment,
    select_enrolment,
};
use headless_lms_models::library::credit_registration::grade_mapping::{
    GradeSource, grade_pairs, improves_on_all, map_grade,
};
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, missing_context_outcome, submit_error_outcome, unanswered_item_outcome,
};
use headless_lms_models::library::credit_registration::payload::{
    BuiltPayload, PayloadSources, build_payload_snapshot,
};
use headless_lms_models::library::credit_registration::submission_context::{
    SubmissionContext, get_submission_contexts,
};
use headless_lms_models::secret::DbSecret;
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{
    EnrolmentResolutionResult, ExistingAttainment, ResolveEnrolmentRequestItem, SuotarEndpoint,
    SuotarEnrolment, SuotarItemStatus, SuotarResponseItem, endpoints, new_request_item_id,
};
use sqlx::{Connection, PgConnection};
use std::collections::HashSet;
use uuid::Uuid;

use super::{Lookup, hold};
use crate::apply::{
    Applied, Decision, Effects, OutcomeEvent, PayloadChange, apply_decision, apply_unasked_outcome,
};
use crate::batch_phase::{Prepared, Refusal, SuotarBatchPhase};
use crate::dispatch::Iteration;
use crate::error::CreditRegistrationResult;

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ResolveEnrolments;

pub(super) struct ResolveEnrolments;

/// A claimed row and its frozen context: the answer is applied against what was asked, not against
/// a second read of the database.
pub(super) struct Resolvable {
    registration: CreditRegistration,
    context: SubmissionContext,
    lookup: Lookup,
}

impl AsRef<CreditRegistration> for Resolvable {
    fn as_ref(&self) -> &CreditRegistration {
        &self.registration
    }
}

impl SuotarBatchPhase for ResolveEnrolments {
    type Endpoint = endpoints::ResolveEnrolments;
    type Row = Resolvable;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every item of the batch came back unavailable.";

    async fn claim(
        &mut self,
        it: &Iteration<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, ResolveEnrolmentRequestItem>> {
        let claimed = claim_due_for_resolve(conn, it.scope, limit as i64).await?;
        let ids: Vec<_> = claimed.iter().map(|row| row.id).collect();
        let mut contexts = get_submission_contexts(conn, &ids).await?;

        let mut prepared = Prepared::default();
        let mut batched_student_modules = HashSet::new();
        for row in claimed {
            // Left claimable where it is: once this batch's row for the module is resolving, the
            // claim holds this one back until that one settles.
            if !batched_student_modules.insert((row.user_id, row.course_module_id)) {
                continue;
            }
            let Some(context) = contexts.remove(&row.id) else {
                warn!(
                    credit_registration_id = %row.id,
                    "Credit registration has no completion or module to submit for"
                );
                apply_unasked_outcome(
                    conn,
                    &row,
                    &missing_context_outcome(&RowFacts::of(&row, Utc::now())),
                    "There is no completion or module to submit for.",
                    Some(row.state),
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
                    let lookup = Lookup::of(&row);
                    let request = ResolveEnrolmentRequestItem {
                        request_item_id: new_request_item_id(),
                        student_number: item.student_number.into(),
                        course_code: item.course_code,
                    };
                    let resolvable = Resolvable {
                        registration: row,
                        context,
                        lookup,
                    };
                    prepared.sendable.push((resolvable, request));
                }
                Err(problem) => {
                    if let Preflight::Config(code) = &problem {
                        warn!(
                            credit_registration_id = %row.id,
                            error_code = ?code,
                            "Course module is not configured for credit registration"
                        );
                    }
                    transition(conn, row.id, &problem.transition()).await?;
                    prepared.decided += 1;
                    prepared.failed += 1;
                }
            }
        }
        hold(
            conn,
            prepared
                .sendable
                .iter()
                .map(|(resolvable, _)| (resolvable.registration.id, resolvable.lookup)),
        )
        .await?;
        Ok(prepared)
    }

    async fn apply(
        &self,
        conn: &mut PgConnection,
        resolvable: &Self::Row,
        item: Option<&SuotarResponseItem<EnrolmentResolutionResult>>,
        event: OutcomeEvent<'_>,
    ) -> CreditRegistrationResult<Applied> {
        let row = &resolvable.registration;
        let result = item.and_then(|item| item.result.as_ref());
        let enrolments = result
            .map(|result| result.enrolments.as_slice())
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
        let event = OutcomeEvent {
            enrolment_check: check.as_ref(),
            ..event
        };
        let expected = Some(resolvable.lookup.in_flight_state());
        let Some(item) = item else {
            let outcome =
                unanswered_item_outcome(ENDPOINT, row.state, &RowFacts::of(row, Utc::now()));
            let decision =
                Decision::new(outcome).with_message("Sisu did not answer for this item.");
            return apply_decision(conn, row, decision, event, expected).await;
        };
        let answer = if item.status == SuotarItemStatus::Error {
            Answer::Refused {
                code: map_code(ENDPOINT, &item.code)
                    .unwrap_or(CreditRegistrationErrorCode::Unknown),
                error_message: item.error.as_ref().map(|error| error.message.as_str()),
            }
        } else {
            Answer::Listed { enrolments, chosen }
        };
        let existing = result
            .map(|result| result.existing_attainments.as_slice())
            .unwrap_or_default();
        apply_answer(conn, resolvable, &answer, existing, event).await
    }

    fn on_refusal(&self, resolvable: &Self::Row) -> Refusal {
        Refusal::RequestLevel {
            in_flight: resolvable.lookup.in_flight_state(),
        }
    }
}

/// What an answered lookup said about the row's enrolment.
enum Answer<'a> {
    /// Suotar answered with an error, which for an enrolment error still lists the attainments.
    Refused {
        code: CreditRegistrationErrorCode,
        error_message: Option<&'a str>,
    },
    /// Suotar listed the enrolments; `chosen` is what [`select_enrolment`] made of them.
    Listed {
        enrolments: &'a [SuotarEnrolment],
        chosen: Result<&'a SuotarEnrolment, NoUsableEnrolment>,
    },
}

impl Answer<'_> {
    /// The scale the grade would go out on: the chosen enrolment's, or that of any listed one, since
    /// all enrolments on one course code share it in practice. With no enrolment to say, the held
    /// attainment's own scale is the best evidence of it.
    fn grade_scale_id<'a>(&'a self, existing: &'a [ExistingAttainment]) -> Option<&'a str> {
        match self {
            Self::Listed { enrolments, chosen } => chosen
                .ok()
                .and_then(|enrolment| enrolment.grade_scale_id.as_deref())
                .or_else(|| {
                    enrolments
                        .iter()
                        .find_map(|enrolment| enrolment.grade_scale_id.as_deref())
                }),
            Self::Refused { .. } => preferred_attainment(&attained_candidates(existing))
                .and_then(|attained| attained.grade_scale_id.as_deref()),
        }
    }

    /// Whether the answer would send the student off to enrol.
    fn is_enrolment_error(&self) -> bool {
        match self {
            Self::Refused { code, .. } => is_enrolment_error(*code),
            Self::Listed {
                chosen: Err(reason),
                ..
            } => is_enrolment_error(reason.error_code()),
            Self::Listed { chosen: Ok(_), .. } => false,
        }
    }
}

/// Applies an answered lookup: settles the row as `duplicate` when a credit it would not beat is
/// already held, fails it when there is nothing to register against, and otherwise freezes the
/// payload and queues the row for import.
///
/// What Sisu itself holds is weighed first, before anything is locked: if the attainment exists the
/// credit does, so sending the student off to re-enrol would be wrong as well as unnecessary. Then,
/// in one transaction, what we registered from another attempt, which Suotar's copy of Sisu may
/// predate, and for an enrolment error, the credits our records hold.
async fn apply_answer(
    conn: &mut PgConnection,
    resolvable: &Resolvable,
    answer: &Answer<'_>,
    existing: &[ExistingAttainment],
    event: OutcomeEvent<'_>,
) -> CreditRegistrationResult<Applied> {
    let row = &resolvable.registration;
    let context = &resolvable.context;
    let expected = Some(resolvable.lookup.in_flight_state());
    let grade_scale_id = answer.grade_scale_id(existing);
    let may_be_held_in_sisu = match answer {
        Answer::Listed { .. } => true,
        Answer::Refused { .. } => answer.is_enrolment_error(),
    };
    if may_be_held_in_sisu && let Some(attained) = held_in_sisu(existing, context, grade_scale_id) {
        let mut decision = unsent_duplicate(
            context,
            grade_scale_id,
            "Sisu already has an equal or better grade for this course, so nothing was submitted.",
        );
        decision.effects.sisu_attainment =
            Some((attained.id.as_str(), attained.attainment_type.as_str()));
        return apply_decision(conn, row, decision, event, expected).await;
    }

    let mut tx = conn.begin().await?;
    let registered = match answer {
        Answer::Listed { .. } => lock_live_successes_for_same_module(&mut tx, row.id).await?,
        Answer::Refused { .. } => Vec::new(),
    };
    let recorded = if answer.is_enrolment_error() {
        get_recorded_credits_for_same_module(&mut tx, row.id).await?
    } else {
        Vec::new()
    };
    let supersedes: Vec<Uuid> = registered.iter().map(|replaced| replaced.id).collect();
    let built;
    let decision = match resolve(answer, context, grade_scale_id, &registered, &recorded, row) {
        Resolution::HeldHere { message } => unsent_duplicate(context, grade_scale_id, message),
        Resolution::Fail(decision) => decision,
        Resolution::Freeze(frozen) => {
            built = frozen;
            // Only now does the row become claimable by `import`: the payload is frozen and the
            // event records when the enrolment was resolved.
            let decision = Decision::new(Outcome::to(CreditRegistrationState::CheckingEnrolment))
                .with_effects(Effects {
                    payload: Some(PayloadChange::Frozen {
                        snapshot: &built.snapshot,
                        supersedes: &supersedes,
                    }),
                    ..Effects::default()
                });
            match freeze_message(&built, !registered.is_empty()) {
                Some(message) => decision.with_message(message),
                None => decision,
            }
        }
    };
    let applied = apply_decision(&mut tx, row, decision, event, expected).await?;
    // What was written for a row that moved on meanwhile rolls back with it.
    if matches!(applied, Applied::Written { .. }) {
        tx.commit().await?;
    }
    Ok(applied)
}

/// What the answer comes to once Sisu is known not to hold the credit.
enum Resolution<'a> {
    /// Nothing is sent: our own records hold a credit the grade would not beat.
    HeldHere {
        message: &'static str,
    },
    Fail(Decision<'a>),
    Freeze(BuiltPayload),
}

/// `registered` are the student's other attempts for the module that the registry holds, locked;
/// `recorded` the credits our records hold for it, read only for an enrolment error.
fn resolve<'a>(
    answer: &Answer<'a>,
    context: &SubmissionContext,
    grade_scale_id: Option<&str>,
    registered: &[LiveSuccessForModule],
    recorded: &[RecordedCredit],
    row: &CreditRegistration,
) -> Resolution<'a> {
    let ours = grade_source(context, grade_scale_id);
    let registered_grades: Vec<_> = registered
        .iter()
        .map(LiveSuccessForModule::held_grade)
        .collect();
    if !registered.is_empty() && !improves_on_all(grade_pairs(&registered_grades), ours) {
        return Resolution::HeldHere {
            message: "A grade at least as good is already registered for this module from another \
                      attempt, so nothing was submitted.",
        };
    }
    // Suotar's copy of Sisu may predate a pull-path registration, so a student who holds the credit
    // would be told to enrol again. A better grade still gets the error, since an improvement needs
    // an enrolment too.
    let recorded_grades: Vec<_> = recorded.iter().map(RecordedCredit::held_grade).collect();
    if answer.is_enrolment_error()
        && !recorded.is_empty()
        && !improves_on_all(grade_pairs(&recorded_grades), ours)
    {
        return Resolution::HeldHere {
            message: "The study registry has no usable enrolment, but our records already hold a \
                      credit at least as good for this module, so nothing was submitted.",
        };
    }
    let facts = RowFacts::of(row, Utc::now());
    let chosen = match answer {
        Answer::Refused {
            code,
            error_message,
        } => {
            return Resolution::Fail(
                Decision::new(submit_error_outcome(ENDPOINT, *code, &facts))
                    .with_error_message(*error_message),
            );
        }
        Answer::Listed {
            chosen: Err(reason),
            ..
        } => {
            return Resolution::Fail(
                Decision::new(submit_error_outcome(ENDPOINT, reason.error_code(), &facts))
                    .with_message(reason.message()),
            );
        }
        Answer::Listed {
            chosen: Ok(chosen), ..
        } => *chosen,
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
    match built {
        Ok(built) => Resolution::Freeze(built),
        Err(code) => Resolution::Fail(Decision::new(submit_error_outcome(ENDPOINT, code, &facts))),
    }
}

/// The attainment the row settles as `duplicate` on: the preferred one of those the registry holds
/// for the course, when the grade we would send does not beat them.
///
/// `grade_scale_id` is the scale our grade would go out on; `None` guesses it from the completion.
fn held_in_sisu<'a>(
    existing: &'a [ExistingAttainment],
    context: &SubmissionContext,
    grade_scale_id: Option<&str>,
) -> Option<&'a ExistingAttainment> {
    let candidates = attained_candidates(existing);
    let attained = preferred_attainment(&candidates)?;
    let held = candidates.iter().map(|attained| {
        (
            attained.grade_scale_id.as_deref(),
            attained.grade_id.as_deref(),
        )
    });
    (!improves_on_all(held, grade_source(context, grade_scale_id))).then_some(attained)
}

/// A row that is not sent, because the registry already holds the credit, moving to `duplicate`.
/// The grade we would have sent stays on the row as the one a later regrade has to beat.
fn unsent_duplicate<'a>(
    context: &SubmissionContext,
    grade_scale_id: Option<&str>,
    message: &'static str,
) -> Decision<'a> {
    Decision::new(Outcome::to(CreditRegistrationState::Duplicate))
        .with_message(message)
        .with_effects(Effects {
            payload: Some(PayloadChange::Unsent {
                weighed_grade: map_grade(grade_source(context, grade_scale_id)).ok(),
            }),
            ..Effects::default()
        })
}

fn grade_source<'a>(
    context: &SubmissionContext,
    grade_scale_id: Option<&'a str>,
) -> GradeSource<'a> {
    GradeSource {
        passed: context.completion.passed,
        grade: context.completion.grade,
        enrolment_grade_scale_id: grade_scale_id,
    }
}

/// The timeline line for a frozen payload: that it replaces another attempt's registered grade,
/// and that its credits were adjusted to fit the enrolment.
fn freeze_message(built: &BuiltPayload, supersedes: bool) -> Option<String> {
    let superseded_message = supersedes.then(|| {
        format!(
            "This attempt's grade {} beats the one registered from another attempt, which this \
             one supersedes once it is registered.",
            built.snapshot.grade_id
        )
    });
    let clamped_message = built.clamped_credits_from.map(|from| {
        format!(
            "Credits adjusted from {from} to {} to fit the enrolment's range.",
            built.snapshot.credits
        )
    });
    [superseded_message, clamped_message]
        .into_iter()
        .flatten()
        .reduce(|first, second| format!("{first} {second}"))
}

/// What an enrolment must fit for this row's attainment to be registered against it.
fn enrolment_criteria(context: &SubmissionContext) -> EnrolmentCriteria {
    EnrolmentCriteria {
        attainment_date: headless_lms_utils::helsinki_time::helsinki_date(
            context.completion.completion_date,
        ),
        credits: context.ects_credits.unwrap_or_default(),
    }
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
