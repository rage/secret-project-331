use std::{
    collections::{HashMap, HashSet},
    env,
    time::Duration,
};

use crate::setup_tracing;
use chrono::Utc;
use dotenv::dotenv;
use headless_lms_models::{
    self as models, chatbot_page_sync_statuses::ChatbotPageSyncStatus, courses::Course,
};
use sqlx::{Connection, PgConnection, PgPool};
use url::Url;
use uuid::Uuid;

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let base_url = Url::parse(&env::var("BASE_URL").expect("BASE_URL must be defined"))
        .expect("BASE_URL must be a valid URL");
    let index_name_prefix = base_url
        .host_str()
        .expect("BASE_URL must have a host")
        .replace(".", "-");

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
            sync_pages(&mut conn, &index_name_prefix).await?;
        }
    }
}

/// Continuously syncs page contents to the chatbot backend.
async fn sync_pages(conn: &mut sqlx::PgConnection, index_name_prefix: &str) -> anyhow::Result<()> {
    let chatbot_configurations =
        models::chatbot_configurations::get_for_azure_search_maintananace(conn).await?;
    let course_ids = chatbot_configurations
        .iter()
        .map(|config| config.course_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let sync_statuses_by_course_id =
        models::chatbot_page_sync_statuses::make_sure_sync_statuses_exist(conn, &course_ids)
            .await?
            .into_iter()
            .fold(
                HashMap::<Uuid, Vec<ChatbotPageSyncStatus>>::new(),
                |mut map, status| {
                    map.entry(status.course_id)
                        .or_insert_with(Vec::new)
                        .push(status);
                    map
                },
            );
    Ok(())
}

async fn add_missing_sync_statuses(conn: &mut PgConnection) -> anyhow::Result<()> {
    Ok(())
}

async fn get_index_name(course: &Course, prefix: &str) -> String {
    format!("{}-{}", prefix, course.id)
}
