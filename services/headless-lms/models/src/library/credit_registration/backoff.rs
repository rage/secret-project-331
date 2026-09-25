//! How long the pipeline waits before trying again. Generic scheduling math; which error codes are
//! even retryable is [`super::classification`].

use headless_lms_utils::backoff::{exponential_backoff_secs, window_expired};
use headless_lms_utils::services::suotar::SuotarEndpoint;

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

/// The waits between the pipeline's own looks for an enrolment, from the first time it found none;
/// after the last one it looks daily. A manual recheck or enrolment discovery can wake the row
/// sooner without restarting this, since it is timed from `no_usable_enrolment_since`.
pub const NO_USABLE_ENROLMENT_FIRST_RECHECKS_SECS: [i64; 3] = [60 * 60, 4 * 60 * 60, 12 * 60 * 60];
pub const NO_USABLE_ENROLMENT_DAILY_RECHECK_SECS: i64 = 24 * 60 * 60;
/// A row parked this long is unlikely ever to enrol, so its looks drop to weekly.
pub const NO_USABLE_ENROLMENT_WEEKLY_AFTER_SECS: i64 = 30 * 24 * 60 * 60;
pub const NO_USABLE_ENROLMENT_WEEKLY_RECHECK_SECS: i64 = 7 * 24 * 60 * 60;
/// How soon after the last enrolment check a person may ask for another. The student's and the
/// teacher's buttons share it, and enrolment discovery waits it out for a roster entry that carries
/// no enrolment time.
pub const ENROLMENT_RECHECK_MIN_INTERVAL_SECS: i64 = 60 * 60;

/// The first wait before looking for an attainment we may or may not have created; it doubles
/// after every fruitless look.
pub const UNCERTAIN_RECHECK_SECS: i64 = 15 * 60;
pub const UNCERTAIN_MAX_RECHECK_SECS: i64 = 6 * 60 * 60;
/// How long after the submission a human is asked to look in Sisu, well past the hour an
/// attainment may take to show up. The row still never resubmits.
pub const UNCERTAIN_ADMIN_AFTER_SECS: i64 = 24 * 60 * 60;

/// How long verify may see only the assessment item attainment before a human looks.
pub const PARTIAL_REGISTRATION_ADMIN_AFTER_SECS: i64 = 3 * 24 * 60 * 60;
/// How many times Suotar may lose a submission (`notRegistered`) before a human looks. Each one
/// still resubmits.
pub const NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD: i32 = 3;

/// A row still `submitting` this long belongs to a worker that died mid-call. Above the import
/// timeout, so a live request is never condemned to `submission_uncertain`.
pub const SUBMITTING_RECOVERY_GRACE_SECS: i64 = SuotarEndpoint::ImportAttainments
    .request_timeout()
    .as_secs() as i64
    + 15 * 60;
/// A row still `resolving_enrolment` this long belongs to a worker that died mid-call, and goes back
/// to `ready_to_submit`. Above the resolve timeout, so a live answer still lands.
pub const RESOLVING_RECOVERY_GRACE_SECS: i64 = SuotarEndpoint::ResolveEnrolments
    .request_timeout()
    .as_secs() as i64
    + 10 * 60;

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

/// `lookup_count` counts the look just made, so the wait after the first one is already doubled.
pub fn uncertain_recheck_secs(lookup_count: i32) -> i64 {
    exponential_backoff_secs(
        UNCERTAIN_RECHECK_SECS,
        UNCERTAIN_MAX_RECHECK_SECS,
        lookup_count,
    )
}

/// The wait before the next look for an enrolment, for a row that has been without a usable one for
/// `parked_for_secs`: each step of [`NO_USABLE_ENROLMENT_FIRST_RECHECKS_SECS`] applies until the
/// time it ends at has passed.
pub fn no_usable_enrolment_recheck_secs(parked_for_secs: i64) -> i64 {
    if parked_for_secs >= NO_USABLE_ENROLMENT_WEEKLY_AFTER_SECS {
        return NO_USABLE_ENROLMENT_WEEKLY_RECHECK_SECS;
    }
    let mut step_ends_at_secs = 0;
    for delay_secs in NO_USABLE_ENROLMENT_FIRST_RECHECKS_SECS {
        step_ends_at_secs += delay_secs;
        if parked_for_secs < step_ends_at_secs {
            return delay_secs;
        }
    }
    NO_USABLE_ENROLMENT_DAILY_RECHECK_SECS
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

pub fn uncertain_needs_admin(submitted_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    window_expired(submitted_at, now, UNCERTAIN_ADMIN_AFTER_SECS)
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
    fn enrolment_rechecks_thin_out_the_longer_a_row_waits() {
        const HOUR: i64 = 60 * 60;
        let schedule: Vec<i64> = [0, HOUR, 5 * HOUR, 17 * HOUR, 41 * HOUR, 31 * 24 * HOUR]
            .into_iter()
            .map(no_usable_enrolment_recheck_secs)
            .collect();
        assert_eq!(
            schedule,
            [
                HOUR,
                4 * HOUR,
                12 * HOUR,
                24 * HOUR,
                24 * HOUR,
                7 * 24 * HOUR
            ]
        );
        // A manual recheck in between does not restart the schedule.
        assert_eq!(no_usable_enrolment_recheck_secs(2 * HOUR), 4 * HOUR);
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
