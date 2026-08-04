//! The circuit breaker the study-registry phases share.
//!
//! Keyed by scope rather than global: a test driving a deliberate outage for its own course must not
//! silence the pipeline for every other test running at the same moment. Production only ever uses
//! the global key.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use uuid::Uuid;

use super::PhaseScope;

pub const MAX_CONSECUTIVE_SUOTAR_FAILURES: u32 = 5;
pub const SUOTAR_COOLDOWN_SECS: u64 = 300;
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

/// How long a run of failures that never tripped the breaker is remembered, so a scope never run
/// again leaves the map. Much longer than a worker tick, so a real outage never loses its count.
const FAILURE_RUN_MEMORY: Duration = Duration::from_secs(SUOTAR_COOLDOWN_SECS);

#[derive(Debug, Clone)]
struct BreakerState {
    consecutive_failures: u32,
    open_until: Option<Instant>,
    last_failure_at: Instant,
}

impl BreakerState {
    /// Whether the entry still says anything: an open cooldown, or a recent enough run of failures.
    fn is_live(&self, now: Instant) -> bool {
        self.open_until.is_some_and(|until| now < until)
            || now.duration_since(self.last_failure_at) < FAILURE_RUN_MEMORY
    }
}

static BREAKERS: LazyLock<Mutex<HashMap<ScopeKey, BreakerState>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn cooldown(test_mode: bool) -> Duration {
    Duration::from_secs(if test_mode {
        TEST_SUOTAR_COOLDOWN_SECS
    } else {
        SUOTAR_COOLDOWN_SECS
    })
}

/// Whether the phases that call the study registry should skip this iteration.
pub fn is_open(key: &ScopeKey) -> bool {
    let now = Instant::now();
    let mut breakers = lock();
    let Some(state) = breakers.get(key) else {
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
    breakers.remove(key);
    false
}

/// What one breaker holds right now, in this process.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct BreakerSnapshot {
    pub open: bool,
    pub consecutive_failures: u32,
    /// How much of the cooldown is left, in seconds.
    pub open_for_secs: Option<u64>,
}

/// Reads a breaker without touching it, for the dashboard. Not [`is_open`], which clears an elapsed
/// cooldown as a side effect.
pub fn snapshot(key: &ScopeKey) -> BreakerSnapshot {
    let breakers = lock();
    let Some(state) = breakers
        .get(key)
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
    }
}

pub fn record_success(key: &ScopeKey) {
    let mut breakers = lock();
    breakers.remove(key);
}

/// Returns whether this failure opened the breaker.
pub fn record_failure(key: &ScopeKey, cooldown: Duration) -> bool {
    let now = Instant::now();
    let mut breakers = lock();
    breakers.retain(|_, state| state.is_live(now));
    let state = breakers.entry(key.clone()).or_insert(BreakerState {
        consecutive_failures: 0,
        open_until: None,
        last_failure_at: now,
    });
    state.last_failure_at = now;
    state.consecutive_failures = state.consecutive_failures.saturating_add(1);
    if state.consecutive_failures >= MAX_CONSECUTIVE_SUOTAR_FAILURES {
        state.open_until = Some(now + cooldown);
        return true;
    }
    false
}

#[cfg(test)]
pub fn reset(key: &ScopeKey) {
    lock().remove(key);
}

fn lock() -> std::sync::MutexGuard<'static, HashMap<ScopeKey, BreakerState>> {
    // The counters are advisory, so recovering a poisoned lock beats taking the worker down.
    BREAKERS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key() -> ScopeKey {
        ScopeKey::Course(Uuid::new_v4())
    }

    #[test]
    fn the_breaker_opens_only_after_the_documented_run_of_failures() {
        let key = key();
        for _ in 1..MAX_CONSECUTIVE_SUOTAR_FAILURES {
            assert!(!record_failure(&key, cooldown(false)));
            assert!(!is_open(&key));
        }
        assert!(record_failure(&key, cooldown(false)));
        assert!(is_open(&key));
        reset(&key);
    }

    #[test]
    fn one_success_puts_the_run_of_failures_back_to_zero() {
        let key = key();
        for _ in 1..MAX_CONSECUTIVE_SUOTAR_FAILURES {
            record_failure(&key, cooldown(false));
        }
        record_success(&key);
        assert!(!record_failure(&key, cooldown(false)));
        assert!(!is_open(&key));
        reset(&key);
    }

    #[test]
    fn two_scopes_do_not_trip_each_other() {
        let storm = key();
        let bystander = key();
        for _ in 0..MAX_CONSECUTIVE_SUOTAR_FAILURES {
            record_failure(&storm, cooldown(false));
        }
        assert!(is_open(&storm));
        assert!(!is_open(&bystander));
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
            record_failure(&key, Duration::ZERO);
        }
        assert!(!is_open(&key));
        reset(&key);
    }
}
