use crate::prelude::*;
use serde_json::json;

const API_VERSION: &str = "2024-07-01";

/// For parsing indexer status.
#[derive(Debug, Deserialize)]
struct IndexerStatusResponse {
    pub status: String,
    #[serde(rename = "lastResult")]
    pub last_result: LastResult,
}

#[derive(Debug, Deserialize)]
struct LastResult {
    pub status: String,
    pub errors: Vec<IndexerError>,
    pub warnings: Vec<IndexerWarning>,
}

#[derive(Debug, Deserialize)]
struct IndexerError {
    pub key: Option<String>,
    pub name: Option<String>,
    pub message: Option<String>,
    pub details: Option<String>,
    #[serde(rename = "documentationLink")]
    pub documentation_link: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IndexerWarning {
    key: Option<String>,
    name: Option<String>,
    message: Option<String>,
    details: Option<String>,
    #[serde(rename = "documentationLink")]
    documentation_link: Option<String>,
}

pub async fn does_search_indexer_exist(
    indexer_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<bool> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;
    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("indexers('{}')", indexer_name));
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    let response = REQWEST_CLIENT
        .get(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.clone())
        .send()
        .await?;

    if response.status().is_success() {
        Ok(true)
    } else if response.status() == 404 {
        Ok(false)
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(anyhow::anyhow!(
            "Error checking if index exists. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}

pub async fn create_search_indexer(
    indexer_name: &str,
    data_source_name: &str,
    skillset_name: &str,
    target_index_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    // Retrieve Azure configurations from the application configuration
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;

    // Construct the URL for the Azure Search Service API
    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("indexers/{}", indexer_name));
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    // Build the JSON body for the indexer
    let indexer_definition = json!({
        "name": indexer_name,
        "description": null,
        "dataSourceName": data_source_name,
        "skillsetName": skillset_name,
        "targetIndexName": target_index_name,
        "disabled": null,
        "schedule": null,
        "parameters": {
            "batchSize": null,
            "maxFailedItems": null,
            "maxFailedItemsPerBatch": null,
            "base64EncodeKeys": null,
            "configuration": {
                "dataToExtract": "contentAndMetadata",
                "parsingMode": "json"
            }
        },
        "fieldMappings": [
            {
                "sourceFieldName": "title",
                "targetFieldName": "title",
                "mappingFunction": null
            },
            {
                "sourceFieldName": "page_path",
                "targetFieldName": "page_path",
                "mappingFunction": null
            }
        ],
        "outputFieldMappings": [],
        "encryptionKey": null
    });

    // Send the PUT request to create the indexer
    let response = REQWEST_CLIENT
        .put(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.clone())
        .json(&indexer_definition)
        .send()
        .await?;

    // Handle the response
    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(anyhow::anyhow!(
            "Error creating search indexer. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}

pub async fn run_search_indexer_now(
    indexer_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;

    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("indexers/{}/run", indexer_name));
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    let response = REQWEST_CLIENT
        .post(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.clone())
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(anyhow::anyhow!(
            "Error triggering search indexer. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}

/// Checks if the search indexer exists, is not running, and the last execution is not in progress.
/// Also prints any errors and warnings from the last execution in a nicely formatted manner.
///
/// # Arguments
///
/// * `indexer_name` - The name of the indexer to check.
/// * `app_config` - The application configuration containing Azure settings.
///
/// # Returns
///
/// * `Ok(true)` if the indexer exists, is not running, and the last execution is not in progress.
/// * `Ok(false)` if the indexer is running or the last execution is in progress.
/// * An error if the indexer does not exist or if there's an issue fetching its status.
pub async fn check_search_indexer_status(
    indexer_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<bool> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;

    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("indexers('{}')/search.status", indexer_name));
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    let response = REQWEST_CLIENT
        .get(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.clone())
        .send()
        .await?;

    if response.status().is_success() {
        let response_text = response.text().await?;
        let indexer_status: IndexerStatusResponse = match serde_json::from_str(&response_text) {
            Ok(status) => status,
            Err(e) => {
                error!("Failed to parse indexer status JSON: {}", e);
                error!("{}", serde_json::to_string_pretty(&response_text).unwrap());
                return Err(anyhow::anyhow!(
                    "Failed to parse indexer status JSON: {}",
                    e
                ));
            }
        };

        // If the indexer is not running, it is not healthy
        let is_running = indexer_status.status.eq_ignore_ascii_case("running");

        // If the last run is in progress, we cannot start a new run.
        let last_result_in_progress = indexer_status
            .last_result
            .status
            .eq_ignore_ascii_case("inprogress");

        if !is_running {
            info!("Indexer '{}' is not running normally.", indexer_name);
        }

        if last_result_in_progress {
            warn!(
                "Last execution of indexer '{}' is in progress.",
                indexer_name
            );
        }

        if !indexer_status.last_result.errors.is_empty() {
            error!("Errors in the last execution:");
            for error in &indexer_status.last_result.errors {
                error!(
                    "  - **Key**: {}\n    **Name**: {}\n    **Message**: {}\n    **Details**: {}\n    **Documentation**: {}\n",
                    error.key.as_deref().unwrap_or("N/A"),
                    error.name.as_deref().unwrap_or("N/A"),
                    error.message.as_deref().unwrap_or("N/A"),
                    error.details.as_deref().unwrap_or("N/A"),
                    error.documentation_link.as_deref().unwrap_or("N/A"),
                );
            }
        }

        if !indexer_status.last_result.warnings.is_empty() {
            warn!("Warnings in the last execution:");
            for warning in &indexer_status.last_result.warnings {
                warn!(
                    "  - **Key**: {}\n    **Name**: {}\n    **Message**: {}\n    **Details**: {}\n    **Documentation**: {}\n",
                    warning.key.as_deref().unwrap_or("N/A"),
                    warning.name.as_deref().unwrap_or("N/A"),
                    warning.message.as_deref().unwrap_or("N/A"),
                    warning.details.as_deref().unwrap_or("N/A"),
                    warning.documentation_link.as_deref().unwrap_or("N/A"),
                );
            }
        }

        if is_running && !last_result_in_progress {
            Ok(true)
        } else {
            Ok(false)
        }
    } else if response.status() == reqwest::StatusCode::NOT_FOUND {
        error!("Indexer '{}' does not exist.", indexer_name);
        Ok(false)
    } else {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "No error text".to_string());
        error!(
            "Error fetching indexer status. Status: {}. Error: {}",
            status, error_text
        );
        Err(anyhow::anyhow!(
            "Error fetching indexer status. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}
