//! Hourly upkeep of the account forms' data: deletes what is past its retention.

use dotenvy::dotenv;
use headless_lms_models as models;
use sqlx::PgPool;

use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;

pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;
    let pool = PgPool::connect(&ProgramConfig::database_url_with_default()).await?;
    let mut conn = pool.acquire().await?;
    let counts = models::shared_rate_counts::delete_old(&mut conn).await?;
    info!("Deleted {counts} shared counts");
    Ok(())
}
