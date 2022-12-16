use std::env;

use crate::setup_tracing;
use chrono::Utc;
use dotenv::dotenv;
use headless_lms_models as models;
use sqlx::PgPool;

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;
    let now = Utc::now();
    let exams =
        models::ended_processed_exams::get_unprocessed_ended_exams_by_timestamp(&mut conn, now)
            .await?;
    tracing::info!(
        "Found {} ended exams for completions processing.",
        exams.len()
    );
    Ok(())
}
