//! The `tools` array of an Azure request: how a tool is advertised to the model.
//!
//! Only the wire shapes live here. What tools exist, who may use them and how a call is carried
//! out is [`crate::chatbot_tools`]; building the search definition from the deployment's search
//! configuration is [`crate::chatbot_tools::provider_tools::azure_ai_search`].

use serde::{Deserialize, Serialize};

use headless_lms_utils::json_schema_types::Schema;

/// The name Azure gives its own search tool. Unlike every other tool it has no
/// `ChatbotToolDeclaration` to carry its name.
pub const AZURE_AI_SEARCH_TOOL_NAME: &str = "azure_ai_search";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum AzureLLMToolDefinition {
    Function(AzureLLMFunctionToolDefinition),
    Search(AzureAISearchToolDefinition),
}

/// A function tool definition, formatted for Azure.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AzureLLMFunctionToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: LLMToolType,
    pub name: String,
    pub description: String,
    /// Azure requires `additional_properties: false` here.
    pub parameters: Schema,
    /// Always `true`: makes Azure validate calls against `parameters` instead of just passing them through.
    pub strict: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolType {
    Function,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AzureAISearchToolDefinition {
    #[serde(rename = "type")]
    pub data_type: String,
    pub azure_ai_search: AzureAISearch,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AzureAISearch {
    pub indexes: Vec<SearchIndex>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchIndex {
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
