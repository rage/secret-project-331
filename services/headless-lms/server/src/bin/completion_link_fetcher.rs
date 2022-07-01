use std::env;

use anyhow::Result;
use dotenv::dotenv;
use headless_lms_actix::setup_tracing;
use headless_lms_models as models;
use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;

    tracing::info!("Hello from fetcher");

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;
    let course_codes = models::course_modules::get_all_uh_course_codes(&mut conn).await?;
    tracing::info!("Course codes {:?}", course_codes);

    Ok(())
}
