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
}
