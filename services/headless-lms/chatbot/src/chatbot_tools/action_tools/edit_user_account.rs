use indexmap::IndexMap;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{user_details, user_details::EmailVerificationMethod, users};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotToolDeclaration,
        action_tools::{
            ActionAuditFields, ConfirmableActionTool, ExecutedAction, verify_display_field,
        },
        argument_parsing::parse_required_uuid,
        tool_permission::ToolPermission,
    },
    prelude::*,
};

/// Corrects a user's email and/or its verification state, after the admin confirms.
pub struct EditUserAccountTool;

enum VerificationChange {
    NoChange,
    Verify,
    Unverify,
}

/// `current_email` is the display/consistency field: re-checked against the account in [execute]
/// before anything is changed, so a stale or wrong value refuses rather than mutates.
pub struct EditUserAccountArguments {
    user_id: Uuid,
    current_email: String,
    new_email: Option<String>,
    verification_change: VerificationChange,
}

#[derive(Deserialize)]
struct RawArguments {
    user_id: String,
    current_email: String,
    new_email: String,
    mark_email_verified: String,
}

impl ChatbotToolDeclaration for EditUserAccountTool {
    const NAME: &'static str = "edit_user_account";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    const CATEGORY: ToolCategory = ToolCategory::AdminSupportAccounts;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Correct a user's email address and/or its verification state, after the admin confirms. Use to fix a typo'd email or to mark/clear verification. Does not merge accounts.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "user_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(
                                "The user_id (UUID) of the account to edit, as returned by find_user.".to_string(),
                            ),
                        }),
                    ),
                    (
                        "current_email".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(
                                "The account's current email, exactly as find_user returned it. Shown to the admin and checked against the account before anything is changed.".to_string(),
                            ),
                        }),
                    ),
                    (
                        "new_email".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(
                                "The corrected email address, or an empty string to leave the address unchanged.".to_string(),
                            ),
                        }),
                    ),
                    (
                        "mark_email_verified".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(
                                "Empty string for no change, 'verify' to mark the email verified, 'unverify' to clear verification.".to_string(),
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

impl ConfirmableActionTool for EditUserAccountTool {
    type Arguments = EditUserAccountArguments;
    type Facts = ();

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = serde_json::from_str(arguments).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {arguments}"),
                e
            )
        })?;

        let user_id = parse_required_uuid("user_id", &raw.user_id)?;

        let current_email = raw.current_email.trim().to_string();
        if current_email.is_empty() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "current_email must not be empty.".to_string()
            ));
        }

        let new_email_trimmed = raw.new_email.trim();
        let new_email = if new_email_trimmed.is_empty() {
            None
        } else {
            if !new_email_trimmed.contains('@') || new_email_trimmed.contains(char::is_whitespace) {
                return Err(chatbot_err!(
                    InvalidToolArguments,
                    format!("'{new_email_trimmed}' does not look like an email address.")
                ));
            }
            Some(new_email_trimmed.to_string())
        };

        let verification_change = match raw.mark_email_verified.as_str() {
            "" => VerificationChange::NoChange,
            "verify" => VerificationChange::Verify,
            "unverify" => VerificationChange::Unverify,
            other => {
                return Err(chatbot_err!(
                    InvalidToolArguments,
                    format!(
                        "Unknown mark_email_verified '{other}'. Valid values: '', 'verify', 'unverify'."
                    )
                ));
            }
        };

        if new_email.is_none() && matches!(verification_change, VerificationChange::NoChange) {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "Nothing to do: new_email is empty and mark_email_verified is empty.".to_string()
            ));
        }

        Ok(EditUserAccountArguments {
            user_id,
            current_email,
            new_email,
            verification_change,
        })
    }

    async fn execute(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: &Self::Arguments,
        _acting_user_id: Uuid,
    ) -> ChatbotResult<(ExecutedAction, Self::Facts)> {
        let user = users::get_active_by_id(conn, arguments.user_id)
            .await
            .map_err(|e| {
                chatbot_err!(
                    ToolUseError,
                    format!(
                        "No active account found with user_id {} (or it is deleted). Re-run find_user.",
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
            "current_email",
            &details.email,
            &arguments.current_email,
            "find_user",
        )?;

        let old_email = details.email.clone();
        let mut new_email_applied: Option<String> = None;

        if let Some(new_email) = &arguments.new_email {
            if let Some(other_user_id) =
                user_details::get_active_user_id_by_email_case_insensitive(conn, new_email).await?
            {
                if other_user_id != user.id {
                    return Err(chatbot_err!(
                        ToolUseError,
                        "Another account already uses this email address — likely a duplicate-account case; do not merge by email.".to_string()
                    ));
                }
            }

            users::update_email_for_user_by_id(conn, user.id, new_email).await?;
            new_email_applied = Some(new_email.clone());
        }

        // Must run after the email update: set_email_verified stamps the row's *current* email,
        // so verifying before an email change would verify the address being replaced.
        let verification_label = match arguments.verification_change {
            VerificationChange::NoChange => None,
            VerificationChange::Verify => {
                user_details::set_email_verified(
                    conn,
                    user.id,
                    EmailVerificationMethod::AdminAsserted,
                    Utc::now(),
                )
                .await?;
                Some("verified (admin-asserted)")
            }
            VerificationChange::Unverify => {
                user_details::clear_email_verified(conn, user.id).await?;
                Some("unverified")
            }
        };

        let displayed_new_email = new_email_applied.as_deref().unwrap_or(&old_email);
        let mut summary = if let Some(new_email) = &new_email_applied {
            format!("Changed email {old_email} → {new_email}")
        } else {
            format!("No email change for {old_email}")
        };
        if let Some(label) = verification_label {
            summary.push_str(&format!("; marked {label}"));
        }

        let mut output = format!(
            "Account updated for user {}: email {} → {}",
            user.id, old_email, displayed_new_email
        );
        if let Some(label) = verification_label {
            output.push_str(&format!("; email verification → {label}"));
        }
        output.push('.');

        Ok((
            ExecutedAction {
                output,
                client_payload: None,
                audit: ActionAuditFields {
                    target_user_id: Some(user.id),
                    course_id: None,
                    summary,
                },
            },
            (),
        ))
    }

    fn output_description_instructions(
        arguments: &Self::Arguments,
        _facts: Option<&Self::Facts>,
        app_config: &ApplicationConfiguration,
    ) -> Option<String> {
        let base_url = app_config.base_url.trim_end_matches('/');
        let mut notes = vec![
            "State the old and new values back to the admin. If the change was refused because the address belongs to another account, suggest comparing the two accounts' enrollments (user_overview) instead -- this tool cannot merge accounts and progress does not follow the address.".to_string(),
            format!(
                "No admin page can make this change -- this tool is the only way to edit another user's email or verification state -- so tell the admin to open {base_url}/manage/users/{} and confirm the address and the verification badge now read what you asked for.",
                arguments.user_id
            ),
        ];

        let email_changed = arguments.new_email.is_some();
        let verify_requested = matches!(arguments.verification_change, VerificationChange::Verify);
        if email_changed && !verify_requested {
            notes.push("Changing the email clears the account's verification automatically, so unless verify was also requested the account is now unverified and will be asked to re-confirm the address.".to_string());
        }
        if verify_requested {
            notes.push("Marking the email verified this way records the admin's own assertion, not proof the user controls the address -- the weakest of the platform's verification methods, and the user page shows only the verified badge and its timestamp, not the method, so this distinction is invisible there and this reply is the only record of it.".to_string());
        }
        if matches!(arguments.verification_change, VerificationChange::Unverify) {
            notes.push("Clearing verification breaks any flow gated on it (e.g. verification-only emails) -- don't do this casually.".to_string());
        }

        Some(notes.join(" "))
    }
}
