//! The in-memory map the circuit breakers and the rate limiter keep their state in.

use std::collections::HashMap;
use std::hash::Hash;
use std::sync::{LazyLock, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

/// A map private to this worker process, for state that is advisory: a poisoned lock is recovered
/// rather than taking the worker down.
pub(crate) struct ProcessLocalMap<K, V>(LazyLock<Mutex<HashMap<K, V>>>);

impl<K, V> ProcessLocalMap<K, V> {
    pub(crate) const fn new() -> Self {
        Self(LazyLock::new(|| Mutex::new(HashMap::new())))
    }

    pub(crate) fn lock(&self) -> MutexGuard<'_, HashMap<K, V>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// How often an unchanged report is written anyway, so its `updated_at` still shows the process is
/// alive.
const UNCHANGED_REPORT_REFRESH: Duration = Duration::from_secs(60);

/// What this process last wrote to the dashboard's copy of its in-memory state, per key.
pub(crate) struct LastReported<K, S>(ProcessLocalMap<K, (S, Instant)>);

impl<K: Eq + Hash, S> LastReported<K, S> {
    pub(crate) const fn new() -> Self {
        Self(ProcessLocalMap::new())
    }

    /// Whether `report` differs from the last one written for `key` by `is_same`, or that write has
    /// aged past [`UNCHANGED_REPORT_REFRESH`].
    pub(crate) fn is_due(&self, key: &K, report: &S, is_same: impl FnOnce(&S, &S) -> bool) -> bool {
        self.0.lock().get(key).is_none_or(|(written, at)| {
            !is_same(written, report) || at.elapsed() >= UNCHANGED_REPORT_REFRESH
        })
    }

    /// Notes that `report` was written for `key`; only after the write succeeded.
    pub(crate) fn record(&self, key: K, report: S) {
        self.0.lock().insert(key, (report, Instant::now()));
    }
}
