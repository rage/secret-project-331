//! How long the pipeline waits before trying again. Generic scheduling math; which error codes are
//! even retryable is [`super::classification`].

use chrono::TimeDelta;
use headless_lms_utils::backoff::{exponential_backoff_secs, window_expired};

use crate::prelude::*;
use crate::suotar_api_calls::SuotarEndpoint;

pub const SUBMIT_BASE_BACKOFF: TimeDelta = TimeDelta::minutes(1);
pub const SUBMIT_MAX_BACKOFF: TimeDelta = TimeDelta::hours(6);
/// After this long in failure a row stops being retried and becomes a support case.
pub const SUBMIT_MAX_RETRY_AGE: TimeDelta = TimeDelta::days(7);
/// Registrations land between about 5 and 29 hours after the submission, most of them in the first
/// half: polls start shortly before, are close together through the dense part, and back off after.
pub const VERIFY_WINDOW_START: TimeDelta = TimeDelta::minutes(270);
const VERIFY_DENSE_WINDOW_END: TimeDelta = TimeDelta::minutes(630);
const VERIFY_WINDOW_END: TimeDelta = TimeDelta::hours(29);
pub const VERIFY_WINDOW_INTERVAL: TimeDelta = TimeDelta::minutes(30);
const VERIFY_LATE_WINDOW_INTERVAL: TimeDelta = TimeDelta::hours(1);
pub const VERIFY_BASE_BACKOFF: TimeDelta = TimeDelta::hours(2);
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
/// timeout, and restarted before each resent half of a split batch, so a live answer still lands.
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

/// The wait before the next submit after `retry_count` failed ones.
pub fn submit_backoff(retry_count: i32) -> TimeDelta {
    doubling(SUBMIT_BASE_BACKOFF, SUBMIT_MAX_BACKOFF, retry_count)
}

/// The wait from `now` until the next verify poll of a row submitted at `submitted_at`. Timed from
/// the submission rather than by counting polls, so a resumed or delayed row still polls at the
/// times registrations land.
pub fn verify_delay(submitted_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> TimeDelta {
    let Some(submitted_at) = submitted_at else {
        return VERIFY_WINDOW_INTERVAL;
    };
    let age = now - submitted_at;
    if age < VERIFY_WINDOW_START {
        VERIFY_WINDOW_START - age
    } else if age < VERIFY_DENSE_WINDOW_END {
        VERIFY_WINDOW_INTERVAL
    } else if age < VERIFY_WINDOW_END {
        VERIFY_LATE_WINDOW_INTERVAL
    } else {
        // Grows with the time past the window, so polls thin out until the cap.
        (age - VERIFY_WINDOW_END).clamp(VERIFY_BASE_BACKOFF, VERIFY_MAX_BACKOFF)
    }
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

/// Whether an uncertain submission has waited long enough to be handed to an admin; never without
/// a submission time.
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
    fn verify_polls_follow_the_landing_window_from_the_submission() {
        let now = Utc::now();
        let delay = |age: TimeDelta| verify_delay(Some(now - age), now);
        assert_eq!(delay(TimeDelta::zero()), VERIFY_WINDOW_START);
        assert_eq!(delay(TimeDelta::hours(3)), TimeDelta::minutes(90));
        assert_eq!(delay(TimeDelta::minutes(270)), VERIFY_WINDOW_INTERVAL);
        assert_eq!(delay(TimeDelta::hours(10)), VERIFY_WINDOW_INTERVAL);
        assert_eq!(delay(TimeDelta::hours(11)), VERIFY_LATE_WINDOW_INTERVAL);
        assert_eq!(delay(TimeDelta::hours(28)), VERIFY_LATE_WINDOW_INTERVAL);
        assert_eq!(delay(TimeDelta::hours(29)), VERIFY_BASE_BACKOFF);
        assert_eq!(delay(TimeDelta::hours(33)), VERIFY_BASE_BACKOFF * 2);
        assert_eq!(delay(TimeDelta::days(5)), VERIFY_MAX_BACKOFF);
        assert_eq!(verify_delay(None, now), VERIFY_WINDOW_INTERVAL);
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
