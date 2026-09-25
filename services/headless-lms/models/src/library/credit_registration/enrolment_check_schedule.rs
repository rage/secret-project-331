//! When a row waiting for an enrolment is checked next.
//!
//! Each group has a ladder of offsets from its anchor. The next check is always the first rung after
//! now, so a row that missed rungs (an outage, a check brought forward) gets one catch-up check
//! rather than one per missed rung, and a row past its last rung has stopped.

use std::sync::LazyLock;

use utoipa::ToSchema;

use crate::prelude::*;

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

impl EnrolmentCheckGroup {
    pub const ALL: [Self; 3] = [Self::Completed, Self::Visited, Self::CheckRequested];
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
    pub const ALL: [Self; 6] = [
        Self::Schedule,
        Self::StudentRequest,
        Self::TeacherRequest,
        Self::AdminRequest,
        Self::RosterListing,
        Self::AccountLink,
    ];
}

const MINUTE_SECS: i64 = 60;
const HOUR_SECS: i64 = 60 * MINUTE_SECS;
const DAY_SECS: i64 = 24 * HOUR_SECS;
const WEEK_SECS: i64 = 7 * DAY_SECS;

/// Suotar's copy of Sisu is about an hour old, so a check sooner than this after an enrolment
/// cannot see it.
pub const REGISTRY_LAG_SECS: i64 = HOUR_SECS;

/// How soon after a check request, or after the last check, another request may start one. Shared
/// by the student's recheck, Done and the teacher's button.
pub const CHECK_REQUEST_MIN_INTERVAL_SECS: i64 = 30 * MINUTE_SECS;
/// How many check requests a day may restart the ladder. Past it a request gets one check only.
pub const MAX_CHECK_REQUEST_RESTARTS_PER_DAY: i32 = 4;
pub const CHECK_REQUEST_RESTART_WINDOW_SECS: i64 = DAY_SECS;
/// A repeat visit restarts the visited ladder at most this often.
pub const VISIT_RESTART_MIN_INTERVAL_SECS: i64 = DAY_SECS;

/// Slow checks go out together on boundaries this far apart.
pub const BATCH_INTERVAL_SECS: i64 = 5 * MINUTE_SECS;
/// A slow check due this soon after a batch goes out joins it.
pub const BATCH_PULL_FORWARD_SECS: i64 = 15 * MINUTE_SECS;
/// A rung at least this far after the one before it is a slow one.
const SLOW_GAP_SECS: i64 = DAY_SECS;

/// How long a check that failed in transit waits before the same rung is tried again.
pub const TRANSIENT_FAILURE_RETRY_SECS: i64 = 5 * MINUTE_SECS;

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
        let boundary = secs.div_euclid(BATCH_INTERVAL_SECS) * BATCH_INTERVAL_SECS;
        let boundary = if boundary < secs {
            boundary + BATCH_INTERVAL_SECS
        } else {
            boundary
        };
        DateTime::from_timestamp(boundary, 0).unwrap_or(self.due_at)
    }
}

/// The group's ladder, as offsets in seconds from the anchor, ascending.
pub fn ladder_offsets_secs(group: EnrolmentCheckGroup) -> &'static [i64] {
    static COMPLETED: LazyLock<Vec<i64>> = LazyLock::new(|| {
        let mut offsets: Vec<i64> = (1..=7).map(|day| day * DAY_SECS).collect();
        offsets.extend([10 * DAY_SECS, 13 * DAY_SECS]);
        extend_by(&mut offsets, WEEK_SECS, 90 * DAY_SECS);
        offsets
    });
    static VISITED: LazyLock<Vec<i64>> = LazyLock::new(|| {
        let mut offsets: Vec<i64> = [1, 2, 4, 7, 11, 17, 25, 37, 55, 79]
            .into_iter()
            .map(|hours| hours * HOUR_SECS)
            .collect();
        extend_by(&mut offsets, DAY_SECS, 14 * DAY_SECS);
        extend_by(&mut offsets, WEEK_SECS, 90 * DAY_SECS);
        offsets
    });
    static CHECK_REQUESTED: LazyLock<Vec<i64>> = LazyLock::new(|| {
        let mut offsets = vec![0, REGISTRY_LAG_SECS];
        let mut gap = 30 * MINUTE_SECS;
        while gap <= 5 * HOUR_SECS {
            push_after(&mut offsets, gap);
            gap += 30 * MINUTE_SECS;
        }
        for hours in [6, 8, 12, 24] {
            push_after(&mut offsets, hours * HOUR_SECS);
        }
        extend_by(&mut offsets, DAY_SECS, 28 * DAY_SECS);
        extend_by(&mut offsets, WEEK_SECS, 180 * DAY_SECS);
        offsets
    });
    match group {
        EnrolmentCheckGroup::Completed => &COMPLETED,
        EnrolmentCheckGroup::Visited => &VISITED,
        EnrolmentCheckGroup::CheckRequested => &CHECK_REQUESTED,
    }
}

fn push_after(offsets: &mut Vec<i64>, gap_secs: i64) {
    let last = offsets.last().copied().unwrap_or(0);
    offsets.push(last + gap_secs);
}

/// Appends rungs `gap_secs` apart until the next one would pass `until_secs`.
fn extend_by(offsets: &mut Vec<i64>, gap_secs: i64, until_secs: i64) {
    while offsets.last().copied().unwrap_or(0) + gap_secs <= until_secs {
        push_after(offsets, gap_secs);
    }
}

fn resolve(
    group: EnrolmentCheckGroup,
    anchor: DateTime<Utc>,
    step: usize,
) -> Option<ScheduledEnrolmentCheck> {
    let offsets = ladder_offsets_secs(group);
    let offset = *offsets.get(step)?;
    let previous = step.checked_sub(1).map_or(0, |previous| offsets[previous]);
    Some(ScheduledEnrolmentCheck {
        step: i32::try_from(step).ok()?,
        due_at: anchor + chrono::Duration::seconds(offset),
        is_batched: offset - previous >= SLOW_GAP_SECS,
    })
}

/// The first rung of a ladder started at `anchor`: immediate for a check request, later for the
/// other groups.
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
    let elapsed_secs = (after - anchor).num_seconds();
    let step = ladder_offsets_secs(group).partition_point(|&offset| offset <= elapsed_secs);
    resolve(group, anchor, step)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(secs: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_800_000_000 + secs, 0).unwrap()
    }

    fn offsets_hours(group: EnrolmentCheckGroup) -> Vec<f64> {
        ladder_offsets_secs(group)
            .iter()
            .map(|&secs| secs as f64 / HOUR_SECS as f64)
            .collect()
    }

    #[test]
    fn the_ladders_follow_the_plan() {
        let completed = offsets_hours(EnrolmentCheckGroup::Completed);
        assert_eq!(
            completed[..10],
            [
                24.0, 48.0, 72.0, 96.0, 120.0, 144.0, 168.0, 240.0, 312.0, 480.0
            ]
        );
        assert_eq!(completed.last(), Some(&(90.0 * 24.0)));

        let visited = offsets_hours(EnrolmentCheckGroup::Visited);
        assert_eq!(
            visited[..11],
            [
                1.0, 2.0, 4.0, 7.0, 11.0, 17.0, 25.0, 37.0, 55.0, 79.0, 103.0
            ]
        );
        assert!(visited.last().unwrap() <= &(90.0 * 24.0));

        let requested = offsets_hours(EnrolmentCheckGroup::CheckRequested);
        assert_eq!(
            requested[..16],
            [
                0.0, 1.0, 1.5, 2.5, 4.0, 6.0, 8.5, 11.5, 15.0, 19.0, 23.5, 28.5, 34.5, 42.5, 54.5,
                78.5
            ]
        );
        assert!(requested.last().unwrap() <= &(180.0 * 24.0));
        for group in EnrolmentCheckGroup::ALL {
            assert!(
                ladder_offsets_secs(group)
                    .windows(2)
                    .all(|pair| pair[0] < pair[1])
            );
        }
    }

    #[test]
    fn the_next_check_is_the_first_rung_after_now() {
        let anchor = at(0);
        let requested = EnrolmentCheckGroup::CheckRequested;
        assert_eq!(first_check(requested, anchor).unwrap().due_at, anchor);
        let after_immediate = next_check_after(requested, anchor, anchor).unwrap();
        assert_eq!(after_immediate.step, 1);
        assert_eq!(after_immediate.due_at, at(HOUR_SECS));
        // A row that sat out several rungs gets one catch-up, not one per rung.
        let late = next_check_after(requested, anchor, at(10 * HOUR_SECS)).unwrap();
        assert_eq!(late.due_at, at(11 * HOUR_SECS + 30 * MINUTE_SECS));
        assert_eq!(
            next_check_after(EnrolmentCheckGroup::Completed, anchor, at(91 * DAY_SECS)),
            None
        );
    }

    #[test]
    fn only_slow_rungs_are_batched_on_five_minute_boundaries() {
        let anchor = at(7);
        let first = first_check(EnrolmentCheckGroup::Completed, anchor).unwrap();
        assert!(first.is_batched);
        assert_eq!(first.release_at().timestamp() % BATCH_INTERVAL_SECS, 0);
        assert!(first.release_at() >= first.due_at);
        assert!(first.release_at() < first.due_at + chrono::Duration::seconds(BATCH_INTERVAL_SECS));

        let visit = first_check(EnrolmentCheckGroup::Visited, anchor).unwrap();
        assert!(!visit.is_batched);
        assert_eq!(visit.release_at(), visit.due_at);
    }
}
