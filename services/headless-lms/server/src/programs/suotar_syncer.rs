//! The worker that owns everything about credit registration except the ledger.
//!
//! Enrolment discovery, the account-linking mails and the open university product access tokens. It
//! is a separate process from the registrar because no phase of it moves a ledger row, and because
//! its intervals are half-hours and hours rather than seconds.
//!
//! With nothing configured for Suotar there is nothing to discover and no product to look up, so the
//! loop simply finds no work; it does not need a special idle path. Missing credentials are a
//! different matter and fail at boot.

use std::env;

use sqlx::PgPool;

use crate::config::program_config::ProgramConfig;
use crate::domain::credit_registration_phases::worker_loop;
use crate::setup_tracing;
use headless_lms_base::config::ApplicationConfiguration;

const PROCESS_NAME: &str = "suotar-syncer";

pub async fn main() -> anyhow::Result<()> {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    dotenvy::dotenv().ok();
    setup_tracing()?;

    let db_url = ProgramConfig::database_url_with_default();
    let app_configuration = ApplicationConfiguration::try_from_env()?;
    let db_pool = PgPool::connect(&db_url).await?;

    info!("Starting the Suotar syncer.");
    worker_loop::run(
        PROCESS_NAME,
        db_pool,
        app_configuration,
        "Still syncing with the study registry.",
    )
    .await
}
