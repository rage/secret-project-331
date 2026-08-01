//! The circuit breaker the three study-registry phases share.
//!
//! Keyed by scope rather than global: a test driving a deliberate outage for its own course must not
//! silence the pipeline for every other test running at the same moment, and production only ever
//! uses the global key.
//!
//! **When an iteration counts as failed** — the rule both this and
//! `credit_registration_phase_state.consecutive_failures` follow — is either of:
//!
//! - the request failed as a whole (credentials, a malformed request, 5xx, transport, an
//!   unreadable body), or
//! - the request succeeded, carried at least one item, and *every* item came back with a
//!   transient code.
//!
//! A mix is a success: some rows moved, so the registry is answering. Request-level only would let
//! the worker burn calls against a Sisu that is answering "unavailable" to everything.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use uuid::Uuid;

use super::PhaseScope;

pub const MAX_CONSECUTIVE_SUOTAR_FAILURES: u32 = 5;
pub const SUOTAR_COOLDOWN_SECS: u64 = 300;
/// Playwright's per-test budget is 100 s, so the production cooldown is three whole tests. A test
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

#[derive(Debug, Default, Clone)]
struct BreakerState {
    consecutive_failures: u32,
    open_until: Option<Instant>,
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
    let mut breakers = lock();
    let Some(state) = breakers.get_mut(key) else {
        return false;
    };
    match state.open_until {
        Some(until) if Instant::now() < until => true,
        Some(_) => {
            // The cooldown elapsed. The next failure opens it again immediately, which is what
            // makes a lasting outage cheap instead of a hot loop.
            state.open_until = None;
            state.consecutive_failures = 0;
            false
        }
        None => false,
    }
}

pub fn record_success(key: &ScopeKey) {
    let mut breakers = lock();
    breakers.remove(key);
}

/// Returns whether this failure opened the breaker.
pub fn record_failure(key: &ScopeKey, cooldown: Duration) -> bool {
    let mut breakers = lock();
    let state = breakers.entry(key.clone()).or_default();
    state.consecutive_failures = state.consecutive_failures.saturating_add(1);
    if state.consecutive_failures >= MAX_CONSECUTIVE_SUOTAR_FAILURES {
        state.open_until = Some(Instant::now() + cooldown);
        return true;
    }
    false
}

#[cfg(test)]
pub fn reset(key: &ScopeKey) {
    lock().remove(key);
}

fn lock() -> std::sync::MutexGuard<'static, HashMap<ScopeKey, BreakerState>> {
    // A poisoned lock would mean a panic while holding it; the counters are advisory, so carrying
    // on with them beats taking the worker down.
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

    /// The reason the breaker is keyed at all: one course's deliberate outage must not stop another
    /// course's rows moving.
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

    /// Registration ids name the same breaker whichever order a caller listed them in.
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
    fn the_cooldown_fits_inside_one_test_under_test_mode() {
        assert_eq!(cooldown(false).as_secs(), SUOTAR_COOLDOWN_SECS);
        assert!(cooldown(true) < cooldown(false));
        assert!(cooldown(true).as_secs() < 100);
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
