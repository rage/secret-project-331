//! Exponential backoff with jitter, and the "has this retry window run out" check that goes with
//! it. Shared by every worker that reschedules a failed row instead of giving up on it outright.

use rand::RngExt;

use crate::prelude::*;

/// `base_secs * 2^attempt`, capped at `max_secs`. `attempt` is clamped to keep the shift in range
/// of `i64`.
pub fn exponential_backoff_secs(base_secs: i64, max_secs: i64, attempt: i32) -> i64 {
    let shift = attempt.clamp(0, 62) as u32;
    base_secs
        .saturating_mul(2_i64.saturating_pow(shift))
        .min(max_secs)
}

/// `now + delay_secs`, plus a uniformly random `0..=jitter_max_secs` so a batch that failed
/// together does not all come back at once.
pub fn next_attempt_at(now: DateTime<Utc>, delay_secs: i64, jitter_max_secs: i64) -> DateTime<Utc> {
    let jitter = rand::rng().random_range(0..=jitter_max_secs);
    now + chrono::Duration::seconds(delay_secs.saturating_add(jitter))
}

/// Whether `max_age_secs` have passed since `reference`. `None` (never failed) is never expired.
pub fn window_expired(
    reference: Option<DateTime<Utc>>,
    now: DateTime<Utc>,
    max_age_secs: i64,
) -> bool {
    reference.is_some_and(|reference| (now - reference).num_seconds() >= max_age_secs)
}
