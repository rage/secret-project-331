//! The bootstrap both credit registration workers share; they differ only in the phases
//! `worker_loop::run` picks for `process_name` and in their log messages.

use sqlx::postgres::PgPoolOptions;

use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_credit_registration::worker_loop;

pub async fn run_credit_registration_worker(
    process_name: &'static str,
    start_message: &str,
    still_running_message: &str,
) -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;

    let db_url = ProgramConfig::database_url_with_default();
    // Fails at boot without credentials, so a misconfigured deploy is loud instead of silently idle.
    let app_configuration = ApplicationConfiguration::try_from_env()?;
    // Every phase loop and its heartbeat keeper may hold a connection at once.
    let db_pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(&db_url)
        .await?;

    info!("{start_message}");
    worker_loop::run(
        process_name,
        db_pool,
        app_configuration,
        still_running_message,
    )
    .await
}
