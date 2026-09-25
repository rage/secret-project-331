//! The in-memory map the circuit breakers and the rate limiter keep their state in.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex, MutexGuard, PoisonError};

/// A map private to this worker process, for state that is advisory: a poisoned lock is recovered
/// rather than taking the worker down.
pub(super) struct ProcessLocalMap<K, V>(LazyLock<Mutex<HashMap<K, V>>>);

impl<K, V> ProcessLocalMap<K, V> {
    pub(super) const fn new() -> Self {
        Self(LazyLock::new(|| Mutex::new(HashMap::new())))
    }

    pub(super) fn lock(&self) -> MutexGuard<'_, HashMap<K, V>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}
