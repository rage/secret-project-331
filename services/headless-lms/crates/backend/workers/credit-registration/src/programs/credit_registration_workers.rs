//! The two credit registration worker processes. They share a bootstrap and differ only in the
//! phases `worker_loop::run` picks for their process.

use sqlx::postgres::PgPoolOptions;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_base::program_config::ProgramConfig;
use headless_lms_base::tracing::setup_tracing;
use headless_lms_credit_registration::{WorkerProcess, worker_loop};

/// Runs the worker that owns the credit registration ledger.
pub async fn credit_registrar_main() -> anyhow::Result<()> {
    run(
        WorkerProcess::CreditRegistrar,
        "Starting the credit registrar.",
        "Still registering credits.",
    )
    .await
}

/// Runs the worker that owns everything about credit registration except the ledger: enrolment
/// discovery, the account-linking mails and the course configuration check. Separate from the
/// registrar because none of its phases move a ledger row and its intervals are hours, not seconds.
pub async fn suotar_syncer_main() -> anyhow::Result<()> {
    run(
        WorkerProcess::SuotarSyncer,
        "Starting the Suotar syncer.",
        "Still syncing with the study registry.",
    )
    .await
}

async fn run(
    process: WorkerProcess,
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
    let result = worker_loop::run(process, db_pool, app_configuration, still_running_message).await;
    if let Err(error) = &result {
        error!(process = process.as_str(), error = %error, "Worker loop exited with an error");
    }
    result?;
    Ok(())
}
