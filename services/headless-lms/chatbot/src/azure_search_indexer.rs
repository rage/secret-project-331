use crate::prelude::*;
use serde_json::json;

const API_VERSION: &str = "2024-07-01";

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
                "parsingMode": "default"
            }
        },
        "fieldMappings": [
            {
                "sourceFieldName": "metadata_storage_name",
                "targetFieldName": "title",
                "mappingFunction": null
            },
            {
              "sourceFieldName": "metadata_page_path",
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
