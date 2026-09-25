//! When enrolment discovery lists each course code's roster.
//!
//! The tier is derived from the modules on the code whenever it is needed, so a course coming back
//! to life is listed at its new rate at once. Only what cannot be derived lives in the table:
//! triggered listings, the per-code failure backoff and the daily trigger count.

use std::collections::HashMap;

use chrono::NaiveDate;
use utoipa::ToSchema;

use crate::course_module_suotar_configurations::ModuleToList;
use crate::credit_registrations::CreditRegistrationErrorCode;
use crate::prelude::*;

const HOUR_SECS: i64 = 60 * 60;
const DAY_SECS: i64 = 24 * HOUR_SECS;

/// Completions this recent keep a code on the active tier.
pub const ACTIVE_WINDOW_SECS: i64 = 7 * DAY_SECS;
/// With no completions for this long a code drops to weekly with account linking on, and stops
/// being listed at all with it off.
pub const DORMANT_AFTER_SECS: i64 = 60 * DAY_SECS;
pub const ACTIVE_INTERVAL_SECS: i64 = 8 * HOUR_SECS;
pub const IDLE_INTERVAL_SECS: i64 = DAY_SECS;
pub const DORMANT_INTERVAL_SECS: i64 = 7 * DAY_SECS;
/// A triggered listing waits this long after the last one: Suotar's copy of Sisu is about an hour
/// old, so listing sooner would show nothing new.
pub const TRIGGER_MIN_GAP_SECS: i64 = HOUR_SECS;
/// The one extra listing a visit books, for an enrolment the triggered one was too early to see.
pub const VISIT_FOLLOW_UP_SECS: i64 = 2 * HOUR_SECS;
pub const MAX_TRIGGERED_FETCHES_PER_DAY: i32 = 6;
/// How long a code that failed on its own is left alone, by how many times in a row it has.
const ALONE_FAILURE_BACKOFF_SECS: [i64; 3] = [HOUR_SECS, 4 * HOUR_SECS, DAY_SECS];

/// How often a code is listed without a trigger.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RosterTier {
    /// Completions in the last week: three times a day.
    Active,
    /// None for a week: daily.
    Idle,
    /// None for two months, with account linking on: weekly.
    Dormant,
    /// Not listed without a trigger: Suotar holds no realisation of the code any more, or with
    /// account linking off nobody on it is waiting for an enrolment or it has gone dormant.
    Unlisted,
}

impl RosterTier {
    pub fn interval_secs(self) -> Option<i64> {
        match self {
            Self::Active => Some(ACTIVE_INTERVAL_SECS),
            Self::Idle => Some(IDLE_INTERVAL_SECS),
            Self::Dormant => Some(DORMANT_INTERVAL_SECS),
            Self::Unlisted => None,
        }
    }
}

/// What the tier of a code is decided from.
#[derive(Debug, Clone, PartialEq)]
pub struct RosterTierFacts {
    /// When the last ledger row on the code's modules was created, the stand-in for its last
    /// completion.
    pub last_completion_at: Option<DateTime<Utc>>,
    pub has_waiting_rows: bool,
    pub window_closed_at: Option<DateTime<Utc>>,
}

pub fn roster_tier(
    facts: &RosterTierFacts,
    is_account_linking_enabled: bool,
    now: DateTime<Utc>,
) -> RosterTier {
    let is_window_closed = facts.window_closed_at.is_some_and(|closed| {
        facts
            .last_completion_at
            .is_none_or(|completion| completion <= closed)
    });
    if is_window_closed || (!is_account_linking_enabled && !facts.has_waiting_rows) {
        return RosterTier::Unlisted;
    }
    let quiet_secs = facts
        .last_completion_at
        .map_or(i64::MAX, |completion| (now - completion).num_seconds());
    if quiet_secs < ACTIVE_WINDOW_SECS {
        RosterTier::Active
    } else if quiet_secs < DORMANT_AFTER_SECS {
        RosterTier::Idle
    } else if is_account_linking_enabled {
        RosterTier::Dormant
    } else {
        RosterTier::Unlisted
    }
}

/// One code's schedule with the facts its tier comes from.
#[derive(Debug, Clone, PartialEq)]
pub struct RosterSchedule {
    pub course_code: String,
    pub last_fetched_at: Option<DateTime<Utc>>,
    pub last_fetch_duration_ms: Option<i32>,
    pub last_listed_person_count: Option<i32>,
    pub triggered_fetch_at: Option<DateTime<Utc>>,
    pub follow_up_fetch_at: Option<DateTime<Utc>>,
    pub triggered_fetch_day: Option<NaiveDate>,
    pub triggered_fetch_count: i32,
    pub is_fetched_alone: bool,
    pub consecutive_failures: i32,
    pub retry_not_before: Option<DateTime<Utc>>,
    pub last_error: Option<CreditRegistrationErrorCode>,
    /// The active modules on the code, which share its roster.
    pub module_count: i64,
    pub tier_facts: RosterTierFacts,
}

impl RosterSchedule {
    /// When a trigger or the tier next makes the code due, ignoring the failure backoff.
    pub fn next_fetch_at(
        &self,
        is_account_linking_enabled: bool,
        now: DateTime<Utc>,
    ) -> Option<DateTime<Utc>> {
        let tier_due = roster_tier(&self.tier_facts, is_account_linking_enabled, now)
            .interval_secs()
            .map(|interval| {
                self.last_fetched_at
                    .map_or(now, |fetched| fetched + chrono::Duration::seconds(interval))
            });
        [tier_due, self.triggered_due_at()]
            .into_iter()
            .flatten()
            .min()
    }

    /// The earlier of the booked triggered and follow-up listings.
    pub fn triggered_due_at(&self) -> Option<DateTime<Utc>> {
        [self.triggered_fetch_at, self.follow_up_fetch_at]
            .into_iter()
            .flatten()
            .min()
    }

    pub fn is_due(&self, is_account_linking_enabled: bool, now: DateTime<Utc>) -> bool {
        self.retry_not_before.is_none_or(|retry| retry <= now)
            && self
                .next_fetch_at(is_account_linking_enabled, now)
                .is_some_and(|due| due <= now)
    }

    pub fn is_triggered_due(&self, now: DateTime<Utc>) -> bool {
        self.triggered_due_at().is_some_and(|due| due <= now)
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
  JOIN course_modules cm ON cm.id = acm.course_module_id
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
  JOIN course_modules cm ON cm.id = acm.course_module_id
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
    /// Only the codes that may be due by now, a superset [`RosterSchedule::is_due`] narrows down:
    /// the tier facts are then computed for those alone.
    DueCandidates,
}

/// Every listable code that has a schedule row; see [`ensure_rows`]. `course_id` narrows the codes
/// and the modules their facts come from to one course, for a scoped tick.
pub async fn get_schedules(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    selection: ScheduleSelection,
) -> ModelResult<Vec<RosterSchedule>> {
    let rows = sqlx::query!(
        r#"
WITH modules AS (
  SELECT acm.course_module_id,
    TRIM(cm.uh_course_code) AS course_code
  FROM credit_registration_active_course_modules acm
    JOIN course_modules cm ON cm.id = acm.course_module_id
  WHERE TRIM(COALESCE(cm.uh_course_code, '')) <> ''
    AND ($1::uuid IS NULL OR acm.course_id = $1)
),
candidates AS (
  SELECT s.*
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
          OR s.last_fetched_at <= now() - ($3::bigint * INTERVAL '1 second')
          OR LEAST(s.triggered_fetch_at, s.follow_up_fetch_at) <= now()
        )
      )
    )
)
SELECT c.course_code,
  c.last_fetched_at,
  c.last_fetch_duration_ms,
  c.last_listed_person_count,
  c.triggered_fetch_at,
  c.follow_up_fetch_at,
  c.triggered_fetch_day,
  c.triggered_fetch_count,
  c.is_fetched_alone,
  c.consecutive_failures,
  c.retry_not_before,
  c.last_error AS "last_error: CreditRegistrationErrorCode",
  c.window_closed_at,
  COUNT(*) AS "module_count!",
  MAX(facts.last_completion_at) AS last_completion_at,
  bool_or(facts.has_waiting_rows) AS "has_waiting_rows!"
FROM candidates c
  JOIN modules m ON m.course_code = c.course_code
  CROSS JOIN LATERAL (
    SELECT (
        SELECT cr.created_at
        FROM credit_registrations cr
        WHERE cr.course_module_id = m.course_module_id
          AND cr.deleted_at IS NULL
        ORDER BY cr.created_at DESC
        LIMIT 1
      ) AS last_completion_at,
      EXISTS (
        SELECT 1
        FROM credit_registrations cr
        WHERE cr.course_module_id = m.course_module_id
          AND cr.state = 'no_usable_enrolment'
          AND cr.enrolment_checks_stopped_at IS NULL
          AND cr.superseded_by_id IS NULL
          AND cr.deleted_at IS NULL
      ) AS has_waiting_rows
  ) facts
GROUP BY c.id,
  c.course_code,
  c.last_fetched_at,
  c.last_fetch_duration_ms,
  c.last_listed_person_count,
  c.triggered_fetch_at,
  c.follow_up_fetch_at,
  c.triggered_fetch_day,
  c.triggered_fetch_count,
  c.is_fetched_alone,
  c.consecutive_failures,
  c.retry_not_before,
  c.last_error,
  c.window_closed_at
ORDER BY c.course_code
        "#,
        course_id,
        selection == ScheduleSelection::DueCandidates,
        ACTIVE_INTERVAL_SECS,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| RosterSchedule {
            course_code: row.course_code,
            last_fetched_at: row.last_fetched_at,
            last_fetch_duration_ms: row.last_fetch_duration_ms,
            last_listed_person_count: row.last_listed_person_count,
            triggered_fetch_at: row.triggered_fetch_at,
            follow_up_fetch_at: row.follow_up_fetch_at,
            triggered_fetch_day: row.triggered_fetch_day,
            triggered_fetch_count: row.triggered_fetch_count,
            is_fetched_alone: row.is_fetched_alone,
            consecutive_failures: row.consecutive_failures,
            retry_not_before: row.retry_not_before,
            last_error: row.last_error,
            module_count: row.module_count,
            tier_facts: RosterTierFacts {
                last_completion_at: row.last_completion_at,
                has_waiting_rows: row.has_waiting_rows,
                window_closed_at: row.window_closed_at,
            },
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
  JOIN course_modules cm ON cm.id = acm.course_module_id
  JOIN courses co ON co.id = acm.course_id
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

/// Records a roster that arrived. Clears the failure streak and any trigger that was due, and
/// counts a triggered listing against the day's cap.
pub async fn mark_fetched(
    conn: &mut PgConnection,
    course_code: &str,
    listed_person_count: i32,
    duration_ms: i32,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_roster_schedules
SET last_fetched_at = now(),
  last_fetch_duration_ms = $3,
  last_listed_person_count = $2,
  is_fetched_alone = FALSE,
  consecutive_failures = 0,
  retry_not_before = NULL,
  last_error = NULL,
  window_closed_at = NULL,
  triggered_fetch_count = CASE
    WHEN LEAST(triggered_fetch_at, follow_up_fetch_at) > now()
    OR COALESCE(triggered_fetch_at, follow_up_fetch_at) IS NULL THEN triggered_fetch_count
    WHEN triggered_fetch_day = (now() AT TIME ZONE 'UTC')::date THEN triggered_fetch_count + 1
    ELSE 1
  END,
  triggered_fetch_day = CASE
    WHEN LEAST(triggered_fetch_at, follow_up_fetch_at) <= now() THEN (now() AT TIME ZONE 'UTC')::date
    ELSE triggered_fetch_day
  END,
  triggered_fetch_at = CASE
    WHEN triggered_fetch_at <= now() THEN NULL
    ELSE triggered_fetch_at
  END,
  follow_up_fetch_at = CASE
    WHEN follow_up_fetch_at <= now() THEN NULL
    ELSE follow_up_fetch_at
  END
WHERE course_code = $1
        "#,
        course_code,
        listed_person_count,
        duration_ms,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records Suotar saying it holds no realisation of the code: tier listings stop until a new
/// completion arrives on it. Not a failure.
pub async fn mark_window_closed(conn: &mut PgConnection, course_code: &str) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_roster_schedules
SET last_fetched_at = now(),
  last_listed_person_count = 0,
  is_fetched_alone = FALSE,
  consecutive_failures = 0,
  retry_not_before = NULL,
  last_error = NULL,
  window_closed_at = now(),
  triggered_fetch_at = NULL,
  follow_up_fetch_at = NULL
WHERE course_code = $1
        "#,
        course_code,
    )
    .execute(conn)
    .await?;
    Ok(())
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

/// Books a listing for an unlinked student's visit or check request, with account linking on: at
/// the earliest an hour after the last listing, and for a visit also one follow-up two hours on.
/// Refused once the code has had its triggered listings for the day. Returns whether anything was
/// booked.
pub async fn book_triggered_fetch(
    conn: &mut PgConnection,
    course_code: &str,
    books_follow_up: bool,
) -> ModelResult<bool> {
    sqlx::query!(
        r#"
INSERT INTO credit_registration_roster_schedules (course_code)
VALUES ($1) ON CONFLICT (course_code) DO NOTHING
        "#,
        course_code,
    )
    .execute(&mut *conn)
    .await?;
    let booked = sqlx::query!(
        r#"
UPDATE credit_registration_roster_schedules
SET triggered_fetch_at = LEAST(
    COALESCE(triggered_fetch_at, 'infinity'::timestamptz),
    GREATEST(
      now(),
      COALESCE(last_fetched_at, '-infinity'::timestamptz) + ($3::bigint * INTERVAL '1 second')
    )
  ),
  follow_up_fetch_at = CASE
    WHEN $2
    AND follow_up_fetch_at IS NULL THEN now() + ($4::bigint * INTERVAL '1 second')
    ELSE follow_up_fetch_at
  END
WHERE course_code = $1
  AND (
    triggered_fetch_day IS DISTINCT FROM (now() AT TIME ZONE 'UTC')::date
    OR triggered_fetch_count < $5
  )
        "#,
        course_code,
        books_follow_up,
        TRIGGER_MIN_GAP_SECS,
        VISIT_FOLLOW_UP_SECS,
        MAX_TRIGGERED_FETCHES_PER_DAY,
    )
    .execute(conn)
    .await?;
    Ok(booked.rows_affected() > 0)
}

/// Waits out the tier interval and the failure backoff of every code on the course's active
/// modules, and returns how many codes it moved. A code its tier does not list stays unlisted.
/// Exists only for test setup: specs cannot wait out a tier interval.
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
      JOIN course_modules cm ON cm.id = acm.course_module_id
    WHERE acm.course_id = $1
  )
        "#,
        course_id,
        DORMANT_INTERVAL_SECS,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

/// Codes listed on their own that keep failing, for the admin alert.
#[derive(Debug, Clone, PartialEq)]
pub struct FailingRosterCode {
    pub course_code: String,
    pub consecutive_failures: i32,
    pub last_error: Option<CreditRegistrationErrorCode>,
    pub last_attempted_at: Option<DateTime<Utc>>,
}

pub async fn get_failing_codes(conn: &mut PgConnection) -> ModelResult<Vec<FailingRosterCode>> {
    let res = sqlx::query_as!(
        FailingRosterCode,
        r#"
SELECT course_code,
  consecutive_failures,
  last_error AS "last_error: CreditRegistrationErrorCode",
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
