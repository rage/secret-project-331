use std::{collections::HashSet, env, time::Duration};

use crate::{
    domain::chatbot::azure_search_index::{
        add_documents_to_index, create_search_index, does_search_index_exist,
    },
    setup_tracing,
};

use dotenv::dotenv;
use headless_lms_models::pages::Page;
use headless_lms_utils::{
    document_schema_processor::{remove_sensitive_attributes, GutenbergBlock},
    ApplicationConfiguration,
};
use sqlx::{PgConnection, PgPool};
use url::Url;

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

    let app_config = ApplicationConfiguration::try_from_env()?;

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
            sync_pages(&mut conn, &index_name_prefix, &app_config).await?;
        }
    }
}

/// Continuously syncs page contents to the chatbot backend.
async fn sync_pages(
    conn: &mut sqlx::PgConnection,
    index_name_prefix: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    let chatbot_configurations =
        headless_lms_models::chatbot_configurations::get_for_azure_search_maintananace(conn)
            .await?;
    let course_ids = chatbot_configurations
        .iter()
        .map(|config| config.course_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let sync_statuses_by_course_id =
        headless_lms_models::chatbot_page_sync_statuses::make_sure_sync_statuses_exist(
            conn,
            &course_ids,
        )
        .await?;
    let latest_history_entries_by_page_id =
        headless_lms_models::page_history::get_latest_history_entries_for_pages_by_course_ids(
            conn,
            &course_ids,
        )
        .await?;
    for (course_id, statuses) in sync_statuses_by_course_id.iter() {
        let statuses_not_up_to_date = statuses
            .iter()
            .filter(|status| {
                if let Some(history_entry) = latest_history_entries_by_page_id.get(&status.page_id)
                {
                    status.synced_page_revision_id != Some(history_entry.id)
                } else {
                    warn!(
                        "No history entry found for page with id {}. Skipping syncing. ",
                        status.page_id
                    );
                    false
                }
            })
            .collect::<Vec<_>>();
        if statuses_not_up_to_date.is_empty() {
            continue;
        }
        info!(
            "Syncing {} pages for course with id {}.",
            statuses_not_up_to_date.len(),
            course_id
        );
        let index_name = format!("{}-{}", index_name_prefix, course_id);
        ensure_index_exists(&index_name, app_config).await?;
        let page_ids = statuses_not_up_to_date
            .iter()
            .map(|status| status.page_id)
            .collect::<Vec<_>>();
        let pages = headless_lms_models::pages::get_by_ids(conn, &page_ids).await?;

        sync_pages_batch(conn, &index_name, &pages, app_config).await?;
    }
    Ok(())
}

async fn add_missing_sync_statuses(conn: &mut PgConnection) -> anyhow::Result<()> {
    Ok(())
}

async fn ensure_index_exists(
    index_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    if !does_search_index_exist(index_name, app_config).await? {
        create_search_index(index_name.to_owned(), app_config).await?;
    }
    Ok(())
}

async fn sync_pages_batch(
    conn: &mut PgConnection,
    index_name: &str,
    pages: &[Page],
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    let mut documents = Vec::new();

    for page in pages {
        // Don't want to put the private spec to the index as the chatbot could use it to leak the correct answers to exercises.
        let parsed_content: Vec<GutenbergBlock> = serde_json::from_value(page.content.clone())?;
        let content = remove_sensitive_attributes(parsed_content);
        documents.push(content);
    }

    add_documents_to_index(index_name, documents, app_config).await?;

    Ok(())
}
