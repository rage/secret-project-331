//! When enrolment discovery fetches each course code's enrolment list.
//!
//! A code is due weekly, and sooner while somebody on its modules waits for a student number: each
//! such person is on the ladders of the signals they have given that they are enrolling, and the
//! code is due at the earliest rung no fetch that could claim linking mail has served. Every due
//! time snaps up to the code's own grid, see [`fetch_slot`], so codes spread evenly over the hour.
//! Both are derived whenever they are needed; the table keeps only what cannot be: when fetches
//! ran, the failure backoff and how many fetches of the code went out today.

use std::collections::HashMap;

use chrono::TimeDelta;
use utoipa::ToSchema;

use crate::course_module_suotar_configurations::ModuleToList;
use crate::credit_registrations::CreditRegistrationErrorCode;
use crate::library::credit_registration::enrolment_check_schedule::{
    COMPLETED_LADDER, DAY_SECS, HOUR_SECS, MINUTE_SECS, WEEK_SECS, ladder,
};
use crate::prelude::*;

/// How far apart the points of a code's fetch grid are. Divides an hour.
pub const FETCH_GRID_STEP: TimeDelta = TimeDelta::minutes(20);
/// A code fetched this recently is not fetched again, whatever is due.
pub const MIN_REFETCH_GAP: TimeDelta = TimeDelta::minutes(15);
/// The shorter gap the first fetch after an "I have enrolled" press or an admin's request needs,
/// since somebody is waiting on it.
pub const PRESS_MIN_REFETCH_GAP: TimeDelta = TimeDelta::minutes(5);
/// How often every code is fetched, whether or not anybody on it is waiting.
pub const BASELINE_INTERVAL: TimeDelta = TimeDelta::weeks(1);
/// How long after its anchor a waiting person still makes the code due: every ladder ends here.
pub const WAITING_HORIZON: TimeDelta = TimeDelta::days(90);
/// How many fetches of one code may go out in a UTC day. Past it, only the weekly fetch and an
/// admin's request make the code due: a third of the grid points, so one busy code cannot crowd
/// out the rest.
pub const MAX_FETCHES_PER_DAY: i32 = 24;
/// How long a code that failed on its own is left alone, by how many times in a row it has.
const ALONE_FAILURE_BACKOFF_SECS: [i64; 3] = [HOUR_SECS, 4 * HOUR_SECS, DAY_SECS];

const WAITING_HORIZON_SECS: i64 = WAITING_HORIZON.num_seconds();
const VISITED_LADDER: [i64; 33] = ladder(
    &[1, 2, 3, 5, 8, 12, 24],
    HOUR_SECS,
    &[
        (DAY_SECS, 14 * DAY_SECS),
        (3 * DAY_SECS, 30 * DAY_SECS),
        (WEEK_SECS, WAITING_HORIZON_SECS),
    ],
);
const PRESSED_LADDER: [i64; 35] = ladder(
    &[
        0, 20, 40, 60, 80, 100, 120, 150, 180, 240, 360, 540, 720, 1440,
    ],
    MINUTE_SECS,
    &[
        (DAY_SECS, 7 * DAY_SECS),
        (3 * DAY_SECS, 30 * DAY_SECS),
        (WEEK_SECS, WAITING_HORIZON_SECS),
    ],
);

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

/// What one code's last enrolment list that fed account linking did, each person counted once in
/// exactly one of the counters after `listed_person_count`. Written whole, so the dashboard never
/// mixes two runs.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, ToSchema)]
pub struct AccountLinkingCodeCounters {
    /// Only those enrolled since account linking began.
    pub listed_person_count: i32,
    pub already_linked_count: i32,
    pub mailed_count: i32,
    pub suppressed_by_dedup_count: i32,
    pub suppressed_by_rate_cap_count: i32,
    /// Persons the registry holds no address for: the one population no remedy here can reach.
    pub no_address_count: i32,
}

/// One code's schedule, with the waiting people its next fetch is derived from.
#[derive(Debug, Clone, PartialEq)]
pub struct RosterSchedule {
    pub course_code: String,
    pub last_fetched_at: Option<DateTime<Utc>>,
    pub last_fetch_started_at: Option<DateTime<Utc>>,
    /// When the latest arrived fetch that could claim linking mail was sent.
    pub last_mailing_fetch_started_at: Option<DateTime<Utc>>,
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
    /// The earliest unserved rung of a waiting person's ladder.
    pub next_rung_at: Option<DateTime<Utc>>,
    /// The latest unserved "I have enrolled" press a waiting person's ladder is anchored on.
    pub unserved_press_at: Option<DateTime<Utc>>,
    /// Fetches of the code sent today (UTC), against [`MAX_FETCHES_PER_DAY`].
    pub fetches_today: i32,
    /// An admin's fetch request; served once a fetch sent after it arrives.
    pub fetch_requested_at: Option<DateTime<Utc>>,
    /// The last enrolment list that fed account linking.
    pub linking_counters: Option<AccountLinkingCodeCounters>,
}

impl RosterSchedule {
    /// When the code is next due, ignoring the failure backoff: at once if it has never been
    /// fetched.
    pub fn next_fetch_at(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let Some(last_fetched_at) = self.last_fetched_at else {
            return now;
        };
        let mut reasons = vec![(last_fetched_at + BASELINE_INTERVAL, MIN_REFETCH_GAP)];
        reasons.extend(
            self.unserved_fetch_request_at()
                .map(|requested_at| (requested_at, PRESS_MIN_REFETCH_GAP)),
        );
        if self.fetches_today < MAX_FETCHES_PER_DAY {
            reasons.extend(self.next_rung_at.map(|rung_at| (rung_at, MIN_REFETCH_GAP)));
            reasons.extend(
                self.unserved_press_at
                    .map(|pressed_at| (pressed_at, PRESS_MIN_REFETCH_GAP)),
            );
        }
        reasons
            .into_iter()
            .map(|(ready_at, gap)| self.slot_after(ready_at, gap))
            .min()
            .unwrap_or(now)
    }

    /// The first grid point at or after `ready_at` that is at least `gap` after the last fetch.
    fn slot_after(&self, ready_at: DateTime<Utc>, gap: TimeDelta) -> DateTime<Utc> {
        let ready_at = self
            .last_fetched_at
            .map_or(ready_at, |fetched_at| ready_at.max(fetched_at + gap));
        fetch_slot(&self.course_code, ready_at)
    }

    /// An admin's fetch request no fetch sent after it has served yet.
    pub fn unserved_fetch_request_at(&self) -> Option<DateTime<Utc>> {
        self.fetch_requested_at.filter(|requested_at| {
            self.last_fetch_started_at
                .is_none_or(|started_at| *requested_at > started_at)
        })
    }

    /// Whether the code is to be fetched now, failure backoff included.
    pub fn is_due(&self, now: DateTime<Utc>) -> bool {
        self.retry_not_before.is_none_or(|retry| retry <= now) && self.next_fetch_at(now) <= now
    }
}

/// Creates the schedule rows of every listable code, and the per-module configuration rows the
/// listing status is written to. `course_id` narrows it to one course.
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
pub enum ScheduleSelection<'a> {
    Every,
    /// Only the codes not fetched in the last [`PRESS_MIN_REFETCH_GAP`] and out of backoff, a superset
    /// [`RosterSchedule::is_due`] narrows down: the waiting people are then read for those alone.
    DueCandidates,
    /// Only this code, which must be passed trimmed.
    Code(&'a str),
}

/// Every listable code that has a schedule row; see [`ensure_rows`]. `course_id` narrows the codes
/// and the modules their waiting people come from to one course, for a scoped tick. Only
/// completions on or after `account_linking_since` can wait, and with it `None` nobody does.
pub async fn get_schedules(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    selection: ScheduleSelection<'_>,
    account_linking_since: Option<DateTime<Utc>>,
) -> ModelResult<Vec<RosterSchedule>> {
    let only_code = match selection {
        ScheduleSelection::Code(course_code) => Some(course_code),
        ScheduleSelection::Every | ScheduleSelection::DueCandidates => None,
    };
    let rows = sqlx::query!(
        r#"
WITH modules AS (
  SELECT TRIM(cm.uh_course_code) AS course_code
  FROM credit_registration_active_course_modules acm
    JOIN course_modules cm ON cm.id = acm.course_module_id AND cm.deleted_at IS NULL
  WHERE TRIM(COALESCE(cm.uh_course_code, '')) <> ''
    AND ($1::uuid IS NULL OR acm.course_id = $1)
    AND (
      $4::text IS NULL
      OR TRIM(cm.uh_course_code) = $4
    )
)
SELECT s.course_code,
  s.last_fetched_at,
  s.last_fetch_started_at,
  s.last_mailing_fetch_started_at,
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
  CASE
    WHEN s.fetch_day = (now() AT TIME ZONE 'UTC')::date THEN s.fetch_day_count
    ELSE 0
  END AS "fetches_today!",
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
        only_code,
    )
    .fetch_all(&mut *conn)
    .await?;
    let codes: Vec<String> = rows.iter().map(|row| row.course_code.clone()).collect();
    // Every rung comes after the epoch, so a code never fetched has served none.
    let served_until: Vec<DateTime<Utc>> = rows
        .iter()
        .map(|row| {
            row.last_mailing_fetch_started_at
                .unwrap_or(DateTime::UNIX_EPOCH)
        })
        .collect();
    let mut waiting = get_waiting(
        conn,
        course_id,
        &codes,
        &served_until,
        account_linking_since,
    )
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            let waiting = waiting.remove(&row.course_code).unwrap_or_default();
            let linking_counters =
                row.linking_listed_count
                    .map(|listed_person_count| AccountLinkingCodeCounters {
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
                last_fetch_started_at: row.last_fetch_started_at,
                last_mailing_fetch_started_at: row.last_mailing_fetch_started_at,
                last_fetch_duration_ms: row.last_fetch_duration_ms,
                last_listed_person_count: row.last_listed_person_count,
                is_fetched_alone: row.is_fetched_alone,
                consecutive_failures: row.consecutive_failures,
                retry_not_before: row.retry_not_before,
                last_error: row.last_error,
                module_count: row.module_count,
                waiting_count: waiting.waiting_count,
                next_rung_at: waiting.next_rung_at,
                unserved_press_at: waiting.unserved_press_at,
                fetches_today: row.fetches_today,
                fetch_requested_at: row.fetch_requested_at,
                linking_counters,
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
/// `served_until`.
async fn get_waiting(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    course_codes: &[String],
    served_until: &[DateTime<Utc>],
    account_linking_since: Option<DateTime<Utc>>,
) -> ModelResult<HashMap<String, CodeWaiting>> {
    if account_linking_since.is_none() || course_codes.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query!(
        r#"
WITH codes AS (
  SELECT *
  FROM UNNEST($2::text [], $3::timestamptz []) AS code(course_code, served_until)
),
waiting AS (
  SELECT codes.course_code,
    codes.served_until,
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
        (sig.visit_ladder_anchor_at, $5::bigint [], FALSE),
        (sig.check_request_ladder_anchor_at, $6::bigint [], TRUE)
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
    WHERE rung.due_at > w.served_until
  ) AS next_rung_at,
  MAX(w.anchor_at) FILTER (
    WHERE w.is_press
      AND w.anchor_at > w.served_until
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
        served_until,
        &COMPLETED_LADDER[..],
        &VISITED_LADDER[..],
        &PRESSED_LADDER[..],
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

/// Stamps the codes a listing request is about to go out for and counts the fetch against
/// [`MAX_FETCHES_PER_DAY`]. Returns the stamp to hand to [`mark_fetched`].
pub async fn mark_attempted(
    conn: &mut PgConnection,
    course_codes: &[String],
) -> ModelResult<DateTime<Utc>> {
    let started_at = sqlx::query_scalar!(
        r#"
WITH stamped AS (
  UPDATE credit_registration_roster_schedules
  SET last_attempted_at = now(),
    fetch_day_count = CASE
      WHEN fetch_day = (now() AT TIME ZONE 'UTC')::date THEN fetch_day_count + 1
      ELSE 1
    END,
    fetch_day = (now() AT TIME ZONE 'UTC')::date
  WHERE course_code = ANY($1::text [])
)
SELECT now() AS "started_at!"
        "#,
        course_codes,
    )
    .fetch_one(conn)
    .await?;
    Ok(started_at)
}

/// Records an enrolment list that arrived, or Suotar saying it holds no realisation of the code,
/// and clears the failure streak. `started_at` is what [`mark_attempted`] returned for the request,
/// and `could_claim_mail` whether the list was free to claim linking mail; only such a fetch serves
/// the waiting people's rungs and presses. Returns when the code was fetched before this.
pub async fn mark_fetched(
    conn: &mut PgConnection,
    course_code: &str,
    started_at: DateTime<Utc>,
    could_claim_mail: bool,
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
  last_fetch_started_at = $4,
  last_mailing_fetch_started_at = CASE
    WHEN $5 THEN $4
    ELSE s.last_mailing_fetch_started_at
  END,
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
        started_at,
        could_claim_mail,
    )
    .fetch_optional(conn)
    .await?;
    Ok(previous.flatten())
}

/// Overwrites the code's linking counters with what its latest enrolment list did.
pub async fn record_linking_counters(
    conn: &mut PgConnection,
    course_code: &str,
    counters: &AccountLinkingCodeCounters,
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
        counters.listed_person_count,
        counters.already_linked_count,
        counters.mailed_count,
        counters.suppressed_by_dedup_count,
        counters.suppressed_by_rate_cap_count,
        counters.no_address_count,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Makes the code due at its next grid point, past [`MAX_FETCHES_PER_DAY`]. Returns the schedule
/// row's id, or `None` for a code with no row.
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
