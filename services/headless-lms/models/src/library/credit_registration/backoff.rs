//! How long the pipeline waits before trying again. Generic scheduling math; which error codes are
//! even retryable is [`super::classification`].

use headless_lms_utils::backoff::{exponential_backoff_secs, window_expired};

use crate::prelude::*;

pub const SUBMIT_BASE_BACKOFF_SECS: i64 = 60;
pub const SUBMIT_MAX_BACKOFF_SECS: i64 = 6 * 60 * 60;
/// After this long in failure a row stops being retried and becomes a support case.
pub const SUBMIT_MAX_RETRY_AGE_SECS: i64 = 7 * 24 * 60 * 60;
/// Sisu needs a few minutes before a submitted attainment shows up, so the first poll waits.
pub const VERIFY_FIRST_DELAY_SECS: i64 = 120;
pub const VERIFY_BASE_BACKOFF_SECS: i64 = 300;
pub const VERIFY_MAX_BACKOFF_SECS: i64 = 6 * 60 * 60;
/// After this, polling drops to daily and a human looks. Never a failure: the attainment may exist,
/// and calling it failed would invite a second submission.
pub const VERIFY_MAX_AGE_SECS: i64 = 14 * 24 * 60 * 60;
pub const VERIFY_GIVE_UP_POLL_SECS: i64 = 24 * 60 * 60;
pub const JITTER_MAX_SECS: i64 = 30;

/// How long before the pipeline looks for an enrolment again on its own; a student recheck or
/// enrolment discovery can wake the row sooner.
pub const NO_USABLE_ENROLMENT_RECHECK_SECS: i64 = 24 * 60 * 60;

/// How long between the checks that look for an attainment we may or may not have created.
pub const UNCERTAIN_RECHECK_SECS: i64 = 15 * 60;
/// After this many fruitless checks a human is asked to look in Sisu. The row still never resubmits.
pub const UNCERTAIN_MAX_CHECKS: i32 = 3;

/// A row still `submitting` this long belongs to a worker that died mid-call. Must stay comfortably
/// longer than the client's request timeout, so a live request is never condemned.
pub const SUBMITTING_RECOVERY_GRACE_SECS: i64 = 120;

pub fn submit_backoff_secs(retry_count: i32) -> i64 {
    exponential_backoff_secs(
        SUBMIT_BASE_BACKOFF_SECS,
        SUBMIT_MAX_BACKOFF_SECS,
        retry_count,
    )
}

/// The import phase schedules the first poll, so one prior attempt still means the base delay.
pub fn verify_backoff_secs(attempt_count: i32) -> i64 {
    exponential_backoff_secs(
        VERIFY_BASE_BACKOFF_SECS,
        VERIFY_MAX_BACKOFF_SECS,
        attempt_count.saturating_sub(1),
    )
}

/// Spreads a batch that failed together, so it does not come back as one thundering herd.
pub fn next_attempt_at(now: DateTime<Utc>, delay_secs: i64) -> DateTime<Utc> {
    headless_lms_utils::backoff::next_attempt_at(now, delay_secs, JITTER_MAX_SECS)
}

pub fn submit_window_expired(first_failed_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    window_expired(first_failed_at, now, SUBMIT_MAX_RETRY_AGE_SECS)
}

pub fn verify_window_expired(submitted_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    window_expired(submitted_at, now, VERIFY_MAX_AGE_SECS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_doubles_and_then_stops_growing() {
        assert_eq!(submit_backoff_secs(0), SUBMIT_BASE_BACKOFF_SECS);
        assert_eq!(submit_backoff_secs(1), SUBMIT_BASE_BACKOFF_SECS * 2);
        assert_eq!(submit_backoff_secs(3), SUBMIT_BASE_BACKOFF_SECS * 8);
        assert_eq!(submit_backoff_secs(30), SUBMIT_MAX_BACKOFF_SECS);
        assert_eq!(submit_backoff_secs(i32::MAX), SUBMIT_MAX_BACKOFF_SECS);
    }

    #[test]
    fn verify_backoff_starts_at_the_base_after_the_first_poll() {
        assert_eq!(verify_backoff_secs(1), VERIFY_BASE_BACKOFF_SECS);
        assert_eq!(verify_backoff_secs(2), VERIFY_BASE_BACKOFF_SECS * 2);
        assert_eq!(verify_backoff_secs(100), VERIFY_MAX_BACKOFF_SECS);
    }

    #[test]
    fn the_retry_window_runs_from_the_first_failure() {
        let now = Utc::now();
        assert!(!submit_window_expired(None, now));
        assert!(!submit_window_expired(
            Some(now - chrono::Duration::days(6)),
            now
        ));
        assert!(submit_window_expired(
            Some(now - chrono::Duration::days(8)),
            now
        ));
    }

    #[test]
    fn the_verify_window_runs_from_the_submission() {
        let now = Utc::now();
        assert!(!verify_window_expired(None, now));
        assert!(!verify_window_expired(
            Some(now - chrono::Duration::days(13)),
            now
        ));
        assert!(verify_window_expired(
            Some(now - chrono::Duration::days(15)),
            now
        ));
    }

    #[test]
    fn jitter_never_shortens_a_backoff() {
        let now = Utc::now();
        for _ in 0..50 {
            let scheduled = next_attempt_at(now, 60);
            assert!((scheduled - now).num_seconds() >= 60);
            assert!((scheduled - now).num_seconds() <= 60 + JITTER_MAX_SECS);
        }
    }
}
