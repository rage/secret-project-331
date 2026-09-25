//! How much one worker process may ask of each rate-limited Suotar endpoint.
//!
//! One token bucket per endpoint, in memory like the circuit breaker: every endpoint is called from
//! one process only. After its own failures, or when the breaker trips or closes again, an endpoint
//! drops to a tenth of its rate and doubles back every five healthy minutes.
//!
//! Keyed by scope like the breaker, so a test's scoped ticks never spend what the live workers or
//! another test may send.

use std::time::{Duration, Instant};

use headless_lms_utils::services::suotar::SuotarEndpoint;

use crate::breaker::ScopeKey;
use crate::process_local::ProcessLocalMap;

/// What an endpoint may take at full rate.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EndpointRate {
    /// Items per minute, or requests per minute for `list_by_course`.
    pub per_minute: f64,
    /// The most that may go out in one burst.
    pub capacity: f64,
}

/// The rate an endpoint is limited to, or `None` for one that is not limited.
pub fn endpoint_rate(endpoint: SuotarEndpoint) -> Option<EndpointRate> {
    match endpoint {
        SuotarEndpoint::ResolveEnrolments | SuotarEndpoint::ResolvePersons => Some(EndpointRate {
            per_minute: 500.0,
            capacity: 1000.0,
        }),
        SuotarEndpoint::ListByCourse => Some(EndpointRate {
            per_minute: 2.0,
            capacity: 2.0,
        }),
        SuotarEndpoint::ImportAttainments
        | SuotarEndpoint::VerifyAttainments
        | SuotarEndpoint::ValidateCourseCodes => None,
    }
}

/// The endpoints [`endpoint_rate`] limits.
pub const LIMITED_ENDPOINTS: [SuotarEndpoint; 3] = [
    SuotarEndpoint::ResolvePersons,
    SuotarEndpoint::ResolveEnrolments,
    SuotarEndpoint::ListByCourse,
];

/// The share of the full rate an endpoint drops to.
pub const FLOOR_SHARE: f64 = 0.1;
/// The reduced share doubles after each of these without a failure.
const RAMP_DOUBLING_INTERVAL: Duration = Duration::from_secs(5 * 60);

#[derive(Debug, Clone)]
struct Bucket {
    tokens: f64,
    refilled_at: Instant,
    /// When the reduced rate last restarted from the floor; `None` at full rate.
    floor_started_at: Option<Instant>,
}

impl Bucket {
    fn new(rate: EndpointRate, now: Instant) -> Self {
        Self {
            tokens: rate.capacity,
            refilled_at: now,
            floor_started_at: None,
        }
    }

    fn share(&mut self, now: Instant) -> f64 {
        let Some(started) = self.floor_started_at else {
            return 1.0;
        };
        let doublings = now.duration_since(started).as_secs() / RAMP_DOUBLING_INTERVAL.as_secs();
        let share = FLOOR_SHARE * 2f64.powi(i32::try_from(doublings).unwrap_or(i32::MAX));
        if share >= 1.0 {
            self.floor_started_at = None;
            return 1.0;
        }
        share
    }

    fn refill(&mut self, rate: EndpointRate, now: Instant) {
        let share = self.share(now);
        let elapsed_minutes = now.duration_since(self.refilled_at).as_secs_f64() / 60.0;
        self.tokens =
            (self.tokens + elapsed_minutes * rate.per_minute * share).min(burst_limit(rate, share));
        self.refilled_at = now;
    }

    /// Whether the bucket is back where a new one starts, so dropping it changes nothing.
    fn is_fresh(&mut self, rate: EndpointRate, now: Instant) -> bool {
        self.refill(rate, now);
        self.floor_started_at.is_none() && self.tokens >= rate.capacity
    }
}

static BUCKETS: ProcessLocalMap<(ScopeKey, SuotarEndpoint), Bucket> = ProcessLocalMap::new();

fn with_bucket<T>(
    key: &ScopeKey,
    endpoint: SuotarEndpoint,
    use_bucket: impl FnOnce(&mut Bucket, EndpointRate) -> T,
) -> Option<T> {
    let rate = endpoint_rate(endpoint)?;
    let now = Instant::now();
    let mut buckets = BUCKETS.lock();
    let bucket_key = (key.clone(), endpoint);
    if !buckets.contains_key(&bucket_key) {
        // A scope never run again would otherwise stay in the map for the life of the process.
        buckets.retain(|(_, endpoint), bucket| {
            endpoint_rate(*endpoint).is_some_and(|rate| !bucket.is_fresh(rate, now))
        });
    }
    let bucket = buckets
        .entry(bucket_key)
        .or_insert_with(|| Bucket::new(rate, now));
    bucket.refill(rate, now);
    Some(use_bucket(bucket, rate))
}

/// How many items, or requests, the endpoint may take right now. Unlimited endpoints answer
/// `usize::MAX`.
pub fn available(key: &ScopeKey, endpoint: SuotarEndpoint) -> usize {
    with_bucket(key, endpoint, |bucket, _| {
        bucket.tokens.floor().max(0.0) as usize
    })
    .unwrap_or(usize::MAX)
}

/// Spends `count` of what [`available`] allowed.
pub fn take(key: &ScopeKey, endpoint: SuotarEndpoint, count: usize) {
    with_bucket(key, endpoint, |bucket, _| {
        bucket.tokens = (bucket.tokens - count as f64).max(0.0);
    });
}

/// Spends `count` even past what [`available`] allows, leaving the bucket in debt that later
/// refills pay off before [`available`] allows anything again. At most one capacity of debt, so
/// the limiter is back within one refill of the full burst. Only for a split batch's resent halves,
/// which must not wait for a later iteration: that would claim and refuse the same batch again.
pub fn overdraw(key: &ScopeKey, endpoint: SuotarEndpoint, count: usize) {
    with_bucket(key, endpoint, |bucket, rate| {
        bucket.tokens = (bucket.tokens - count as f64).max(-rate.capacity);
    });
}

/// Drops `endpoints` to [`FLOOR_SHARE`] of their rate, restarting the climb back. Unlimited ones
/// are skipped.
pub fn drop_to_floor(key: &ScopeKey, endpoints: &[SuotarEndpoint]) {
    for &endpoint in endpoints {
        with_bucket(key, endpoint, |bucket, rate| {
            bucket.floor_started_at = Some(Instant::now());
            bucket.tokens = bucket.tokens.min(burst_limit(rate, FLOOR_SHARE));
        });
    }
}

/// At least one, so an endpoint whose capacity is a couple of requests still gets one through at
/// the floor.
fn burst_limit(rate: EndpointRate, share: f64) -> f64 {
    (rate.capacity * share).max(1.0)
}

/// One endpoint's limiter as it stands, for the dashboard.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LimiterSnapshot {
    pub share: f64,
    pub available: usize,
    pub rate: EndpointRate,
}

/// Forgets every bucket of `scope`, so its endpoints are back at full rate with a full burst.
pub fn reset(scope: &ScopeKey) {
    BUCKETS.lock().retain(|(key, _), _| key != scope);
}

/// `None` for an unlimited endpoint.
pub fn snapshot(key: &ScopeKey, endpoint: SuotarEndpoint) -> Option<LimiterSnapshot> {
    with_bucket(key, endpoint, |bucket, rate| LimiterSnapshot {
        share: bucket.share(Instant::now()),
        available: bucket.tokens.floor().max(0.0) as usize,
        rate,
    })
}
