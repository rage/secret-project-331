use std::str::FromStr;

use chrono::{DateTime, Utc};
use indexmap::IndexMap;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::user_details::EmailVerificationMethod;
use headless_lms_models::{user_details, user_details::UserDetail, users};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};
use sqlx::PgConnection;

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties, argument_parsing::parse_required_uuid,
        tool_permission::ToolPermission,
    },
    prelude::{
        BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, TryToOptional, chatbot_err,
    },
    user_context::ChatbotTurnContext,
};

const MAX_CANDIDATES: usize = 10;
const MIN_FUZZY_QUERY_LENGTH: usize = 3;

pub type FindUserTool = ToolProperties<FindUserState>;

pub struct FindUserState {
    matched_as: &'static str,
    candidates: Vec<UserCandidateOutput>,
}

#[derive(Clone, serde::Serialize)]
struct UserCandidateOutput {
    user_id: Uuid,
    email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    upstream_id: Option<i32>,
    created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    email_verified_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    email_verified_method: Option<EmailVerificationMethod>,
    #[serde(skip_serializing_if = "Option::is_none")]
    deleted_at: Option<DateTime<Utc>>,
}

#[derive(serde::Serialize)]
struct FindUserOutput {
    matched_as: &'static str,
    candidates: Vec<UserCandidateOutput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    note: Option<String>,
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

/// Manual, not derived: `kind` needs validation `#[derive(Deserialize)]` can't express, and this
/// is what [ChatbotTool::Arguments]'s `DeserializeOwned` bound is satisfied by (`parse_arguments`
/// below is overridden and never calls it, but the bound still has to hold).
impl<'de> serde::Deserialize<'de> for FindUserArguments {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let raw = RawFindUserArguments::deserialize(deserializer)?;
        build_arguments(raw).map_err(serde::de::Error::custom)
    }
}

fn build_arguments(raw: RawFindUserArguments) -> ChatbotResult<FindUserArguments> {
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

impl ChatbotToolDeclaration for FindUserTool {
    const NAME: &'static str = "find_user";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    const CATEGORY: ToolCategory = ToolCategory::AdminSupportAccounts;

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
        build_arguments(raw)
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        _user_context: &ChatbotTurnContext,
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

        let details: Vec<UserDetail> = details.into_iter().take(MAX_CANDIDATES).collect();
        let user_ids: Vec<Uuid> = details.iter().map(|d| d.user_id).collect();
        let users_by_id: std::collections::HashMap<Uuid, users::User> =
            users::get_by_ids(conn, &user_ids)
                .await?
                .into_iter()
                .map(|u| (u.id, u))
                .collect();

        let mut candidates = Vec::new();
        for detail in details {
            let user = users_by_id.get(&detail.user_id);
            candidates.push(UserCandidateOutput {
                user_id: detail.user_id,
                email: detail.email,
                first_name: detail.first_name,
                last_name: detail.last_name,
                upstream_id: user.and_then(|u| u.upstream_id),
                created_at: detail.created_at,
                email_verified_at: detail.email_verified_at,
                email_verified_method: detail.email_verified_method,
                deleted_at: user.and_then(|u| u.deleted_at),
            });
        }

        Ok(FindUserTool {
            state: FindUserState {
                matched_as,
                candidates,
            },
        })
    }

    fn output(&self) -> String {
        let note = self.state.candidates.is_empty().then(|| {
            "No candidates found. Try a different kind (email, name, user_id, upstream_id, auto) or check the query for typos."
                .to_string()
        });

        let result = FindUserOutput {
            matched_as: self.state.matched_as,
            candidates: self.state.candidates.clone(),
            note,
        };

        serde_json::to_string_pretty(&result).unwrap_or_else(|_| "{}".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        let mut notes = vec![
            "If exactly one candidate matches, proceed with its user_id. If several match, list them to the admin (email, name, created date) and ask which one is meant before doing anything else. Never guess between candidates. Mention when the matched email differs from what the admin typed (likely a typo).".to_string(),
        ];

        if self.state.matched_as == "email" {
            notes.push("kind \"email\" is a fuzzy (trigram) match, not an exact lookup: verify the returned email character-by-character against what the admin typed before using a candidate.".to_string());
        }

        if self.state.matched_as == "name" {
            notes.push("matched_as \"name\" means an email or ID search found nothing and only the name search matched — this is a weak match; a hit on a common name could be any user with that name.".to_string());
        }

        if self.state.candidates.len() >= MAX_CANDIDATES {
            notes.push(format!(
                "The candidate list is capped at {MAX_CANDIDATES} and truncation is not signalled beyond this note: if this many came back, ask the admin to narrow the query rather than assuming this is the complete set."
            ));
        }

        let has_upstream_id = self
            .state
            .candidates
            .iter()
            .any(|c| c.upstream_id.is_some());
        let missing_upstream_id = self
            .state
            .candidates
            .iter()
            .any(|c| c.upstream_id.is_none());
        if has_upstream_id && missing_upstream_id {
            notes.push("upstream_id is the TMC/mooc.fi account id; some candidates have it and some don't, which is the classic duplicate-account shape (one TMC account, one local-only account) — check with the admin before picking one.".to_string());
        }

        if self
            .state
            .candidates
            .iter()
            .any(|c| c.email_verified_method.is_some())
        {
            notes.push("email_verified_at absent means the address was never proven and is auto-cleared on every email change, so it being absent right after an address correction is expected, not suspicious. email_verified_method strength ranges from real proof (EmailedCode, TmcConfirmed) through an inference (PasswordResetBackfill) down to AdminAsserted, which is only a human's assertion and may have been set by a support admin rather than the user.".to_string());
        }

        Some(notes.join(" "))
    }
}

/// Looks up one user by `user_id`, rejecting a query that is not a valid UUID.
async fn find_by_user_id(conn: &mut PgConnection, query: &str) -> ChatbotResult<Vec<UserDetail>> {
    let user_id = parse_required_uuid("user_id", query)?;
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
    if Uuid::from_str(query).is_ok() {
        let details = find_by_user_id(conn, query).await?;
        if !details.is_empty() {
            return Ok(("user_id", details));
        }
    }

    if query.parse::<i32>().is_ok() {
        let details = find_by_upstream_id(conn, query).await?;
        if !details.is_empty() {
            return Ok(("upstream_id", details));
        }
    }

    if query.contains('@') {
        let details = user_details::search_for_user_details_by_email(conn, query).await?;
        if !details.is_empty() {
            return Ok(("email", details));
        }
    }

    if query.chars().count() < MIN_FUZZY_QUERY_LENGTH {
        return Err(chatbot_err!(
            InvalidToolArguments,
            format!(
                "query must be at least {MIN_FUZZY_QUERY_LENGTH} characters long for email or name search."
            )
        ));
    }
    let details = user_details::search_for_user_details_fuzzy_match(conn, query).await?;
    Ok(("name", details))
}
