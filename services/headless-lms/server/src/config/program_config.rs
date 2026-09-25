use anyhow::Context;
use headless_lms_base::config::bool_env_false_by_default;
use std::env;

pub struct ProgramConfig;

impl ProgramConfig {
    /// Reads DATABASE_URL with the historical development fallback.
    pub fn database_url_with_default() -> String {
        env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string())
    }

    /// Reads a required environment variable by name.
    pub fn required(key: &str) -> anyhow::Result<String> {
        env::var(key).with_context(|| format!("{key} must be defined"))
    }

    /// Reads an optional environment variable by name.
    pub fn optional(key: &str) -> Option<String> {
        env::var(key).ok()
    }

    /// Reads a boolean env var where missing values default to false.
    pub fn bool_flag(key: &str) -> bool {
        bool_env_false_by_default(key)
    }

    /// Gives a worker process a quieter default than the web server's (sqlx queries at `warn`
    /// instead of `info`), without overriding a `RUST_LOG` the operator already set.
    /// Call after loading `.env`, so a `RUST_LOG` from there counts as already set.
    pub fn ensure_default_rust_log_for_workers() {
        if env::var("RUST_LOG").is_err() {
            // TODO: Audit that the environment access only happens in single-threaded code.
            unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
        }
    }
}
