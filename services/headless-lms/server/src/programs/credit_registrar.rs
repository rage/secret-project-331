//! The worker that owns the credit registration ledger: one process, several phases, each with its
//! own interval and its own row in `credit_registration_phase_state`. Every iteration goes through
//! the same dispatcher the test tick endpoint uses.

use std::env;

use sqlx::PgPool;

use crate::config::program_config::ProgramConfig;
use crate::domain::credit_registration_phases::worker_loop;
use crate::setup_tracing;
use headless_lms_base::config::ApplicationConfiguration;

const PROCESS_NAME: &str = "credit-registrar";

pub async fn main() -> anyhow::Result<()> {
    run_credit_registration_worker(
        PROCESS_NAME,
        "Starting the credit registrar.",
        "Still registering credits.",
    )
    .await
}

/// The bootstrap both credit-registration binaries share; they differ only in the phases
/// `worker_loop::run` picks for `process_name` and in these messages.
pub async fn run_credit_registration_worker(
    process_name: &'static str,
    start_message: &str,
    still_running_message: &str,
) -> anyhow::Result<()> {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    dotenvy::dotenv().ok();
    setup_tracing()?;

    let db_url = ProgramConfig::database_url_with_default();
    // Fails at boot without credentials, so a misconfigured deploy is loud instead of silently idle.
    let app_configuration = ApplicationConfiguration::try_from_env()?;
    let db_pool = PgPool::connect(&db_url).await?;

    info!("{start_message}");
    worker_loop::run(
        process_name,
        db_pool,
        app_configuration,
        still_running_message,
    )
    .await
}
