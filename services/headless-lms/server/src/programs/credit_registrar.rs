//! The worker that owns the credit registration ledger.
//!
//! One process, several phases: creating rows, moving them along, resolving enrolments, importing,
//! verifying and mirroring the successes. Each phase has its own interval and its own row in
//! `credit_registration_phase_state`, because an operator reasons about phases rather than pods.
//!
//! Every iteration goes through the same dispatcher the test tick endpoint uses, so a phase cannot
//! behave one way for a worker and another for a test.

use std::env;

use sqlx::PgPool;

use crate::config::program_config::ProgramConfig;
use crate::domain::credit_registration_phases::worker_loop;
use crate::setup_tracing;
use headless_lms_base::config::ApplicationConfiguration;

const PROCESS_NAME: &str = "credit-registrar";

pub async fn main() -> anyhow::Result<()> {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    dotenvy::dotenv().ok();
    setup_tracing()?;

    let db_url = ProgramConfig::database_url_with_default();
    // Fails at boot without credentials rather than idling, so a misconfigured production deploy is
    // loud instead of silently registering nobody's credits.
    let app_configuration = ApplicationConfiguration::try_from_env()?;
    let db_pool = PgPool::connect(&db_url).await?;

    info!("Starting the credit registrar.");
    worker_loop::run(
        PROCESS_NAME,
        db_pool,
        app_configuration,
        "Still registering credits.",
    )
    .await
}
