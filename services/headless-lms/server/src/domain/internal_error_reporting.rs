use std::sync::OnceLock;

use sqlx::PgPool;

static ERROR_REPORTING_POOL: OnceLock<PgPool> = OnceLock::new();

/// Initializes the shared internal error-reporting pool once.
/// Subsequent calls are ignored and logged as warnings.
pub fn init_error_reporting(pool: PgPool) {
    if ERROR_REPORTING_POOL.set(pool).is_err() {
        tracing::warn!("init_error_reporting called more than once; keeping existing pool");
    }
}

/// Returns the globally initialized internal error-reporting pool, if set.
pub fn error_reporting_pool() -> Option<&'static PgPool> {
    ERROR_REPORTING_POOL.get()
}
