use std::str::FromStr;

use indexmap::IndexMap;
use serde_json::json;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{user_details, user_details::UserDetail, users};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};
use sqlx::PgConnection;

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties, tool_permission::ToolPermission,
    },
    prelude::{ChatbotResult, TryToOptional, chatbot_err},
    user_context::ChatbotUserContext,
};

const MAX_CANDIDATES: usize = 10;
const MIN_FUZZY_QUERY_LENGTH: usize = 3;

pub type FindUserTool = ToolProperties<FindUserState>;

pub struct FindUserState {
    matched_as: &'static str,
    candidates: Vec<serde_json::Value>,
}

enum FindUserKind {
    Email,
    Name,
    UserId,
    UpstreamId,
    Auto,
}

pub struct FindUserArguments {
    query: String,
    kind: FindUserKind,
}

#[derive(serde::Deserialize)]
struct RawFindUserArguments {
    query: String,
    kind: String,
}

impl ChatbotToolDeclaration for FindUserTool {
    const NAME: &'static str = "find_user";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Find a user by email, name, user id, or upstream id, to identify who a support request is about before looking up or changing anything for them.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "query".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The value to search for: an email address, a name, a user_id (UUID), or an upstream_id (integer), depending on kind.".to_string()),
                        }),
                    ),
                    (
                        "kind".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("One of: email, name, user_id, upstream_id, auto. Use auto when unsure.".to_string()),
                        }),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ChatbotTool for FindUserTool {
    type Arguments = FindUserArguments;

    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        let raw: RawFindUserArguments = serde_json::from_str(&args_string).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {args_string}"),
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

        let kind = match raw.kind.as_str() {
            "email" => FindUserKind::Email,
            "name" => FindUserKind::Name,
            "user_id" => FindUserKind::UserId,
            "upstream_id" => FindUserKind::UpstreamId,
            "auto" => FindUserKind::Auto,
            other => {
                return Err(chatbot_err!(
                    InvalidToolArguments,
                    format!(
                        "Unknown kind '{other}'. Valid values: email, name, user_id, upstream_id, auto."
                    )
                ));
            }
        };

        if matches!(kind, FindUserKind::Email | FindUserKind::Name)
            && query.chars().count() < MIN_FUZZY_QUERY_LENGTH
        {
            return Err(chatbot_err!(
                InvalidToolArguments,
                format!(
                    "query must be at least {MIN_FUZZY_QUERY_LENGTH} characters long for email or name search."
                )
            ));
        }

        Ok(FindUserArguments { query, kind })
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        _user_context: &ChatbotUserContext,
    ) -> ChatbotResult<Self> {
        let (matched_as, details) = match arguments.kind {
            FindUserKind::UserId => ("user_id", find_by_user_id(conn, &arguments.query).await?),
            FindUserKind::UpstreamId => (
                "upstream_id",
                find_by_upstream_id(conn, &arguments.query).await?,
            ),
            FindUserKind::Email => (
                "email",
                user_details::search_for_user_details_by_email(conn, &arguments.query).await?,
            ),
            FindUserKind::Name => (
                "name",
                user_details::search_for_user_details_fuzzy_match(conn, &arguments.query).await?,
            ),
            FindUserKind::Auto => find_auto(conn, &arguments.query).await?,
        };

        let mut candidates = Vec::new();
        for detail in details.into_iter().take(MAX_CANDIDATES) {
            let user = users::get_by_id(conn, detail.user_id).await?;
            candidates.push(json!({
                "user_id": detail.user_id,
                "email": detail.email,
                "first_name": detail.first_name,
                "last_name": detail.last_name,
                "upstream_id": user.upstream_id,
                "created_at": detail.created_at,
                "email_verified_at": detail.email_verified_at,
                "email_verified_method": detail.email_verified_method,
                "deleted_at": user.deleted_at,
            }));
        }

        Ok(FindUserTool {
            state: FindUserState {
                matched_as,
                candidates,
            },
        })
    }

    fn output(&self) -> String {
        let mut result = json!({
            "matched_as": self.state.matched_as,
            "candidates": self.state.candidates,
        });

        if self.state.candidates.is_empty() {
            result["note"] = json!(
                "No candidates found. Try a different kind (email, name, user_id, upstream_id, auto) or check the query for typos."
            );
        }

        serde_json::to_string_pretty(&result).unwrap_or_else(|_| "{}".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some("If exactly one candidate matches, proceed with its user_id. If several match, list them to the admin (email, name, created date) and ask which one is meant before doing anything else. Never guess between candidates. Mention when the matched email differs from what the admin typed (likely a typo).".to_string())
    }
}

/// Looks up one user by `user_id`, rejecting a query that is not a valid UUID.
async fn find_by_user_id(conn: &mut PgConnection, query: &str) -> ChatbotResult<Vec<UserDetail>> {
    let user_id = Uuid::from_str(query).map_err(|e| {
        chatbot_err!(
            InvalidToolArguments,
            format!("'{query}' is not a valid user_id (UUID)."),
            e
        )
    })?;
    Ok(user_details::get_user_details_by_user_id(conn, user_id)
        .await
        .optional()?
        .into_iter()
        .collect())
}

/// Looks up one user by `upstream_id`, rejecting a query that is not an integer.
async fn find_by_upstream_id(
    conn: &mut PgConnection,
    query: &str,
) -> ChatbotResult<Vec<UserDetail>> {
    let upstream_id = query.parse::<i32>().map_err(|e| {
        chatbot_err!(
            InvalidToolArguments,
            format!("'{query}' is not a valid upstream_id (integer)."),
            e
        )
    })?;
    let Some(user) = users::find_by_upstream_id(conn, upstream_id).await? else {
        return Ok(Vec::new());
    };
    Ok(user_details::get_user_details_by_user_id(conn, user.id)
        .await
        .optional()?
        .into_iter()
        .collect())
}

/// Tries interpretations of `query` in order — UUID, upstream id, email, name — and returns the
/// first one that yields at least one candidate. Falls back to a (possibly empty) name search.
async fn find_auto(
    conn: &mut PgConnection,
    query: &str,
) -> ChatbotResult<(&'static str, Vec<UserDetail>)> {
    if let Ok(user_id) = Uuid::from_str(query) {
        let details: Vec<UserDetail> = user_details::get_user_details_by_user_id(conn, user_id)
            .await
            .optional()?
            .into_iter()
            .collect();
        if !details.is_empty() {
            return Ok(("user_id", details));
        }
    }

    if let Ok(upstream_id) = query.parse::<i32>() {
        if let Some(user) = users::find_by_upstream_id(conn, upstream_id).await? {
            let details: Vec<UserDetail> = user_details::get_user_details_by_user_id(conn, user.id)
                .await
                .optional()?
                .into_iter()
                .collect();
            if !details.is_empty() {
                return Ok(("upstream_id", details));
            }
        }
    }

    if query.contains('@') {
        let details = user_details::search_for_user_details_by_email(conn, query).await?;
        if !details.is_empty() {
            return Ok(("email", details));
        }
    }

    let details = user_details::search_for_user_details_fuzzy_match(conn, query).await?;
    Ok(("name", details))
}
