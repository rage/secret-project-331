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
    content_cleaner::convert_material_blocks_to_markdown_with_llm,
};
use headless_lms_models::{
    chapters::DatabaseChapter,
    page_history::PageHistory,
    pages::{Page, PageVisibility},
};
use headless_lms_utils::{
    ApplicationConfiguration,
    document_schema_processor::{GutenbergBlock, remove_sensitive_attributes},
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
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    dotenv().ok();
    setup_tracing()?;
    Ok(())
}

struct SyncerConfig {
    database_url: String,
    name: String,
    app_configuration: ApplicationConfiguration,
}

async fn initialize_configuration() -> anyhow::Result<SyncerConfig> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());

    let base_url = Url::parse(&env::var("BASE_URL").expect("BASE_URL must be defined"))
        .expect("BASE_URL must be a valid URL");

    let name = base_url
        .host_str()
        .expect("BASE_URL must have a host")
        .replace(".", "-");

    let app_configuration = ApplicationConfiguration::try_from_env()?;

    Ok(SyncerConfig {
        database_url,
        name,
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
    let blob_client = AzureBlobClient::new(&config.app_configuration, &config.name).await?;
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

    let shared_index_name = config.name.clone();
    ensure_search_index_exists(
        &shared_index_name,
        &config.app_configuration,
        &blob_client.container_name,
    )
    .await?;

    if !check_search_indexer_status(&shared_index_name, &config.app_configuration).await? {
        warn!("Search indexer is not ready to index. Skipping synchronization.");
        return Ok(());
    }

    let mut any_changes = false;

    for (course_id, statuses) in sync_statuses.iter() {
        let outdated_statuses: Vec<_> = statuses
            .iter()
            .filter(|status| {
                latest_histories
                    .get(&status.page_id)
                    .is_some_and(|history| status.synced_page_revision_id != Some(history.id))
            })
            .collect();

        if outdated_statuses.is_empty() {
            continue;
        }

        any_changes = true;
        info!(
            "Syncing {} pages for course id: {}.",
            outdated_statuses.len(),
            course_id
        );

        let page_ids: Vec<Uuid> = outdated_statuses.iter().map(|s| s.page_id).collect();
        let pages = headless_lms_models::pages::get_by_ids(conn, &page_ids).await?;

        sync_pages_batch(
            conn,
            &pages,
            &latest_histories,
            blob_client,
            &base_url,
            &config.app_configuration,
        )
        .await?;

        delete_old_files(conn, *course_id, blob_client).await?;
    }

    if any_changes {
        run_search_indexer_now(&shared_index_name, &config.app_configuration).await?;
        info!("New files have been synced and the search indexer has been started.");
    }

    Ok(())
}

/// Ensures that the specified search index exists, creating it if necessary.
async fn ensure_search_index_exists(
    name: &str,
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
        create_azure_datasource(name, container_name, app_config).await?;
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
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    let course_id = pages
        .first()
        .ok_or_else(|| anyhow::anyhow!("No pages to sync."))?
        .course_id
        .ok_or_else(|| anyhow::anyhow!("The first page does not belong to any course."))?;

    let course = headless_lms_models::courses::get_course(conn, course_id).await?;
    let organization =
        headless_lms_models::organizations::get_organization(conn, course.organization_id).await?;

    let mut base_url = base_url.clone();
    base_url.set_path(&format!(
        "/org/{}/courses/{}",
        organization.slug, course.slug
    ));

    let mut allowed_file_paths = Vec::new();

    for page in pages {
        info!("Syncing page id: {}.", page.id);

        let mut page_url = base_url.clone();
        page_url.set_path(&format!("{}{}", base_url.path(), page.url_path));

        let parsed_content: Vec<GutenbergBlock> = serde_json::from_value(page.content.clone())?;
        let sanitized_blocks = remove_sensitive_attributes(parsed_content);

        let content_to_upload = match convert_material_blocks_to_markdown_with_llm(
            &sanitized_blocks,
            app_config,
        )
        .await
        {
            Ok(markdown) => {
                info!("Successfully cleaned content for page {}", page.id);
                // Check if the markdown is empty, or if it just contains all spaces or newlines
                if markdown.trim().is_empty() {
                    warn!(
                        "Markdown is empty for page {}. Generating fallback content with a fake heading.",
                        page.id
                    );
                    format!("# {}", page.title)
                } else {
                    markdown
                }
            }
            Err(e) => {
                warn!(
                    "Failed to clean content with LLM for page {}: {}. Using serialized sanitized content instead.",
                    page.id, e
                );
                // Fallback to original content
                serde_json::to_string(&sanitized_blocks)?
            }
        };

        let blob_path = generate_blob_path(page)?;
        let mut chapter: Option<DatabaseChapter> = None;
        if page.chapter_id.is_some() {
            chapter =
                Some(headless_lms_models::chapters::get_chapter_by_page_id(conn, page.id).await?);
        }

        allowed_file_paths.push(blob_path.clone());
        let mut metadata = HashMap::new();
        metadata.insert("url".to_string(), page_url.to_string().into());
        metadata.insert("title".to_string(), page.title.to_string().into());
        metadata.insert(
            "course_id".to_string(),
            page.course_id.unwrap_or(Uuid::nil()).to_string().into(),
        );
        metadata.insert(
            "language".to_string(),
            course.language_code.to_string().into(),
        );
        metadata.insert("filepath".to_string(), blob_path.clone().into());
        if let Some(c) = chapter {
            metadata.insert(
                "chunk_context".to_string(),
                format!(
                    "This chunk is Page {} from the Chapter {}: {} of Course {}.",
                    page.title, c.chapter_number, c.name, course.name,
                )
                .into(),
            );
        } else {
            metadata.insert(
                "chunk_context".to_string(),
                format!(
                    "This chunk is Page {} from the Course {}.",
                    page.title, course.name,
                )
                .into(),
            );
        }

        if let Err(e) = blob_client
            .upload_file(&blob_path, content_to_upload.as_bytes(), Some(metadata))
            .await
        {
            warn!("Failed to upload file {}: {:?}", blob_path, e);
        }
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

    Ok(format!("courses/{}/pages/{}.md", course_id, page.id))
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
