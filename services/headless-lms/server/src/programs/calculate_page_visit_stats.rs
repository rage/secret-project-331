use std::env;

use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;

use dotenvy::dotenv;
use headless_lms_models as models;
use sqlx::PgPool;

pub async fn main() -> anyhow::Result<()> {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    dotenv().ok();
    setup_tracing()?;
    let database_url = ProgramConfig::database_url_with_default();
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;
    models::library::page_visit_stats::calculate_latest(&mut conn).await?;
    info!("Calculated page view stats for all dates.");
    Ok(())
}
