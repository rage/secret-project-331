use std::{collections::HashSet, env};

use crate::setup_tracing;
use chrono::Utc;
use dotenv::dotenv;
use headless_lms_models as models;
use sqlx::{Connection, PgConnection, PgPool};
use uuid::Uuid;

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;
    let mut interval = tokio::time::interval(Duration::from_secs(10));
    let mut ticks = 60;

    loop {
      interval.tick().await;
      ticks += 1;
      // 60 10 second intervals = 10 minutes
      if ticks > 60 {
          // Occasionally prints a reminder that the service is still running
          ticks = 0;
          tracing::info!("Syncing pages to chatbot backend.");
          sync_pages(&mut conn).await?;
      }
    }
}

/// Continuously syncs page contents to the chatbot backend.
async fn sync_pages(conn: &mut sqlx::PgConnection) -> anyhow::Result<()> {

    Ok(())
}


async fn add_missing_sync_statuses(
    conn: &mut PgConnection,
) -> anyhow::Result<()> {

    Ok(())
}
