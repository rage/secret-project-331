//! Moving one row's enrolment check schedule: starting it, restarting it for a visit or a check
//! request, scheduling the next check once one answers, batching slow checks, waking rows off a
//! roster and shifting them past a module pause. The ladders are
//! [`super::enrolment_check_schedule`].

use crate::credit_registrations::{
    CreditRegistrationState, RegistrationScope, is_waiting_for_enrolment,
};
use crate::prelude::*;

use super::enrolment_check_schedule::{
    BATCH_INTERVAL_SECS, BATCH_PULL_FORWARD_SECS, CHECK_REQUEST_MIN_INTERVAL_SECS,
    CHECK_REQUEST_RESTART_WINDOW_SECS, EnrolmentCheckGroup, EnrolmentCheckSource,
    MAX_CHECK_REQUEST_RESTARTS_PER_DAY, ScheduledEnrolmentCheck, TRANSIENT_FAILURE_RETRY_SECS,
    VISIT_RESTART_MIN_INTERVAL_SECS, first_check, never, next_check_after,
};

/// What a check request did to the row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckRequestOutcome {
    /// A check is due now.
    CheckStarted,
    /// The schedule restarted, but without the immediate check: the row was checked moments ago.
    Rescheduled,
    /// Asked too soon after the last request, or checked moments ago with the day's restarts used
    /// up. Nothing changed.
    TooSoon,
    /// The row is not waiting for an enrolment.
    NotWaiting,
}

impl CheckRequestOutcome {
    pub fn started_check(self) -> bool {
        self == Self::CheckStarted
    }
}

struct ScheduleFacts {
    state: CreditRegistrationState,
    no_usable_enrolment_since: Option<DateTime<Utc>>,
    enrolment_check_group: EnrolmentCheckGroup,
    enrolment_check_anchor_at: Option<DateTime<Utc>>,
    enrolment_checks_stopped_at: Option<DateTime<Utc>>,
    enrolment_check_requested_at: Option<DateTime<Utc>>,
    enrolment_check_restart_window_started_at: Option<DateTime<Utc>>,
    enrolment_check_restart_count: i32,
    enrolment_checked_at: Option<DateTime<Utc>>,
}

async fn lock_schedule(conn: &mut PgConnection, id: Uuid) -> ModelResult<ScheduleFacts> {
    let res = sqlx::query_as!(
        ScheduleFacts,
        r#"
SELECT state AS "state: CreditRegistrationState",
  no_usable_enrolment_since,
  enrolment_check_group AS "enrolment_check_group: EnrolmentCheckGroup",
  enrolment_check_anchor_at,
  enrolment_checks_stopped_at,
  enrolment_check_requested_at,
  enrolment_check_restart_window_started_at,
  enrolment_check_restart_count,
  enrolment_checked_at
FROM credit_registrations
WHERE id = $1
  AND deleted_at IS NULL
FOR UPDATE
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

impl ScheduleFacts {
    fn is_waiting(&self) -> bool {
        is_waiting_for_enrolment(
            self.state,
            self.enrolment_check_anchor_at,
            self.no_usable_enrolment_since,
        )
    }
}

fn is_within(at: Option<DateTime<Utc>>, now: DateTime<Utc>, secs: i64) -> bool {
    at.is_some_and(|at| now - at < chrono::Duration::seconds(secs))
}

/// Writes a (re)started or advanced schedule. `next_attempt_at` is only moved for a row parked in
/// `no_usable_enrolment`, and only ever earlier unless `replaces_next_attempt`: a row in a resolve
/// state has a check on its way already, and one a roster just woke must stay woken.
#[allow(clippy::too_many_arguments)]
async fn write_schedule(
    conn: &mut PgConnection,
    id: Uuid,
    group: EnrolmentCheckGroup,
    anchor_at: DateTime<Utc>,
    scheduled: Option<ScheduledEnrolmentCheck>,
    source: EnrolmentCheckSource,
    next_attempt_at: DateTime<Utc>,
    replaces_next_attempt: bool,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET enrolment_check_group = GREATEST(enrolment_check_group, $2),
  enrolment_check_anchor_at = $3,
  enrolment_check_step = $4,
  enrolment_check_due_at = $5,
  is_enrolment_check_batched = $6,
  enrolment_checks_stopped_at = CASE
    WHEN $4::int IS NULL THEN COALESCE(enrolment_checks_stopped_at, now())
  END,
  enrolment_check_source = $7,
  next_attempt_at = CASE
    WHEN state <> 'no_usable_enrolment' THEN next_attempt_at
    WHEN $9 THEN $8
    ELSE LEAST(next_attempt_at, $8)
  END
WHERE id = $1
        "#,
        id,
        group as EnrolmentCheckGroup,
        anchor_at,
        scheduled.map(|scheduled| scheduled.step),
        scheduled.map(|scheduled| scheduled.due_at),
        scheduled.is_some_and(|scheduled| scheduled.is_batched),
        source as EnrolmentCheckSource,
        next_attempt_at,
        replaces_next_attempt,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// A student or teacher asking for a check, or Done being pressed: restarts the row on the
/// check-requested ladder with its immediate check.
///
/// Shares one 30-minute limit between every kind of request. The immediate check is skipped when
/// the row was checked within that limit, and past the daily restart cap a request gets its
/// immediate check without restarting the ladder.
pub async fn request_check(
    conn: &mut PgConnection,
    id: Uuid,
    source: EnrolmentCheckSource,
    now: DateTime<Utc>,
) -> ModelResult<CheckRequestOutcome> {
    let mut tx = conn.begin().await?;
    let facts = lock_schedule(&mut tx, id).await?;
    if !facts.is_waiting() {
        return Ok(CheckRequestOutcome::NotWaiting);
    }
    if is_within(
        facts.enrolment_check_requested_at,
        now,
        CHECK_REQUEST_MIN_INTERVAL_SECS,
    ) {
        return Ok(CheckRequestOutcome::TooSoon);
    }
    let checked_recently = is_within(
        facts.enrolment_checked_at,
        now,
        CHECK_REQUEST_MIN_INTERVAL_SECS,
    );
    let window_is_current = is_within(
        facts.enrolment_check_restart_window_started_at,
        now,
        CHECK_REQUEST_RESTART_WINDOW_SECS,
    );
    let (window_started_at, restart_count) = if window_is_current {
        (
            facts
                .enrolment_check_restart_window_started_at
                .unwrap_or(now),
            facts.enrolment_check_restart_count,
        )
    } else {
        (now, 0)
    };
    let may_restart = restart_count < MAX_CHECK_REQUEST_RESTARTS_PER_DAY;
    if !may_restart && checked_recently {
        return Ok(CheckRequestOutcome::TooSoon);
    }
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET enrolment_check_requested_at = $2,
  enrolment_check_restart_window_started_at = $3,
  enrolment_check_restart_count = $4
WHERE id = $1
        "#,
        id,
        now,
        window_started_at,
        restart_count + i32::from(may_restart),
    )
    .execute(&mut *tx)
    .await?;

    let outcome = if may_restart {
        let group = facts
            .enrolment_check_group
            .max(EnrolmentCheckGroup::CheckRequested);
        let (scheduled, source, next_attempt_at, outcome) = if checked_recently {
            let scheduled = next_check_after(group, now, now);
            (
                scheduled,
                EnrolmentCheckSource::Schedule,
                scheduled.map_or_else(never, |scheduled| scheduled.release_at()),
                CheckRequestOutcome::Rescheduled,
            )
        } else {
            (
                first_check(group, now),
                source,
                now,
                CheckRequestOutcome::CheckStarted,
            )
        };
        write_schedule(
            &mut tx,
            id,
            group,
            now,
            scheduled,
            source,
            next_attempt_at,
            true,
        )
        .await?;
        outcome
    } else {
        sqlx::query!(
            r#"
UPDATE credit_registrations
SET enrolment_check_source = $2,
  next_attempt_at = CASE
    WHEN state = 'no_usable_enrolment' THEN now()
    ELSE next_attempt_at
  END
WHERE id = $1
            "#,
            id,
            source as EnrolmentCheckSource,
        )
        .execute(&mut *tx)
        .await?;
        CheckRequestOutcome::CheckStarted
    };
    tx.commit().await?;
    Ok(outcome)
}

/// Whether a check request would be refused as too soon right now, which is when the buttons that
/// make one are hidden.
pub fn is_check_request_limited(
    enrolment_check_requested_at: Option<DateTime<Utc>>,
    enrolment_checked_at: Option<DateTime<Utc>>,
    now: DateTime<Utc>,
) -> bool {
    is_within(
        enrolment_check_requested_at,
        now,
        CHECK_REQUEST_MIN_INTERVAL_SECS,
    ) || is_within(enrolment_checked_at, now, CHECK_REQUEST_MIN_INTERVAL_SECS)
}

/// A visit to the registration page while it showed the enrolment instructions. Moves a
/// `completed` row onto the visited ladder; restarts a `visited` row at most once a day, and a
/// stopped row of any group. Returns whether the schedule restarted.
pub async fn record_visit(
    conn: &mut PgConnection,
    id: Uuid,
    now: DateTime<Utc>,
) -> ModelResult<bool> {
    let mut tx = conn.begin().await?;
    let facts = lock_schedule(&mut tx, id).await?;
    if !facts.is_waiting() {
        return Ok(false);
    }
    let restart_is_due = !is_within(
        facts.enrolment_check_anchor_at,
        now,
        VISIT_RESTART_MIN_INTERVAL_SECS,
    );
    let restarts = facts.enrolment_check_group < EnrolmentCheckGroup::Visited
        || (restart_is_due
            && (facts.enrolment_checks_stopped_at.is_some()
                || facts.enrolment_check_group == EnrolmentCheckGroup::Visited));
    if !restarts {
        return Ok(false);
    }
    let group = facts
        .enrolment_check_group
        .max(EnrolmentCheckGroup::Visited);
    let scheduled = first_check(group, now);
    write_schedule(
        &mut tx,
        id,
        group,
        now,
        scheduled,
        EnrolmentCheckSource::Schedule,
        scheduled.map_or_else(never, |scheduled| scheduled.release_at()),
        false,
    )
    .await?;
    tx.commit().await?;
    Ok(true)
}

/// Schedules the next check of a row an answer just parked in `no_usable_enrolment`: the first
/// rung after now, or stopped once the ladder has run out. A row with no schedule yet, such as one
/// import sent back, starts one now, past its immediate rung.
///
/// Reads the schedule under lock rather than from the snapshot the answer was decided on, so a
/// request that restarted the row while the check was out is kept.
pub async fn schedule_next_check(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    let facts = lock_schedule(conn, id).await?;
    if facts.state != CreditRegistrationState::NoUsableEnrolment {
        return Ok(());
    }
    let now = Utc::now();
    let anchor_at = facts.enrolment_check_anchor_at.unwrap_or(now);
    let scheduled = next_check_after(facts.enrolment_check_group, anchor_at, now);
    write_schedule(
        conn,
        id,
        facts.enrolment_check_group,
        anchor_at,
        scheduled,
        EnrolmentCheckSource::Schedule,
        scheduled.map_or_else(never, |scheduled| scheduled.release_at()),
        true,
    )
    .await
}

/// The schedule a row starts when it first waits for an enrolment, decided by the preconditions
/// recompute.
#[derive(Debug, Clone, PartialEq)]
pub struct EnrolmentCheckStart {
    pub credit_registration_id: Uuid,
    pub group: EnrolmentCheckGroup,
    pub anchor_at: DateTime<Utc>,
    pub scheduled: ScheduledEnrolmentCheck,
    pub source: EnrolmentCheckSource,
}

/// Writes the schedules rows start with, and ends the checks of the earlier attempts each new row
/// replaces for its student and module.
///
/// Only rows still in `expected_state`: one a phase moved since the decision keeps whatever that
/// phase wrote.
pub async fn record_starts(
    conn: &mut PgConnection,
    starts: &[EnrolmentCheckStart],
) -> ModelResult<()> {
    if starts.is_empty() {
        return Ok(());
    }
    let ids: Vec<Uuid> = starts
        .iter()
        .map(|start| start.credit_registration_id)
        .collect();
    let groups: Vec<EnrolmentCheckGroup> = starts.iter().map(|start| start.group).collect();
    let anchors: Vec<DateTime<Utc>> = starts.iter().map(|start| start.anchor_at).collect();
    let steps: Vec<i32> = starts.iter().map(|start| start.scheduled.step).collect();
    let due_ats: Vec<DateTime<Utc>> = starts.iter().map(|start| start.scheduled.due_at).collect();
    let batched: Vec<bool> = starts
        .iter()
        .map(|start| start.scheduled.is_batched)
        .collect();
    let sources: Vec<EnrolmentCheckSource> = starts.iter().map(|start| start.source).collect();
    sqlx::query!(
        r#"
UPDATE credit_registrations cr
SET enrolment_check_group = GREATEST(cr.enrolment_check_group, started.enrolment_check_group),
  enrolment_check_anchor_at = started.anchor_at,
  enrolment_check_step = started.step,
  enrolment_check_due_at = started.due_at,
  is_enrolment_check_batched = started.is_batched,
  enrolment_checks_stopped_at = NULL,
  enrolment_check_source = started.source
FROM UNNEST(
    $1::uuid [],
    $2::enrolment_check_group [],
    $3::timestamptz [],
    $4::int [],
    $5::timestamptz [],
    $6::boolean [],
    $7::enrolment_check_source []
  ) AS started(
    id,
    enrolment_check_group,
    anchor_at,
    step,
    due_at,
    is_batched,
    source
  )
WHERE cr.id = started.id
  AND cr.state IN ('no_usable_enrolment', 'ready_to_submit')
  AND cr.deleted_at IS NULL
        "#,
        &ids,
        &groups as &[EnrolmentCheckGroup],
        &anchors,
        &steps,
        &due_ats,
        &batched,
        &sources as &[EnrolmentCheckSource],
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        r#"
UPDATE credit_registrations replaced
SET enrolment_check_anchor_at = COALESCE(replaced.enrolment_check_anchor_at, now()),
  enrolment_check_step = NULL,
  enrolment_check_due_at = NULL,
  is_enrolment_check_batched = FALSE,
  enrolment_checks_stopped_at = COALESCE(replaced.enrolment_checks_stopped_at, now()),
  next_attempt_at = $2
FROM credit_registrations started
WHERE started.id = ANY($1::uuid [])
  AND replaced.user_id = started.user_id
  AND replaced.course_module_id = started.course_module_id
  AND replaced.id <> started.id
  AND replaced.created_at < started.created_at
  AND replaced.state = 'no_usable_enrolment'
  AND replaced.superseded_by_id IS NULL
  AND replaced.deleted_at IS NULL
        "#,
        &ids,
        never(),
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// One student the roster lists on a module, with every enrolment id it lists them under.
#[derive(Debug, Clone, PartialEq)]
pub struct RosterEnrolee {
    pub user_id: Uuid,
    pub enrolment_ids: Vec<String>,
}

/// Wakes this module's rows waiting for an enrolment when the roster lists their student under an
/// enrolment id the row has not seen, stopped rows included, and returns how many it touched.
///
/// A row never checked has seen nothing, so any listing wakes it. The listed ids count as seen from
/// here on, so one listing wakes a row once. A row a later attempt has replaced is left alone. Only
/// the clock moves: the enrolment is still resolved by a check rather than read off the roster.
pub async fn wake_for_roster_listing(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    enrolees: &[RosterEnrolee],
) -> ModelResult<u64> {
    let mut user_ids = Vec::new();
    let mut enrolment_ids: Vec<Option<String>> = Vec::new();
    for enrolee in enrolees {
        if enrolee.enrolment_ids.is_empty() {
            user_ids.push(enrolee.user_id);
            enrolment_ids.push(None);
        }
        for enrolment_id in &enrolee.enrolment_ids {
            user_ids.push(enrolee.user_id);
            enrolment_ids.push(Some(enrolment_id.clone()));
        }
    }
    let res = sqlx::query!(
        r#"
WITH listed AS (
  SELECT user_id,
    ARRAY_REMOVE(ARRAY_AGG(enrolment_id), NULL) AS enrolment_ids
  FROM UNNEST($2::uuid [], $3::text []) AS listing(user_id, enrolment_id)
  GROUP BY user_id
)
UPDATE credit_registrations cr
SET enrolment_check_source = CASE
    WHEN cr.next_attempt_at > now() THEN 'roster_listing'
    ELSE cr.enrolment_check_source
  END,
  next_attempt_at = LEAST(cr.next_attempt_at, now()),
  seen_enrolment_ids = ARRAY(
    SELECT DISTINCT UNNEST(COALESCE(cr.seen_enrolment_ids, '{}') || listed.enrolment_ids)
  )
FROM listed
WHERE cr.course_module_id = $1
  AND cr.user_id = listed.user_id
  AND cr.state = 'no_usable_enrolment'
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND (
    cr.seen_enrolment_ids IS NULL
    OR NOT listed.enrolment_ids <@ cr.seen_enrolment_ids
  )
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registrations later
    WHERE later.user_id = cr.user_id
      AND later.course_module_id = cr.course_module_id
      AND later.created_at > cr.created_at
      AND later.deleted_at IS NULL
  )
        "#,
        course_module_id,
        &user_ids,
        &enrolment_ids as &[Option<String>],
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

/// Adds the enrolment ids a check saw to the row's seen set, which also marks it checked for
/// [`wake_for_roster_listing`].
pub async fn add_seen_enrolment_ids(
    conn: &mut PgConnection,
    id: Uuid,
    enrolment_ids: &[String],
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET seen_enrolment_ids = ARRAY(
    SELECT DISTINCT UNNEST(COALESCE(seen_enrolment_ids, '{}') || $2::text [])
  )
WHERE id = $1
        "#,
        id,
        enrolment_ids,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Moves the schedules of a module's rows past a pause of `paused_for_secs`, so the pause spends
/// none of their ladder. A batched row stays on a batch boundary. Stopped rows are left as they are.
pub async fn shift_past_pause(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    paused_for_secs: i64,
) -> ModelResult<u64> {
    let res = sqlx::query!(
        r#"
UPDATE credit_registrations
SET enrolment_check_anchor_at = enrolment_check_anchor_at + ($2::bigint * INTERVAL '1 second'),
  enrolment_check_due_at = enrolment_check_due_at + ($2::bigint * INTERVAL '1 second'),
  next_attempt_at = CASE
    WHEN state <> 'no_usable_enrolment'
    OR enrolment_check_source <> 'schedule' THEN next_attempt_at
    WHEN is_enrolment_check_batched THEN to_timestamp(
      CEIL(
        EXTRACT(
          EPOCH
          FROM next_attempt_at + ($2::bigint * INTERVAL '1 second')
        ) / $3::bigint
      ) * $3::bigint
    )
    ELSE next_attempt_at + ($2::bigint * INTERVAL '1 second')
  END
WHERE course_module_id = $1
  AND enrolment_check_anchor_at IS NOT NULL
  AND enrolment_checks_stopped_at IS NULL
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        course_module_id,
        paused_for_secs.max(0),
        BATCH_INTERVAL_SECS,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

/// Brings the slow checks due within [`BATCH_PULL_FORWARD_SECS`] forward to now when another slow
/// check in `scope` is released and not yet claimed: they cost nothing extra in the request that
/// goes out for it. A row tried within [`TRANSIENT_FAILURE_RETRY_SECS`] keeps waiting out its failed
/// lookup.
pub async fn pull_forward_batched_checks(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
WITH scoped AS (
  SELECT cr.id,
    cr.next_attempt_at,
    cr.enrolment_check_due_at,
    cr.last_attempt_at,
    cr.enrolment_check_claimed_until
  FROM credit_registrations cr
    JOIN credit_registration_active_course_modules acm ON acm.course_module_id = cr.course_module_id
  WHERE cr.state = 'no_usable_enrolment'
    AND cr.is_enrolment_check_batched
    AND cr.superseded_by_id IS NULL
    AND cr.deleted_at IS NULL
    AND ($1::uuid IS NULL OR cr.course_id = $1)
    AND ($2::uuid IS NULL OR cr.user_id = $2)
    AND (
      cardinality($3::uuid []) = 0
      OR cr.id = ANY($3::uuid [])
    )
)
UPDATE credit_registrations cr
SET next_attempt_at = now()
FROM scoped
WHERE cr.id = scoped.id
  AND scoped.next_attempt_at > now()
  AND scoped.enrolment_check_due_at > now()
  AND scoped.enrolment_check_due_at <= now() + ($4::bigint * INTERVAL '1 second')
  AND (
    scoped.last_attempt_at IS NULL
    OR scoped.last_attempt_at <= now() - ($5::bigint * INTERVAL '1 second')
  )
  AND EXISTS (
    SELECT 1
    FROM scoped released
    WHERE released.next_attempt_at <= now()
      AND (
        released.enrolment_check_claimed_until IS NULL
        OR released.enrolment_check_claimed_until <= now()
      )
  )
        "#,
        scope.course_id,
        scope.user_id,
        &scope.credit_registration_ids,
        BATCH_PULL_FORWARD_SECS,
        TRANSIENT_FAILURE_RETRY_SECS,
    )
    .execute(conn)
    .await?;
    Ok(())
}
