use std::str::FromStr;

use indexmap::IndexMap;
use sqlx::PgConnection;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{courses, exercises, user_details, users};
use headless_lms_utils::json_schema_types::{
    JSONType, JsonItem, Schema, SchemaPropertyType, string_array_property,
};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotToolDeclaration,
        action_tools::{ActionAuditFields, ConfirmableActionTool, ExecutedAction},
        tool_permission::ToolPermission,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
};

/// Resets a user's progress on selected exercises (or the whole course) after admin
/// confirmation. Confirmed answers run [Self::execute].
pub struct ResetExercisesTool;

pub struct ResetExercisesArguments {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub user_email: String,
    pub course_name: String,
    pub exercise_ids: Vec<Uuid>,
    pub exercise_names: Vec<String>,
    pub reason: String,
}

#[derive(serde::Deserialize)]
struct RawArguments {
    user_id: String,
    course_id: String,
    user_email: String,
    course_name: String,
    exercise_ids: Vec<String>,
    exercise_names: Vec<String>,
    reason: String,
}

impl ChatbotToolDeclaration for ResetExercisesTool {
    const NAME: &'static str = "reset_exercises";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Resets a user's progress on selected exercises in a course, after the admin confirms in the chat UI. Deletes the user's submissions, gradings, exercise states and peer-review queue entries for those exercises so they can be resubmitted. Requires global admin.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "user_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("UUID of the user whose exercises will be reset.".to_string()),
                        }),
                    ),
                    (
                        "course_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("UUID of the course the exercises belong to.".to_string()),
                        }),
                    ),
                    (
                        "user_email".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The user's current email, exactly as an earlier tool (e.g. find_user) returned it. Shown to the admin and checked against the account before resetting.".to_string()),
                        }),
                    ),
                    (
                        "course_name".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The course's current name, exactly as an earlier tool (e.g. find_course or course_configuration) returned it. Shown to the admin and checked against the course before resetting.".to_string()),
                        }),
                    ),
                    (
                        "exercise_ids".to_string(),
                        string_array_property(Some(
                            "UUIDs of the exercises to reset. Pass an empty array to reset every exercise in the course.",
                        )),
                    ),
                    (
                        "exercise_names".to_string(),
                        string_array_property(Some(
                            "Human-readable names matching exercise_ids one-to-one, shown to the admin in the confirmation. Pass an empty array when exercise_ids is empty.",
                        )),
                    ),
                    (
                        "reason".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("Why, e.g. the support ticket reference. Recorded in the reset log.".to_string()),
                        }),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ConfirmableActionTool for ResetExercisesTool {
    type Arguments = ResetExercisesArguments;

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
                format!("Invalid user_id: {}", raw.user_id),
                e
            )
        })?;
        let course_id = Uuid::from_str(&raw.course_id).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Invalid course_id: {}", raw.course_id),
                e
            )
        })?;

        if raw.exercise_names.len() != raw.exercise_ids.len() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "exercise_names must have the same length as exercise_ids.".to_string()
            ));
        }

        let mut exercise_ids = Vec::with_capacity(raw.exercise_ids.len());
        for id in &raw.exercise_ids {
            exercise_ids.push(Uuid::from_str(id).map_err(|e| {
                chatbot_err!(
                    InvalidToolArguments,
                    format!("Invalid exercise id: {id}"),
                    e
                )
            })?);
        }
        for name in &raw.exercise_names {
            if name.trim().is_empty() {
                return Err(chatbot_err!(
                    InvalidToolArguments,
                    "exercise_names entries must not be empty.".to_string()
                ));
            }
        }

        let reason = raw.reason.trim().to_string();
        if reason.is_empty() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "reason must not be empty.".to_string()
            ));
        }
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

        Ok(ResetExercisesArguments {
            user_id,
            course_id,
            user_email,
            course_name,
            exercise_ids,
            exercise_names: raw.exercise_names,
            reason,
        })
    }

    async fn execute(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: &Self::Arguments,
        acting_user_id: Uuid,
    ) -> ChatbotResult<ExecutedAction> {
        let user = users::get_active_by_id(conn, arguments.user_id)
            .await
            .map_err(|e| {
                chatbot_err!(
                    ToolUseError,
                    format!("No active user found with id {}.", arguments.user_id),
                    e
                )
            })?;
        let user_detail = user_details::get_user_details_by_user_id(conn, user.id)
            .await
            .map_err(|e| {
                chatbot_err!(
                    ToolUseError,
                    format!("No user details found for user {}.", user.id),
                    e
                )
            })?;
        if !user_detail
            .email
            .eq_ignore_ascii_case(&arguments.user_email)
        {
            return Err(chatbot_err!(
                ToolUseError,
                "user_email does not match the account on record. Re-run find_user to get the current email before retrying.".to_string()
            ));
        }

        let course = courses::get_course(conn, arguments.course_id)
            .await
            .map_err(|e| {
                chatbot_err!(
                    ToolUseError,
                    format!("No course found with id {}.", arguments.course_id),
                    e
                )
            })?;
        if !course.name.eq_ignore_ascii_case(&arguments.course_name) {
            return Err(chatbot_err!(
                ToolUseError,
                "course_name does not match the course on record. Re-run find_course to get the current name before retrying.".to_string()
            ));
        }

        let course_exercises = exercises::get_exercises_by_course_id(conn, course.id).await?;

        // A wrong or stale id/name pair refuses the action instead of resetting the wrong
        // exercise: mistargeting must never survive as a silent no-op or wrong mutation.
        let (exercise_ids, exercise_label) = if arguments.exercise_ids.is_empty() {
            (
                course_exercises.iter().map(|e| e.id).collect::<Vec<_>>(),
                "all exercises in the course".to_string(),
            )
        } else {
            for (id, name) in arguments.exercise_ids.iter().zip(&arguments.exercise_names) {
                match course_exercises.iter().find(|e| &e.id == id) {
                    Some(exercise) if exercise.name.eq_ignore_ascii_case(name) => {}
                    Some(exercise) => {
                        return Err(chatbot_err!(
                            ToolUseError,
                            format!(
                                "Exercise {id} is named '{}' in the course, not '{name}'. Re-run course_structure to get current names before retrying.",
                                exercise.name
                            )
                        ));
                    }
                    None => {
                        return Err(chatbot_err!(
                            ToolUseError,
                            format!("Exercise {id} does not belong to course {}.", course.id)
                        ));
                    }
                }
            }
            (
                arguments.exercise_ids.clone(),
                arguments.exercise_names.join(", "),
            )
        };

        let pairs = exercises::collect_user_ids_and_exercise_ids_for_reset(
            conn,
            &[user.id],
            &exercise_ids,
            None,
            false,
            false,
        )
        .await?;

        // Writes exercise_reset_logs itself; the generated execute_action_tool arm additionally
        // writes chatbot_action_logs, so this reset is audited in both places on purpose.
        let reset_results = exercises::reset_exercises_for_selected_users(
            conn,
            &pairs,
            Some(acting_user_id),
            course.id,
            Some(format!("reset-by-support-chatbot: {}", arguments.reason)),
        )
        .await?;
        let reset_count: usize = reset_results.iter().map(|(_, exs)| exs.len()).sum();

        Ok(ExecutedAction {
            output: format!(
                "{reset_count} exercises were reset for {} in {}: {exercise_label}. The user can now resubmit them.",
                user_detail.email, course.name
            ),
            client_payload: None,
            audit: ActionAuditFields {
                target_user_id: Some(user.id),
                course_id: Some(course.id),
                summary: format!(
                    "Reset {reset_count} exercises for {} in {} (reason: {})",
                    user_detail.email, course.name, arguments.reason
                ),
            },
        })
    }

    fn output_description_instructions() -> Option<String> {
        Some(
            "Confirm to the admin what was reset and remind them the user's previous submissions and points for those exercises are gone."
                .to_string(),
        )
    }
}
