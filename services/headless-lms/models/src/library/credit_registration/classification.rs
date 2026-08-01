//! How an error code is treated and how long the pipeline waits before trying again.
//!
//! The one place the retryability of a code is decided. The phases read it, and so does the mock
//! Suotar's fault validator, which refuses to arm a fault claiming a code is retryable when the
//! attainment it describes has already landed.

use rand::RngExt;
use utoipa::ToSchema;

use crate::credit_registrations::{CreditRegistrationErrorCode, map_code};
use crate::prelude::*;
use crate::suotar_api_calls::SuotarEndpoint;

/// What may be done about an error code.
///
/// The class is the contract's, not the endpoint's. `import` creates attainments, so a failure
/// there that may have landed is upgraded to [`Retryability::VerifyOnly`] by the phase, which is
/// the only place that upgrade happens.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Retryability {
    RetryableTransient,
    /// The outcome is unknown and re-sending could duplicate it. Only `verify` may touch it.
    VerifyOnly,
    PermanentNeedsStudent,
    PermanentNeedsAdmin,
    PermanentNeedsConfig,
}

impl Retryability {
    pub fn is_permanent(self) -> bool {
        matches!(
            self,
            Self::PermanentNeedsStudent | Self::PermanentNeedsAdmin | Self::PermanentNeedsConfig
        )
    }
}

pub fn retryability(code: CreditRegistrationErrorCode) -> Retryability {
    use CreditRegistrationErrorCode as Code;
    use Retryability as Class;
    match code {
        Code::SisuTemporarilyUnavailable | Code::TransportError => Class::RetryableTransient,
        // Our credentials or our request shape. The batch is re-queued rather than blamed on its
        // rows, and the loud logging is what gets a human to look.
        Code::Unauthorized | Code::MalformedRequest => Class::RetryableTransient,
        // Suotar answered with something we could not read. Nothing about the row is wrong.
        Code::UnexpectedResponse => Class::RetryableTransient,
        Code::SisuTimeout => Class::VerifyOnly,
        Code::PersonNotFound
        | Code::EnrolmentNotFound
        | Code::EnrolmentNotAccepted
        | Code::StudyRightNotValid => Class::PermanentNeedsStudent,
        Code::CourseCodeNotFound
        | Code::CourseNotAllowed
        | Code::InvalidGradeForGradeScale
        | Code::InvalidCredits
        | Code::NoGradeScaleMapping
        | Code::MissingUhCourseCode
        | Code::MissingEctsCredits => Class::PermanentNeedsConfig,
        Code::AcceptorNotFound
        | Code::SisuValidationFailed
        | Code::Misregistered
        | Code::RetryWindowExpired
        | Code::Unknown => Class::PermanentNeedsAdmin,
    }
}

/// The class the contract gives a per-item wire code, before any hardening of ours.
///
/// Any endpoint but `import` yields the unhardened mapping, and the mock's validator wants exactly
/// that: its guarded fault is "the contract says retry me, and the attainment landed anyway".
pub fn wire_code_retryability(code: &str) -> Option<Retryability> {
    map_code(SuotarEndpoint::VerifyAttainments, code).map(retryability)
}

pub fn is_retryable_transient_wire_code(code: &str) -> bool {
    wire_code_retryability(code) == Some(Retryability::RetryableTransient)
}

pub const SUBMIT_BASE_BACKOFF_SECS: i64 = 60;
pub const SUBMIT_MAX_BACKOFF_SECS: i64 = 6 * 60 * 60;
/// After this much time in failure, a row stops being retried and becomes a support case.
pub const SUBMIT_MAX_RETRY_AGE_SECS: i64 = 7 * 24 * 60 * 60;
/// Sisu needs a few minutes before a submitted attainment shows up, so the first poll waits.
pub const VERIFY_FIRST_DELAY_SECS: i64 = 120;
pub const VERIFY_BASE_BACKOFF_SECS: i64 = 300;
pub const VERIFY_MAX_BACKOFF_SECS: i64 = 6 * 60 * 60;
/// After this, polling drops to daily and a human is asked to look. Never a failure: the attainment
/// may well exist, and calling it failed would invite a second submission.
pub const VERIFY_MAX_AGE_SECS: i64 = 14 * 24 * 60 * 60;
pub const VERIFY_GIVE_UP_POLL_SECS: i64 = 24 * 60 * 60;
pub const JITTER_MAX_SECS: i64 = 30;

/// How long a row with no usable enrolment waits before the pipeline looks again on its own. The
/// student can also force a recheck, and enrolment discovery can wake it sooner.
pub const NO_USABLE_ENROLMENT_RECHECK_SECS: i64 = 24 * 60 * 60;

/// How long between the checks that look for an attainment we may or may not have created.
pub const UNCERTAIN_RECHECK_SECS: i64 = 15 * 60;
/// After this many fruitless checks a human is asked to look in Sisu. The row still never resubmits.
pub const UNCERTAIN_MAX_CHECKS: i32 = 3;

/// A row found in `submitting` this long after entering it belongs to a worker that died mid-call.
/// Comfortably longer than the client's request timeout, so a live request is never condemned.
pub const SUBMITTING_RECOVERY_GRACE_SECS: i64 = 120;

fn exponential(base_secs: i64, max_secs: i64, attempt: i32) -> i64 {
    let shift = attempt.clamp(0, 32) as u32;
    base_secs
        .saturating_mul(2_i64.saturating_pow(shift))
        .min(max_secs)
}

/// Delay before the next submit attempt, given how many have already failed.
pub fn submit_backoff_secs(retry_count: i32) -> i64 {
    exponential(
        SUBMIT_BASE_BACKOFF_SECS,
        SUBMIT_MAX_BACKOFF_SECS,
        retry_count,
    )
}

/// Delay before the next verify poll, given how many have already been made.
pub fn verify_backoff_secs(attempt_count: i32) -> i64 {
    exponential(
        VERIFY_BASE_BACKOFF_SECS,
        VERIFY_MAX_BACKOFF_SECS,
        attempt_count.saturating_sub(1),
    )
}

/// Spreads a batch that failed together, so it does not come back as one thundering herd.
pub fn next_attempt_at(now: DateTime<Utc>, delay_secs: i64) -> DateTime<Utc> {
    let jitter = rand::rng().random_range(0..=JITTER_MAX_SECS);
    now + chrono::Duration::seconds(delay_secs.saturating_add(jitter))
}

/// Whether a row has been failing for longer than the pipeline keeps trying.
pub fn submit_window_expired(first_failed_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    first_failed_at.is_some_and(|first| (now - first).num_seconds() >= SUBMIT_MAX_RETRY_AGE_SECS)
}

/// Whether a submitted attainment has gone unconfirmed for longer than we keep polling hard.
pub fn verify_window_expired(submitted_at: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    submitted_at.is_some_and(|submitted| (now - submitted).num_seconds() >= VERIFY_MAX_AGE_SECS)
}

#[cfg(test)]
mod tests {
    use super::*;
    use CreditRegistrationErrorCode as Code;
    use Retryability as Class;

    #[test]
    fn every_error_code_is_classified() {
        let classified = [
            (Code::PersonNotFound, Class::PermanentNeedsStudent),
            (Code::CourseCodeNotFound, Class::PermanentNeedsConfig),
            (Code::EnrolmentNotFound, Class::PermanentNeedsStudent),
            (Code::EnrolmentNotAccepted, Class::PermanentNeedsStudent),
            (Code::InvalidGradeForGradeScale, Class::PermanentNeedsConfig),
            (Code::CourseNotAllowed, Class::PermanentNeedsConfig),
            (Code::InvalidCredits, Class::PermanentNeedsConfig),
            (Code::StudyRightNotValid, Class::PermanentNeedsStudent),
            (Code::AcceptorNotFound, Class::PermanentNeedsAdmin),
            (Code::SisuValidationFailed, Class::PermanentNeedsAdmin),
            (Code::SisuTimeout, Class::VerifyOnly),
            (Code::SisuTemporarilyUnavailable, Class::RetryableTransient),
            (Code::Misregistered, Class::PermanentNeedsAdmin),
            (Code::Unauthorized, Class::RetryableTransient),
            (Code::MalformedRequest, Class::RetryableTransient),
            (Code::TransportError, Class::RetryableTransient),
            (Code::UnexpectedResponse, Class::RetryableTransient),
            (Code::NoGradeScaleMapping, Class::PermanentNeedsConfig),
            (Code::MissingUhCourseCode, Class::PermanentNeedsConfig),
            (Code::MissingEctsCredits, Class::PermanentNeedsConfig),
            (Code::RetryWindowExpired, Class::PermanentNeedsAdmin),
            (Code::Unknown, Class::PermanentNeedsAdmin),
        ];
        assert_eq!(classified.len(), CreditRegistrationErrorCode::ALL.len());
        for (code, expected) in classified {
            assert_eq!(retryability(code), expected, "{code:?}");
        }
    }

    /// What the mock's fault validator reads. Our own hardening of import must not reach it, or the
    /// one fault combination it refuses would stop being refused.
    #[test]
    fn the_wire_class_of_the_transient_code_ignores_imports_hardening() {
        assert!(is_retryable_transient_wire_code(
            "sisuTemporarilyUnavailable"
        ));
        assert_eq!(
            map_code(
                SuotarEndpoint::ImportAttainments,
                "sisuTemporarilyUnavailable"
            )
            .map(retryability),
            Some(Class::VerifyOnly)
        );
    }

    #[test]
    fn a_code_that_names_no_failure_has_no_wire_class() {
        assert_eq!(wire_code_retryability("registered"), None);
        assert_eq!(wire_code_retryability("notRegistered"), None);
    }

    #[test]
    fn backoff_doubles_and_then_stops_growing() {
        assert_eq!(submit_backoff_secs(0), SUBMIT_BASE_BACKOFF_SECS);
        assert_eq!(submit_backoff_secs(1), SUBMIT_BASE_BACKOFF_SECS * 2);
        assert_eq!(submit_backoff_secs(3), SUBMIT_BASE_BACKOFF_SECS * 8);
        assert_eq!(submit_backoff_secs(30), SUBMIT_MAX_BACKOFF_SECS);
        assert_eq!(submit_backoff_secs(i32::MAX), SUBMIT_MAX_BACKOFF_SECS);
    }

    /// The first poll is scheduled by the import phase, so the first backoff this computes is the
    /// wait after one fruitless poll.
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
