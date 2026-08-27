use indexmap::IndexMap;
use serde_json::json;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{user_details, user_passwords, users};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotToolDeclaration,
        action_tools::{
            ActionAuditFields, ConfirmableActionTool, ExecutedAction, verify_display_field,
        },
        argument_parsing::parse_required_uuid,
        tool_permission::{ToolAuthorization, ToolPermission},
    },
    prelude::*,
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

    const CATEGORY: ToolCategory = ToolCategory::AdminSupportAccounts;

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

/// What [GeneratePasswordResetLinkTool::execute] found out about the account while minting the
/// link, beyond what the arguments already say.
pub struct GeneratePasswordResetLinkFacts {
    is_tmc_managed_with_no_local_password: bool,
}

impl ConfirmableActionTool for GeneratePasswordResetLinkTool {
    type Arguments = GeneratePasswordResetLinkArguments;
    type Facts = GeneratePasswordResetLinkFacts;

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = serde_json::from_str(arguments).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {arguments}"),
                e
            )
        })?;

        let user_id = parse_required_uuid("user_id", &raw.user_id)?;

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
        _authorization: &ToolAuthorization<Self>,
    ) -> ChatbotResult<(ExecutedAction, Self::Facts)> {
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

        verify_display_field(
            "user_email",
            &details.email,
            &arguments.user_email,
            "find_user",
        )?;

        let has_local_password =
            user_passwords::check_if_users_password_is_stored(conn, user.id).await?;
        let is_tmc_managed_with_no_local_password =
            user.upstream_id.is_some() && !has_local_password;

        let token =
            user_passwords::insert_password_reset_token(conn, user.id, Uuid::new_v4()).await?;

        // Must match the RESET_LINK substitution in server/src/programs/email_deliver.rs exactly,
        // or the link this hands the admin will not resolve.
        let reset_url = format!(
            "{}/reset-user-password/{}",
            app_config.base_url.trim_end_matches('/'),
            token
        );

        Ok((
            ExecutedAction {
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
            },
            GeneratePasswordResetLinkFacts {
                is_tmc_managed_with_no_local_password,
            },
        ))
    }

    fn output_description_instructions(
        arguments: &Self::Arguments,
        facts: Option<&Self::Facts>,
        app_config: &ApplicationConfiguration,
    ) -> Option<String> {
        let base_url = app_config.base_url.trim_end_matches('/');
        let mut notes = vec![
            "Tell the admin the link is shown above for copy-paste into their reply, that it invalidates any earlier reset link, and to send it only to the account's own email address, after confirming the requester is the account holder.".to_string(),
            format!(
                "Point the admin to {base_url}/manage/users/{} to confirm this is the right account and that the address they are about to send the link to is the one on the account -- not as a place to find the link itself.",
                arguments.user_id
            ),
            "The link expires one hour after being generated and is single-use -- tell the admin to send it right away, and to re-run this tool if the student comes back after it has lapsed rather than trying to reuse or recover the old one. There is no admin page that lists outstanding reset links, which is why that expiry and the invalidate-on-regenerate behavior have to be stated here rather than looked up.".to_string(),
            "You never see the link itself and must not claim to know it or offer to repeat it.".to_string(),
        ];

        if let Some(facts) = facts
            && facts.is_tmc_managed_with_no_local_password
        {
            notes.push("This account has never had a local password -- redeeming the link will create one and permanently move password management for this account from TMC to this platform, which is worth telling the admin.".to_string());
        }

        Some(notes.join(" "))
    }
}
