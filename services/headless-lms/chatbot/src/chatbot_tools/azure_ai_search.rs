use crate::{
    azure_chatbot::CONTENT_FIELD_SEPARATOR, prelude::ChatbotResult, search_filter::SearchFilter,
};
use headless_lms_utils::ApplicationConfiguration;
use serde::{Deserialize, Serialize};
use url::Url;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AzureAISearchToolDefinition {
    #[serde(rename = "type")]
    pub data_type: String,
    pub azure_ai_search: AzureAISearch,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AzureAISearch {
    pub project_connection_id: String,
    pub index_name: String,
    pub query_type: String,
    pub top_k: i32,
    pub embedding_dependency: EmbeddingDependency,
    pub in_scope: bool,
    pub strictness: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<String>,
    pub fields_mapping: FieldsMapping,
    pub semantic_configuration: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FieldsMapping {
    pub content_fields_separator: String,
    pub content_fields: Vec<String>,
    pub filepath_field: String,
    pub title_field: String,
    pub url_field: String,
    pub vector_fields: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbeddingDependency {
    #[serde(rename = "type")]
    pub dep_type: String,
    pub deployment_name: String,
}

// todo what
pub fn get_azure_ai_search_tool_definition(
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    use_semantic_reranking: bool,
) -> ChatbotResult<AzureAISearchToolDefinition> {
    let index_name = Url::parse(&app_config.base_url)?
        .host_str()
        .expect("BASE_URL must have a host")
        .replace(".", "-");
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;

    let query_type = if use_semantic_reranking {
        "vector_semantic_hybrid"
    } else {
        "vector_simple_hybrid"
    };

    Ok(AzureAISearchToolDefinition {
        data_type: "azure_ai_search".to_string(),
        azure_ai_search: AzureAISearch {
            index_name,
            project_connection_id: search_config.search_connection_id.to_owned(),
            query_type: query_type.to_string(),
            semantic_configuration: "default".to_string(),
            embedding_dependency: EmbeddingDependency {
                dep_type: "deployment_name".to_string(),
                deployment_name: search_config.vectorizer_deployment_id.clone(),
            },
            in_scope: false,
            top_k: 15,
            strictness: 3,
            filter: Some(SearchFilter::eq("course_id", course_id.to_string()).to_odata()?),
            fields_mapping: FieldsMapping {
                content_fields_separator: CONTENT_FIELD_SEPARATOR.to_string(),
                content_fields: vec!["chunk_context".to_string(), "chunk".to_string()],
                filepath_field: "filepath".to_string(),
                title_field: "title".to_string(),
                url_field: "url".to_string(),
                vector_fields: vec!["text_vector".to_string()],
            },
        },
    })
}
