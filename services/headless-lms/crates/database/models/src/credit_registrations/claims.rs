//! Claiming due rows for a worker phase.
//!
//! Every claim takes up to `limit` due rows in its states, the longest due first. The row locks
//! live until the caller's transaction ends, so callers must pass a transaction. Rows on a paused
//! course module, or on one whose credit registration has been switched off, are never claimed:
//! enforced here so no phase can forget it. Both freeze a row where it stands rather than
//! cancelling it, so switching the module back on resumes the rows that were already in flight.
//!
//! An unscoped claim (the live background worker) also skips a row whose user (and, if the hold
//! names one, course) has a live row in `credit_registration_test_exclusive_holds`. A scoped claim
//! always ignores holds, so a spec driving its own rows through explicit ticks is unaffected
//! either way.

use crate::prelude::*;
use chrono::TimeDelta;
use secrecy::ExposeSecret;

use super::registration::CreditRegistration;
use super::state::CreditRegistrationState;

/// Which rows a phase iteration may touch. Empty means every row, which is what production runs; a
/// narrowed scope lets a test drive the pipeline for its own course on a shared database.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct RegistrationScope {
    pub course_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    /// The precision escape hatch, for a caller that already knows its ledger rows.
    pub credit_registration_ids: Vec<Uuid>,
}

impl RegistrationScope {
    pub fn is_unscoped(&self) -> bool {
        self.course_id.is_none()
            && self.user_id.is_none()
            && self.credit_registration_ids.is_empty()
    }

    pub fn for_course(course_id: Uuid) -> Self {
        Self {
            course_id: Some(course_id),
            ..Self::default()
        }
    }
}

/// The states resolve-enrolments looks up from: rows on their way to a first resolve, and rows
/// parked in `no_usable_enrolment` whose next enrolment check is due, which are checked where they
/// stand.
const LOOKUP_STATES: [CreditRegistrationState; 2] = [
    CreditRegistrationState::ReadyToSubmit,
    CreditRegistrationState::NoUsableEnrolment,
];

/// Claims, for the person lookup that precedes resolve-enrolments, the rows
/// [`claim_due_for_resolve_after_pull_forward`] would take, the later [`EnrolmentCheckGroup`](crate::credit_registration_policy::enrolment_check_schedule::EnrolmentCheckGroup) first.
pub async fn claim_due_for_person_lookup(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<CreditRegistration>> {
    claim(conn, &LOOKUP_STATES, scope, limit, ClaimKind::PersonLookup).await
}

/// Claims, for resolve-enrolments, `ready_to_submit` rows and parked rows due an enrolment check,
/// the later [`EnrolmentCheckGroup`](crate::credit_registration_policy::enrolment_check_schedule::EnrolmentCheckGroup) first, minus any whose student already has another live row
/// for the module somewhere between resolving and a known outcome. The caller first pulls slow
/// checks due soon into the batch; see
/// [`crate::library::credit_registration::enrolment_checks::claim_due_for_resolve`].
///
/// Only one completion per student and module goes past resolve at a time, so each is weighed
/// against the outcome of the one before it rather than racing it to the registry; see
/// [`lock_live_successes_for_same_module`](super::lock_live_successes_for_same_module). Of two such
/// rows claimed together only the first comes back; the other stays claimable where it is. A parked
/// row sent for a check must be marked with [`claim_enrolment_checks`] before the claim's
/// transaction commits.
pub async fn claim_due_for_resolve_after_pull_forward(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<CreditRegistration>> {
    let claimed = claim(conn, &LOOKUP_STATES, scope, limit, ClaimKind::Resolve).await?;
    Ok(first_per(
        claimed,
        |row| (row.user_id, row.course_module_id),
        "another attempt for the same student and module",
    ))
}

/// Keeps parked rows out of every claim while a lookup for them is out, as `resolving_enrolment`
/// does for a row on its first resolve. The answer's [`transition`](super::transition::transition) ends the
/// claim; one a worker died holding expires after
/// [`RESOLVING_RECOVERY_GRACE`](crate::library::credit_registration::backoff::RESOLVING_RECOVERY_GRACE).
/// A no-op for a row in any other state.
pub async fn claim_enrolment_checks(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
    use crate::library::credit_registration::backoff::RESOLVING_RECOVERY_GRACE;
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET enrolment_check_claimed_until = now() + $2::interval
WHERE id = ANY($1)
  AND state = 'no_usable_enrolment'
        "#,
        ids,
        RESOLVING_RECOVERY_GRACE as TimeDelta,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Claims, for import, `checking_enrolment` rows, minus any whose student and course code already
/// have a submission in flight, which Suotar's hour-old copy of Sisu would not stop from
/// registering twice, and any whose person and module slot in
/// `uq_credit_registrations_person_module` is taken. Of two rows for the same student and course
/// code claimed together only the first comes back; the other stays claimable where it is.
pub async fn claim_due_for_import(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<CreditRegistration>> {
    let claimed = claim(
        conn,
        &[CreditRegistrationState::CheckingEnrolment],
        scope,
        limit,
        ClaimKind::Import,
    )
    .await?;
    Ok(first_per(
        claimed,
        |row| {
            (
                row.student_number
                    .as_ref()
                    .map(|number| number.expose_secret().to_string()),
                row.uh_course_code.clone(),
            )
        },
        "another attempt for the same student and course code",
    ))
}

/// The first of the claimed rows per `key`. The claim query holds back a row whose twin is already
/// in flight, but cannot see a twin claimed alongside it; the rows dropped here keep their lock
/// until the claim's transaction ends, and are claimable where they are after it.
fn first_per<K: Eq + std::hash::Hash>(
    claimed: Vec<CreditRegistration>,
    key: impl Fn(&CreditRegistration) -> K,
    twin: &str,
) -> Vec<CreditRegistration> {
    let mut seen = std::collections::HashSet::new();
    claimed
        .into_iter()
        .filter(|row| {
            let is_first = seen.insert(key(row));
            if !is_first {
                debug!(
                    credit_registration_id = %row.id,
                    "Leaving row claimable: {twin} is already in this claim"
                );
            }
            is_first
        })
        .collect()
}

/// The states verify polls from. Withdrawal moves a row out of all of them, which is what stops the
/// polling without any query having to know about withdrawal.
const VERIFY_STATES: [CreditRegistrationState; 3] = [
    CreditRegistrationState::AwaitingVerification,
    CreditRegistrationState::PartiallyRegistered,
    CreditRegistrationState::SubmissionUncertain,
];

/// Which of verify's flows a claim is for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifyFlow {
    /// Rows with a submitted attainment to poll by, and `awaiting_verification` rows stuck without
    /// one.
    Poll,
    /// `submission_uncertain` rows with no submitted attainment id, looked up through
    /// resolve-enrolments instead.
    UncertainRecovery,
}

/// Claims rows for one of verify's flows. Each flow is claimed on its own, so that rows one flow
/// has no allowance to send cannot fill the other's claim.
pub async fn claim_due_for_verify(
    conn: &mut PgConnection,
    flow: VerifyFlow,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<CreditRegistration>> {
    claim(conn, &VERIFY_STATES, scope, limit, ClaimKind::Verify(flow)).await
}

/// Which caller a claim is for, which decides the rows that hold a row back and the order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ClaimKind {
    /// See [`claim_due_for_verify`].
    Verify(VerifyFlow),
    /// See [`claim_due_for_person_lookup`].
    PersonLookup,
    /// See [`claim_due_for_resolve_after_pull_forward`].
    Resolve,
    /// See [`claim_due_for_import`].
    Import,
}

/// Shares its eligibility filters with
/// [`count_due_enrolment_checks`](super::count_due_enrolment_checks) and
/// [`pull_forward_batched_checks`](crate::library::credit_registration::enrolment_checks::pull_forward_batched_checks);
/// change all three together.
async fn claim(
    conn: &mut PgConnection,
    states: &[CreditRegistrationState],
    scope: &RegistrationScope,
    limit: i64,
    kind: ClaimKind,
) -> ModelResult<Vec<CreditRegistration>> {
    let ignores_test_holds = !scope.is_unscoped();
    let excludes_twins_in_flight = kind == ClaimKind::Import;
    let waits_behind_other_attempts = kind == ClaimKind::Resolve;
    let orders_by_check_group = matches!(kind, ClaimKind::PersonLookup | ClaimKind::Resolve);
    // `Some(true)` claims only uncertain rows without a submitted attainment, `Some(false)` every
    // other verify row.
    let only_uncertain_without_attainment_id = match kind {
        ClaimKind::Verify(flow) => Some(flow == VerifyFlow::UncertainRecovery),
        _ => None,
    };
    let res = sqlx::query_as!(
        CreditRegistration,
        r#"
WITH due AS (
  SELECT cr.id
  FROM credit_registrations cr
    JOIN credit_registration_active_course_modules acm ON acm.course_module_id = cr.course_module_id
    JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  WHERE cr.deleted_at IS NULL
    AND cr.superseded_by_id IS NULL
    -- A completion opted out by hand is the pull path's again; only a row already sent carries on.
    AND (
      cmc.register_credits_via_suotar
      OR cr.submitted_at IS NOT NULL
    )
    AND cr.state = ANY($1::credit_registration_state [])
    AND cr.next_attempt_at <= now()
    AND (
      cr.enrolment_check_claimed_until IS NULL
      OR cr.enrolment_check_claimed_until <= now()
    )
    AND ($3::uuid IS NULL OR cr.course_id = $3)
    AND ($4::uuid IS NULL OR cr.user_id = $4)
    AND (
      cardinality($5::uuid []) = 0
      OR cr.id = ANY($5::uuid [])
    )
    AND (
      $12::boolean IS NULL
      OR (
        cr.state = 'submission_uncertain'
        AND cr.submitted_attainment_id IS NULL
      ) = $12
    )
    AND (
      $6::boolean
      OR NOT EXISTS (
        SELECT 1
        FROM credit_registration_test_exclusive_holds h
        WHERE h.user_id = cr.user_id
          AND (
            h.course_id IS NULL
            OR h.course_id = cr.course_id
          )
          AND h.held_until > now()
      )
    )
    AND (
      NOT $7::boolean
      OR (
        NOT EXISTS (
          SELECT 1
          FROM credit_registrations twin
          WHERE twin.student_number = cr.student_number
            AND twin.uh_course_code = cr.uh_course_code
            AND twin.id <> cr.id
            AND twin.deleted_at IS NULL
            AND twin.state = ANY($10::credit_registration_state [])
        )
        -- Mirrors uq_credit_registrations_person_module, which moving to submitting would violate.
        AND NOT EXISTS (
          SELECT 1
          FROM credit_registrations holder
          WHERE holder.sisu_person_id = cr.sisu_person_id
            AND holder.course_module_id = cr.course_module_id
            AND holder.id <> cr.id
            AND holder.deleted_at IS NULL
            AND holder.superseded_by_id IS NULL
            AND holder.pending_superseded_by_id IS NULL
            AND (
              holder.state = ANY($10::credit_registration_state [])
              OR holder.state = ANY($11::credit_registration_state [])
            )
        )
      )
    )
    AND (
      NOT $8::boolean
      OR NOT EXISTS (
        SELECT 1
        FROM credit_registrations ahead
        WHERE ahead.user_id = cr.user_id
          AND ahead.course_module_id = cr.course_module_id
          AND ahead.id <> cr.id
          AND ahead.deleted_at IS NULL
          AND ahead.superseded_by_id IS NULL
          -- failed_retryable because its backoff may resume it at checking_enrolment or later.
          AND (
            ahead.state IN (
              'resolving_enrolment',
              'checking_enrolment',
              'failed_retryable'
            )
            OR ahead.state = ANY($10::credit_registration_state [])
            OR ahead.enrolment_check_claimed_until > now()
          )
      )
    )
  ORDER BY CASE
      WHEN $9 THEN cr.enrolment_check_group
    END DESC NULLS LAST,
    cr.next_attempt_at
  FOR UPDATE OF cr SKIP LOCKED
  LIMIT $2
)
UPDATE credit_registrations cr
SET last_attempt_at = now()
FROM due
WHERE cr.id = due.id
RETURNING cr.*
        "#,
        states as &[CreditRegistrationState],
        limit,
        scope.course_id,
        scope.user_id,
        &scope.credit_registration_ids,
        ignores_test_holds,
        excludes_twins_in_flight,
        waits_behind_other_attempts,
        orders_by_check_group,
        &CreditRegistrationState::IN_FLIGHT_STATES as &[CreditRegistrationState],
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
        only_uncertain_without_attainment_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
