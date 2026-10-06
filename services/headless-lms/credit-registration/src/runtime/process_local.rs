//! The in-memory maps this worker process keeps its advisory state in: the circuit breakers', the
//! rate limiter's, and the worker loop's last logged skips.

use std::collections::HashMap;
use std::hash::Hash;
use std::sync::{LazyLock, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use headless_lms_models::credit_registrations::RegistrationScope;
use uuid::Uuid;

/// Whose share of the breakers and the limiter a run uses. Keyed by scope rather than global: a
/// test driving a deliberate outage for its own course must not silence the pipeline for every
/// other test running at the same moment. Production only ever uses the global key.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(super) enum ScopeKey {
    /// Production, and any unscoped run.
    Global,
    Course(Uuid),
    User(Uuid),
    Registrations(Vec<Uuid>),
}

impl ScopeKey {
    pub(super) fn of(scope: &RegistrationScope) -> Self {
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

/// A map private to this worker process, for state that is advisory: a poisoned lock is recovered
/// rather than taking the worker down.
pub(super) struct ProcessLocalMap<K, V>(LazyLock<Mutex<HashMap<K, V>>>);

impl<K, V> ProcessLocalMap<K, V> {
    pub(super) const fn new() -> Self {
        Self(LazyLock::new(|| Mutex::new(HashMap::new())))
    }

    pub(super) fn lock(&self) -> MutexGuard<'_, HashMap<K, V>> {
        self.0.lock().unwrap_or_else(|poisoned| {
            warn!("Recovered a poisoned breaker/rate-limit lock after a panic elsewhere");
            poisoned.into_inner()
        })
    }
}

/// How often an unchanged report is written anyway, so its `updated_at` still shows the process is
/// alive.
const UNCHANGED_REPORT_REFRESH: Duration = Duration::from_secs(60);

/// What this process last reported per key, to the dashboard's copy of its in-memory state or to
/// the log.
pub(super) struct LastReported<K, S> {
    reports: ProcessLocalMap<K, (S, Instant)>,
    /// How often an unchanged report is due anyway; `None` for never.
    refresh: Option<Duration>,
}

impl<K: Eq + Hash, S> LastReported<K, S> {
    /// Refreshed every [`UNCHANGED_REPORT_REFRESH`].
    pub(super) const fn new() -> Self {
        Self {
            reports: ProcessLocalMap::new(),
            refresh: Some(UNCHANGED_REPORT_REFRESH),
        }
    }

    /// Due again only once the report changes or [`Self::clear`] forgets it.
    pub(super) const fn without_refresh() -> Self {
        Self {
            reports: ProcessLocalMap::new(),
            refresh: None,
        }
    }

    /// Whether `report` differs from the last one recorded for `key` by `is_same`, or that one has
    /// aged past the refresh interval.
    pub(super) fn is_due(&self, key: &K, report: &S, is_same: impl FnOnce(&S, &S) -> bool) -> bool {
        self.reports.lock().get(key).is_none_or(|(written, at)| {
            !is_same(written, report) || self.refresh.is_some_and(|refresh| at.elapsed() >= refresh)
        })
    }

    /// Notes that `report` was written for `key`; only after the write succeeded.
    pub(super) fn record(&self, key: K, report: S) {
        self.reports.lock().insert(key, (report, Instant::now()));
    }

    /// Forgets `key`'s last report, so the next one is due whatever it is.
    pub(super) fn clear(&self, key: &K) {
        self.reports.lock().remove(key);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_scoped_run_gets_its_own_key_and_an_unscoped_one_gets_the_global_key() {
        let course = Uuid::new_v4();
        let user = Uuid::new_v4();
        assert_eq!(
            ScopeKey::of(&RegistrationScope::default()),
            ScopeKey::Global
        );
        assert_eq!(
            ScopeKey::of(&RegistrationScope::for_course(course)),
            ScopeKey::Course(course)
        );
        assert_eq!(
            ScopeKey::of(&RegistrationScope {
                user_id: Some(user),
                ..RegistrationScope::default()
            }),
            ScopeKey::User(user)
        );
    }

    #[test]
    fn a_registration_scope_is_order_independent() {
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let one = RegistrationScope {
            credit_registration_ids: vec![first, second],
            ..RegistrationScope::default()
        };
        let other = RegistrationScope {
            credit_registration_ids: vec![second, first],
            ..RegistrationScope::default()
        };
        assert_eq!(ScopeKey::of(&one), ScopeKey::of(&other));
    }
}
