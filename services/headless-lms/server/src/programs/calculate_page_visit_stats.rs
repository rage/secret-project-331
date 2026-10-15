use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;

use dotenvy::dotenv;
use headless_lms_models as models;
use sqlx::PgPool;

pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;
    let database_url = ProgramConfig::database_url_with_default();
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;
    models::library::page_visit_stats::calculate_latest(&mut conn).await?;
    info!("Calculated page view stats for all dates.");
    Ok(())
}
