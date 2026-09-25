//! Moving a row along, or out of, the chain of things that must be true before we submit. Decided
//! from the database alone, so it keeps running during a Suotar outage.

use crate::credit_registrations::{
    BatchMove, CreditRegistrationErrorCode, CreditRegistrationState, RegistrationScope, Transition,
    transition_batch,
};
use crate::prelude::*;
use chrono::TimeDelta;

use super::backoff::{RESOLVING_RECOVERY_GRACE, SUBMIT_MAX_RETRY_AGE, SUBMITTING_RECOVERY_GRACE};
use super::enrolment_check_schedule::{
    EnrolmentCheckGroup, EnrolmentCheckSource, ScheduledEnrolmentCheck, first_check,
};
use super::enrolment_checks::{EnrolmentCheckStart, record_starts};
use super::pending_reason::{CreditRegistrationPendingReason, PendingPreconditions};

/// How many rows one iteration may move.
pub const PRECONDITIONS_LIMIT: i64 = 500;

#[derive(Debug, Clone, PartialEq)]
struct PendingMove {
    id: Uuid,
    state: CreditRegistrationState,
    next_attempt_at: DateTime<Utc>,
    state_entered_at: DateTime<Utc>,
    submitted_at: Option<DateTime<Utc>>,
    first_failed_at: Option<DateTime<Utc>>,
    completion_deleted: bool,
    /// Names the blocker in the audit event when the target is `pending`.
    preconditions: PendingPreconditions,
    has_submitted_attainment: bool,
    has_payload_snapshot: bool,
    frozen_identity_stale: bool,
    payload_unweighed_against_held_credit: bool,
    /// Set for a row that would leave `pending` or `blocked` for its first enrolment check: it
    /// starts the check schedule instead of resolving at once.
    check_start: Option<CheckStartFacts>,
}

/// What the preconditions make of one row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Target {
    Stay,
    Move(CreditRegistrationState),
    /// A retryable row whose backoff has elapsed, resuming where [`resume_state`] says.
    Resume,
}

/// The one table of the pipeline's moves that need no study registry: recovering rows a dead
/// worker left behind, and moving a row along, or out of, the chain of preconditions. A target equal
/// to the row's state is staying put.
fn precondition_target(row: &PendingMove, now: DateTime<Utc>) -> Target {
    use CreditRegistrationState as State;
    let facts = &row.preconditions;
    let elapsed = |since: DateTime<Utc>, span: TimeDelta| since < now - span;
    match row.state {
        // A worker committed `submitting` and never came back with an answer. There is no way to
        // know whether the request landed, so the row is never imported again. Timed from the last
        // send, which a split import batch repeats.
        State::Submitting
            if elapsed(
                row.submitted_at.unwrap_or(row.state_entered_at),
                SUBMITTING_RECOVERY_GRACE,
            ) =>
        {
            Target::Move(State::SubmissionUncertain)
        }
        State::Submitting | State::SubmissionUncertain | State::AwaitingVerification => {
            Target::Stay
        }
        _ if row.completion_deleted => Target::Move(State::Cancelled),
        State::FailedRetryable if !facts.completion_eligible => Target::Move(State::Blocked),
        State::FailedRetryable
            if row
                .first_failed_at
                .is_some_and(|first_failed_at| elapsed(first_failed_at, SUBMIT_MAX_RETRY_AGE)) =>
        {
            Target::Move(State::FailedPermanent)
        }
        // Before the resume below, or a retry would carry on past a precondition the student has
        // since removed and import would send the frozen student_number under a link they gave up.
        State::FailedRetryable if !facts.has_verified_student_number => {
            Target::Move(State::Pending)
        }
        // Only a row with nothing in flight: one with a submission to verify has to resume there.
        State::FailedRetryable if !facts.course_code_allowed && !row.has_submitted_attainment => {
            Target::Move(State::Pending)
        }
        State::FailedRetryable if row.next_attempt_at <= now => Target::Resume,
        State::FailedRetryable => Target::Stay,
        // Eligibility lost after the row had already moved on is what `blocked` is for; a row still
        // waiting is simply where it belongs, and the reason it reports changes to say so.
        state if !facts.completion_eligible && state != State::Pending => {
            Target::Move(State::Blocked)
        }
        _ if !facts.completion_eligible
            || !facts.has_verified_student_number
            || !facts.course_code_allowed =>
        {
            Target::Move(State::Pending)
        }
        // resolve-enrolments checks it where it stands when its schedule says.
        State::NoUsableEnrolment => Target::Stay,
        // A relink after the payload was frozen must not let the row import against the account's
        // previous number: send it back to resolve a fresh payload against the current one.
        State::CheckingEnrolment if row.frozen_identity_stale => Target::Move(State::ReadyToSubmit),
        // Already queued for import with its payload frozen; sending it back would resolve again
        // forever.
        State::CheckingEnrolment => Target::Stay,
        // Past the grace the worker that claimed it is gone, and asking again is harmless.
        State::ResolvingEnrolment if elapsed(row.state_entered_at, RESOLVING_RECOVERY_GRACE) => {
            Target::Move(State::ReadyToSubmit)
        }
        // A resolve-enrolments call for this row is in flight; only that phase's own commit may
        // move it, or import could claim it before the enrolment is actually resolved.
        State::ResolvingEnrolment => Target::Stay,
        _ => Target::Move(State::ReadyToSubmit),
    }
}

#[derive(Debug, Clone, PartialEq)]
struct CheckStartFacts {
    group: EnrolmentCheckGroup,
    anchor_at: DateTime<Utc>,
    source: EnrolmentCheckSource,
}

/// Where a `failed_retryable` row goes when its backoff elapses, derived from how far it had got.
/// Never `submitting`: only the import phase writes that, in the transaction before it sends.
///
/// `frozen_identity_stale` demotes a frozen payload to no payload at all. Only a `notRegistered`
/// resend clears `selected_enrolment_id`/`grade_id`, so a row sent back to re-resolve after a
/// relink still looks frozen; without this it would resume at `checking_enrolment` and import the
/// previous number.
///
/// `payload_unweighed_against_held_credit` also resolves again: another row of the module holds a
/// credit this row is not marked to replace, and only resolve-enrolments may weigh the two and hand
/// this row that row's slot in `uq_credit_registrations_person_module`. Import would otherwise hold
/// the row back for good.
fn resume_state(
    has_submitted_attainment_id: bool,
    has_payload_snapshot: bool,
    frozen_identity_stale: bool,
    payload_unweighed_against_held_credit: bool,
) -> CreditRegistrationState {
    if payload_unweighed_against_held_credit {
        CreditRegistrationState::ReadyToSubmit
    } else if has_submitted_attainment_id {
        CreditRegistrationState::AwaitingVerification
    } else if has_payload_snapshot && !frozen_identity_stale {
        CreditRegistrationState::CheckingEnrolment
    } else {
        CreditRegistrationState::ReadyToSubmit
    }
}

/// Applies at most `limit` moves to the scoped rows and returns how many moved.
///
/// A row a worker claimed between the snapshot and the write is left where it is: its state is that
/// phase's to own now, and the next iteration decides again from whatever it committed. Writing
/// anyway could put an in-flight import back into a state a second import claims.
///
/// A row that would start resolving without ever having been checked starts its enrolment check
/// schedule instead: nobody has enrolled at the moment they complete, so it waits in
/// `no_usable_enrolment` for the first rung of its group's ladder unless that rung is due already.
/// A row waiting there is left to resolve-enrolments, which checks it where it stands.
pub async fn recompute_preconditions(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<i64> {
    let now = Utc::now();
    let mut tx = conn.begin().await?;
    let mut starts = Vec::new();
    let moves: Vec<BatchMove> = pending_moves(&mut tx, scope, limit)
        .await?
        .iter()
        .filter_map(|pending| {
            let mut target = match precondition_target(pending, now) {
                Target::Stay => pending.state,
                Target::Move(target) => target,
                Target::Resume => resume_state(
                    pending.has_submitted_attainment,
                    pending.has_payload_snapshot,
                    pending.frozen_identity_stale,
                    pending.payload_unweighed_against_held_credit,
                ),
            };
            let mut next_attempt_at = None;
            if target == CreditRegistrationState::ReadyToSubmit
                && let Some(start) = &pending.check_start
                && let Some(scheduled) = first_check(start.group, start.anchor_at)
            {
                // A rung already past when the schedule starts is due from now, or its lateness
                // would count time before the row could be checked.
                let scheduled = ScheduledEnrolmentCheck {
                    due_at: scheduled.due_at.max(now),
                    ..scheduled
                };
                starts.push(EnrolmentCheckStart {
                    credit_registration_id: pending.id,
                    group: start.group,
                    anchor_at: start.anchor_at,
                    scheduled,
                    source: start.source,
                });
                if scheduled.due_at > now {
                    target = CreditRegistrationState::NoUsableEnrolment;
                    next_attempt_at = Some(scheduled.release_at());
                }
            }
            (target != pending.state).then(|| BatchMove {
                id: pending.id,
                transition: Transition {
                    next_attempt_at,
                    ..transition_for(pending, target)
                },
            })
        })
        .collect();
    let moved = transition_batch(&mut tx, &moves).await?;
    record_starts(&mut tx, &starts).await?;
    tx.commit().await?;
    Ok(moved)
}

/// The transition each edge writes: kept out of the query so every edge's error code, admin flag
/// and audit message sit in one place.
fn transition_for(pending: &PendingMove, target: CreditRegistrationState) -> Transition {
    use CreditRegistrationState as State;
    let base = Transition {
        // `pending_moves` reads without a row lock, so a phase can claim and move the row in the
        // gap before this write. Guarding on the state we decided from turns that into a refusal
        // instead of overwriting, say, a `submitting` row whose request is already out.
        expected_from_state: Some(pending.state),
        ..Transition::to(target)
    };
    match target {
        State::SubmissionUncertain => Transition {
            error_code: Some(CreditRegistrationErrorCode::SisuTimeout),
            event_message: Some(
                "Found still submitting after a restart, so the import may or may not have been \
                 processed. Only verification may touch it from here."
                    .to_string(),
            ),
            ..base
        },
        State::Cancelled => Transition {
            event_message: Some(
                "The completion no longer exists and nothing had been submitted.".to_string(),
            ),
            ..base
        },
        State::Blocked => Transition {
            event_message: Some(
                "The completion is no longer eligible for registration.".to_string(),
            ),
            ..base
        },
        State::FailedPermanent => Transition {
            error_code: Some(CreditRegistrationErrorCode::RetryWindowExpired),
            needs_admin_attention: Some(true),
            event_message: Some("Retried for a week without success.".to_string()),
            ..base
        },
        // The ledger does not record which precondition a `pending` row waits on, so the event is
        // where the answer is kept for whoever reads the timeline later.
        State::Pending => Transition {
            event_message: pending.preconditions.reason().map(|reason| {
                match reason {
                    CreditRegistrationPendingReason::Completion => {
                        "The completion is not registrable yet."
                    }
                    CreditRegistrationPendingReason::StudentNumber => {
                        "No verified student number is linked to the account."
                    }
                    CreditRegistrationPendingReason::CourseCode => {
                        "Suotar does not accept the module's course code, so nothing is sent \
                         until it does."
                    }
                }
                .to_string()
            }),
            ..base
        },
        State::NoUsableEnrolment => Transition {
            event_message: Some("Waiting for the first enrolment check.".to_string()),
            ..base
        },
        // Keys off `pending.state`, not just `target`: the message is about where the row came
        // from, unlike every arm above.
        State::ReadyToSubmit if pending.state == State::CheckingEnrolment => Transition {
            event_message: Some(
                "The linked student number changed after this row's payload was frozen, so the \
                 enrolment is resolved again against the current one."
                    .to_string(),
            ),
            ..base
        },
        _ => base,
    }
}

/// The facts of the rows that may need a move, so `limit` cannot be spent on rows that need nothing.
///
/// The `WHERE` only narrows to the rows [`precondition_target`] could move, and must keep every one
/// of them: the decision itself is that function's.
async fn pending_moves(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<PendingMove>> {
    let rows = sqlx::query!(
        r#"
WITH facts AS (
  SELECT cr.id,
    cr.state,
    cr.next_attempt_at,
    cr.state_entered_at,
    cr.submitted_at,
    cr.first_failed_at,
    cr.submitted_attainment_id IS NOT NULL AS has_submitted_attainment,
    (
      cr.selected_enrolment_id IS NOT NULL
      AND cr.grade_id IS NOT NULL
    ) AS has_payload_snapshot,
    p.completion_deleted,
    p.completion_eligible AS eligible,
    p.has_verified_student_number AS has_student_number,
    p.course_code_allowed,
    p.frozen_identity_stale,
    EXISTS (
      SELECT 1
      FROM credit_registrations held
      WHERE held.user_id = cr.user_id
        AND held.course_module_id = cr.course_module_id
        AND held.id <> cr.id
        AND held.deleted_at IS NULL
        AND held.superseded_by_id IS NULL
        AND held.pending_superseded_by_id IS DISTINCT FROM cr.id
        AND held.state = ANY($8::credit_registration_state [])
    ) AS payload_unweighed_against_held_credit,
    cr.state IN ('pending', 'blocked')
    AND cr.enrolment_checked_at IS NULL AS starts_enrolment_checks,
    GREATEST(
      cr.enrolment_check_group,
      CASE
        WHEN sig.last_check_requested_at IS NOT NULL THEN 'check_requested'
        WHEN sig.last_visited_at IS NOT NULL THEN 'visited'
        ELSE 'completed'
      END::enrolment_check_group,
      (
        SELECT MAX(earlier.enrolment_check_group)
        FROM credit_registrations earlier
        WHERE earlier.user_id = cr.user_id
          AND earlier.course_module_id = cr.course_module_id
          AND earlier.created_at < cr.created_at
          AND earlier.deleted_at IS NULL
      )
    ) AS check_group,
    GREATEST(
      cmc.completion_date,
      vsn.verified_at,
      COALESCE(sig.last_check_requested_at, sig.last_visited_at)
    ) AS check_anchor_at,
    CASE
      WHEN sig.last_check_requested_at IS NOT NULL THEN sig.check_request_source
      ELSE 'schedule'
    END::enrolment_check_source AS check_source
  FROM credit_registrations cr
    JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
    JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
    LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
    AND vsn.deleted_at IS NULL
    LEFT JOIN credit_registration_enrolment_check_signals sig ON sig.course_module_completion_id = cr.course_module_completion_id
    AND sig.deleted_at IS NULL
    LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cr.course_module_id
    AND conf.deleted_at IS NULL
  WHERE cr.deleted_at IS NULL
    AND cr.superseded_by_id IS NULL
    AND cr.terminal_at IS NULL
    -- Only a human moves a row the study registry reversed.
    AND cr.state <> 'misregistered'
    AND conf.paused_at IS NULL
    AND ($2::uuid IS NULL OR cr.course_id = $2)
    AND ($3::uuid IS NULL OR cr.user_id = $3)
    AND (
      cardinality($4::uuid []) = 0
      OR cr.id = ANY($4::uuid [])
    )
)
SELECT id,
  state AS "state: CreditRegistrationState",
  next_attempt_at,
  state_entered_at,
  submitted_at,
  first_failed_at,
  completion_deleted AS "completion_deleted!",
  eligible AS "eligible!",
  has_student_number AS "has_student_number!",
  course_code_allowed AS "course_code_allowed!",
  has_submitted_attainment AS "has_submitted_attainment!",
  has_payload_snapshot AS "has_payload_snapshot!",
  frozen_identity_stale AS "frozen_identity_stale!",
  payload_unweighed_against_held_credit AS "payload_unweighed_against_held_credit!",
  starts_enrolment_checks AS "starts_enrolment_checks!",
  check_group AS "check_group!: EnrolmentCheckGroup",
  check_anchor_at AS "check_anchor_at!",
  check_source AS "check_source!: EnrolmentCheckSource"
FROM facts
WHERE (
    state = 'submitting'
    AND COALESCE(submitted_at, state_entered_at) < now() - $5::interval
  )
  OR (
    state <> ALL($9::credit_registration_state [])
    AND (
      completion_deleted
      OR (
        state = 'failed_retryable'
        AND (
          NOT eligible
          OR NOT has_student_number
          OR (
            NOT course_code_allowed
            AND NOT has_submitted_attainment
          )
          OR next_attempt_at <= now()
          OR first_failed_at < now() - $6::interval
        )
      )
      OR (
        state NOT IN ('failed_retryable', 'pending', 'blocked')
        AND (
          NOT eligible
          OR NOT has_student_number
          OR NOT course_code_allowed
        )
      )
      OR (
        state = 'blocked'
        AND eligible
      )
      OR (
        state = 'pending'
        AND eligible
        AND has_student_number
        AND course_code_allowed
      )
      OR (
        state = 'checking_enrolment'
        AND frozen_identity_stale
      )
      OR (
        state = 'resolving_enrolment'
        AND state_entered_at < now() - $7::interval
      )
    )
  )
ORDER BY state_entered_at
LIMIT $1
        "#,
        limit,
        scope.course_id,
        scope.user_id,
        &scope.credit_registration_ids,
        SUBMITTING_RECOVERY_GRACE as TimeDelta,
        SUBMIT_MAX_RETRY_AGE as TimeDelta,
        RESOLVING_RECOVERY_GRACE as TimeDelta,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
        &CreditRegistrationState::IN_FLIGHT_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| PendingMove {
            id: row.id,
            state: row.state,
            next_attempt_at: row.next_attempt_at,
            state_entered_at: row.state_entered_at,
            submitted_at: row.submitted_at,
            first_failed_at: row.first_failed_at,
            completion_deleted: row.completion_deleted,
            preconditions: PendingPreconditions {
                completion_eligible: row.eligible,
                has_verified_student_number: row.has_student_number,
                course_code_allowed: row.course_code_allowed,
            },
            has_submitted_attainment: row.has_submitted_attainment,
            has_payload_snapshot: row.has_payload_snapshot,
            frozen_identity_stale: row.frozen_identity_stale,
            payload_unweighed_against_held_credit: row.payload_unweighed_against_held_credit,
            check_start: row.starts_enrolment_checks.then_some(CheckStartFacts {
                group: row.check_group,
                anchor_at: row.check_anchor_at,
                source: row.check_source,
            }),
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::course_module_completions::{
        CourseModuleCompletionGranter, NewCourseModuleCompletion,
    };
    use crate::credit_registrations::{NewCreditRegistration, get_by_id, transition};
    use crate::test_helper::*;
    use crate::verified_student_numbers::{
        NewVerifiedStudentNumber, StudentNumberVerificationMethod,
    };

    struct Fixture {
        registration: Uuid,
        completion: Uuid,
    }

    async fn fixture(
        conn: &mut PgConnection,
        user: Uuid,
        course: Uuid,
        instance: Uuid,
        course_module: Uuid,
    ) -> Fixture {
        let completion = crate::course_module_completions::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module,
                user_id: user,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en".to_string(),
                eligible_for_ects: true,
                email: "student@example.com".to_string(),
                grade: Some(4),
                passed: true,
            },
            CourseModuleCompletionGranter::Automatic,
        )
        .await
        .unwrap();
        // Defaults to false, which the recompute reads as an unmet prerequisite.
        crate::course_module_completions::update_prerequisite_modules_completed(
            conn,
            completion.id,
            true,
        )
        .await
        .unwrap();
        let registration = crate::credit_registrations::insert(
            conn,
            PKeyPolicy::Generate,
            &NewCreditRegistration {
                course_module_completion_id: completion.id,
                user_id: user,
                course_id: course,
                course_module_id: course_module,
                course_instance_id: instance,
                attempt_number: 1,
            },
            None,
        )
        .await
        .unwrap();
        Fixture {
            registration,
            completion: completion.id,
        }
    }

    async fn link_student_number(conn: &mut PgConnection, user: Uuid) {
        crate::verified_student_numbers::insert(
            conn,
            PKeyPolicy::Generate,
            &NewVerifiedStudentNumber {
                user_id: user,
                student_number: DbSecret::new(format!("9{:08}", rand_suffix())),
                sisu_person_id: DbSecret::new(format!("hy-hlo-{}", rand_suffix())),
                first_names: None,
                last_name: None,
                verified_via: StudentNumberVerificationMethod::EmailedLink,
                verified_via_email: Some(DbSecret::new("student@helsinki.example.com")),
                linked_by_user_id: None,
                link_reason: None,
                verified_from_course_id: None,
            },
        )
        .await
        .unwrap();
    }

    async fn entered_state_long_ago(conn: &mut PgConnection, id: Uuid) {
        let long_ago = Utc::now() - SUBMITTING_RECOVERY_GRACE - TimeDelta::minutes(1);
        crate::credit_registrations::set_state_entered_at_for_testing(conn, id, long_ago)
            .await
            .unwrap();
        sqlx::query("UPDATE credit_registrations SET submitted_at = $2 WHERE id = $1")
            .bind(id)
            .bind(long_ago)
            .execute(conn)
            .await
            .unwrap();
    }

    async fn first_failed_long_ago(conn: &mut PgConnection, id: Uuid) {
        crate::credit_registrations::set_first_failed_at_for_testing(
            conn,
            id,
            Utc::now() - chrono::Duration::days(8),
        )
        .await
        .unwrap();
    }

    async fn pause_module(conn: &mut PgConnection, course_module_id: Uuid, user_id: Uuid) {
        crate::course_module_suotar_configurations::ensure_exists(conn, course_module_id)
            .await
            .unwrap();
        crate::course_module_suotar_configurations::set_paused(
            conn,
            course_module_id,
            Some(crate::course_module_suotar_configurations::SuotarPause {
                paused_at: Utc::now(),
                paused_by_user_id: user_id,
                reason: None,
            }),
        )
        .await
        .unwrap();
    }

    fn rand_suffix() -> u32 {
        use rand::RngExt;
        rand::rng().random_range(1..99_999_999)
    }

    async fn recompute(conn: &mut PgConnection, fixture: &Fixture) -> i64 {
        recompute_preconditions(
            conn,
            &RegistrationScope {
                credit_registration_ids: vec![fixture.registration],
                ..RegistrationScope::default()
            },
            PRECONDITIONS_LIMIT,
        )
        .await
        .unwrap()
    }

    async fn state(conn: &mut PgConnection, fixture: &Fixture) -> CreditRegistrationState {
        get_by_id(conn, fixture.registration).await.unwrap().state
    }

    #[tokio::test]
    async fn an_eligible_completion_waits_for_a_linked_student_number() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Pending
        );

        link_student_number(tx.as_mut(), user).await;
        assert_eq!(recompute(tx.as_mut(), &fixture).await, 1);
        // Nobody has enrolled the moment they complete, so the first check waits for its rung.
        let parked = get_by_id(tx.as_mut(), fixture.registration).await.unwrap();
        assert_eq!(parked.state, CreditRegistrationState::NoUsableEnrolment);
        assert_eq!(parked.enrolment_checked_at, None);
        assert_eq!(parked.enrolment_check_step, Some(0));

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
    }

    #[tokio::test]
    async fn a_row_left_submitting_by_a_dead_worker_becomes_uncertain() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::planted(CreditRegistrationState::Submitting),
        )
        .await
        .unwrap();

        // A request that may still be in flight is left alone.
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Submitting
        );

        entered_state_long_ago(tx.as_mut(), fixture.registration).await;
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::SubmissionUncertain
        );
    }

    #[tokio::test]
    async fn an_uncertain_row_is_never_moved_back_towards_import() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::planted(CreditRegistrationState::SubmissionUncertain),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::SubmissionUncertain
        );
    }

    #[tokio::test]
    async fn losing_eligibility_blocks_a_row_and_regaining_it_unblocks_it() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        link_student_number(tx.as_mut(), user).await;
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::NoUsableEnrolment
        );

        crate::course_module_completions::update_needs_to_be_reviewed(
            tx.as_mut(),
            fixture.completion,
            true,
        )
        .await
        .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Blocked
        );

        crate::course_module_completions::update_needs_to_be_reviewed(
            tx.as_mut(),
            fixture.completion,
            false,
        )
        .await
        .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::NoUsableEnrolment
        );
    }

    #[tokio::test]
    async fn a_deleted_completion_cancels_a_row_that_was_never_sent() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        crate::course_module_completions::delete(tx.as_mut(), fixture.completion)
            .await
            .unwrap();

        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Cancelled
        );
    }

    #[tokio::test]
    async fn unlinking_the_student_number_sends_a_queued_row_back_to_wait_for_one() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        link_student_number(tx.as_mut(), user).await;
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::NoUsableEnrolment
        );

        let linked = crate::verified_student_numbers::get_by_user_id(tx.as_mut(), user)
            .await
            .unwrap()
            .expect("a linked number");
        crate::verified_student_numbers::soft_delete(tx.as_mut(), linked.id)
            .await
            .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Pending
        );
    }

    #[tokio::test]
    async fn a_retryable_row_resumes_where_it_had_got_to_once_its_backoff_elapses() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::planted(CreditRegistrationState::FailedRetryable),
        )
        .await
        .unwrap();
        crate::credit_registrations::schedule_next_attempt(
            tx.as_mut(),
            fixture.registration,
            Utc::now() + chrono::Duration::hours(1),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);

        crate::credit_registrations::schedule_next_attempt(
            tx.as_mut(),
            fixture.registration,
            Utc::now() - chrono::Duration::seconds(1),
        )
        .await
        .unwrap();
        recompute(tx.as_mut(), &fixture).await;
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::ReadyToSubmit
        );
    }

    #[tokio::test]
    async fn a_row_that_kept_failing_for_a_week_becomes_a_support_case() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::planted(CreditRegistrationState::FailedRetryable),
        )
        .await
        .unwrap();
        first_failed_long_ago(tx.as_mut(), fixture.registration).await;

        recompute(tx.as_mut(), &fixture).await;
        let row = get_by_id(tx.as_mut(), fixture.registration).await.unwrap();
        assert_eq!(row.state, CreditRegistrationState::FailedPermanent);
        assert_eq!(
            row.error_code,
            Some(CreditRegistrationErrorCode::RetryWindowExpired)
        );
        assert!(row.needs_admin_attention);
    }

    #[tokio::test]
    async fn a_parked_row_is_claimed_for_its_check_where_it_stands() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        crate::course_modules::update(
            tx.as_mut(),
            course_module.id,
            &crate::course_modules::NewCourseModule::new(
                course_module.course_id,
                course_module.name.clone(),
                course_module.order_number,
            )
            .set_enable_credit_registration_via_suotar(true),
        )
        .await
        .unwrap();
        crate::course_modules::set_register_eligible_new_completions_via_suotar(
            tx.as_mut(),
            course_module.id,
            true,
        )
        .await
        .unwrap();
        link_student_number(tx.as_mut(), user).await;
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        recompute(tx.as_mut(), &fixture).await;
        let scope = RegistrationScope {
            credit_registration_ids: vec![fixture.registration],
            ..RegistrationScope::default()
        };
        let claim = async |conn: &mut PgConnection| {
            crate::credit_registrations::claim_due_for_resolve(conn, &scope, 10)
                .await
                .unwrap()
                .len()
        };
        assert_eq!(claim(tx.as_mut()).await, 0);

        crate::credit_registrations::schedule_next_attempt(
            tx.as_mut(),
            fixture.registration,
            Utc::now() - chrono::Duration::seconds(1),
        )
        .await
        .unwrap();
        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(claim(tx.as_mut()).await, 1);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::NoUsableEnrolment
        );

        crate::credit_registrations::claim_enrolment_check(tx.as_mut(), fixture.registration)
            .await
            .unwrap();
        assert_eq!(claim(tx.as_mut()).await, 0);
        let answered = transition(
            tx.as_mut(),
            fixture.registration,
            &Transition {
                next_attempt_at: Some(Utc::now() - chrono::Duration::seconds(1)),
                ..Transition::to(CreditRegistrationState::NoUsableEnrolment)
            },
        )
        .await
        .unwrap();
        assert!(answered.enrolment_checked_at.is_some());
        assert_eq!(answered.enrolment_check_claimed_until, None);
        assert_eq!(claim(tx.as_mut()).await, 1);
    }

    /// Its payload is already frozen, so resolving the enrolment again would be a loop.
    #[tokio::test]
    async fn a_row_queued_for_import_is_left_where_it_is() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        link_student_number(tx.as_mut(), user).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::planted(CreditRegistrationState::CheckingEnrolment),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::CheckingEnrolment
        );
    }

    #[tokio::test]
    async fn a_paused_module_stops_the_recompute_without_rewriting_anything() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        pause_module(tx.as_mut(), course_module.id, user).await;

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Pending
        );
    }

    #[tokio::test]
    async fn a_terminal_row_is_never_recomputed() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::planted(CreditRegistrationState::Registered),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Registered
        );
    }

    #[tokio::test]
    async fn a_reversed_registration_waits_for_a_human() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let fixture = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        transition(
            tx.as_mut(),
            fixture.registration,
            &Transition::planted(CreditRegistrationState::Misregistered),
        )
        .await
        .unwrap();

        assert_eq!(recompute(tx.as_mut(), &fixture).await, 0);
        assert_eq!(
            state(tx.as_mut(), &fixture).await,
            CreditRegistrationState::Misregistered
        );
    }

    #[test]
    fn a_retry_resumes_where_the_row_had_got_to() {
        assert_eq!(
            resume_state(false, false, false, false),
            CreditRegistrationState::ReadyToSubmit
        );
        assert_eq!(
            resume_state(false, true, false, false),
            CreditRegistrationState::CheckingEnrolment
        );
        assert_eq!(
            resume_state(true, true, false, false),
            CreditRegistrationState::AwaitingVerification
        );
    }

    /// Resuming at `checking_enrolment` here would import the number the account no longer holds.
    #[test]
    fn a_retry_whose_frozen_identity_went_stale_resolves_the_enrolment_again() {
        assert_eq!(
            resume_state(false, true, true, false),
            CreditRegistrationState::ReadyToSubmit
        );
    }

    #[tokio::test]
    async fn a_scoped_recompute_leaves_another_students_row_alone() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);
        let mine = fixture(tx.as_mut(), user, course, instance.id, course_module.id).await;
        link_student_number(tx.as_mut(), user).await;
        insert_data!(tx: tx; user: other_user);
        let theirs = fixture(
            tx.as_mut(),
            other_user,
            course,
            instance.id,
            course_module.id,
        )
        .await;

        assert_eq!(
            recompute_preconditions(
                tx.as_mut(),
                &RegistrationScope {
                    user_id: Some(user),
                    ..RegistrationScope::default()
                },
                PRECONDITIONS_LIMIT
            )
            .await
            .unwrap(),
            1
        );
        assert_eq!(
            state(tx.as_mut(), &mine).await,
            CreditRegistrationState::NoUsableEnrolment
        );
        assert_eq!(
            state(tx.as_mut(), &theirs).await,
            CreditRegistrationState::Pending
        );
    }
}
