use std::collections::HashMap;

use anyhow::anyhow;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgConnection;
use url::Url;

use crate::{
    azure_chatbot::ChatbotUserContext,
    chatbot_tools::{
        AzureLLMToolDefinition, ChatbotTool, LLMTool, LLMToolParamProperties, LLMToolParamType,
        LLMToolParams, LLMToolType, ToolProperties,
    },
    prelude::{
        ApplicationConfiguration, BackendError, ChatbotError, ChatbotErrorType, ChatbotResult,
        REQWEST_CLIENT,
    },
};

pub type SearchTool = ToolProperties<SearchState, SearchArguments>;

#[derive(Serialize, Deserialize)]
pub struct SearchArguments {
    pub query: String,
}

pub struct SearchState {
    pub query: String,
    pub results: Vec<SearchResultItem>,
}

#[derive(Clone)]
pub struct SearchResultItem {
    pub title: String,
    pub chunk: String,
    pub url: String,
}

#[derive(Deserialize)]
struct AzureSearchResponse {
    value: Vec<AzureSearchDocument>,
}

#[derive(Deserialize)]
struct AzureSearchDocument {
    #[serde(default)]
    title: String,
    #[serde(default)]
    chunk: String,
    #[serde(default)]
    url: String,
}

impl ChatbotTool for SearchTool {
    type State = SearchState;
    type Arguments = SearchArguments;

    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        if args_string.trim().is_empty() {
            return Err(ChatbotError::new(
                ChatbotErrorType::InvalidToolArguments,
                "Missing arguments for course_search tool".to_string(),
                None,
            ));
        }
        let parsed: SearchArguments = serde_json::from_str(&args_string).map_err(|e| {
            ChatbotError::new(
                ChatbotErrorType::InvalidToolArguments,
                "Failed to parse arguments for course_search tool".to_string(),
                Some(e.into()),
            )
        })?;
        Ok(parsed)
    }

    async fn from_db_and_arguments(
        _conn: &mut PgConnection,
        arguments: Self::Arguments,
        user_context: &ChatbotUserContext,
        app_config: &ApplicationConfiguration,
    ) -> ChatbotResult<Self> {
        let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
            anyhow!("Azure configuration is missing from the application configuration")
        })?;

        let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
            anyhow!("Azure search configuration is missing from the Azure configuration")
        })?;

        let index_name = Url::parse(&app_config.base_url)
            .map_err(ChatbotError::from)?
            .host_str()
            .ok_or_else(|| {
                ChatbotError::new(
                    ChatbotErrorType::Other,
                    "BASE_URL must have a host when building Azure AI Search index name"
                        .to_string(),
                    None,
                )
            })?
            .replace('.', "-");

        let filter = format!("course_id eq '{}'", user_context.course_id);

        let body = json!({
            "search": arguments.query,
            "vectorQueries": [{
                "kind": "text",
                "text": arguments.query,
                "fields": "text_vector",
                "k": 50
            }],
            "queryType": "semantic",
            "semanticConfiguration": format!("{}-semantic-configuration", index_name),
            "filter": filter,
            "top": 5,
            "select": "title,chunk,url"
        });

        let mut url = search_config.search_endpoint.clone();
        url.set_path(&format!("indexes('{index_name}')/docs/search"));
        url.set_query(Some("api-version=2024-07-01"));

        let response = REQWEST_CLIENT
            .post(url)
            .header("Content-Type", "application/json")
            .header("api-key", search_config.search_api_key.clone())
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                ChatbotError::new(ChatbotErrorType::Other, e.to_string(), Some(e.into()))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(ChatbotError::new(
                ChatbotErrorType::Other,
                format!(
                    "Azure AI Search request failed with status {} and error: {}",
                    status, error_text
                ),
                None,
            ));
        }

        let search_response: AzureSearchResponse = response.json().await.map_err(|e| {
            ChatbotError::new(
                ChatbotErrorType::DeserializationError,
                e.to_string(),
                Some(e.into()),
            )
        })?;

        let results = search_response
            .value
            .into_iter()
            .map(|doc| SearchResultItem {
                title: if doc.title.is_empty() {
                    "Untitled document".to_string()
                } else {
                    doc.title
                },
                chunk: doc.chunk,
                url: doc.url,
            })
            .collect();

        Ok(SearchTool {
            state: SearchState {
                query: arguments.query.clone(),
                results,
            },
            arguments,
        })
    }

    fn output(&self) -> String {
        if self.state.results.is_empty() {
            return format!(
                "No search results were found for the query: \"{}\".",
                self.state.query
            );
        }

        let mut out = format!(
            "Top search results for the query: \"{}\":\n",
            self.state.query
        );

        for (i, item) in self.state.results.iter().enumerate() {
            out.push_str(&format!(
                "{}. Title: {}\nURL: {}\nExcerpt: {}\n\n",
                i + 1,
                item.title,
                item.url,
                item.chunk
            ));
        }

        out
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some(
            "Use these search results to answer the user's question about the course material. Prefer citing specific results by their index (1, 2, 3, ...) and avoid inventing information that is not supported by the retrieved chunks."
                .to_string(),
        )
    }

    fn get_arguments(&self) -> &Self::Arguments {
        &self.arguments
    }

    fn get_tool_definition() -> AzureLLMToolDefinition {
        let mut properties = HashMap::new();
        properties.insert(
            "query".to_string(),
            LLMToolParamProperties {
                param_type: "string".to_string(),
                description:
                    "Natural language search query about the course material. Use when you need to look up relevant content from the course."
                        .to_string(),
            },
        );

        AzureLLMToolDefinition {
            tool_type: LLMToolType::Function,
            function: LLMTool {
                name: "course_search".to_string(),
                description: "Search the course material in Azure AI Search using hybrid keyword + vector search with semantic reranking."
                    .to_string(),
                parameters: Some(LLMToolParams {
                    tool_type: LLMToolParamType::Object,
                    properties,
                    required: vec!["query".to_string()],
                }),
            },
        }
    }
}
