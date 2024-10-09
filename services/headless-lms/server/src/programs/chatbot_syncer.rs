use std::{
    collections::{HashMap, HashSet},
    env,
    time::Duration,
};

use crate::setup_tracing;

use dotenv::dotenv;
use headless_lms_chatbot::{
    azure_blob_storage::AzureBlobClient,
    azure_search_index::{create_search_index, does_search_index_exist},
};
use headless_lms_models::{
    page_history::PageHistory,
    pages::{Page, PageVisibility},
};
use headless_lms_utils::{
    document_schema_processor::{remove_sensitive_attributes, GutenbergBlock},
    ApplicationConfiguration,
};
use sqlx::{PgConnection, PgPool};
use std::path::PathBuf;
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

    let name_prefix = base_url
        .host_str()
        .expect("BASE_URL must have a host")
        .replace(".", "-");

    let app_config = ApplicationConfiguration::try_from_env()?;
    let blob_storage_client = AzureBlobClient::new(&app_config, &name_prefix).await?;
    blob_storage_client.ensure_container_exists().await?;

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
            sync_pages(&mut conn, &name_prefix, &app_config, &blob_storage_client).await?;
        }
    }
}

/// Continuously syncs page contents to the chatbot backend.
async fn sync_pages(
    conn: &mut sqlx::PgConnection,
    index_name_prefix: &str,
    app_config: &ApplicationConfiguration,
    blob_storage_client: &AzureBlobClient,
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

        sync_pages_batch(
            conn,
            &index_name,
            &pages,
            &latest_history_entries_by_page_id,
            app_config,
            blob_storage_client,
            *course_id,
        )
        .await?;

        // Delete old files only when we have synced something new (thanks to the continue above). This way we don't constantly hammer the api when nothing has changed.
        delete_old_files(&mut *conn, *course_id, blob_storage_client).await?;
    }
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
    latest_history_entries_by_page_id: &HashMap<Uuid, PageHistory>,
    app_config: &ApplicationConfiguration,
    blob_storage_client: &AzureBlobClient,
    course_id: Uuid,
) -> anyhow::Result<()> {
    let mut allowed_file_paths = Vec::new();
    for page in pages {
        info!("Syncing page with id {}.", page.id);

        let parsed_content: Vec<GutenbergBlock> = serde_json::from_value(page.content.clone())?;
        let content = remove_sensitive_attributes(parsed_content);
        let content_string = serde_json::to_string(&content)?;
        let content_bytes = content_string.as_bytes();
        let blob_path = page_to_blob_path(&page)?;
        allowed_file_paths.push(blob_path.clone());

        blob_storage_client
            .upload_file(&blob_path, content_bytes)
            .await?;
    }

    // Mark the documents we just uploaded as synced
    let page_id_to_latest_history_id = pages
        .iter()
        .map(|page| (page.id, latest_history_entries_by_page_id[&page.id].id))
        .collect::<HashMap<_, _>>();

    headless_lms_models::chatbot_page_sync_statuses::update_page_revision_ids(
        conn,
        page_id_to_latest_history_id,
    )
    .await?;

    Ok(())
}

fn page_to_blob_path(page: &Page) -> anyhow::Result<String> {
    let base_path = if let Some(course_id) = page.course_id {
        PathBuf::from(course_id.to_string())
    } else {
        return Err(anyhow::anyhow!(
            "Trying to sync a page that does not belong to a course."
        ));
    };
    let mut url_path = page.url_path.clone();
    if url_path.starts_with('/') {
        url_path = url_path[1..].to_string();
    }
    if url_path.is_empty() {
        url_path = "index".to_string();
    }
    Ok(format!("{}/{}.json", base_path.to_string_lossy(), url_path))
}

/** Deletes all files that don't belong to a page. */
async fn delete_old_files(
    conn: &mut PgConnection,
    course_id: Uuid,
    blob_storage_client: &AzureBlobClient,
) -> anyhow::Result<()> {
    let files = blob_storage_client
        .list_files_with_prefix(&course_id.to_string())
        .await?;
    let all_pages = headless_lms_models::pages::get_all_by_course_id_and_visibility(
        &mut *conn,
        course_id,
        PageVisibility::Public,
    )
    .await?;
    let allowed_file_paths = all_pages
        .iter()
        .map(|page| page_to_blob_path(page))
        .collect::<Result<Vec<_>, _>>()?;
    for file in files {
        if !allowed_file_paths.contains(&file) {
            info!("Deleting file: {}", file);
            blob_storage_client.delete_file(&file).await?;
        }
    }
    Ok(())
}
