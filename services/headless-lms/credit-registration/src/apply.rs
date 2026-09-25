//! Writing a decided outcome, the side writes the answer asked for, and the exchange behind it, to
//! one ledger row.

use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, scrub_text, suotar_exchange_details,
};
use headless_lms_models::credit_registrations::{
    self, CreditRegistration, CreditRegistrationState, PayloadSnapshot, Transition, Transitioned,
    set_resubmit_not_before, set_sisu_attainment_if_unclaimed, set_submitted_attainment,
};
use headless_lms_models::library::credit_registration::enrolment_checks::{
    self, EnrolmentCheckAnswer, record_enrolment_check,
};
use headless_lms_models::library::credit_registration::grade_mapping::MappedGrade;
use headless_lms_models::library::credit_registration::outcomes::{NextAttempt, Outcome};
use headless_lms_models::verified_student_numbers;
use headless_lms_utils::prelude::{DateTime, Utc};
use secrecy::{ExposeSecret, SecretString};
use sqlx::{Connection, PgConnection};
use uuid::Uuid;

use crate::error::CreditRegistrationResult;

/// Applies one decided outcome to one row, with the side writes and the exchange that produced it.
///
/// `expected_from_state` guards against writing back a decision made from a row snapshot that an
/// `await` (an external call, or just the gap since claiming) has let go stale: pass the state the
/// phase itself put the row in before that `await`, or `Some(registration.state)` when the phase
/// never moved the row before its own `await`.
pub(crate) async fn apply_outcome(
    conn: &mut PgConnection,
    registration: &CreditRegistration,
    outcome: &Outcome,
    effects: Effects<'_>,
    event: OutcomeEvent<'_>,
    expected_from_state: Option<CreditRegistrationState>,
) -> CreditRegistrationResult<Applied> {
    let transition = Transition {
        error_message: event.error_message.map(scrub_text),
        event_kind: CreditRegistrationEventKind::SuotarResponse,
        event_message: event.message.map(str::to_string),
        suotar_api_call_id: event.suotar_api_call_id,
        event_details: Some(suotar_exchange_details(event.request, event.response)),
        request_item_id: event.request_item_id.map(str::to_string),
        ..outcome.transition(expected_from_state)
    };
    write_outcome(conn, registration, outcome, effects, &event, &transition).await
}

/// [`apply_outcome`] for a [`Decision`], whose message and item error go on the event.
pub(crate) async fn apply_decision(
    conn: &mut PgConnection,
    registration: &CreditRegistration,
    decision: Decision<'_>,
    event: OutcomeEvent<'_>,
    expected_from_state: Option<CreditRegistrationState>,
) -> CreditRegistrationResult<Applied> {
    apply_outcome(
        conn,
        registration,
        &decision.outcome,
        decision.effects,
        OutcomeEvent {
            message: decision.message.as_deref(),
            error_message: decision.error_message,
            ..event
        },
        expected_from_state,
    )
    .await
}

/// [`apply_outcome`] for a decision made without asking the study registry, which has no exchange
/// to record.
pub(crate) async fn apply_unasked_outcome(
    conn: &mut PgConnection,
    registration: &CreditRegistration,
    outcome: &Outcome,
    message: &str,
    expected_from_state: Option<CreditRegistrationState>,
) -> CreditRegistrationResult<Applied> {
    let transition = Transition {
        event_message: Some(message.to_string()),
        ..outcome.transition(expected_from_state)
    };
    write_outcome(
        conn,
        registration,
        outcome,
        Effects::default(),
        &OutcomeEvent::default(),
        &transition,
    )
    .await
}

async fn write_outcome(
    conn: &mut PgConnection,
    registration: &CreditRegistration,
    outcome: &Outcome,
    effects: Effects<'_>,
    event: &OutcomeEvent<'_>,
    transition: &Transition,
) -> CreditRegistrationResult<Applied> {
    effects
        .write_before_transaction(conn, registration.id)
        .await?;
    // Only if the request carried this number: a student who linked a working one while the request
    // was out must not lose the link they just made.
    if outcome.drop_verified_student_number
        && let Some(linked) =
            verified_student_numbers::get_by_user_id(conn, registration.user_id).await?
        && event.sent_student_number.map(ExposeSecret::expose_secret)
            == Some(linked.student_number.expose_secret())
    {
        verified_student_numbers::soft_delete(conn, linked.id).await?;
    }
    let mut tx = conn.begin().await?;
    if outcome.increment_submit_retry_count {
        credit_registrations::increment_submit_retry_count(&mut tx, registration.id).await?;
    }
    effects
        .write_in_transaction(&mut tx, registration.id)
        .await?;
    let written =
        credit_registrations::transition_unless_moved_on(&mut tx, registration.id, transition)
            .await?;
    let after = match written {
        Transitioned::Written(after) => *after,
        Transitioned::MovedOn { found } => return Ok(Applied::MovedOn { found }),
    };
    if outcome.next == NextAttempt::NextEnrolmentRung {
        enrolment_checks::schedule_next_check(&mut tx, registration.id).await?;
    }
    record_enrolment_check(&mut tx, event.enrolment_check, &after).await?;
    tx.commit().await?;
    if outcome.to_state == CreditRegistrationState::SubmissionUncertain
        && registration.state != CreditRegistrationState::SubmissionUncertain
    {
        warn!(
            credit_registration_id = %registration.id,
            "Credit registration entered submission_uncertain; Sisu's outcome could not be confirmed"
        );
    }
    Ok(Applied::Written {
        is_failure: outcome.is_failure(),
    })
}

/// What writing one answer did to its row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Applied {
    /// `is_failure` when the row now carries an error code, which is what `items_failed` counts.
    Written { is_failure: bool },
    /// Another writer moved the row since it was read, so the row is theirs and nothing was
    /// written. The rest of the batch carries on: aborting would leave it in the state the phase's
    /// own preflight wrote, which no phase claims again.
    MovedOn { found: CreditRegistrationState },
}

/// What one answer does to its row, decided without touching the database.
pub(crate) struct Decision<'a> {
    pub outcome: Outcome,
    pub effects: Effects<'a>,
    /// The timeline line for the move.
    pub message: Option<String>,
    /// The item's own error from Suotar, persisted on the row.
    pub error_message: Option<&'a str>,
}

impl<'a> Decision<'a> {
    pub fn new(outcome: Outcome) -> Self {
        Self {
            outcome,
            effects: Effects::default(),
            message: None,
            error_message: None,
        }
    }

    pub fn with_message(self, message: impl Into<String>) -> Self {
        Self {
            message: Some(message.into()),
            ..self
        }
    }

    pub fn with_effects(self, effects: Effects<'a>) -> Self {
        Self { effects, ..self }
    }

    pub fn with_error_message(self, error_message: Option<&'a str>) -> Self {
        Self {
            error_message,
            ..self
        }
    }
}

/// The side writes an answer asks for besides the move, each where it has to happen.
#[derive(Debug, Default)]
pub(crate) struct Effects<'a> {
    /// The submission an import answer named, and its attainment type. Written before the move, so a
    /// row that moved on meanwhile still keeps the id support needs to find what was created.
    pub submitted_attainment: Option<(&'a str, Option<&'a str>)>,
    /// The Sisu attainment that settles the row, and its type. Outside any transaction: a lost race
    /// for it surfaces as a unique violation, which would abort the transaction, so the caller must
    /// not hold one open either.
    pub sisu_attainment: Option<(&'a str, &'a str)>,
    /// Suotar's own bound on when resending becomes safe.
    pub resubmit_not_before: Option<DateTime<Utc>>,
    /// What becomes of the payload, in the move's transaction, so it rolls back with a row that
    /// moved on.
    pub payload: Option<PayloadChange<'a>>,
}

/// What a resolved enrolment does to the payload a row carries.
#[derive(Debug)]
pub(crate) enum PayloadChange<'a> {
    /// Frozen for import, replacing the registered credits of the student's other attempts once it
    /// is registered.
    Frozen {
        snapshot: &'a PayloadSnapshot,
        supersedes: &'a [Uuid],
    },
    /// Not sent, since the registry already holds the credit: see
    /// [`credit_registrations::prepare_unsent_duplicate`].
    Unsent { weighed_grade: Option<MappedGrade> },
}

impl Effects<'_> {
    async fn write_before_transaction(
        &self,
        conn: &mut PgConnection,
        id: Uuid,
    ) -> CreditRegistrationResult<()> {
        if let Some((attainment_id, attainment_type)) = self.submitted_attainment {
            set_submitted_attainment(conn, id, attainment_id, attainment_type).await?;
        }
        if let Some((attainment_id, attainment_type)) = self.sisu_attainment {
            set_sisu_attainment_if_unclaimed(conn, id, attainment_id, Some(attainment_type))
                .await?;
        }
        if let Some(resubmit_not_before) = self.resubmit_not_before {
            set_resubmit_not_before(conn, id, resubmit_not_before).await?;
        }
        Ok(())
    }

    async fn write_in_transaction(
        &self,
        conn: &mut PgConnection,
        id: Uuid,
    ) -> CreditRegistrationResult<()> {
        match &self.payload {
            None => {}
            Some(PayloadChange::Frozen {
                snapshot,
                supersedes,
            }) => {
                for &replaced in *supersedes {
                    credit_registrations::mark_pending_superseded(conn, replaced, id).await?;
                }
                credit_registrations::set_payload_snapshot(conn, id, snapshot).await?;
            }
            Some(PayloadChange::Unsent { weighed_grade }) => {
                credit_registrations::prepare_unsent_duplicate(conn, id, weighed_grade.as_ref())
                    .await?;
            }
        }
        Ok(())
    }
}

/// The audit half of applying an outcome. Both bodies are scrubbed on the way into the event row.
#[derive(Default)]
pub(crate) struct OutcomeEvent<'a> {
    /// The student number this row's request actually carried, which may no longer be the linked
    /// one by the time the answer is applied.
    pub sent_student_number: Option<&'a SecretString>,
    pub message: Option<&'a str>,
    /// Persisted on the ledger row, so it is scrubbed before it is written.
    pub error_message: Option<&'a str>,
    pub suotar_api_call_id: Option<Uuid>,
    /// The requestItemId the row went out under in that call.
    pub request_item_id: Option<&'a str>,
    pub request: Option<&'a serde_json::Value>,
    pub response: Option<&'a serde_json::Value>,
    /// Set for a row on its enrolment check schedule, whose check is logged with the answer.
    pub enrolment_check: Option<&'a EnrolmentCheckAnswer<'a>>,
}
