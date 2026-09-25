//! The circuit breakers the study-registry phases share within one worker process: one every such
//! phase stops for, and one only the phase that submits to Sisu stops for, since Sisu timing out on
//! submissions says nothing about the rest of Suotar.
//!
//! `BREAKERS` is a process-local static: `credit-registrar` and `suotar-syncer` are separate OS
//! processes (see `server/src/programs/credit_registrar.rs` and `suotar_syncer.rs`), each with its own
//! map, so an outage tripping the breaker in one does not pause the study-registry phases of the
//! other. Only the phases within the same process actually share a breaker per scope key.
//!
//! Keyed by scope rather than global: a test driving a deliberate outage for its own course must not
//! silence the pipeline for every other test running at the same moment. Production only ever uses
//! the global key.

use std::time::{Duration, Instant};

use headless_lms_utils::services::suotar::SuotarEndpoint;
use uuid::Uuid;

use crate::phase::PhaseScope;
use crate::process_local::ProcessLocalMap;

pub const MAX_CONSECUTIVE_SUOTAR_FAILURES: u32 = 5;
/// The first cooldown; each trip without a success between adds another, up to
/// [`MAX_COOLDOWN_TRIPS`] of them.
pub const SUOTAR_COOLDOWN_SECS: u64 = 300;
pub const MAX_COOLDOWN_TRIPS: u32 = 3;
/// Playwright's per-test budget is 100 s, which the production cooldown does not fit inside: a test
/// that trips the breaker deliberately has to be able to watch it recover.
pub const TEST_SUOTAR_COOLDOWN_SECS: u64 = 5;

/// What one breaker counts failures for.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ScopeKey {
    /// Production, and any unscoped run.
    Global,
    Course(Uuid),
    User(Uuid),
    Registrations(Vec<Uuid>),
}

impl ScopeKey {
    pub fn of(scope: &PhaseScope) -> Self {
        if let Some(course_id) = scope.course_id {
            Self::Course(course_id)
        } else if let Some(user_id) = scope.user_id {
            Self::User(user_id)
        } else if !scope.credit_registration_ids.is_empty() {
            let mut ids = scope.credit_registration_ids.clone();
            ids.sort();
            Self::Registrations(ids)
        } else {
            Self::Global
        }
    }
}

/// Which phases one breaker pauses.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BreakerTarget {
    /// Every phase that calls the study registry: Suotar itself failing.
    StudyRegistry,
    /// Only the phase that submits to Sisu: Suotar answering that Sisu timed out.
    SisuSubmissions,
}

/// How long a run of failures that never tripped the breaker is remembered, so a scope never run
/// again leaves the map. Failures an outage spreads between hour-long timed-out calls must still
/// add up.
const FAILURE_RUN_MEMORY: Duration = Duration::from_secs(2 * 60 * 60);
const _: () = assert!(
    FAILURE_RUN_MEMORY.as_secs()
        >= 2 * SuotarEndpoint::ImportAttainments
            .request_timeout()
            .as_secs()
);

#[derive(Debug, Clone)]
struct BreakerState {
    consecutive_failures: u32,
    open_until: Option<Instant>,
    last_failure_at: Instant,
    /// Times opened since the last success, which the next cooldown grows with.
    trip_count: u32,
}

impl BreakerState {
    /// Whether the entry still says anything: an open cooldown, or a recent enough run of failures.
    fn is_live(&self, now: Instant) -> bool {
        self.open_until.is_some_and(|until| now < until)
            || now.duration_since(self.last_failure_at) < FAILURE_RUN_MEMORY
    }
}

type BreakerKey = (ScopeKey, BreakerTarget);

static BREAKERS: ProcessLocalMap<BreakerKey, BreakerState> = ProcessLocalMap::new();

/// The first cooldown, which later trips multiply.
pub fn cooldown(test_mode: bool) -> Duration {
    Duration::from_secs(if test_mode {
        TEST_SUOTAR_COOLDOWN_SECS
    } else {
        SUOTAR_COOLDOWN_SECS
    })
}

/// Whether the phases `target` covers should skip this iteration.
pub fn is_open(scope: &ScopeKey, target: BreakerTarget) -> bool {
    let key = (scope.clone(), target);
    let now = Instant::now();
    let mut breakers = BREAKERS.lock();
    let Some(state) = breakers.get(&key) else {
        return false;
    };
    if state.open_until.is_some_and(|until| now < until) {
        return true;
    }
    if state.is_live(now) {
        return false;
    }
    // Dropped rather than reset in place so an idle scope leaves the map; the fresh entry the next
    // failure creates is the state a reset would have left behind anyway.
    breakers.remove(&key);
    false
}

/// Whether the breaker's cooldown has ended with no success since: the next iteration is a probe,
/// and sends one item only.
pub fn is_half_open(scope: &ScopeKey, target: BreakerTarget) -> bool {
    let now = Instant::now();
    BREAKERS
        .lock()
        .get(&(scope.clone(), target))
        .is_some_and(|state| {
            state.is_live(now)
                && state.open_until.is_some_and(|until| now >= until)
                && state.consecutive_failures >= MAX_CONSECUTIVE_SUOTAR_FAILURES
        })
}

/// What one breaker holds right now, in this process.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct BreakerSnapshot {
    pub open: bool,
    pub consecutive_failures: u32,
    /// How much of the cooldown is left, in seconds.
    pub open_for_secs: Option<u64>,
    pub trip_count: u32,
}

/// Reads a breaker without touching it, for the dashboard. Not [`is_open`], which clears an elapsed
/// cooldown as a side effect.
pub fn snapshot(scope: &ScopeKey, target: BreakerTarget) -> BreakerSnapshot {
    let breakers = BREAKERS.lock();
    let Some(state) = breakers
        .get(&(scope.clone(), target))
        .filter(|state| state.is_live(Instant::now()))
    else {
        return BreakerSnapshot::default();
    };
    let remaining = state
        .open_until
        .and_then(|until| until.checked_duration_since(Instant::now()));
    BreakerSnapshot {
        open: remaining.is_some(),
        consecutive_failures: state.consecutive_failures,
        open_for_secs: remaining.map(|left| left.as_secs()),
        trip_count: state.trip_count,
    }
}

/// Returns whether this success closed a breaker that had tripped.
pub fn record_success(scope: &ScopeKey, target: BreakerTarget) -> bool {
    BREAKERS
        .lock()
        .remove(&(scope.clone(), target))
        .is_some_and(|state| state.trip_count > 0)
}

/// Returns the cooldown this failure opened the breaker for, if it did. `base_cooldown` is the
/// first trip's; a failure while half-open trips again at once, for longer.
pub fn record_failure(
    scope: &ScopeKey,
    target: BreakerTarget,
    base_cooldown: Duration,
) -> Option<Duration> {
    let now = Instant::now();
    let mut breakers = BREAKERS.lock();
    breakers.retain(|_, state| state.is_live(now));
    let state = breakers
        .entry((scope.clone(), target))
        .or_insert(BreakerState {
            consecutive_failures: 0,
            open_until: None,
            last_failure_at: now,
            trip_count: 0,
        });
    state.last_failure_at = now;
    state.consecutive_failures = state.consecutive_failures.saturating_add(1);
    if state.consecutive_failures < MAX_CONSECUTIVE_SUOTAR_FAILURES {
        return None;
    }
    state.trip_count = state.trip_count.saturating_add(1);
    let cooldown = base_cooldown * state.trip_count.min(MAX_COOLDOWN_TRIPS);
    state.open_until = Some(now + cooldown);
    Some(cooldown)
}

#[cfg(test)]
pub fn reset(scope: &ScopeKey) {
    let mut breakers = BREAKERS.lock();
    breakers.retain(|(key_scope, _), _| key_scope != scope);
}

#[cfg(test)]
mod tests {
    use super::*;

    const TARGET: BreakerTarget = BreakerTarget::StudyRegistry;

    fn key() -> ScopeKey {
        ScopeKey::Course(Uuid::new_v4())
    }

    #[test]
    fn the_breaker_opens_only_after_the_documented_run_of_failures() {
        let key = key();
        for _ in 1..MAX_CONSECUTIVE_SUOTAR_FAILURES {
            assert!(record_failure(&key, TARGET, cooldown(false)).is_none());
            assert!(!is_open(&key, TARGET));
        }
        assert!(record_failure(&key, TARGET, cooldown(false)).is_some());
        assert!(is_open(&key, TARGET));
        reset(&key);
    }

    #[test]
    fn one_success_puts_the_run_of_failures_back_to_zero() {
        let key = key();
        for _ in 1..MAX_CONSECUTIVE_SUOTAR_FAILURES {
            record_failure(&key, TARGET, cooldown(false));
        }
        record_success(&key, TARGET);
        assert!(record_failure(&key, TARGET, cooldown(false)).is_none());
        assert!(!is_open(&key, TARGET));
        reset(&key);
    }

    #[test]
    fn two_scopes_do_not_trip_each_other() {
        let storm = key();
        let bystander = key();
        for _ in 0..MAX_CONSECUTIVE_SUOTAR_FAILURES {
            record_failure(&storm, TARGET, cooldown(false));
        }
        assert!(is_open(&storm, TARGET));
        assert!(!is_open(&bystander, TARGET));
        reset(&storm);
        reset(&bystander);
    }

    #[test]
    fn a_scoped_run_gets_its_own_key_and_an_unscoped_one_gets_the_global_key() {
        let course = Uuid::new_v4();
        let user = Uuid::new_v4();
        assert_eq!(ScopeKey::of(&PhaseScope::default()), ScopeKey::Global);
        assert_eq!(
            ScopeKey::of(&PhaseScope::for_course(course)),
            ScopeKey::Course(course)
        );
        assert_eq!(
            ScopeKey::of(&PhaseScope {
                user_id: Some(user),
                ..PhaseScope::default()
            }),
            ScopeKey::User(user)
        );
    }

    #[test]
    fn a_registration_scope_is_order_independent() {
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let one = PhaseScope {
            credit_registration_ids: vec![first, second],
            ..PhaseScope::default()
        };
        let other = PhaseScope {
            credit_registration_ids: vec![second, first],
            ..PhaseScope::default()
        };
        assert_eq!(ScopeKey::of(&one), ScopeKey::of(&other));
    }

    #[test]
    fn a_tripped_breaker_closes_once_its_cooldown_has_elapsed() {
        let key = key();
        for _ in 0..MAX_CONSECUTIVE_SUOTAR_FAILURES {
            record_failure(&key, TARGET, Duration::ZERO);
        }
        assert!(!is_open(&key, TARGET));
        reset(&key);
    }
}
