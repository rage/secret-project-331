//! When a row waiting for an enrolment is checked next.
//!
//! Each group has a ladder of offsets from its anchor. The next check is always the first rung after
//! now, so a row that missed rungs (an outage, a check brought forward) gets one catch-up check
//! rather than one per missed rung, and a row past its last rung has stopped.

use utoipa::ToSchema;

use crate::prelude::*;
use chrono::TimeDelta;

/// How strongly a student has signalled that they are enrolling, which picks the ladder. Ordered: a
/// row only ever moves to a later variant.
#[derive(
    Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone, Copy, Hash, Type, ToSchema,
)]
#[sqlx(type_name = "enrolment_check_group", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EnrolmentCheckGroup {
    /// Completed the module and has not opened its registration page since.
    Completed,
    /// Opened the registration page after completing, with the enrolment instructions showing.
    Visited,
    /// Asked for a check, had a teacher ask for one, or linked from a roster mail.
    CheckRequested,
}

/// What made an enrolment check run when it did.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Type, ToSchema)]
#[sqlx(type_name = "enrolment_check_source", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EnrolmentCheckSource {
    /// The group's own ladder: the only source lateness is measured on.
    Schedule,
    StudentRequest,
    TeacherRequest,
    AdminRequest,
    /// The course roster listed an enrolment the row had not seen.
    RosterListing,
    /// The student linked their number from a mail sent off the roster, which proves an enrolment.
    AccountLink,
}

impl EnrolmentCheckSource {
    /// Whether someone pressed a button for the check, and so is waiting to see its answer.
    pub fn is_request(self) -> bool {
        matches!(
            self,
            Self::StudentRequest | Self::TeacherRequest | Self::AdminRequest
        )
    }
}

/// Suotar's copy of Sisu shows a new enrolment after 15 to 60 minutes, so a check sooner than this
/// after an enrolment usually cannot see it.
pub const REGISTRY_LAG: TimeDelta = TimeDelta::hours(1);

/// How soon after a check request, or after the last check, another request may start one. Shared
/// by the student's recheck, Done and the teacher's button.
pub const CHECK_REQUEST_MIN_INTERVAL: TimeDelta = TimeDelta::minutes(30);
/// How old a row must be before its student may ask for a check: a new enrolment takes 15 to 60
/// minutes to show, so an earlier request only finds nothing and spends the allowance.
pub const STUDENT_CHECK_REQUEST_MIN_ROW_AGE: TimeDelta = TimeDelta::hours(1);
/// How many check requests a day may restart the ladder. Past it a request gets one check only.
pub const MAX_CHECK_REQUEST_RESTARTS_PER_DAY: i32 = 4;
pub const CHECK_REQUEST_RESTART_WINDOW: TimeDelta = TimeDelta::days(1);
/// A repeat visit restarts the visited ladder at most this often.
pub const VISIT_RESTART_MIN_INTERVAL: TimeDelta = TimeDelta::days(1);

/// Slow checks go out together on boundaries this far apart.
pub const BATCH_INTERVAL: TimeDelta = TimeDelta::minutes(5);
/// A slow check due this soon after a batch goes out joins it.
pub const BATCH_PULL_FORWARD: TimeDelta = TimeDelta::minutes(15);
/// A rung at least this far after the one before it is a slow one.
const SLOW_GAP: TimeDelta = TimeDelta::days(1);

/// How long a check that failed in transit waits before the same rung is tried again.
pub const TRANSIENT_FAILURE_RETRY: TimeDelta = TimeDelta::minutes(5);

/// Where a stopped row's `next_attempt_at` is parked: it is never claimed on its own again.
pub fn never() -> DateTime<Utc> {
    DateTime::<Utc>::from_naive_utc_and_offset(
        chrono::NaiveDate::from_ymd_opt(9999, 12, 31)
            .and_then(|date| date.and_hms_opt(0, 0, 0))
            .unwrap_or_default(),
        Utc,
    )
}

/// One rung of a ladder, resolved against an anchor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScheduledEnrolmentCheck {
    pub step: i32,
    pub due_at: DateTime<Utc>,
    /// A slow rung, released in five-minute batches rather than on the ten-second tick.
    pub is_batched: bool,
}

impl ScheduledEnrolmentCheck {
    /// When the row may be claimed for this check: the due time itself, or for a slow rung the
    /// first batch boundary at or after it.
    pub fn release_at(&self) -> DateTime<Utc> {
        if !self.is_batched {
            return self.due_at;
        }
        let secs = self.due_at.timestamp();
        let interval_secs = BATCH_INTERVAL.num_seconds();
        let boundary = secs.div_euclid(interval_secs) * interval_secs;
        let boundary = if boundary < secs {
            boundary + interval_secs
        } else {
            boundary
        };
        DateTime::from_timestamp(boundary, 0).unwrap_or(self.due_at)
    }
}

pub(crate) const MINUTE_SECS: i64 = 60;
pub(crate) const HOUR_SECS: i64 = 60 * MINUTE_SECS;
pub(crate) const DAY_SECS: i64 = 24 * HOUR_SECS;
pub(crate) const WEEK_SECS: i64 = 7 * DAY_SECS;

/// A ladder in seconds: `head` in `head_unit`s, then for each `(gap, until)` rungs `gap` apart while
/// they stay within `until`. Fails to compile unless that makes exactly `N` rungs.
pub(crate) const fn ladder<const N: usize>(
    head: &[i64],
    head_unit: i64,
    extensions: &[(i64, i64)],
) -> [i64; N] {
    let mut rungs = [0; N];
    let mut len = 0;
    while len < head.len() {
        rungs[len] = head[len] * head_unit;
        len += 1;
    }
    let mut i = 0;
    while i < extensions.len() {
        let (gap, until) = extensions[i];
        while rungs[len - 1] + gap <= until {
            rungs[len] = rungs[len - 1] + gap;
            len += 1;
        }
        i += 1;
    }
    assert!(len == N, "the ladder has a different number of rungs");
    rungs
}

/// Also the ladder of enrolment list fetches for a person waiting for a student number.
pub(crate) const COMPLETED_LADDER: [i64; 7] = ladder(&[1, 3, 7, 14, 30, 60, 90], DAY_SECS, &[]);
const VISITED_LADDER: [i64; 28] = ladder(
    &[60, 75, 120, 240, 480],
    MINUTE_SECS,
    &[(DAY_SECS, 14 * DAY_SECS), (WEEK_SECS, 90 * DAY_SECS)],
);
const CHECK_REQUESTED_LADDER: [i64; 57] = ladder(
    &[15, 50, 60, 75, 120, 180, 360, 720, 1440],
    MINUTE_SECS,
    &[(DAY_SECS, 28 * DAY_SECS), (WEEK_SECS, 180 * DAY_SECS)],
);

/// The group's ladder, as offsets in seconds from the anchor, ascending.
fn ladder_offsets(group: EnrolmentCheckGroup) -> &'static [i64] {
    match group {
        EnrolmentCheckGroup::Completed => &COMPLETED_LADDER,
        EnrolmentCheckGroup::Visited => &VISITED_LADDER,
        EnrolmentCheckGroup::CheckRequested => &CHECK_REQUESTED_LADDER,
    }
}

fn resolve(
    group: EnrolmentCheckGroup,
    anchor: DateTime<Utc>,
    step: usize,
) -> Option<ScheduledEnrolmentCheck> {
    let offsets = ladder_offsets(group);
    let offset = *offsets.get(step)?;
    let previous = step.checked_sub(1).map_or(0, |previous| offsets[previous]);
    Some(ScheduledEnrolmentCheck {
        step: i32::try_from(step).ok()?,
        due_at: anchor + TimeDelta::seconds(offset),
        is_batched: offset - previous >= SLOW_GAP.num_seconds(),
    })
}

/// The first rung of a ladder started at `anchor`. A check request's own check runs before it, at
/// once.
pub fn first_check(
    group: EnrolmentCheckGroup,
    anchor: DateTime<Utc>,
) -> Option<ScheduledEnrolmentCheck> {
    resolve(group, anchor, 0)
}

/// The first rung strictly after `after`, or `None` once the ladder has run out.
pub fn next_check_after(
    group: EnrolmentCheckGroup,
    anchor: DateTime<Utc>,
    after: DateTime<Utc>,
) -> Option<ScheduledEnrolmentCheck> {
    let elapsed = (after - anchor).num_seconds();
    let step = ladder_offsets(group).partition_point(|&offset| offset <= elapsed);
    resolve(group, anchor, step)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL_GROUPS: [EnrolmentCheckGroup; 3] = [
        EnrolmentCheckGroup::Completed,
        EnrolmentCheckGroup::Visited,
        EnrolmentCheckGroup::CheckRequested,
    ];

    fn at(offset: TimeDelta) -> DateTime<Utc> {
        DateTime::from_timestamp(1_800_000_000, 0).unwrap() + offset
    }

    fn offsets_hours(group: EnrolmentCheckGroup) -> Vec<f64> {
        ladder_offsets(group)
            .iter()
            .map(|&offset| offset as f64 / 3600.0)
            .collect()
    }

    #[test]
    fn the_ladders_follow_the_plan() {
        let completed = offsets_hours(EnrolmentCheckGroup::Completed);
        assert_eq!(completed, [24.0, 72.0, 168.0, 336.0, 720.0, 1440.0, 2160.0]);

        let visited = offsets_hours(EnrolmentCheckGroup::Visited);
        assert_eq!(visited[..6], [1.0, 1.25, 2.0, 4.0, 8.0, 32.0]);
        assert!(visited.last().unwrap() <= &(90.0 * 24.0));

        let requested = offsets_hours(EnrolmentCheckGroup::CheckRequested);
        assert_eq!(
            requested[..10],
            [
                0.25,
                50.0 / 60.0,
                1.0,
                1.25,
                2.0,
                3.0,
                6.0,
                12.0,
                24.0,
                48.0
            ]
        );
        assert!(requested.last().unwrap() <= &(180.0 * 24.0));
        for group in ALL_GROUPS {
            assert!(
                ladder_offsets(group)
                    .windows(2)
                    .all(|pair| pair[0] < pair[1])
            );
        }
    }

    #[test]
    fn the_next_check_is_the_first_rung_after_now() {
        let anchor = at(TimeDelta::zero());
        let requested = EnrolmentCheckGroup::CheckRequested;
        assert_eq!(
            first_check(requested, anchor).unwrap().due_at,
            at(TimeDelta::minutes(15))
        );
        let after_first = next_check_after(requested, anchor, at(TimeDelta::minutes(15))).unwrap();
        assert_eq!(after_first.step, 1);
        assert_eq!(after_first.due_at, at(TimeDelta::minutes(50)));
        // A row that sat out several rungs gets one catch-up, not one per rung.
        let late = next_check_after(requested, anchor, at(TimeDelta::hours(4))).unwrap();
        assert_eq!(late.due_at, at(TimeDelta::hours(6)));
        assert_eq!(
            next_check_after(
                EnrolmentCheckGroup::Completed,
                anchor,
                at(TimeDelta::days(91))
            ),
            None
        );
    }

    #[test]
    fn only_slow_rungs_are_batched_on_five_minute_boundaries() {
        let anchor = at(TimeDelta::seconds(7));
        let first = first_check(EnrolmentCheckGroup::Completed, anchor).unwrap();
        assert!(first.is_batched);
        assert_eq!(
            first.release_at().timestamp() % BATCH_INTERVAL.num_seconds(),
            0
        );
        assert!(first.release_at() >= first.due_at);
        assert!(first.release_at() < first.due_at + BATCH_INTERVAL);

        let visit = first_check(EnrolmentCheckGroup::Visited, anchor).unwrap();
        assert!(!visit.is_batched);
        assert_eq!(visit.release_at(), visit.due_at);
    }
}
