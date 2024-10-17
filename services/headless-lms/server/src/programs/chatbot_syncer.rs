use std::{
    collections::{HashMap, HashSet},
    env,
    time::Duration,
};

use dotenv::dotenv;
use sqlx::{PgConnection, PgPool};
use url::Url;
use uuid::Uuid;

use crate::setup_tracing;

use headless_lms_chatbot::{
    azure_blob_storage::AzureBlobClient,
    azure_datasources::{create_azure_datasource, does_azure_datasource_exist},
    azure_search_index::{create_search_index, does_search_index_exist},
    azure_search_indexer::{
        check_search_indexer_status, create_search_indexer, does_search_indexer_exist,
        run_search_indexer_now,
    },
    azure_skillset::{create_skillset, does_skillset_exist},
};
use headless_lms_models::{
    page_history::PageHistory,
    pages::{Page, PageVisibility},
};
use headless_lms_utils::{
    document_schema_processor::{remove_sensitive_attributes, GutenbergBlock},
    ApplicationConfiguration,
};

const SYNC_INTERVAL_SECS: u64 = 10;
const PRINT_STILL_RUNNING_MESSAGE_TICKS_THRESHOLD: u32 = 60;

pub async fn main() -> anyhow::Result<()> {
    initialize_environment()?;
    let config = initialize_configuration().await?;
    if config.app_configuration.azure_configuration.is_none() {
        warn!("Azure configuration not provided. Not running chatbot syncer.");
        // Sleep indefinitely to prevent the program from exiting. This only happens in development.
        loop {
            tokio::time::sleep(Duration::from_secs(u64::MAX)).await;
        }
    }

    let db_pool = initialize_database_pool(&config.database_url).await?;
    let mut conn = db_pool.acquire().await?;
    let blob_client = initialize_blob_client(&config).await?;

    let mut interval = tokio::time::interval(Duration::from_secs(SYNC_INTERVAL_SECS));
    let mut ticks = 0;

    info!("Starting chatbot syncer.");

    loop {
        interval.tick().await;
        ticks += 1;

        if ticks >= PRINT_STILL_RUNNING_MESSAGE_TICKS_THRESHOLD {
            ticks = 0;
            info!("Still syncing for chatbot.");
        }
        if let Err(e) = sync_pages(&mut conn, &config, &blob_client).await {
            error!("Error during synchronization: {:?}", e);
        }
    }
}

fn initialize_environment() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    Ok(())
}

struct SyncerConfig {
    database_url: String,
    name_prefix: String,
    app_configuration: ApplicationConfiguration,
}

async fn initialize_configuration() -> anyhow::Result<SyncerConfig> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());

    let base_url = Url::parse(&env::var("BASE_URL").expect("BASE_URL must be defined"))
        .expect("BASE_URL must be a valid URL");

    let name_prefix = base_url
        .host_str()
        .expect("BASE_URL must have a host")
        .replace(".", "-");

    let app_configuration = ApplicationConfiguration::try_from_env()?;

    Ok(SyncerConfig {
        database_url,
        name_prefix,
        app_configuration,
    })
}

/// Initializes the PostgreSQL connection pool.
async fn initialize_database_pool(database_url: &str) -> anyhow::Result<PgPool> {
    PgPool::connect(database_url).await.map_err(|e| {
        anyhow::anyhow!(
            "Failed to connect to the database at {}: {:?}",
            database_url,
            e
        )
    })
}

/// Initializes the Azure Blob Storage client.
async fn initialize_blob_client(config: &SyncerConfig) -> anyhow::Result<AzureBlobClient> {
    let blob_client = AzureBlobClient::new(&config.app_configuration, &config.name_prefix).await?;
    blob_client.ensure_container_exists().await?;
    Ok(blob_client)
}

/// Synchronizes pages to the chatbot backend.
async fn sync_pages(
    conn: &mut PgConnection,
    config: &SyncerConfig,
    blob_client: &AzureBlobClient,
) -> anyhow::Result<()> {
    let base_url = Url::parse(&config.app_configuration.base_url)?;
    let chatbot_configs =
        headless_lms_models::chatbot_configurations::get_for_azure_search_maintenance(conn).await?;

    let course_ids: Vec<Uuid> = chatbot_configs
        .iter()
        .map(|config| config.course_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    let sync_statuses =
        headless_lms_models::chatbot_page_sync_statuses::ensure_sync_statuses_exist(
            conn,
            &course_ids,
        )
        .await?;

    let latest_histories =
        headless_lms_models::page_history::get_latest_history_entries_for_pages_by_course_ids(
            conn,
            &course_ids,
        )
        .await?;

    for (course_id, statuses) in sync_statuses.iter() {
        let outdated_statuses: Vec<_> = statuses
            .iter()
            .filter(|status| {
                latest_histories
                    .get(&status.page_id)
                    .map_or(false, |history| {
                        status.synced_page_revision_id != Some(history.id)
                    })
            })
            .collect();

        if outdated_statuses.is_empty() {
            continue;
        }

        info!(
            "Syncing {} pages for course id: {}.",
            outdated_statuses.len(),
            course_id
        );

        let page_ids: Vec<Uuid> = outdated_statuses.iter().map(|s| s.page_id).collect();

        let index_name = format!("{}-{}", config.name_prefix, course_id);
        ensure_search_index_exists(
            &index_name,
            *course_id,
            &config.app_configuration,
            &blob_client.container_name,
        )
        .await?;

        if !check_search_indexer_status(&index_name, &config.app_configuration).await? {
            warn!("Search indexer is not ready to index. Skipping synchronization.");
            return Ok(());
        }

        let pages = headless_lms_models::pages::get_by_ids(conn, &page_ids).await?;

        sync_pages_batch(conn, &pages, &latest_histories, blob_client, &base_url).await?;
        delete_old_files(conn, *course_id, blob_client).await?;

        run_search_indexer_now(&index_name, &config.app_configuration).await?;
        info!(
            "New files have been synced and the search indexer has been started for course id: {}.",
            course_id
        );
    }

    Ok(())
}

/// Ensures that the specified search index exists, creating it if necessary.
async fn ensure_search_index_exists(
    name: &str,
    course_id: Uuid,
    app_config: &ApplicationConfiguration,
    container_name: &str,
) -> anyhow::Result<()> {
    if !does_search_index_exist(name, app_config).await? {
        create_search_index(name.to_owned(), app_config).await?;
    }
    if !does_skillset_exist(name, app_config).await? {
        create_skillset(name, name, app_config).await?;
    }
    if !does_azure_datasource_exist(name, app_config).await? {
        create_azure_datasource(name, container_name, &course_id.to_string(), app_config).await?;
    }
    if !does_search_indexer_exist(name, app_config).await? {
        create_search_indexer(name, name, name, name, app_config).await?;
    }

    Ok(())
}

/// Processes and synchronizes a batch of pages.
async fn sync_pages_batch(
    conn: &mut PgConnection,
    pages: &[Page],
    latest_histories: &HashMap<Uuid, PageHistory>,
    blob_client: &AzureBlobClient,
    base_url: &Url,
) -> anyhow::Result<()> {
    let course_id = pages
        .first()
        .ok_or_else(|| anyhow::anyhow!("No pages to sync."))?
        .course_id
        .ok_or_else(|| anyhow::anyhow!("The first page does not belong to any course."))?;

    let course = headless_lms_models::courses::get_course(conn, course_id).await?;
    let organization =
        headless_lms_models::organizations::get_organization(conn, course.organization_id).await?;

    let mut url = base_url.clone();
    url.set_path(&format!(
        "/org/{}/courses/{}",
        organization.slug, course.slug
    ));

    let mut allowed_file_paths = Vec::new();

    for page in pages {
        info!("Syncing page id: {}.", page.id);

        let parsed_content: Vec<GutenbergBlock> = serde_json::from_value(page.content.clone())?;
        let sanitized_content = remove_sensitive_attributes(parsed_content);
        let content_string = serde_json::to_string(&sanitized_content)?;
        let blob_path = generate_blob_path(page)?;

        allowed_file_paths.push(blob_path.clone());
        let mut metadata = HashMap::new();
        metadata.insert("url".to_string(), url.to_string().into());
        metadata.insert("title".to_string(), page.title.to_string().into());

        blob_client
            .upload_file(&blob_path, content_string.as_bytes(), Some(metadata))
            .await?;
    }

    let page_revision_map: HashMap<Uuid, Uuid> = pages
        .iter()
        .map(|page| (page.id, latest_histories[&page.id].id))
        .collect();

    headless_lms_models::chatbot_page_sync_statuses::update_page_revision_ids(
        conn,
        page_revision_map,
    )
    .await?;

    Ok(())
}

/// Generates the blob storage path for a given page.
fn generate_blob_path(page: &Page) -> anyhow::Result<String> {
    let course_id = page
        .course_id
        .ok_or_else(|| anyhow::anyhow!("Page {} does not belong to any course.", page.id))?;

    let mut url_path = page.url_path.trim_start_matches('/').to_string();
    if url_path.is_empty() {
        url_path = "index".to_string();
    }

    Ok(format!("{}/{}.json", course_id, url_path))
}

/// Deletes files from blob storage that are no longer associated with any page.
async fn delete_old_files(
    conn: &mut PgConnection,
    course_id: Uuid,
    blob_client: &AzureBlobClient,
) -> anyhow::Result<()> {
    let existing_files = blob_client
        .list_files_with_prefix(&course_id.to_string())
        .await?;

    let pages = headless_lms_models::pages::get_all_by_course_id_and_visibility(
        conn,
        course_id,
        PageVisibility::Public,
    )
    .await?;

    let allowed_paths: HashSet<String> = pages
        .iter()
        .filter_map(|page| generate_blob_path(page).ok())
        .collect();

    for file in existing_files {
        if !allowed_paths.contains(&file) {
            info!("Deleting obsolete file: {}", file);
            blob_client.delete_file(&file).await?;
        }
    }

    Ok(())
}
