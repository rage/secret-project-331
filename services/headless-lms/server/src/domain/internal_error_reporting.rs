use std::sync::OnceLock;

use sqlx::PgPool;

static ERROR_REPORTING_POOL: OnceLock<PgPool> = OnceLock::new();

pub fn init_error_reporting(pool: PgPool) {
    let _ = ERROR_REPORTING_POOL.set(pool);
}

pub fn error_reporting_pool() -> Option<&'static PgPool> {
    ERROR_REPORTING_POOL.get()
}
