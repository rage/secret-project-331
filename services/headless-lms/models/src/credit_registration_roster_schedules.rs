//! When enrolment discovery fetches each course code's enrolment list.
//!
//! A code is due weekly, and sooner while somebody on its modules waits for a student number: each
//! such person is on the ladders of the signals they have given that they are enrolling, and the
//! code is due at the earliest rung the last fetch has not served. Every due time snaps up to the
//! code's own grid, see [`fetch_slot`], so codes spread evenly over the hour. Both are derived
//! whenever they are needed; only the failure backoff lives in the table.

use std::collections::HashMap;
use std::sync::LazyLock;

use chrono::TimeDelta;

use crate::course_module_suotar_configurations::{LinkingOutcome, ModuleToList};
use crate::credit_registrations::CreditRegistrationErrorCode;
use crate::library::credit_registration::enrolment_check_schedule::EnrolmentCheckGroup;
use crate::prelude::*;

const HOUR_SECS: i64 = 60 * 60;
const DAY_SECS: i64 = 24 * HOUR_SECS;

/// How far apart the points of a code's fetch grid are. Divides an hour.
pub const FETCH_GRID_STEP: TimeDelta = TimeDelta::minutes(20);
/// A code fetched this recently is not fetched again, whatever is due.
pub const MIN_REFETCH_GAP: TimeDelta = TimeDelta::minutes(15);
/// The shorter gap the first fetch after an "I have enrolled" press needs, since the student is
/// waiting on it.
pub const PRESS_MIN_REFETCH_GAP: TimeDelta = TimeDelta::minutes(5);
/// How often every code is fetched, whether or not anybody on it is waiting.
pub const BASELINE_INTERVAL: TimeDelta = TimeDelta::weeks(1);
/// How long after its anchor a waiting person still makes the code due: every ladder ends here.
pub const WAITING_HORIZON: TimeDelta = TimeDelta::days(90);
/// How long a code that failed on its own is left alone, by how many times in a row it has.
const ALONE_FAILURE_BACKOFF_SECS: [i64; 3] = [HOUR_SECS, 4 * HOUR_SECS, DAY_SECS];

/// The first point of `course_code`'s fetch grid at or after `at`: [`FETCH_GRID_STEP`] apart, at an
/// offset into the step fixed per code. The only place that decides when within the hour a code
/// goes out.
pub fn fetch_slot(course_code: &str, at: DateTime<Utc>) -> DateTime<Utc> {
    // FNV-1a: the standard library's hashers do not promise a stable output, and a code should
    // keep its grid across processes and releases.
    let hash = course_code
        .bytes()
        .fold(0xcbf2_9ce4_8422_2325_u64, |hash, byte| {
            (hash ^ u64::from(byte)).wrapping_mul(0x0100_0000_01b3)
        });
    let step = FETCH_GRID_STEP.num_seconds();
    let offset = i64::try_from(hash % step.unsigned_abs()).unwrap_or(0);
    let secs = at.timestamp() + i64::from(at.timestamp_subsec_nanos() > 0);
    let point = (secs - offset + step - 1).div_euclid(step) * step + offset;
    DateTime::from_timestamp(point, 0).unwrap_or(at)
}

/// A waiting person's ladder, as offsets from its anchor: the completion for
/// [`EnrolmentCheckGroup::Completed`], the last visit for [`EnrolmentCheckGroup::Visited`] and the
/// last "I have enrolled" press for [`EnrolmentCheckGroup::CheckRequested`].
pub fn waiting_ladder(group: EnrolmentCheckGroup) -> &'static [TimeDelta] {
    static COMPLETED: LazyLock<Vec<TimeDelta>> = LazyLock::new(|| {
        [1, 3, 7, 14, 30, 60, 90]
            .into_iter()
            .map(TimeDelta::days)
            .collect()
    });
    static VISITED: LazyLock<Vec<TimeDelta>> = LazyLock::new(|| {
        let mut offsets: Vec<TimeDelta> = [1, 2, 3, 5, 8, 12, 24]
            .into_iter()
            .map(TimeDelta::hours)
            .collect();
        extend_by(&mut offsets, TimeDelta::days(1), TimeDelta::days(14));
        extend_by(&mut offsets, TimeDelta::days(3), TimeDelta::days(30));
        extend_by(&mut offsets, TimeDelta::weeks(1), WAITING_HORIZON);
        offsets
    });
    static PRESSED: LazyLock<Vec<TimeDelta>> = LazyLock::new(|| {
        let mut offsets: Vec<TimeDelta> = [
            0, 20, 40, 60, 80, 100, 120, 150, 180, 240, 360, 540, 720, 1440,
        ]
        .into_iter()
        .map(TimeDelta::minutes)
        .collect();
        extend_by(&mut offsets, TimeDelta::days(1), TimeDelta::days(7));
        extend_by(&mut offsets, TimeDelta::days(3), TimeDelta::days(30));
        extend_by(&mut offsets, TimeDelta::weeks(1), WAITING_HORIZON);
        offsets
    });
    match group {
        EnrolmentCheckGroup::Completed => &COMPLETED,
        EnrolmentCheckGroup::Visited => &VISITED,
        EnrolmentCheckGroup::CheckRequested => &PRESSED,
    }
}

/// Appends rungs `gap` apart until the next one would pass `until`.
fn extend_by(offsets: &mut Vec<TimeDelta>, gap: TimeDelta, until: TimeDelta) {
    while let Some(next) = offsets.last().map(|last| *last + gap)
        && next <= until
    {
        offsets.push(next);
    }
}

fn ladder_secs(group: EnrolmentCheckGroup) -> Vec<i64> {
    waiting_ladder(group)
        .iter()
        .map(TimeDelta::num_seconds)
        .collect()
}

/// One code's schedule, with the waiting people its next fetch is derived from.
#[derive(Debug, Clone, PartialEq)]
pub struct RosterSchedule {
    pub course_code: String,
    pub last_fetched_at: Option<DateTime<Utc>>,
    pub last_fetch_duration_ms: Option<i32>,
    pub last_listed_person_count: Option<i32>,
    pub is_fetched_alone: bool,
    pub consecutive_failures: i32,
    pub retry_not_before: Option<DateTime<Utc>>,
    pub last_error: Option<CreditRegistrationErrorCode>,
    /// The active modules on the code, which share its enrolment list.
    pub module_count: i64,
    /// Registrations on the code's modules waiting for a student number within
    /// [`WAITING_HORIZON`] of an anchor. Always zero with account linking off.
    pub waiting_count: i64,
    /// The earliest waiting rung after the last fetch.
    pub next_waiting_rung_at: Option<DateTime<Utc>>,
    /// The latest "I have enrolled" press by a waiting person after the last fetch.
    pub unserved_press_at: Option<DateTime<Utc>>,
    /// An admin's fetch request; served once a fetch runs after it.
    pub fetch_requested_at: Option<DateTime<Utc>>,
    /// The last enrolment list that fed account linking, each person counted once.
    pub linking_outcome: Option<LinkingOutcome>,
}

impl RosterSchedule {
    /// When the code is next due, ignoring the failure backoff: at once if it has never been
    /// fetched.
    pub fn next_fetch_at(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let Some(last_fetched_at) = self.last_fetched_at else {
            return now;
        };
        let baseline = last_fetched_at + BASELINE_INTERVAL;
        let ready_at = self
            .next_waiting_rung_at
            .map_or(baseline, |waiting| waiting.min(baseline));
        let due = fetch_slot(
            &self.course_code,
            ready_at.max(last_fetched_at + MIN_REFETCH_GAP),
        );
        let urgent_at = [self.unserved_press_at, self.unserved_fetch_request_at()]
            .into_iter()
            .flatten()
            .min();
        urgent_at.map_or(due, |urgent_at| {
            due.min(fetch_slot(
                &self.course_code,
                urgent_at.max(last_fetched_at + PRESS_MIN_REFETCH_GAP),
            ))
        })
    }

    /// An admin's fetch request no fetch has run after yet.
    pub fn unserved_fetch_request_at(&self) -> Option<DateTime<Utc>> {
        self.fetch_requested_at.filter(|requested_at| {
            self.last_fetched_at
                .is_none_or(|fetched_at| *requested_at > fetched_at)
        })
    }

    /// Whether the code is to be fetched now, failure backoff included.
    pub fn is_due(&self, now: DateTime<Utc>) -> bool {
        self.retry_not_before.is_none_or(|retry| retry <= now) && self.next_fetch_at(now) <= now
    }
}

/// Creates the schedule rows of every listable code, and the per-module configuration rows the
/// discovery counters are written to. `course_id` narrows it to one course.
pub async fn ensure_rows(conn: &mut PgConnection, course_id: Option<Uuid>) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO course_module_suotar_configurations (course_module_id)
SELECT acm.course_module_id
FROM credit_registration_active_course_modules acm
  JOIN course_modules cm ON cm.id = acm.course_module_id AND cm.deleted_at IS NULL
WHERE TRIM(COALESCE(cm.uh_course_code, '')) <> ''
  AND ($1::uuid IS NULL OR acm.course_id = $1) ON CONFLICT (course_module_id) DO NOTHING
        "#,
        course_id,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        r#"
INSERT INTO credit_registration_roster_schedules (course_code)
SELECT DISTINCT TRIM(cm.uh_course_code)
FROM credit_registration_active_course_modules acm
  JOIN course_modules cm ON cm.id = acm.course_module_id AND cm.deleted_at IS NULL
WHERE TRIM(COALESCE(cm.uh_course_code, '')) <> ''
  AND ($1::uuid IS NULL OR acm.course_id = $1) ON CONFLICT (course_code) DO NOTHING
        "#,
        course_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Which codes [`get_schedules`] reads.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScheduleSelection {
    Every,
    /// Only the codes not fetched in the last [`PRESS_MIN_REFETCH_GAP`] and out of backoff, a superset
    /// [`RosterSchedule::is_due`] narrows down: the waiting people are then read for those alone.
    DueCandidates,
}

/// Every listable code that has a schedule row; see [`ensure_rows`]. `course_id` narrows the codes
/// and the modules their waiting people come from to one course, for a scoped tick. Only
/// completions on or after `account_linking_since` can wait, and with it `None` nobody does.
pub async fn get_schedules(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    selection: ScheduleSelection,
    account_linking_since: Option<DateTime<Utc>>,
) -> ModelResult<Vec<RosterSchedule>> {
    let rows = sqlx::query!(
        r#"
WITH modules AS (
  SELECT TRIM(cm.uh_course_code) AS course_code
  FROM credit_registration_active_course_modules acm
    JOIN course_modules cm ON cm.id = acm.course_module_id AND cm.deleted_at IS NULL
  WHERE TRIM(COALESCE(cm.uh_course_code, '')) <> ''
    AND ($1::uuid IS NULL OR acm.course_id = $1)
)
SELECT s.course_code,
  s.last_fetched_at,
  s.last_fetch_duration_ms,
  s.last_listed_person_count,
  s.is_fetched_alone,
  s.consecutive_failures,
  s.retry_not_before,
  s.last_error,
  s.fetch_requested_at,
  s.linking_listed_count,
  s.linking_already_linked_count,
  s.linking_mailed_count,
  s.linking_suppressed_by_dedup_count,
  s.linking_suppressed_by_rate_cap_count,
  s.linking_no_address_count,
  (
    SELECT COUNT(*)
    FROM modules m
    WHERE m.course_code = s.course_code
  ) AS "module_count!"
FROM credit_registration_roster_schedules s
WHERE s.course_code IN (
    SELECT course_code
    FROM modules
  )
  AND (
    NOT $2::boolean
    OR (
      (
        s.retry_not_before IS NULL
        OR s.retry_not_before <= now()
      )
      AND (
        s.last_fetched_at IS NULL
        OR s.last_fetched_at < $3
      )
    )
  )
ORDER BY s.course_code
        "#,
        course_id,
        selection == ScheduleSelection::DueCandidates,
        Utc::now() - PRESS_MIN_REFETCH_GAP,
    )
    .fetch_all(&mut *conn)
    .await?;
    let codes: Vec<String> = rows.iter().map(|row| row.course_code.clone()).collect();
    // Every rung comes after the epoch, so a code never fetched has seen none.
    let fetched_until: Vec<DateTime<Utc>> = rows
        .iter()
        .map(|row| row.last_fetched_at.unwrap_or(DateTime::UNIX_EPOCH))
        .collect();
    let mut waiting = get_waiting(
        conn,
        course_id,
        &codes,
        &fetched_until,
        account_linking_since,
    )
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            let waiting = waiting.remove(&row.course_code).unwrap_or_default();
            let linking_outcome =
                row.linking_listed_count
                    .map(|listed_person_count| LinkingOutcome {
                        listed_person_count,
                        already_linked_count: row.linking_already_linked_count.unwrap_or(0),
                        mailed_count: row.linking_mailed_count.unwrap_or(0),
                        suppressed_by_dedup_count: row
                            .linking_suppressed_by_dedup_count
                            .unwrap_or(0),
                        suppressed_by_rate_cap_count: row
                            .linking_suppressed_by_rate_cap_count
                            .unwrap_or(0),
                        no_address_count: row.linking_no_address_count.unwrap_or(0),
                    });
            RosterSchedule {
                course_code: row.course_code,
                last_fetched_at: row.last_fetched_at,
                last_fetch_duration_ms: row.last_fetch_duration_ms,
                last_listed_person_count: row.last_listed_person_count,
                is_fetched_alone: row.is_fetched_alone,
                consecutive_failures: row.consecutive_failures,
                retry_not_before: row.retry_not_before,
                last_error: row.last_error,
                module_count: row.module_count,
                waiting_count: waiting.waiting_count,
                next_waiting_rung_at: waiting.next_rung_at,
                unserved_press_at: waiting.unserved_press_at,
                fetch_requested_at: row.fetch_requested_at,
                linking_outcome,
            }
        })
        .collect())
}

/// The people waiting on one code; see [`RosterSchedule`].
#[derive(Debug, Default)]
struct CodeWaiting {
    waiting_count: i64,
    next_rung_at: Option<DateTime<Utc>>,
    unserved_press_at: Option<DateTime<Utc>>,
}

/// The people waiting on each code, their rungs and presses counted after the code's
/// `fetched_until`, its last fetch.
async fn get_waiting(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    course_codes: &[String],
    fetched_until: &[DateTime<Utc>],
    account_linking_since: Option<DateTime<Utc>>,
) -> ModelResult<HashMap<String, CodeWaiting>> {
    if account_linking_since.is_none() || course_codes.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query!(
        r#"
WITH codes AS (
  SELECT *
  FROM UNNEST($2::text [], $3::timestamptz []) AS code(course_code, fetched_until)
),
waiting AS (
  SELECT codes.course_code,
    codes.fetched_until,
    cr.id AS credit_registration_id,
    ladder.anchor_at,
    ladder.offsets,
    ladder.is_press
  FROM codes
    JOIN course_modules cm ON TRIM(cm.uh_course_code) = codes.course_code
    AND cm.deleted_at IS NULL
    JOIN credit_registration_active_course_modules acm ON acm.course_module_id = cm.id
    JOIN credit_registrations cr ON cr.course_module_id = cm.id
    JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
    JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
    LEFT JOIN credit_registration_enrolment_check_signals sig ON sig.course_module_completion_id = cr.course_module_completion_id
    AND sig.deleted_at IS NULL
    CROSS JOIN LATERAL (
      VALUES (cmc.completion_date, $4::bigint [], FALSE),
        (sig.last_visited_at, $5::bigint [], FALSE),
        (sig.last_check_requested_at, $6::bigint [], TRUE)
    ) AS ladder(anchor_at, offsets, is_press)
  WHERE ($1::uuid IS NULL OR acm.course_id = $1)
    AND cr.state = 'pending'
    AND cr.superseded_by_id IS NULL
    AND cr.deleted_at IS NULL
    AND p.completion_eligible
    AND NOT p.has_verified_student_number
    AND cmc.completion_date >= $7::timestamptz
    AND ladder.anchor_at > now() - ($8::bigint * INTERVAL '1 second')
)
SELECT w.course_code AS "course_code!",
  COUNT(DISTINCT w.credit_registration_id) AS "waiting_count!",
  MIN(rung.due_at) FILTER (
    WHERE rung.due_at > w.fetched_until
  ) AS next_rung_at,
  MAX(w.anchor_at) FILTER (
    WHERE w.is_press
      AND w.anchor_at > w.fetched_until
  ) AS unserved_press_at
FROM waiting w
  CROSS JOIN LATERAL (
    SELECT w.anchor_at + (o.secs * INTERVAL '1 second') AS due_at
    FROM unnest(w.offsets) AS o(secs)
  ) rung
GROUP BY w.course_code
        "#,
        course_id,
        course_codes,
        fetched_until,
        &ladder_secs(EnrolmentCheckGroup::Completed),
        &ladder_secs(EnrolmentCheckGroup::Visited),
        &ladder_secs(EnrolmentCheckGroup::CheckRequested),
        account_linking_since,
        WAITING_HORIZON.num_seconds(),
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            (
                row.course_code,
                CodeWaiting {
                    waiting_count: row.waiting_count,
                    next_rung_at: row.next_rung_at,
                    unserved_press_at: row.unserved_press_at,
                },
            )
        })
        .collect())
}

/// The active modules on each of `course_codes`, which share its roster. `course_id` narrows them
/// to one course, as it does for [`get_schedules`].
pub async fn get_modules_by_code(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    course_codes: &[String],
) -> ModelResult<HashMap<String, Vec<ModuleToList>>> {
    let modules = sqlx::query_as!(
        ModuleToList,
        r#"
SELECT acm.course_module_id AS "course_module_id!",
  acm.course_id AS "course_id!",
  TRIM(cm.uh_course_code) AS "uh_course_code!",
  co.language_code AS "course_language_code!"
FROM credit_registration_active_course_modules acm
  JOIN course_modules cm ON cm.id = acm.course_module_id AND cm.deleted_at IS NULL
  JOIN courses co ON co.id = acm.course_id AND co.deleted_at IS NULL
WHERE TRIM(cm.uh_course_code) = ANY($2::text [])
  AND ($1::uuid IS NULL OR acm.course_id = $1)
ORDER BY cm.id
        "#,
        course_id,
        course_codes,
    )
    .fetch_all(conn)
    .await?;
    let mut modules_by_code: HashMap<String, Vec<ModuleToList>> = HashMap::new();
    for module in modules {
        modules_by_code
            .entry(module.uh_course_code.clone())
            .or_default()
            .push(module);
    }
    Ok(modules_by_code)
}

/// Stamps the codes a listing request is about to go out for.
pub async fn mark_attempted(conn: &mut PgConnection, course_codes: &[String]) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_roster_schedules
SET last_attempted_at = now()
WHERE course_code = ANY($1::text [])
        "#,
        course_codes,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records an enrolment list that arrived, or Suotar saying it holds no realisation of the code,
/// and clears the failure streak. Returns when the code was fetched before this.
pub async fn mark_fetched(
    conn: &mut PgConnection,
    course_code: &str,
    listed_person_count: i32,
    duration_ms: i32,
) -> ModelResult<Option<DateTime<Utc>>> {
    let previous = sqlx::query_scalar!(
        r#"
WITH previous AS (
  SELECT id,
    last_fetched_at
  FROM credit_registration_roster_schedules
  WHERE course_code = $1
  FOR UPDATE
)
UPDATE credit_registration_roster_schedules s
SET last_fetched_at = now(),
  last_fetch_duration_ms = $3,
  last_listed_person_count = $2,
  is_fetched_alone = FALSE,
  consecutive_failures = 0,
  retry_not_before = NULL,
  last_error = NULL
FROM previous
WHERE s.id = previous.id
RETURNING previous.last_fetched_at
        "#,
        course_code,
        listed_person_count,
        duration_ms,
    )
    .fetch_optional(conn)
    .await?;
    Ok(previous.flatten())
}

/// Overwrites the code's linking counters with what its latest enrolment list did.
pub async fn record_linking_outcome(
    conn: &mut PgConnection,
    course_code: &str,
    outcome: &LinkingOutcome,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_roster_schedules
SET linking_listed_count = $2,
  linking_already_linked_count = $3,
  linking_mailed_count = $4,
  linking_suppressed_by_dedup_count = $5,
  linking_suppressed_by_rate_cap_count = $6,
  linking_no_address_count = $7
WHERE course_code = $1
        "#,
        course_code,
        outcome.listed_person_count,
        outcome.already_linked_count,
        outcome.mailed_count,
        outcome.suppressed_by_dedup_count,
        outcome.suppressed_by_rate_cap_count,
        outcome.no_address_count,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Makes the code due at its next grid point, as an "I have enrolled" press would. Returns the
/// schedule row's id, or `None` for a code with no row.
pub async fn request_fetch(
    conn: &mut PgConnection,
    course_code: &str,
) -> ModelResult<Option<Uuid>> {
    let id = sqlx::query_scalar!(
        r#"
UPDATE credit_registration_roster_schedules
SET fetch_requested_at = now()
WHERE course_code = $1
RETURNING id
        "#,
        course_code,
    )
    .fetch_optional(conn)
    .await?;
    Ok(id)
}

/// Records a request batching several codes that failed as a whole. Each is listed on its own from
/// now on, until it succeeds, so one bad code stops failing the others.
pub async fn mark_batch_failed(
    conn: &mut PgConnection,
    course_codes: &[String],
    error: CreditRegistrationErrorCode,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_roster_schedules
SET is_fetched_alone = TRUE,
  last_error = $2
WHERE course_code = ANY($1::text [])
        "#,
        course_codes,
        error as CreditRegistrationErrorCode,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records a listing of the code on its own that failed, and backs the code off: an hour, four
/// hours, then daily.
pub async fn mark_alone_failed(
    conn: &mut PgConnection,
    course_code: &str,
    error: CreditRegistrationErrorCode,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_roster_schedules
SET is_fetched_alone = TRUE,
  consecutive_failures = consecutive_failures + 1,
  last_error = $2,
  retry_not_before = now() + (
    ($3::bigint [])[LEAST(consecutive_failures + 1, CARDINALITY($3::bigint []))] * INTERVAL '1 second'
  )
WHERE course_code = $1
        "#,
        course_code,
        error as CreditRegistrationErrorCode,
        &ALONE_FAILURE_BACKOFF_SECS[..],
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Codes listed on their own that keep failing, for the admin alert.
#[derive(Debug, Clone, PartialEq)]
pub struct FailingRosterCode {
    pub course_code: String,
    pub consecutive_failures: i32,
    pub last_error: Option<CreditRegistrationErrorCode>,
    pub last_attempted_at: Option<DateTime<Utc>>,
}

/// The codes whose latest listings failed, most consecutive failures first.
pub async fn get_failing_codes(conn: &mut PgConnection) -> ModelResult<Vec<FailingRosterCode>> {
    let res = sqlx::query_as!(
        FailingRosterCode,
        r#"
SELECT course_code,
  consecutive_failures,
  last_error,
  last_attempted_at
FROM credit_registration_roster_schedules
WHERE consecutive_failures > 0
ORDER BY consecutive_failures DESC,
  course_code
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Test-mode setup the system tests drive through the mock Suotar control routes.
pub mod testing {
    use super::{BASELINE_INTERVAL, FETCH_GRID_STEP};
    use crate::prelude::*;

    /// Waits out the weekly fetch and the failure backoff of every code on the course's active
    /// modules, and returns how many codes it moved. Exists only for test setup: specs cannot wait
    /// for a grid point.
    pub async fn make_listings_due_for_testing(
        conn: &mut PgConnection,
        course_id: Uuid,
    ) -> ModelResult<u64> {
        let res = sqlx::query!(
            r#"
UPDATE credit_registration_roster_schedules
SET last_fetched_at = last_fetched_at - ($2::bigint * INTERVAL '1 second'),
  retry_not_before = NULL
WHERE course_code IN (
    SELECT TRIM(cm.uh_course_code)
    FROM credit_registration_active_course_modules acm
      JOIN course_modules cm ON cm.id = acm.course_module_id AND cm.deleted_at IS NULL
    WHERE acm.course_id = $1
  )
        "#,
            course_id,
            (BASELINE_INTERVAL + FETCH_GRID_STEP).num_seconds(),
        )
        .execute(conn)
        .await?;
        Ok(res.rows_affected())
    }
}
