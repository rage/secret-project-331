use std::str::FromStr;

use indexmap::IndexMap;
use serde::Deserialize;
use sqlx::PgConnection;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    chatbot_conversation_messages_citations, courses, organizations,
    pages::{self, PageSearchResult, SearchRequest},
};
use headless_lms_utils::{
    json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType},
    strings::truncate_utf8_at_boundary,
};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolCitation, ToolProperties,
        course_scope::resolve_course_scope, tool_permission::ToolPermission,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
    user_context::ChatbotUserContext,
};

pub type CourseMaterialSearchTool = ToolProperties<CourseMaterialSearchState>;

struct SearchHit {
    page_id: Uuid,
    title: String,
    chapter_name: Option<String>,
    url_path: String,
    rank: Option<f32>,
    snippet: Option<String>,
    citation_number: i32,
}

pub struct CourseMaterialSearchState {
    course_id: Uuid,
    course_name: String,
    course_slug: String,
    hits: Vec<SearchHit>,
    document_url_prefix: String,
}

#[derive(Deserialize)]
struct RawArguments {
    course_id: String,
    query: String,
}

pub struct CourseMaterialSearchArguments {
    course_id: Uuid,
    query: String,
}

/// Manual, not derived: `course_id`/`query` need validation `#[derive(Deserialize)]` can't
/// express, and this is what [ChatbotTool::Arguments]'s `DeserializeOwned` bound is satisfied by
/// (`parse_arguments` below is overridden and never calls it, but the bound still has to hold).
impl<'de> Deserialize<'de> for CourseMaterialSearchArguments {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let raw = RawArguments::deserialize(deserializer)?;
        build_arguments(raw).map_err(serde::de::Error::custom)
    }
}

fn build_arguments(raw: RawArguments) -> ChatbotResult<CourseMaterialSearchArguments> {
    let course_id = Uuid::from_str(&raw.course_id).map_err(|e| {
        chatbot_err!(
            InvalidToolArguments,
            format!("'{}' is not a valid course_id.", raw.course_id),
            e
        )
    })?;
    let query = raw.query.trim().to_string();
    if query.is_empty() {
        return Err(chatbot_err!(
            InvalidToolArguments,
            "query must not be empty.".to_string()
        ));
    }
    if query.chars().count() > MAX_QUERY_LENGTH {
        return Err(chatbot_err!(
            InvalidToolArguments,
            format!(
                "query is too long ({} characters); keep it under {MAX_QUERY_LENGTH} characters, closer to a few keywords than a paragraph.",
                query.chars().count()
            )
        ));
    }
    Ok(CourseMaterialSearchArguments { course_id, query })
}

const MAX_RESULTS: usize = 10;
const MAX_QUERY_LENGTH: usize = 200;

/// Marks from `ts_headline` on the raw match, useless once handed to the model.
fn strip_headline_marks(headline: Option<String>) -> Option<String> {
    headline.map(|s| s.replace("<b>", "").replace("</b>", ""))
}

impl ChatbotToolDeclaration for CourseMaterialSearchTool {
    const NAME: &'static str = "course_material_search";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Search a course's own pages by keyword, the same full-text search that backs the course material search dialog. Returns the pages that matched, each with a short snippet. Use this before document_lookup to find which page has what you need.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "course_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(
                                "The course to search. Resolve it with find_course first."
                                    .to_string(),
                            ),
                        }),
                    ),
                    (
                        "query".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(
                                "What to look for, in the course's own language and wording. This is a keyword search, not a semantic one: prefer the words the material would use, and try a different phrasing if nothing is found."
                                    .to_string(),
                            ),
                        }),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ChatbotTool for CourseMaterialSearchTool {
    type Arguments = CourseMaterialSearchArguments;

    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = serde_json::from_str(&args_string).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {args_string}"),
                e
            )
        })?;
        build_arguments(raw)
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        user_context: &ChatbotUserContext,
    ) -> ChatbotResult<Self> {
        let course_id = resolve_course_scope(conn, user_context, Some(arguments.course_id)).await?;
        let course = courses::get_course(conn, course_id).await.map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("No course found with id {course_id}."),
                e
            )
        })?;
        let organization = organizations::get_organization(conn, course.organization_id).await?;

        let search_request = SearchRequest {
            query: arguments.query,
        };
        let phrase_results =
            pages::get_page_search_results_for_phrase(conn, course_id, &search_request).await?;
        let word_results =
            pages::get_page_search_results_for_words(conn, course_id, &search_request).await?;

        let mut merged: Vec<PageSearchResult> = phrase_results;
        let already_present: std::collections::HashSet<Uuid> =
            merged.iter().map(|r| r.id).collect();
        merged.extend(
            word_results
                .into_iter()
                .filter(|r| !already_present.contains(&r.id)),
        );
        merged.truncate(MAX_RESULTS);

        // A whole turn's citations end up on one message, so numbering has to continue past
        // whatever an earlier search already used in this turn rather than restart at zero.
        let starting_number = if let Some(conversation_id) = user_context.conversation_id {
            chatbot_conversation_messages_citations::max_citation_number_in_turn(
                conn,
                conversation_id,
            )
            .await?
            .unwrap_or(0)
        } else {
            0
        };

        let ids_missing_headline: Vec<Uuid> = merged
            .iter()
            .filter(|r| r.title_headline.is_none())
            .map(|r| r.id)
            .collect();
        let fallback_titles = pages::get_titles_by_ids(conn, &ids_missing_headline).await?;

        let mut hits = Vec::with_capacity(merged.len());
        for (i, result) in merged.into_iter().enumerate() {
            let title = match strip_headline_marks(result.title_headline) {
                Some(title) => title,
                // No headline (the query didn't match the title itself): fall back to the
                // page's plain title rather than showing the model an empty string.
                None => fallback_titles.get(&result.id).cloned().unwrap_or_default(),
            };
            hits.push(SearchHit {
                page_id: result.id,
                title,
                chapter_name: result.chapter_name,
                url_path: result.url_path,
                rank: result.rank,
                snippet: strip_headline_marks(result.content_headline),
                citation_number: starting_number + 1 + i as i32,
            });
        }

        Ok(CourseMaterialSearchTool {
            state: CourseMaterialSearchState {
                course_id,
                course_name: course.name,
                course_slug: course.slug,
                hits,
                document_url_prefix: format!(
                    "{}/org/{}/courses",
                    app_config.base_url.trim_end_matches('/'),
                    organization.slug
                ),
            },
        })
    }

    fn output(&self) -> String {
        let course = serde_json::json!({
            "id": self.state.course_id,
            "name": self.state.course_name,
            "slug": self.state.course_slug,
        });
        let results: Vec<serde_json::Value> = self
            .state
            .hits
            .iter()
            .map(|hit| {
                serde_json::json!({
                    "page_id": hit.page_id,
                    "title": hit.title,
                    "chapter_name": hit.chapter_name,
                    "url_path": hit.url_path,
                    "rank": hit.rank,
                    "snippet": hit.snippet,
                    "citation_number": hit.citation_number,
                })
            })
            .collect();

        let value = if results.is_empty() {
            serde_json::json!({
                "course": course,
                "results": results,
                "note": "No page matched. Try different wording, or list the course's pages with course_structure.",
            })
        } else {
            serde_json::json!({
                "course": course,
                "results": results,
            })
        };
        serde_json::to_string_pretty(&value).unwrap_or_else(|_| "No results.".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some("Quote the material verbatim and name the page title. Cite a page by writing 【0:N†source】 immediately after the sentence that uses it, where N is that result's citation_number; the admin sees those as clickable links to the page. Fetch the whole page with document_lookup (course_id plus the result's page_id) only when the snippet was not clearly enough. If nothing matched, say so plainly instead of guessing.".to_string())
    }

    /// Column widths in `chatbot_conversation_messages_citations` are `VARCHAR(255)`; truncate to
    /// fit the way `to_chatbot_conversation_message_citation` does for the Azure path.
    fn citations(&self) -> Vec<ToolCitation> {
        self.state
            .hits
            .iter()
            .map(|hit| {
                let title = truncate_utf8_at_boundary(&hit.title, 255).to_string();
                let snippet = hit
                    .snippet
                    .as_deref()
                    .map(|s| truncate_utf8_at_boundary(s, 255).to_string())
                    .unwrap_or_default();
                let document_url = truncate_utf8_at_boundary(
                    &format!("{}{}", self.state.document_url_prefix, hit.url_path),
                    255,
                )
                .to_string();
                ToolCitation {
                    page_id: hit.page_id,
                    title,
                    snippet,
                    document_url,
                    citation_number: hit.citation_number,
                }
            })
            .collect()
    }
}
