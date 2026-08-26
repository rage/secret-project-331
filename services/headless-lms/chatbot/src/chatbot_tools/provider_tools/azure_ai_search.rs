use crate::{
    azure_chatbot::azure::tools::{
        AzureAISearch, AzureAISearchToolDefinition, EmbeddingDependency, FieldsMapping, SearchIndex,
    },
    chatbot_error::chatbot_err,
    llm_utils::azure_search_configuration,
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
    search_filter::SearchFilter,
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_base::prelude_base_and_re_exports::BackendError;
use headless_lms_models::chatbot_configurations::ToolCategory;
use url::Url;
use uuid::Uuid;

/// Separates the content fields Azure concatenates into one chunk. Baked into the format the
/// search index was written with, so changing it silently breaks every indexed document.
pub const CONTENT_FIELD_SEPARATOR: &str = ",|||,";

/// This platform tool has no [crate::chatbot_tools::ChatbotToolDeclaration] impl — it is pushed
/// directly by `AzureRequest::assemble` rather than dispatched through the tool registry — so it
/// carries its category as a standalone constant instead.
pub const CATEGORY: ToolCategory = ToolCategory::CourseMaterial;

pub fn get_azure_ai_search_tool_definition(
    app_config: &ApplicationConfiguration,
    course_id: Uuid,
    use_semantic_reranking: bool,
) -> ChatbotResult<AzureAISearchToolDefinition> {
    let index_name = Url::parse(&app_config.base_url)?
        .host_str()
        .ok_or_else(|| {
            chatbot_err!(
                AzureRequestBuildError,
                "Invalid application base url, no host"
            )
        })?
        .replace(".", "-");
    let search_config = azure_search_configuration(app_config)?;

    let query_type = if use_semantic_reranking {
        "vector_semantic_hybrid"
    } else {
        "vector_simple_hybrid"
    };

    let semantic_configuration = format!("{}-semantic-configuration", &index_name);

    Ok(AzureAISearchToolDefinition {
        data_type: "azure_ai_search".to_string(),
        azure_ai_search: AzureAISearch {
            indexes: vec![SearchIndex {
                index_name,
                project_connection_id: search_config.search_connection_id.to_owned(),
                query_type: query_type.to_string(),
                semantic_configuration,
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
            }],
        },
    })
}
