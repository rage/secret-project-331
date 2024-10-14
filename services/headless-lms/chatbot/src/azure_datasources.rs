use serde_json::json;

use crate::prelude::*;

pub const API_VERSION: &str = "2024-07-01";

pub async fn does_azure_datasource_exist(
    datasource_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<bool> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;
    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("datasources('{}')", datasource_name));
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

pub async fn create_azure_datasource(
    datasource_name: &str,
    container_name: &str,
    query: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    // Retrieve Azure configurations from the application configuration
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;

    let blob_storage_config = azure_config.blob_storage_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Blob storage configuration is missing from the Azure configuration")
    })?;

    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("datasources/{}", datasource_name));
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    let datasource_definition = json!({
        "name": datasource_name,
        "type": "azureblob",
        "container": {
            "name": container_name,
            "query": query,
        },
        "credentials": {
            "accountName": blob_storage_config.storage_account.clone(),
            "accountKey": blob_storage_config.access_key.clone(),
        },
    });

    let response = REQWEST_CLIENT
        .put(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.clone())
        .json(&datasource_definition)
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(anyhow::anyhow!(
            "Error creating datasource. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}
