use indexmap::IndexMap;
use serde::Deserialize;
use serde_json::json;
use sqlx::PgConnection;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{user_details, user_passwords, users};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotToolDeclaration,
        action_tools::{ActionAuditFields, ConfirmableActionTool, ExecutedAction},
        tool_permission::ToolPermission,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
};

/// Generates a one-time password reset link for a user, shown to the admin only in the browser.
pub struct GeneratePasswordResetLinkTool;

/// `user_email` is the display/consistency field: re-checked against the account in [execute]
/// before a token is minted, so a stale or wrong value refuses rather than mutates.
pub struct GeneratePasswordResetLinkArguments {
    user_id: Uuid,
    user_email: String,
}

#[derive(Deserialize)]
struct RawArguments {
    user_id: String,
    user_email: String,
}

impl ChatbotToolDeclaration for GeneratePasswordResetLinkTool {
    const NAME: &'static str = "generate_password_reset_link";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Generate a one-time password reset link for a user, after the admin confirms. Invalidates any previous reset link for that user. The link is shown to the admin in their browser, never to you.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "user_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(
                                "The user_id (UUID) of the account to generate a reset link for, as returned by find_user.".to_string(),
                            ),
                        }),
                    ),
                    (
                        "user_email".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(
                                "The user's current email, exactly as find_user returned it. Shown to the admin and checked against the account before the link is generated.".to_string(),
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

impl ConfirmableActionTool for GeneratePasswordResetLinkTool {
    type Arguments = GeneratePasswordResetLinkArguments;

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = serde_json::from_str(arguments).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {arguments}"),
                e
            )
        })?;

        let user_id = Uuid::parse_str(&raw.user_id).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("'{}' is not a valid user_id (UUID).", raw.user_id),
                e
            )
        })?;

        let user_email = raw.user_email.trim().to_string();
        if user_email.is_empty() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "user_email must not be empty.".to_string()
            ));
        }

        Ok(GeneratePasswordResetLinkArguments {
            user_id,
            user_email,
        })
    }

    async fn execute(
        conn: &mut PgConnection,
        app_config: &ApplicationConfiguration,
        arguments: &Self::Arguments,
        _acting_user_id: Uuid,
    ) -> ChatbotResult<ExecutedAction> {
        let user = users::get_active_by_id(conn, arguments.user_id)
            .await
            .map_err(|e| {
                chatbot_err!(
                    ToolUseError,
                    format!(
                        "No account found with user_id {} (or it is deleted). Re-run find_user.",
                        arguments.user_id
                    ),
                    e
                )
            })?;

        let details = user_details::get_user_details_by_user_id(conn, user.id)
            .await
            .map_err(|e| {
                chatbot_err!(
                    ToolUseError,
                    format!("No account details found for user_id {}.", user.id),
                    e
                )
            })?;

        if !details.email.eq_ignore_ascii_case(&arguments.user_email) {
            return Err(chatbot_err!(
                ToolUseError,
                "The email does not match the account — re-run find_user.".to_string()
            ));
        }

        let token =
            user_passwords::insert_password_reset_token(conn, user.id, Uuid::new_v4()).await?;

        // Must match the RESET_LINK substitution in server/src/programs/email_deliver.rs exactly,
        // or the link this hands the admin will not resolve.
        let reset_url = format!(
            "{}/reset-user-password/{}",
            app_config.base_url.trim_end_matches('/'),
            token
        );

        Ok(ExecutedAction {
            output: format!(
                "A password reset link for {} was generated and shown to the admin in the chat. It replaces any previous reset link. The link itself is not available to you.",
                details.email
            ),
            client_payload: Some(json!({ "reset_link": reset_url })),
            audit: ActionAuditFields {
                target_user_id: Some(user.id),
                course_id: None,
                summary: format!("Generated a password reset link for {}", details.email),
            },
        })
    }

    fn output_description_instructions() -> Option<String> {
        Some(
            "Tell the admin the link is shown above for copy-paste into their reply, that it invalidates any earlier reset link, and to send it only to the account's own email address."
                .to_string(),
        )
    }
}
