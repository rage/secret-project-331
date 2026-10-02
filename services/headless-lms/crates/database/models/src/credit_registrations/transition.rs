//! Moving a row between states: the only writer of `state`, and the one place an edge is checked
//! against [`CreditRegistrationState::allowed_targets`].

use super::registration::CreditRegistration;
use super::state::{
    ADMIN_ONLY_TARGETS, CreditRegistrationErrorCode, CreditRegistrationState,
    PendingSupersessionEffect,
};
use crate::credit_registration_events::{
    CreditRegistrationEventKind, NewCreditRegistrationEvent, SuotarAnswer,
};
use crate::error::missing_model_error;
use crate::prelude::*;
use crate::suotar_api_calls::SuotarEndpoint;
use chrono::TimeDelta;
use std::collections::HashMap;

/// What a move does to the row's admin-attention flag.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdminAttention {
    Raise,
    Clear,
}

impl AdminAttention {
    /// The flag as the move leaves it.
    pub fn is_raised(self) -> bool {
        self == Self::Raise
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Transition {
    pub to_state: CreditRegistrationState,
    pub error_code: Option<CreditRegistrationErrorCode>,
    /// Scrub before passing: this is persisted.
    pub error_message: Option<String>,
    /// `None` leaves the flag as it was.
    pub needs_admin_attention: Option<AdminAttention>,
    pub event_kind: CreditRegistrationEventKind,
    pub event_message: Option<String>,
    pub actor_user_id: Option<Uuid>,
    pub suotar_api_call_id: Option<Uuid>,
    pub suotar_endpoint: Option<SuotarEndpoint>,
    pub suotar_requested_at: Option<DateTime<Utc>>,
    pub suotar_answered_at: Option<DateTime<Utc>>,
    pub suotar_answer: Option<SuotarAnswer>,
    /// Already scrubbed `{request, response}` payload for the event row.
    pub event_details: Option<serde_json::Value>,
    /// The requestItemId the row went out under in the call behind this move.
    pub request_item_id: Option<String>,
    /// Set by a caller that computed `to_state` from a row snapshot taken before an `await` (an
    /// external call, or a gap before its own transaction) during which some other writer could
    /// have moved the row on. `None` skips the check, for callers writing from a snapshot taken
    /// under the same transaction's lock.
    pub expected_from_state: Option<CreditRegistrationState>,
    /// Which (from → to) edges this write may take; see [`TransitionPolicy`].
    pub policy: TransitionPolicy,
    /// When the pipeline may claim the row next. `None` takes the target state's default cadence,
    /// which is what keeps a caller that forgets from leaving the row spinning.
    pub next_attempt_at: Option<DateTime<Utc>>,
    /// Leaves `enrolment_checked_at` alone on a move that would stamp it: a lookup that failed in
    /// transit, or only found the Sisu person, did not check the enrolment.
    pub keeps_enrolment_checked_at: bool,
}

/// Which (from → to) edges [`transition`] will write.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransitionPolicy {
    /// [`CreditRegistrationState::allowed_targets`] only: what the phases and the precondition
    /// recompute may take.
    Pipeline,
    /// Also [`ADMIN_ONLY_TARGETS`], for a teacher's retry or an admin's hand transition. Whether
    /// this particular row may take the edge is
    /// [`ResubmissionFacts::admin_transition_refusal`](super::ResubmissionFacts::admin_transition_refusal)'s
    /// question.
    Admin,
    /// No edge check. Fixtures only: seeds and tests plant a row in a state the pipeline could not
    /// have reached from where it stands in one move.
    Planted,
}

impl TransitionPolicy {
    fn allows(self, from: CreditRegistrationState, to: CreditRegistrationState) -> bool {
        match self {
            Self::Pipeline => from.allowed_targets().contains(&to),
            Self::Admin => from.allowed_targets().contains(&to) || ADMIN_ONLY_TARGETS.contains(&to),
            Self::Planted => true,
        }
    }
}

impl Transition {
    pub fn to(to_state: CreditRegistrationState) -> Self {
        Self {
            to_state,
            error_code: None,
            error_message: None,
            needs_admin_attention: None,
            event_kind: CreditRegistrationEventKind::StateChanged,
            event_message: None,
            actor_user_id: None,
            suotar_api_call_id: None,
            suotar_endpoint: None,
            suotar_requested_at: None,
            suotar_answered_at: None,
            suotar_answer: None,
            event_details: None,
            request_item_id: None,
            expected_from_state: None,
            policy: TransitionPolicy::Pipeline,
            next_attempt_at: None,
            keeps_enrolment_checked_at: false,
        }
    }

    /// A move a human asked for, which may also take the [`ADMIN_ONLY_TARGETS`] edges.
    pub fn by_hand(to_state: CreditRegistrationState) -> Self {
        Self {
            policy: TransitionPolicy::Admin,
            ..Self::to(to_state)
        }
    }

    /// A fixture planting a row in a state directly; see [`TransitionPolicy::Planted`].
    pub fn planted(to_state: CreditRegistrationState) -> Self {
        Self {
            policy: TransitionPolicy::Planted,
            ..Self::to(to_state)
        }
    }
}

/// Moves a ledger row to a new state and appends the matching audit event, atomically.
///
/// The only writer of `state`, and the one place (from → to) legality is decided: an edge outside
/// the transition's [`TransitionPolicy`] is refused as `InvalidRequest` rather than written. A row
/// no longer in `expected_from_state` is refused as `PreconditionFailed`; a caller that has to tell
/// that apart from a real failure uses [`transition_unless_moved_on`] instead.
///
/// Owns the lifecycle stamps, so callers must not touch them (bar
/// [`reset_for_resubmission`](super::reset_for_resubmission) clearing `first_failed_at`):
/// `state_entered_at`, `terminal_at`, `first_failed_at` and `submit_retry_count`, which starting to
/// wait for an enrolment clears, `registered_at`, `submitted_at`, `enrolment_checked_at`,
/// `enrolment_banner_dismissed_at`, which starting to wait for an enrolment clears,
/// `no_usable_enrolment_since`, and `next_attempt_at`, which takes the target state's default
/// cadence unless the caller names a time. Leaving the wait for an enrolment also clears the check
/// schedule, but not `enrolment_check_group`, and every move clears the claim of an enrolment
/// check. Returns the row as written.
pub async fn transition(
    conn: &mut PgConnection,
    id: Uuid,
    transition: &Transition,
) -> ModelResult<CreditRegistration> {
    match transition_unless_moved_on(conn, id, transition).await? {
        Transitioned::Written(after) => Ok(*after),
        Transitioned::MovedOn { found } => Err(model_err!(
            PreconditionFailed,
            format!(
                "Credit registration {id} is in {found:?}, not the expected {}: refusing to overwrite it.",
                transition
                    .expected_from_state
                    .map(|expected| format!("{expected:?}"))
                    .unwrap_or_default()
            )
        )),
    }
}

/// What [`transition_unless_moved_on`] did.
#[derive(Debug, Clone)]
pub enum Transitioned {
    /// The row as written.
    Written(Box<CreditRegistration>),
    /// Another writer moved the row out of `expected_from_state` first, so nothing was written.
    MovedOn { found: CreditRegistrationState },
}

/// [`transition`] for a caller deciding from a snapshot another writer may have overtaken: a row
/// no longer in `expected_from_state` comes back as [`Transitioned::MovedOn`] rather than as an
/// error, since the row is now that writer's and the caller carries on with the rest of its work.
pub async fn transition_unless_moved_on(
    conn: &mut PgConnection,
    id: Uuid,
    transition: &Transition,
) -> ModelResult<Transitioned> {
    let mut tx = conn.begin().await?;
    let from_state = lock_for_moves(&mut tx, &[id])
        .await?
        .remove(&id)
        .ok_or_else(missing_model_error(
            ModelErrorType::RecordNotFound,
            format!("Credit registration {id} does not exist."),
        ))?;
    if transition
        .expected_from_state
        .is_some_and(|expected| from_state != expected)
    {
        return Ok(Transitioned::MovedOn { found: from_state });
    }
    check_edge(id, from_state, transition.to_state, transition.policy)?;
    let after = write_moves(&mut tx, &[(id, from_state, transition)])
        .await?
        .pop()
        .ok_or_else(missing_model_error(
            ModelErrorType::RecordNotFound,
            format!("Credit registration {id} does not exist."),
        ))?;
    tx.commit().await?;
    Ok(Transitioned::Written(Box::new(after)))
}

/// The states of the named rows, locked until the caller's transaction ends.
async fn lock_for_moves(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, CreditRegistrationState>> {
    let locked = sqlx::query!(
        r#"
SELECT id,
  state
FROM credit_registrations
WHERE id = ANY($1)
  AND deleted_at IS NULL
ORDER BY id FOR
UPDATE
        "#,
        ids
    )
    .fetch_all(conn)
    .await?;
    Ok(locked.into_iter().map(|row| (row.id, row.state)).collect())
}

/// Writes already checked moves of locked rows, with their events, and returns the rows as written.
async fn write_moves(
    conn: &mut PgConnection,
    moves: &[(Uuid, CreditRegistrationState, &Transition)],
) -> ModelResult<Vec<CreditRegistration>> {
    let events: Vec<NewCreditRegistrationEvent> = moves
        .iter()
        .map(|(id, from_state, transition)| NewCreditRegistrationEvent {
            credit_registration_id: *id,
            kind: transition.event_kind,
            from_state: Some(*from_state),
            to_state: Some(transition.to_state),
            error_code: transition.error_code,
            message: transition.event_message.clone(),
            suotar_api_call_id: transition.suotar_api_call_id,
            suotar_endpoint: transition.suotar_endpoint,
            suotar_requested_at: transition.suotar_requested_at,
            suotar_answered_at: transition.suotar_answered_at,
            suotar_answer: transition.suotar_answer,
            actor_user_id: transition.actor_user_id,
            details: transition.event_details.clone(),
            request_item_id: transition.request_item_id.clone(),
        })
        .collect();
    let ids: Vec<Uuid> = moves.iter().map(|(id, _, _)| *id).collect();
    let to_states: Vec<CreditRegistrationState> = moves
        .iter()
        .map(|(_, _, transition)| transition.to_state)
        .collect();
    let error_codes: Vec<Option<CreditRegistrationErrorCode>> = moves
        .iter()
        .map(|(_, _, transition)| transition.error_code)
        .collect();
    let error_messages: Vec<Option<String>> = moves
        .iter()
        .map(|(_, _, transition)| transition.error_message.clone())
        .collect();
    let needs_admin: Vec<Option<bool>> = moves
        .iter()
        .map(|(_, _, transition)| {
            transition
                .needs_admin_attention
                .map(AdminAttention::is_raised)
        })
        .collect();
    let terminal: Vec<bool> = to_states.iter().map(|state| state.is_terminal()).collect();
    let failure: Vec<bool> = to_states
        .iter()
        .map(|state| state.is_failed_state())
        .collect();
    let next_attempts: Vec<Option<DateTime<Utc>>> = moves
        .iter()
        .map(|(_, _, transition)| transition.next_attempt_at)
        .collect();
    let default_delays: Vec<TimeDelta> = to_states
        .iter()
        .map(|state| state.default_attempt_delay())
        .collect();
    let keeps_checked_at: Vec<bool> = moves
        .iter()
        .map(|(_, _, transition)| transition.keeps_enrolment_checked_at)
        .collect();
    let keeps_schedule: Vec<bool> = to_states
        .iter()
        .map(|state| state.keeps_enrolment_check_schedule())
        .collect();
    let keeps_waiting_since: Vec<bool> = to_states
        .iter()
        .map(|state| {
            state.keeps_enrolment_check_schedule()
                && *state != CreditRegistrationState::NoUsableEnrolment
        })
        .collect();
    let written = sqlx::query_as!(
        CreditRegistration,
        r#"
UPDATE credit_registrations cr
SET state = move.to_state,
  -- clock_timestamp(), not now(): now() is the transaction timestamp, so several state changes in
  -- one transaction would share an instant and the timeline would lose their order.
  state_entered_at = clock_timestamp(),
  error_code = move.error_code,
  error_message = move.error_message,
  needs_admin_attention = COALESCE(move.needs_admin_attention, cr.needs_admin_attention),
  -- ELSE NULL: without it an admin retry stays invisible to every terminal_at IS NULL query.
  terminal_at = CASE
    WHEN move.terminal THEN COALESCE(cr.terminal_at, now())
    ELSE NULL
  END,
  first_failed_at = CASE
    WHEN move.failure THEN COALESCE(cr.first_failed_at, now())
    WHEN move.to_state = 'no_usable_enrolment' THEN NULL
    ELSE cr.first_failed_at
  END,
  submit_retry_count = CASE
    WHEN move.to_state = 'no_usable_enrolment' THEN 0
    ELSE cr.submit_retry_count
  END,
  registered_at = CASE
    WHEN move.to_state = 'registered' THEN COALESCE(cr.registered_at, now())
    ELSE cr.registered_at
  END,
  submitted_at = CASE
    WHEN move.to_state = 'submitting' THEN now()
    ELSE cr.submitted_at
  END,
  enrolment_checked_at = CASE
    WHEN move.keeps_checked_at THEN cr.enrolment_checked_at
    WHEN (
      cr.state = 'resolving_enrolment'
      OR cr.enrolment_check_claimed_until IS NOT NULL
    )
    AND move.to_state IN ('checking_enrolment', 'no_usable_enrolment') THEN now()
    WHEN cr.state = 'checking_enrolment'
    AND move.to_state <> 'checking_enrolment' THEN now()
    ELSE cr.enrolment_checked_at
  END,
  -- Only on starting to wait, not on every check that finds no enrolment again.
  enrolment_banner_dismissed_at = CASE
    WHEN move.to_state = 'no_usable_enrolment'
    AND cr.no_usable_enrolment_since IS NULL THEN NULL
    ELSE cr.enrolment_banner_dismissed_at
  END,
  -- A retried lookup passes through the states that keep it on its way back to no_usable_enrolment.
  no_usable_enrolment_since = CASE
    WHEN move.to_state = 'no_usable_enrolment' THEN COALESCE(cr.no_usable_enrolment_since, now())
    WHEN move.keeps_waiting_since THEN cr.no_usable_enrolment_since
    ELSE NULL
  END,
  enrolment_check_anchor_at = CASE
    WHEN move.keeps_schedule THEN cr.enrolment_check_anchor_at
  END,
  enrolment_check_step = CASE
    WHEN move.keeps_schedule THEN cr.enrolment_check_step
  END,
  enrolment_check_due_at = CASE
    WHEN move.keeps_schedule THEN cr.enrolment_check_due_at
  END,
  is_enrolment_check_batched = move.keeps_schedule
  AND cr.is_enrolment_check_batched,
  enrolment_checks_stopped_at = CASE
    WHEN move.keeps_schedule THEN cr.enrolment_checks_stopped_at
  END,
  enrolment_check_source = CASE
    WHEN move.keeps_schedule THEN cr.enrolment_check_source
    ELSE 'schedule'
  END,
  enrolment_check_claimed_until = NULL,
  next_attempt_at = COALESCE(
    move.next_attempt_at,
    now() + move.default_delay
  )
FROM UNNEST(
    $1::uuid [],
    $2::credit_registration_state [],
    $3::credit_registration_error_code [],
    $4::text [],
    $5::boolean [],
    $6::boolean [],
    $7::boolean [],
    $8::timestamptz [],
    $9::interval [],
    $10::boolean [],
    $11::boolean [],
    $12::boolean []
  ) AS move(
    id,
    to_state,
    error_code,
    error_message,
    needs_admin_attention,
    terminal,
    failure,
    next_attempt_at,
    default_delay,
    keeps_checked_at,
    keeps_schedule,
    keeps_waiting_since
  )
WHERE cr.id = move.id
  AND cr.deleted_at IS NULL
RETURNING cr.*
        "#,
        &ids,
        &to_states as &[CreditRegistrationState],
        &error_codes as &[Option<CreditRegistrationErrorCode>],
        &error_messages as &[Option<String>],
        &needs_admin as &[Option<bool>],
        &terminal,
        &failure,
        &next_attempts as &[Option<DateTime<Utc>>],
        &default_delays as &[TimeDelta],
        &keeps_checked_at,
        &keeps_schedule,
        &keeps_waiting_since,
    )
    .fetch_all(&mut *conn)
    .await?;

    let settled: Vec<_> = ids.iter().copied().zip(to_states.iter().copied()).collect();
    settle_pending_supersessions(&mut *conn, &settled).await?;
    crate::credit_registration_events::insert_batch(conn, &events).await?;
    Ok(written)
}

/// Completes or abandons the pending supersessions of rows that were waiting on these attempts, as
/// each attempt's new state decides.
async fn settle_pending_supersessions(
    conn: &mut PgConnection,
    moves: &[(Uuid, CreditRegistrationState)],
) -> ModelResult<()> {
    let mut completed = Vec::new();
    let mut abandoned = Vec::new();
    for &(id, to_state) in moves {
        match to_state.pending_supersession_effect() {
            PendingSupersessionEffect::Keep => {}
            PendingSupersessionEffect::Complete => completed.push(id),
            PendingSupersessionEffect::Abandon => abandoned.push(id),
        }
    }
    if completed.is_empty() && abandoned.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET superseded_by_id = CASE
    WHEN pending_superseded_by_id = ANY($1::uuid []) THEN pending_superseded_by_id
    ELSE superseded_by_id
  END,
  superseded_at = CASE
    WHEN pending_superseded_by_id = ANY($1::uuid []) THEN now()
    ELSE superseded_at
  END,
  pending_superseded_by_id = NULL
WHERE (
    pending_superseded_by_id = ANY($1::uuid [])
    OR pending_superseded_by_id = ANY($2::uuid [])
  )
  AND deleted_at IS NULL
        "#,
        &completed,
        &abandoned,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Refuses an edge outside the policy. The one place (from → to) legality is decided, for the
/// single-row [`transition`] and the batched [`transition_batch`] alike.
fn check_edge(
    id: Uuid,
    from: CreditRegistrationState,
    to: CreditRegistrationState,
    policy: TransitionPolicy,
) -> ModelResult<()> {
    // Staying put is not a move: the verify poller rewrites its own state on every poll.
    if from == to || policy.allows(from, to) {
        return Ok(());
    }
    Err(model_err!(
        InvalidRequest,
        format!("Credit registration {id} may not move from {from:?} to {to:?} under {policy:?}.")
    ))
}

/// One row's move in a [`transition_batch`].
#[derive(Debug, Clone, PartialEq)]
pub struct BatchMove {
    pub id: Uuid,
    pub transition: Transition,
}

/// [`transition`] for a whole batch: one lock, one update, one insert of events, whatever the size.
///
/// For the phases that decide many rows from one query and have no per-row exchange to record.
/// Same edge table and policy as [`transition`], and the same event rows; the one difference is
/// that a row whose state no longer matches `expected_from_state` is left alone rather than
/// refused, since a batch has no single caller to hand the refusal to. Returns how many moved.
pub async fn transition_batch(conn: &mut PgConnection, moves: &[BatchMove]) -> ModelResult<i64> {
    if moves.is_empty() {
        return Ok(0);
    }
    let mut tx = conn.begin().await?;
    let ids: Vec<Uuid> = moves.iter().map(|batch_move| batch_move.id).collect();
    let locked = lock_for_moves(&mut tx, &ids).await?;
    let mut writes = Vec::new();
    for batch_move in moves {
        let Some(&from) = locked.get(&batch_move.id) else {
            continue;
        };
        if batch_move
            .transition
            .expected_from_state
            .is_some_and(|expected| expected != from)
        {
            continue;
        }
        check_edge(
            batch_move.id,
            from,
            batch_move.transition.to_state,
            batch_move.transition.policy,
        )?;
        writes.push((batch_move.id, from, &batch_move.transition));
    }
    if !writes.is_empty() {
        write_moves(&mut tx, &writes).await?;
    }
    tx.commit().await?;
    Ok(i64::try_from(writes.len()).unwrap_or(i64::MAX))
}
