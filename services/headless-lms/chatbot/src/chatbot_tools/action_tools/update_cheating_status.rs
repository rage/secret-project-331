use indexmap::IndexMap;
use serde::Deserialize;
use sqlx::PgConnection;
use std::str::FromStr;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    courses, suspected_cheaters,
    suspected_cheaters::SuspectedCheaterStatus,
    user_details,
};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotToolDeclaration,
        action_tools::{ActionAuditFields, ConfirmableActionTool, ExecutedAction},
        tool_permission::ToolPermission,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, TryToOptional, chatbot_err},
};

/// Confirms or dismisses a `Flagged` suspected-cheater row. Only a `Flagged` row is actionable:
/// `ConfirmedCheating`/`Dismissed` are terminal states a support admin cannot re-decide here.
pub struct UpdateCheatingStatusTool;

/// Wire values for `decision`, internal to this tool: never crosses the API boundary as-is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CheatingDecision {
    Confirm,
    Dismiss,
}

pub struct UpdateCheatingStatusArguments {
    user_id: Uuid,
    course_id: Uuid,
    user_email: String,
    course_name: String,
    decision: CheatingDecision,
}

#[derive(Deserialize)]
struct RawArguments {
    user_id: String,
    course_id: String,
    user_email: String,
    course_name: String,
    decision: String,
}

impl ChatbotToolDeclaration for UpdateCheatingStatusTool {
    const NAME: &'static str = "update_cheating_status";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Confirm or dismiss a flagged suspected-cheating case for a user in a course. Suspends for the admin's confirmation before anything changes. Only applies to a case that is currently flagged (awaiting review); it refuses if the case was already confirmed or dismissed.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "user_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The user's id, as returned by find_user.".to_string()),
                        }),
                    ),
                    (
                        "course_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The course's id, as returned by find_course.".to_string()),
                        }),
                    ),
                    (
                        "user_email".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The user's current email, exactly as find_user returned it. Shown to the admin and checked against the account before anything changes.".to_string()),
                        }),
                    ),
                    (
                        "course_name".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The course's name, exactly as find_course returned it. Shown to the admin and checked against the course before anything changes.".to_string()),
                        }),
                    ),
                    (
                        "decision".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("Either 'confirm' (the student cheated; their completions in the course are failed) or 'dismiss' (the flag was a false alarm; any prior confirmation is undone).".to_string()),
                        }),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ConfirmableActionTool for UpdateCheatingStatusTool {
    type Arguments = UpdateCheatingStatusArguments;

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = serde_json::from_str(arguments).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {arguments}"),
                e
            )
        })?;

        let user_id = Uuid::from_str(&raw.user_id).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("'{}' is not a valid user_id.", raw.user_id),
                e
            )
        })?;
        let course_id = Uuid::from_str(&raw.course_id).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("'{}' is not a valid course_id.", raw.course_id),
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
        let course_name = raw.course_name.trim().to_string();
        if course_name.is_empty() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "course_name must not be empty.".to_string()
            ));
        }

        let decision = match raw.decision.as_str() {
            "confirm" => CheatingDecision::Confirm,
            "dismiss" => CheatingDecision::Dismiss,
            other => {
                return Err(chatbot_err!(
                    InvalidToolArguments,
                    format!("'{other}' is not a valid decision. Valid values: confirm, dismiss.")
                ));
            }
        };

        Ok(UpdateCheatingStatusArguments {
            user_id,
            course_id,
            user_email,
            course_name,
            decision,
        })
    }

    async fn execute(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: &Self::Arguments,
        _acting_user_id: Uuid,
    ) -> ChatbotResult<ExecutedAction> {
        let user_detail = user_details::get_user_details_by_user_id(conn, arguments.user_id)
            .await
            .optional()?
            .ok_or_else(|| {
                chatbot_err!(
                    InvalidToolArguments,
                    "The user no longer exists. Re-run find_user.".to_string()
                )
            })?;
        if !user_detail.email.eq_ignore_ascii_case(&arguments.user_email) {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "The email does not match the account. Re-run find_user and try again."
                    .to_string()
            ));
        }

        let course = courses::get_course(conn, arguments.course_id)
            .await
            .optional()?
            .ok_or_else(|| {
                chatbot_err!(
                    InvalidToolArguments,
                    "The course no longer exists. Re-run find_course.".to_string()
                )
            })?;
        if !course.name.eq_ignore_ascii_case(&arguments.course_name) {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "The course name does not match the course. Re-run find_course and try again."
                    .to_string()
            ));
        }

        let cheater = suspected_cheaters::get_by_user_id_and_course_id(
            conn,
            arguments.user_id,
            arguments.course_id,
        )
        .await
        .optional()?
        .ok_or_else(|| {
            chatbot_err!(
                InvalidToolArguments,
                "There is no suspected-cheating record for this user in this course.".to_string()
            )
        })?;

        if cheater.status != SuspectedCheaterStatus::Flagged {
            let status_name = match cheater.status {
                SuspectedCheaterStatus::Flagged => unreachable!("checked above"),
                SuspectedCheaterStatus::ConfirmedCheating => "already confirmed-cheating",
                SuspectedCheaterStatus::Dismissed => "already dismissed",
            };
            return Err(chatbot_err!(
                InvalidToolArguments,
                format!("This case is {status_name} -- nothing to decide.")
            ));
        }

        let (verb, consequence) = match arguments.decision {
            CheatingDecision::Confirm => {
                suspected_cheaters::confirm_cheater_by_user_id_and_course_id(
                    conn,
                    arguments.user_id,
                    arguments.course_id,
                )
                .await?;
                (
                    "confirmed",
                    "Their completions in this course have been failed.",
                )
            }
            CheatingDecision::Dismiss => {
                suspected_cheaters::dismiss_by_user_id_and_course_id(
                    conn,
                    arguments.user_id,
                    arguments.course_id,
                )
                .await?;
                (
                    "dismissed",
                    "Their completion, grade and certificate are visible to them again.",
                )
            }
        };

        Ok(ExecutedAction {
            output: format!(
                "The cheating flag for {} in {} was {verb}. {consequence}",
                arguments.user_email, arguments.course_name
            ),
            client_payload: None,
            audit: ActionAuditFields {
                target_user_id: Some(arguments.user_id),
                course_id: Some(arguments.course_id),
                summary: format!(
                    "Cheating flag {verb} for {} in {}",
                    arguments.user_email, arguments.course_name
                ),
            },
        })
    }

    fn output_description_instructions() -> Option<String> {
        Some(
            "Never put the suspicion into words meant for the student. After a dismissal, the student-visible effect is simply that their completion, grade and certificate become available -- describe it that way, not as a cheating suspicion being cleared."
                .to_string(),
        )
    }
}
