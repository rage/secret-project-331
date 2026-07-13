use secrecy::ExposeSecret;
use serde_json::json;

use crate::prelude::*;

const API_VERSION: &str = "2024-07-01";

pub async fn does_skillset_exist(
    skillset_name: &str,
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<bool> {
    // Retrieve Azure configurations from the application configuration
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        chatbot_err!(
            AzureRequestBuildError,
            "Azure configuration is missing from the application configuration"
        )
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        chatbot_err!(
            AzureRequestBuildError,
            "Azure search configuration is missing from the Azure configuration"
        )
    })?;

    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("skillsets('{}')", skillset_name));
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    let response = REQWEST_CLIENT
        .get(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.expose_secret())
        .send()
        .await?;

    if response.status().is_success() {
        Ok(true)
    } else if response.status() == 404 {
        Ok(false)
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(chatbot_err!(
            FailedAzureResponse,
            format!(
                "Error checking if skillset exists. Status: {}. Error: {}",
                status, error_text
            )
        ))
    }
}

pub async fn create_skillset(
    skillset_name: &str,
    target_index_name: &str,
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<()> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        chatbot_err!(
            AzureRequestBuildError,
            "Azure configuration is missing from the application configuration"
        )
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        chatbot_err!(
            AzureRequestBuildError,
            "Azure search configuration is missing from the Azure configuration"
        )
    })?;

    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("skillsets/{}", skillset_name));
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    let skillset_definition = json!({
        "name": skillset_name,
        "description": "Skillset to chunk documents and generate embeddings",
        "skills": [
            {
                "@odata.type": "#Microsoft.Skills.Text.SplitSkill",
                "name": "#1",
                "description": "Split skill to chunk documents",
                "context": "/document",
                "defaultLanguageCode": "en",
                "textSplitMode": "pages",
                "maximumPageLength": 2000,
                "pageOverlapLength": 500,
                "maximumPagesToTake": 0,
                "inputs": [
                    {
                        "name": "text",
                        "source": "/document/content"
                    },
                    {
                        "name": "languageCode",
                        "source": "/document/language"
                    }
                ],
                "outputs": [
                    {
                        "name": "textItems",
                        "targetName": "pages"
                    }
                ]
            },
            {
                "@odata.type": "#Microsoft.Skills.Text.AzureOpenAIEmbeddingSkill",
                "name": "#2",
                "description": null,
                "context": "/document/pages/*",
                "resourceUri": search_config.vectorizer_resource_uri.clone(),
                "apiKey": search_config.vectorizer_api_key.expose_secret(),
                "deploymentId": search_config.vectorizer_deployment_id.clone(),
                "dimensions": 1536,
                "modelName": search_config.vectorizer_model_name.clone(),
                "inputs": [
                    {
                        "name": "text",
                        "source": "/document/pages/*",
                        "sourceContext": null,
                        "inputs": []
                    }
                ],
                "outputs": [
                    {
                        "name": "embedding",
                        "targetName": "text_vector"
                    }
                ],
                "authIdentity": null
            }
        ],
        "cognitiveServices": null,
        "knowledgeStore": null,
        "indexProjections": {
            "selectors": [
                {
                    "targetIndexName": target_index_name,
                    "parentKeyFieldName": "parent_id",
                    "sourceContext": "/document/pages/*",
                    "mappings": [
                        {
                            "name": "text_vector",
                            "source": "/document/pages/*/text_vector",
                            "sourceContext": null,
                            "inputs": []
                        },
                        {
                            "name": "chunk",
                            "source": "/document/pages/*",
                            "sourceContext": null,
                            "inputs": []
                        },
                        {
                            "name": "title",
                            "source": "/document/title",
                            "sourceContext": null,
                            "inputs": []
                        },
                        {
                          "name": "url",
                          "source": "/document/url",
                          "sourceContext": null,
                          "inputs": []
                        },
                        {
                          "name": "course_id",
                          "source": "/document/course_id",
                          "sourceContext": null,
                          "inputs": []
                        },
                        {
                          "name": "language",
                          "source": "/document/language",
                          "sourceContext": null,
                          "inputs": []
                        },
                        {
                          "name": "filepath",
                          "source": "/document/filepath",
                          "sourceContext": null,
                          "inputs": []
                        },
                        {
                            "name": "chunk_context",
                            "source": "/document/chunk_context",
                            "sourceContext": null,
                            "inputs": []
                        },
                    ]
                }
            ],
            "parameters": {
                "projectionMode": "skipIndexingParentDocuments"
            }
        },
        "encryptionKey": null
    });

    let response = REQWEST_CLIENT
        .put(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.expose_secret())
        .json(&skillset_definition)
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(chatbot_err!(
            FailedAzureResponse,
            format!(
                "Error creating skillset. Status: {}. Error: {}",
                status, error_text
            )
        ))
    }
}
