//! How long the pipeline waits before trying again. Generic scheduling math; which error codes are
//! even retryable is [`super::classification`].

use chrono::TimeDelta;
use headless_lms_utils::backoff::{exponential_backoff_secs, window_expired};
use headless_lms_utils::services::suotar::SuotarEndpoint;

use crate::prelude::*;

pub const SUBMIT_BASE_BACKOFF: TimeDelta = TimeDelta::minutes(1);
pub const SUBMIT_MAX_BACKOFF: TimeDelta = TimeDelta::hours(6);
/// After this long in failure a row stops being retried and becomes a support case.
pub const SUBMIT_MAX_RETRY_AGE: TimeDelta = TimeDelta::days(7);
/// Sisu needs a few minutes before a submitted attainment shows up, so the first poll waits.
pub const VERIFY_FIRST_DELAY: TimeDelta = TimeDelta::minutes(2);
pub const VERIFY_BASE_BACKOFF: TimeDelta = TimeDelta::minutes(5);
pub const VERIFY_MAX_BACKOFF: TimeDelta = TimeDelta::hours(6);
/// After this, polling drops to daily and a human looks. Never a failure: the attainment may exist,
/// and calling it failed would invite a second submission.
pub const VERIFY_MAX_AGE: TimeDelta = TimeDelta::days(14);
pub const VERIFY_GIVE_UP_POLL: TimeDelta = TimeDelta::days(1);
pub const JITTER_MAX: TimeDelta = TimeDelta::seconds(30);

/// The first wait before looking for an attainment we may or may not have created; it doubles
/// after every fruitless look.
pub const UNCERTAIN_RECHECK: TimeDelta = TimeDelta::minutes(15);
pub const UNCERTAIN_MAX_RECHECK: TimeDelta = TimeDelta::hours(6);
/// How long after the submission a human is asked to look in Sisu, well past the hour an
/// attainment may take to show up. The row still never resubmits.
pub const UNCERTAIN_ADMIN_AFTER: TimeDelta = TimeDelta::days(1);

/// How long verify may see only the assessment item attainment before a human looks.
pub const PARTIAL_REGISTRATION_ADMIN_AFTER: TimeDelta = TimeDelta::days(3);
/// How many times Suotar may lose a submission (`notRegistered`) before a human looks. Each one
/// still resubmits.
pub const NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD: i32 = 3;

/// A row still `submitting` this long belongs to a worker that died mid-call. Above the import
/// timeout, so a live request is never condemned to `submission_uncertain`.
pub const SUBMITTING_RECOVERY_GRACE: TimeDelta = TimeDelta::seconds(
    SuotarEndpoint::ImportAttainments
        .request_timeout()
        .as_secs() as i64
        + 15 * 60,
);
/// A row still `resolving_enrolment` this long belongs to a worker that died mid-call, and goes back
/// to `ready_to_submit`; a parked row's claimed check expires after as long. Above the resolve
/// timeout, so a live answer still lands.
pub const RESOLVING_RECOVERY_GRACE: TimeDelta = TimeDelta::seconds(
    SuotarEndpoint::ResolveEnrolments
        .request_timeout()
        .as_secs() as i64
        + 10 * 60,
);

fn doubling(base: TimeDelta, max: TimeDelta, count: i32) -> TimeDelta {
    TimeDelta::seconds(exponential_backoff_secs(
        base.num_seconds(),
        max.num_seconds(),
        count,
    ))
}

pub fn submit_backoff(retry_count: i32) -> TimeDelta {
    doubling(SUBMIT_BASE_BACKOFF, SUBMIT_MAX_BACKOFF, retry_count)
}

/// The import phase schedules the first poll, so one prior attempt still means the base delay.
pub fn verify_backoff(attempt_count: i32) -> TimeDelta {
    doubling(
        VERIFY_BASE_BACKOFF,
        VERIFY_MAX_BACKOFF,
        attempt_count.saturating_sub(1),
    )
}

/// `lookup_count` counts the look just made, so the wait after the first one is already doubled.
pub fn uncertain_recheck_delay(lookup_count: i32) -> TimeDelta {
    doubling(UNCERTAIN_RECHECK, UNCERTAIN_MAX_RECHECK, lookup_count)
}

/// Spreads a batch that failed together, so it does not come back as one thundering herd.
pub fn next_attempt_at(now: DateTime<Utc>, delay: TimeDelta) -> DateTime<Utc> {
    headless_lms_utils::backoff::next_attempt_at(now, delay.num_seconds(), JITTER_MAX.num_seconds())
}

pub fn submit_window_expired(first_failed_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    window_expired(first_failed_at, now, SUBMIT_MAX_RETRY_AGE.num_seconds())
}

pub fn verify_window_expired(submitted_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    window_expired(submitted_at, now, VERIFY_MAX_AGE.num_seconds())
}

pub fn uncertain_needs_admin(submitted_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    window_expired(submitted_at, now, UNCERTAIN_ADMIN_AFTER.num_seconds())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_doubles_and_then_stops_growing() {
        assert_eq!(submit_backoff(0), SUBMIT_BASE_BACKOFF);
        assert_eq!(submit_backoff(1), SUBMIT_BASE_BACKOFF * 2);
        assert_eq!(submit_backoff(3), SUBMIT_BASE_BACKOFF * 8);
        assert_eq!(submit_backoff(30), SUBMIT_MAX_BACKOFF);
        assert_eq!(submit_backoff(i32::MAX), SUBMIT_MAX_BACKOFF);
    }

    #[test]
    fn verify_backoff_starts_at_the_base_after_the_first_poll() {
        assert_eq!(verify_backoff(1), VERIFY_BASE_BACKOFF);
        assert_eq!(verify_backoff(2), VERIFY_BASE_BACKOFF * 2);
        assert_eq!(verify_backoff(100), VERIFY_MAX_BACKOFF);
    }

    #[test]
    fn the_retry_window_runs_from_the_first_failure() {
        let now = Utc::now();
        assert!(!submit_window_expired(None, now));
        assert!(!submit_window_expired(Some(now - TimeDelta::days(6)), now));
        assert!(submit_window_expired(Some(now - TimeDelta::days(8)), now));
    }

    #[test]
    fn the_verify_window_runs_from_the_submission() {
        let now = Utc::now();
        assert!(!verify_window_expired(None, now));
        assert!(!verify_window_expired(Some(now - TimeDelta::days(13)), now));
        assert!(verify_window_expired(Some(now - TimeDelta::days(15)), now));
    }

    #[test]
    fn jitter_never_shortens_a_backoff() {
        let now = Utc::now();
        for _ in 0..50 {
            let scheduled = next_attempt_at(now, TimeDelta::minutes(1));
            assert!(scheduled - now >= TimeDelta::minutes(1));
            assert!(scheduled - now <= TimeDelta::minutes(1) + JITTER_MAX);
        }
    }
}
