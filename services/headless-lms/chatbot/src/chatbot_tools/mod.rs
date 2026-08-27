use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, AzureLLMToolDefinition},
    chatbot_tools::{
        action_tools::{
            ConfirmAnswer, ConfirmableActionTool, edit_user_account::EditUserAccountTool,
            generate_password_reset_link::GeneratePasswordResetLinkTool,
            reset_exercises::ResetExercisesTool, update_cheating_status::UpdateCheatingStatusTool,
        },
        client_tools::ask_multiple_choice_question::AskMultipleChoiceQuestionTool,
        custom_tools::{
            course_configuration::CourseConfigurationTool, course_finder::CourseFinderTool,
            course_material_search::CourseMaterialSearchTool, course_progress::CourseProgressTool,
            course_structure::CourseStructureTool, document_lookup::DocumentLookupTool,
            find_course::FindCourseTool, find_user::FindUserTool,
            user_course_state::UserCourseStateTool, user_overview::UserOverviewTool,
        },
        tool_authorization::{ToolRequirement, authorize_tool_call, requirements_are_satisfied},
    },
    prelude::*,
    user_context::ChatbotTurnContext,
};
use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_utils::json_schema_types::Schema;
use indexmap::IndexMap;
use serde::de::DeserializeOwned;
use utoipa::ToSchema;

pub mod action_tools;
pub mod argument_parsing;
pub mod client_tools;
pub mod course_scope;
pub mod custom_tools;
pub mod provider_tools;
pub mod tool_authorization;
pub mod tool_category;

/// What a tool is called and how it is declared to the LLM.
///
/// Shared by the tools the server runs ([ChatbotTool]) and the tools the client answers
/// ([ClientChatbotTool]): the two differ in who produces the output, not in how the tool is
/// advertised.
pub trait ChatbotToolDeclaration {
    /// The name the LLM calls this tool by. The registries dispatch on it and
    /// [Self::get_tool_definition] must advertise it, so the two cannot drift apart.
    const NAME: &'static str;

    /// What the caller must be allowed to do against the turn itself for this tool to be offered
    /// to the LLM at all.
    ///
    /// Coarse on purpose: no call has named a target yet, so this asks about the chatbot's own
    /// course (or global permissions for a chatbot with none). The binding check is the tool's
    /// `call_requirements`, against what the call actually targets. Empty for a tool the
    /// chatbot's own access check already covers.
    fn offer_requirements(user_context: &ChatbotTurnContext) -> Vec<ToolRequirement>;

    /// Which configured category of tools this belongs to. A chatbot offers it only if its
    /// configuration lists this category; the caller must still be authorized for it.
    const CATEGORY: ToolCategory;

    /// The definition sent to the LLM as part of a chat request. Azure rejects it unless `strict`
    /// is true and the parameter schema forbids additional properties.
    fn get_tool_definition() -> AzureLLMFunctionToolDefinition;
}

pub trait ChatbotTool: ChatbotToolDeclaration {
    type Arguments: DeserializeOwned;

    /// What the caller must be allowed to do against what this call actually targets.
    ///
    /// The model picks the target, so this is the check that binds; the tool must name every
    /// resource the call touches, since all of them are required. `user_context` is here for the
    /// tools whose arguments name a target only by omission, leaving it to default to the
    /// chatbot's own course.
    fn call_requirements(
        arguments: &Self::Arguments,
        user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement>;

    /// Parses and validates the arguments the LLM called the tool with.
    ///
    /// The LLM is free to emit values the schema forbids, so every constraint the tool body
    /// relies on has to be rejected here rather than assumed; the derived deserialization the
    /// default body does is only as strict as the argument type. Fails with
    /// [ChatbotErrorType::InvalidToolArguments], which is reported to the LLM.
    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        serde_json::from_str(&args_string).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {args_string}"),
                e
            )
        })
    }

    /// Create a new instance after parsing arguments
    fn from_db_and_arguments(
        conn: &mut PgConnection,
        app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        user_context: &ChatbotTurnContext,
    ) -> impl std::future::Future<Output = ChatbotResult<Self>> + Send
    where
        Self: Sized;

    /// Output the result of the tool call in LLM-readable form
    fn output(&self) -> String;

    /// Page references this call's output cites, numbered as the tool told the model to cite
    /// them. Empty for a tool whose output is not quotable material.
    fn citations(&self) -> Vec<ToolCitation> {
        Vec::new()
    }

    /// Additional instructions for the LLM on how to describe and
    /// communicate the tool output. Just-in-time prompt.
    fn output_description_instructions(&self) -> Option<String>;

    /// Get and format tool output and instructions for LLM
    fn get_tool_output(&self) -> String {
        let output = self.output();

        match self.output_description_instructions() {
            Some(instructions) => delimited_tool_output(&output, Some(&instructions)),
            None => output,
        }
    }
}

/// What a client answered a tool call with.
///
/// The tool the call belongs to decides what shape the answer has to be in and what the model is
/// told it means.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(tag = "type", content = "data")]
pub enum ClientToolAnswer {
    /// The tool ran on the client. `result` is JSON of whatever shape the tool defines.
    Data {
        /// An untyped object in the OpenApi schema: the shape belongs to the tool, so it is not
        /// known here. Unlike the tool call arguments we hand back to clients, this one is built
        /// by the client, so declaring it a string would make the generated binding unusable.
        #[schema(value_type = Object)]
        result: serde_json::Value,
    },
}

/// The name of a client tool, generated into the frontend as a string union so it names one of
/// [ClientChatbotTool::NAME] by construction instead of by a hand-copied literal.
///
/// The bounds a tool enforces on its arguments and the shape of its answer stay hand-written on
/// the frontend: routing those through the OpenAPI schema would need either a schema per tool or
/// widening the argument and answer types this crate uses to serialize them, for a part of the
/// contract that only fails loudly, unlike the name.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ClientToolName {
    AskMultipleChoiceQuestion,
    GeneratePasswordResetLink,
    ResetExercises,
    UpdateCheatingStatus,
    EditUserAccount,
}

impl ClientToolName {
    /// The wire name [ChatbotToolDeclaration::NAME] must equal for the tool this variant names.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::AskMultipleChoiceQuestion => "ask_multiple_choice_question",
            Self::GeneratePasswordResetLink => "generate_password_reset_link",
            Self::ResetExercises => "reset_exercises",
            Self::UpdateCheatingStatus => "update_cheating_status",
            Self::EditUserAccount => "edit_user_account",
        }
    }
}

/// A tool whose output the client produces instead of server code.
///
/// The LLM calls it like any other tool, but the turn suspends: the call is recorded without an
/// output, the client answers it through the tool-response endpoint, and that answer becomes the
/// output the resumed turn reads.
pub trait ClientChatbotTool: ChatbotToolDeclaration {
    /// The arguments of a call, as [Self::parse_arguments] has validated them.
    type Arguments;

    /// The client's answer, as [Self::parse_response] has checked it against the call.
    type Response;

    /// What the caller must be allowed to do against what this call actually targets. Checked
    /// before the turn suspends on the call and again when its answer arrives.
    fn call_requirements(
        arguments: &Self::Arguments,
        user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement>;

    /// Parses and validates the arguments the LLM called the tool with.
    ///
    /// The LLM is free to emit values the schema forbids, so every constraint the client and the
    /// rendering rely on has to be rejected here rather than assumed. Fails with
    /// [ChatbotErrorType::InvalidToolArguments], which is reported to the LLM.
    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments>;

    /// Parses the client's answer to a call made with `arguments`.
    ///
    /// The answer decides what the model is told the user said, so an implementor must check it
    /// against what `arguments` actually offered instead of trusting the client to keep to it.
    /// Fails with [ChatbotErrorType::InvalidToolAnswer], the one chatbot error the client is
    /// told about.
    fn parse_response(
        arguments: &Self::Arguments,
        answer: &ClientToolAnswer,
    ) -> ChatbotResult<Self::Response>;

    /// The answer in LLM-readable form.
    fn output(arguments: &Self::Arguments, response: &Self::Response) -> String;

    /// Just-in-time instructions for the LLM on what to do with the answer.
    fn output_description_instructions() -> Option<String>;

    /// The tool output the resumed turn reads, with the answer delimited from the instructions
    /// about it.
    fn get_tool_output(arguments: &Self::Arguments, response: &Self::Response) -> String {
        delimited_tool_output(
            &Self::output(arguments, response),
            Self::output_description_instructions().as_deref(),
        )
    }
}

/// The data a client answered with, as the tool's own response shape.
pub fn client_answer_data<T: DeserializeOwned>(answer: &ClientToolAnswer) -> ChatbotResult<T> {
    let ClientToolAnswer::Data { result } = answer;
    serde_json::from_value(result.clone()).map_err(|e| {
        chatbot_err!(
            InvalidToolAnswer,
            "The answer is not in the shape this tool call expects.".to_string(),
            e
        )
    })
}

/// Wraps tool output for the LLM so that data from outside the conversation cannot be read as
/// instructions about it.
fn delimited_tool_output(output: &str, instructions: Option<&str>) -> String {
    let mut formatted = format!("Result: [output]{output}[/output]");
    if let Some(instructions) = instructions {
        formatted.push_str(&format!(
            "\n\nInstructions for describing the output: [instructions]{instructions}[/instructions]"
        ));
    }
    formatted
}

/// The parameter schema of a tool the LLM calls without arguments. Azure still requires a strict
/// object schema that forbids additional properties.
pub fn no_parameters() -> Schema {
    Schema::strict_object(IndexMap::new(), None)
}

/// The function definitions of a tool list, dropping the provider's own tools, which have no name
/// of their own to dispatch on.
#[cfg(test)]
fn function_definitions(
    definitions: Vec<AzureLLMToolDefinition>,
) -> Vec<AzureLLMFunctionToolDefinition> {
    definitions
        .into_iter()
        .filter_map(|definition| match definition {
            AzureLLMToolDefinition::Function(function) => Some(function),
            AzureLLMToolDefinition::Search(_) => None,
        })
        .collect()
}

pub struct ToolProperties<S> {
    state: S,
}

pub struct ChatbotToolCallResult {
    /// The arguments the tool was called with, as JSON, persisted with the function call message.
    pub arguments: String,
    pub output: String,
    pub citations: Vec<ToolCitation>,
}

/// Why a client tool call cannot go ahead, when the client's answer to it (or the plan to suspend
/// on it) has to become an explanation for the model rather than an error.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum ClientToolCallRefusal {
    /// The chatbot's configuration no longer offers this kind of tool.
    CategoryDisabled,
    /// The caller may not make this call against what it targets.
    NotAuthorized,
}

/// What executing a confirmed (or declining an unconfirmed) action tool call produced.
pub struct ActionToolOutcome {
    /// The tool output the resumed turn reads.
    pub output: String,
    /// The data the confirming admin's browser gets as an [ActionExecuted] stream event, never
    /// persisted and never shown to the model. `None` for a decline.
    ///
    /// [ActionExecuted]: crate::azure_chatbot::events::ChatbotChatStreamEvent::ActionExecuted
    pub client_payload: Option<serde_json::Value>,
}

/// One page reference a tool call's output cites, ready to become a
/// [headless_lms_models::chatbot_conversation_messages_citations::ChatbotConversationMessageCitation]
/// row once the message it was attached beside is stored.
pub struct ToolCitation {
    pub page_id: Uuid,
    pub title: String,
    pub snippet: String,
    pub document_url: String,
    pub citation_number: i32,
}

/// Defines the chatbot tools the LLM can call, split by who produces the output of a call.
///
/// Both registries are generated from this one list: the definitions offered to the LLM, the
/// dispatcher that runs a server tool, the check that decides a call suspends the turn instead,
/// what a tool requires of its caller and the rendering of a client's answer. A tool therefore
/// cannot be advertised without being callable, and a tool's kind is stated in one place rather
/// than implied by which list it was pasted into.
macro_rules! chatbot_tool_registry {
    (
        server_tools: [$($server_tool:ty),* $(,)?],
        client_tools: [$($client_tool:ty),* $(,)?],
        action_tools: [$($action_tool:ty),* $(,)?] $(,)?
    ) => {
        /// Every tool the server runs, whoever is allowed to use it.
        ///
        /// For callers that only need the listing. Use [get_permitted_chatbot_tool_definitions]
        /// to decide what a request may offer the LLM.
        pub fn get_chatbot_tool_definitions() -> Vec<AzureLLMToolDefinition> {
            vec![
                $(AzureLLMToolDefinition::Function(<$server_tool as ChatbotToolDeclaration>::get_tool_definition()),)*
            ]
        }

        /// The server tool definitions this request may offer the LLM.
        ///
        /// A tool is offered only to a caller who passes its offer requirements, and the roles
        /// that decides are fetched at most once for the whole request. Offering is not a
        /// promise: what a call may target is decided again when it is made.
        pub async fn get_permitted_chatbot_tool_definitions(
            conn: &mut PgConnection,
            user_context: &ChatbotTurnContext,
        ) -> ChatbotResult<Vec<AzureLLMToolDefinition>> {
            let mut definitions = Vec::new();
            $(
                if user_context.enabled_tool_categories.contains(<$server_tool as ChatbotToolDeclaration>::CATEGORY)
                    && requirements_are_satisfied(
                        &mut *conn,
                        user_context,
                        &<$server_tool as ChatbotToolDeclaration>::offer_requirements(user_context),
                    )
                    .await?
                {
                    definitions.push(AzureLLMToolDefinition::Function(
                        <$server_tool as ChatbotToolDeclaration>::get_tool_definition(),
                    ));
                }
            )*
            Ok(definitions)
        }

        /// Run the chatbot tool the LLM asked for and return its arguments and its
        /// LLM-readable output.
        ///
        /// `fn_args` is the raw argument JSON from the LLM; each tool parses it itself and
        /// tools that take no arguments ignore it. Arguments are parsed before the caller is
        /// authorized, because what the call targets is what decides the answer. Fails with
        /// `InvalidToolName` when no tool claims `fn_name`, which happens when the LLM
        /// hallucinates a tool.
        pub async fn call_chatbot_tool(
            conn: &mut PgConnection,
            app_config: &ApplicationConfiguration,
            fn_name: &str,
            fn_args: &str,
            user_context: &ChatbotTurnContext,
        ) -> ChatbotResult<ChatbotToolCallResult> {
            $(
                if fn_name == <$server_tool as ChatbotToolDeclaration>::NAME {
                    if !user_context.enabled_tool_categories.contains(<$server_tool as ChatbotToolDeclaration>::CATEGORY) {
                        return Err(chatbot_err!(
                            ToolUseError,
                            format!("This chatbot does not offer the tool {fn_name}")
                        ));
                    }
                    let arguments = <$server_tool as ChatbotTool>::parse_arguments(fn_args.to_owned())?;
                    if !requirements_are_satisfied(
                        &mut *conn,
                        user_context,
                        &<$server_tool as ChatbotTool>::call_requirements(&arguments, user_context),
                    )
                    .await?
                    {
                        return Err(chatbot_err!(
                            ToolUseError,
                            format!("The caller is not allowed to use the tool {fn_name}")
                        ));
                    }
                    let tool = <$server_tool as ChatbotTool>::from_db_and_arguments(&mut *conn, app_config, arguments, user_context).await?;
                    return Ok(ChatbotToolCallResult {
                        arguments: fn_args.to_owned(),
                        output: tool.get_tool_output(),
                        citations: tool.citations(),
                    });
                }
            )*
            Err(chatbot_err!(
                InvalidToolName,
                format!("Incorrect or unknown function name: {fn_name}")
            ))
        }

        /// The client tool definitions this request may offer the LLM.
        ///
        /// A tool is offered only to a caller who passes its offer requirements, and the roles
        /// that decides are fetched at most once for the whole request. Offering is not a
        /// promise: what a call may target is decided again when it is made.
        pub async fn get_client_chatbot_tool_definitions(
            conn: &mut PgConnection,
            user_context: &ChatbotTurnContext,
        ) -> ChatbotResult<Vec<AzureLLMToolDefinition>> {
            let mut definitions = Vec::new();
            $(
                if user_context.enabled_tool_categories.contains(<$client_tool as ChatbotToolDeclaration>::CATEGORY)
                    && requirements_are_satisfied(
                        &mut *conn,
                        user_context,
                        &<$client_tool as ChatbotToolDeclaration>::offer_requirements(user_context),
                    )
                    .await?
                {
                    definitions.push(AzureLLMToolDefinition::Function(
                        <$client_tool as ChatbotToolDeclaration>::get_tool_definition(),
                    ));
                }
            )*
            $(
                if user_context.enabled_tool_categories.contains(<$action_tool as ChatbotToolDeclaration>::CATEGORY)
                    && requirements_are_satisfied(
                        &mut *conn,
                        user_context,
                        &<$action_tool as ChatbotToolDeclaration>::offer_requirements(user_context),
                    )
                    .await?
                {
                    definitions.push(AzureLLMToolDefinition::Function(
                        <$action_tool as ChatbotToolDeclaration>::get_tool_definition(),
                    ));
                }
            )*
            Ok(definitions)
        }

        /// Whether the client answers this tool call instead of server code, which is what decides
        /// that the turn suspends rather than answering the call itself.
        ///
        /// The one place that knowledge lives, so the stored `tool_kind` and the engine cannot
        /// disagree. A name no client tool claims is left to the server dispatcher, which reports
        /// a hallucinated name to the LLM instead of suspending on it.
        pub fn tool_is_answered_by_client(tool_name: &str) -> bool {
            client_tool_category(tool_name).is_some()
        }

        /// Checks that a client tool call can go ahead: its arguments parse, and its caller may
        /// make it against what those arguments target.
        ///
        /// Called both before the turn suspends on the call and when its answer arrives, since
        /// nothing bounds how long a call waits and a role can be revoked while it does. A
        /// [ClientToolCallRefusal] is not a failure: the caller turns it into an explanation the
        /// model reads, because the turn stays stuck until its call has some output.
        ///
        /// Fails with [ChatbotErrorType::InvalidToolArguments] for a call the tool would reject,
        /// which can never be answered and so has to fail while the turn can still report it to
        /// the LLM, and with [ChatbotErrorType::InvalidToolName] when no client tool goes by
        /// `tool_name`.
        pub async fn check_client_tool_call(
            conn: &mut PgConnection,
            user_context: &ChatbotTurnContext,
            tool_name: &str,
            arguments: &str,
        ) -> ChatbotResult<Result<(), ClientToolCallRefusal>> {
            $(
                if tool_name == <$client_tool as ChatbotToolDeclaration>::NAME {
                    if !user_context.enabled_tool_categories.contains(<$client_tool as ChatbotToolDeclaration>::CATEGORY) {
                        return Ok(Err(ClientToolCallRefusal::CategoryDisabled));
                    }
                    let arguments = <$client_tool as ClientChatbotTool>::parse_arguments(arguments)?;
                    let authorized = requirements_are_satisfied(
                        conn,
                        user_context,
                        &<$client_tool as ClientChatbotTool>::call_requirements(&arguments, user_context),
                    )
                    .await?;
                    return Ok(if authorized { Ok(()) } else { Err(ClientToolCallRefusal::NotAuthorized) });
                }
            )*
            $(
                if tool_name == <$action_tool as ChatbotToolDeclaration>::NAME {
                    if !user_context.enabled_tool_categories.contains(<$action_tool as ChatbotToolDeclaration>::CATEGORY) {
                        return Ok(Err(ClientToolCallRefusal::CategoryDisabled));
                    }
                    let arguments = <$action_tool as ConfirmableActionTool>::parse_arguments(arguments)?;
                    let authorized = requirements_are_satisfied(
                        conn,
                        user_context,
                        &<$action_tool as ConfirmableActionTool>::call_requirements(&arguments, user_context),
                    )
                    .await?;
                    return Ok(if authorized { Ok(()) } else { Err(ClientToolCallRefusal::NotAuthorized) });
                }
            )*
            Err(chatbot_err!(
                InvalidToolName,
                format!("No client tool is registered under the name {tool_name}")
            ))
        }

        /// The category a client tool (including an action tool) belongs to, or `None` when no
        /// client-answered tool goes by that name.
        pub fn client_tool_category(tool_name: &str) -> Option<ToolCategory> {
            $(
                if tool_name == <$client_tool as ChatbotToolDeclaration>::NAME {
                    return Some(<$client_tool as ChatbotToolDeclaration>::CATEGORY);
                }
            )*
            $(
                if tool_name == <$action_tool as ChatbotToolDeclaration>::NAME {
                    return Some(<$action_tool as ChatbotToolDeclaration>::CATEGORY);
                }
            )*
            None
        }

        /// Whether `tool_name` is a [ConfirmableActionTool] rather than a pure
        /// [ClientChatbotTool]: its answer runs a mutation through [execute_action_tool] instead
        /// of being rendered directly by [client_tool_answer_output].
        pub fn tool_is_confirmable_action(tool_name: &str) -> bool {
            $(
                if tool_name == <$action_tool as ChatbotToolDeclaration>::NAME {
                    return true;
                }
            )*
            false
        }

        /// Runs the confirmed (or records the declined) action tool call the LLM asked for.
        ///
        /// `tool_call`'s row id is stored on the audit row so it traces back to the conversation.
        /// The tool's category and its call requirements are both re-checked here, immediately
        /// before the mutation, rather than trusted from whatever planned the call: the proof
        /// [ConfirmableActionTool::execute] requires can only be minted by that check.
        ///
        /// Fails with [ChatbotErrorType::InvalidToolAnswer] when `answer` is not a
        /// [ConfirmAnswer], with [ChatbotErrorType::ToolUseError] when the caller may no longer
        /// use the tool, and with [ChatbotErrorType::InvalidToolName] when no action tool goes by
        /// `tool_call`'s name. A declined answer never touches the database beyond what the
        /// caller writes for the closed call itself, and needs no authorization of its own.
        pub async fn execute_action_tool(
            conn: &mut PgConnection,
            app_config: &ApplicationConfiguration,
            tool_call: &headless_lms_models::chatbot_conversation_message_tool_calls::ChatbotConversationMessageToolCall,
            answer: &ClientToolAnswer,
            user_context: &ChatbotTurnContext,
        ) -> ChatbotResult<ActionToolOutcome> {
            let tool_name = tool_call.tool_name.as_str();
            let arguments = &tool_call.arguments_json();
            let tool_call_id = tool_call.id;
            $(
                if tool_name == <$action_tool as ChatbotToolDeclaration>::NAME {
                    if !user_context.enabled_tool_categories.contains(<$action_tool as ChatbotToolDeclaration>::CATEGORY) {
                        return Err(chatbot_err!(
                            ToolUseError,
                            format!("This chatbot does not offer the tool {tool_name}")
                        ));
                    }
                    let parsed_arguments =
                        <$action_tool as ConfirmableActionTool>::parse_arguments(arguments)?;
                    let confirm: ConfirmAnswer = client_answer_data(answer)?;

                    if !confirm.confirmed {
                        let instructions = <$action_tool as ConfirmableActionTool>::output_description_instructions(
                            &parsed_arguments,
                            None,
                            app_config,
                        );
                        return Ok(ActionToolOutcome {
                            output: delimited_tool_output(
                                &<$action_tool as ConfirmableActionTool>::declined_output(&parsed_arguments),
                                instructions.as_deref(),
                            ),
                            client_payload: None,
                        });
                    }

                    let Some(authorization) = authorize_tool_call::<$action_tool>(
                        &mut *conn,
                        user_context,
                        &<$action_tool as ConfirmableActionTool>::call_requirements(&parsed_arguments, user_context),
                    )
                    .await?
                    else {
                        return Err(chatbot_err!(
                            ToolUseError,
                            format!("The caller is not allowed to use the tool {tool_name}")
                        ));
                    };
                    let acting_user_id = authorization.acting_user_id();

                    let (executed, facts) = <$action_tool as ConfirmableActionTool>::execute(
                        &mut *conn,
                        app_config,
                        &parsed_arguments,
                        &authorization,
                    )
                    .await?;
                    let instructions = <$action_tool as ConfirmableActionTool>::output_description_instructions(
                        &parsed_arguments,
                        Some(&facts),
                        app_config,
                    );

                    headless_lms_models::chatbot_action_logs::insert(
                        &mut *conn,
                        headless_lms_models::chatbot_action_logs::NewChatbotActionLog {
                            acting_user_id,
                            tool_call_id,
                            tool_name: tool_name.to_string(),
                            arguments: serde_json::from_str(arguments)
                                .unwrap_or(serde_json::Value::String(arguments.to_string())),
                            target_user_id: executed.audit.target_user_id,
                            course_id: executed.audit.course_id,
                            summary: executed.audit.summary,
                        },
                    )
                    .await?;

                    return Ok(ActionToolOutcome {
                        output: delimited_tool_output(&executed.output, instructions.as_deref()),
                        client_payload: executed.client_payload,
                    });
                }
            )*
            Err(chatbot_err!(
                InvalidToolName,
                format!("No action tool is registered under the name {tool_name}")
            ))
        }

        /// Turns a client's answer into the tool output the resumed turn reads.
        ///
        /// `arguments` is the argument JSON the suspended call was recorded with, re-validated
        /// here because the answer is only meaningful against what was actually offered. Fails
        /// with [ChatbotErrorType::InvalidToolAnswer] when the answer does not fit the call, and
        /// with [ChatbotErrorType::InvalidToolName] when no client tool goes by `tool_name`.
        pub fn client_tool_answer_output(
            tool_name: &str,
            arguments: &str,
            answer: &ClientToolAnswer,
        ) -> ChatbotResult<String> {
            $(
                if tool_name == <$client_tool as ChatbotToolDeclaration>::NAME {
                    let arguments = <$client_tool as ClientChatbotTool>::parse_arguments(arguments)?;
                    let response = <$client_tool as ClientChatbotTool>::parse_response(&arguments, answer)?;
                    return Ok(<$client_tool as ClientChatbotTool>::get_tool_output(&arguments, &response));
                }
            )*
            Err(chatbot_err!(
                InvalidToolName,
                format!("No client tool is registered under the name {tool_name}")
            ))
        }
    };
}

chatbot_tool_registry!(
    server_tools: [
        CourseProgressTool,
        DocumentLookupTool,
        CourseStructureTool,
        CourseFinderTool,
        FindUserTool,
        FindCourseTool,
        UserOverviewTool,
        UserCourseStateTool,
        CourseConfigurationTool,
        CourseMaterialSearchTool,
    ],
    client_tools: [AskMultipleChoiceQuestionTool],
    action_tools: [
        GeneratePasswordResetLinkTool,
        ResetExercisesTool,
        UpdateCheatingStatusTool,
        EditUserAccountTool,
    ],
);

/// A second registry, generated from tools that exist only here.
///
/// The one real client tool is offered to everyone, so the generated authorization filter can
/// only be seen letting a tool through. This registry has a tool it keeps out.
#[cfg(test)]
// The empty server list generates a server half that nothing here calls.
#[allow(dead_code, unused_variables, unused_mut)]
mod generated_filter_tests {
    use crate::azure_chatbot::azure::tools::LLMToolType;
    use headless_lms_models::{
        insert_data,
        roles::UserRole,
        test_helper::{Conn, init_app_conf},
    };

    use super::*;
    use crate::chatbot_tools::tool_authorization::test_helpers::{
        context, context_with_categories, course_role,
    };

    struct OpenTool;
    struct TeacherTool;

    fn definition(name: &str) -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: name.to_string(),
            description: "A tool that exists only in this test".to_string(),
            parameters: no_parameters(),
            strict: true,
        }
    }

    impl ChatbotToolDeclaration for OpenTool {
        const NAME: &'static str = "open_tool";
        const CATEGORY: ToolCategory = ToolCategory::Interaction;

        fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
            Vec::new()
        }

        fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
            definition(Self::NAME)
        }
    }

    impl ClientChatbotTool for OpenTool {
        type Arguments = ();
        type Response = ();

        fn call_requirements(
            _arguments: &(),
            _user_context: &ChatbotTurnContext,
        ) -> Vec<ToolRequirement> {
            Vec::new()
        }

        fn parse_arguments(_arguments: &str) -> ChatbotResult<()> {
            Ok(())
        }

        fn parse_response(_arguments: &(), _answer: &ClientToolAnswer) -> ChatbotResult<()> {
            Ok(())
        }

        fn output(_arguments: &(), _response: &()) -> String {
            "answered".to_string()
        }

        fn output_description_instructions() -> Option<String> {
            None
        }
    }

    impl ChatbotToolDeclaration for TeacherTool {
        const NAME: &'static str = "teacher_tool";
        const CATEGORY: ToolCategory = ToolCategory::Interaction;

        fn offer_requirements(user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
            vec![ToolRequirement::on_turn(
                headless_lms_authorization::Action::Teach,
                user_context,
            )]
        }

        fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
            definition(Self::NAME)
        }
    }

    impl ClientChatbotTool for TeacherTool {
        type Arguments = ();
        type Response = ();

        fn call_requirements(
            _arguments: &(),
            _user_context: &ChatbotTurnContext,
        ) -> Vec<ToolRequirement> {
            Vec::new()
        }

        fn parse_arguments(_arguments: &str) -> ChatbotResult<()> {
            Ok(())
        }

        fn parse_response(_arguments: &(), _answer: &ClientToolAnswer) -> ChatbotResult<()> {
            Ok(())
        }

        fn output(_arguments: &(), _response: &()) -> String {
            "answered".to_string()
        }

        fn output_description_instructions() -> Option<String> {
            None
        }
    }

    /// Requires nothing, but sits in a category distinct from [OpenTool]/[TeacherTool] — proves
    /// the category filter keeps an authorized tool out on its own.
    struct UncategorizedTool;

    impl ChatbotToolDeclaration for UncategorizedTool {
        const NAME: &'static str = "uncategorized_tool";
        const CATEGORY: ToolCategory = ToolCategory::AdminSupportAccounts;

        fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
            Vec::new()
        }

        fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
            definition(Self::NAME)
        }
    }

    impl ClientChatbotTool for UncategorizedTool {
        type Arguments = ();
        type Response = ();

        fn call_requirements(
            _arguments: &(),
            _user_context: &ChatbotTurnContext,
        ) -> Vec<ToolRequirement> {
            Vec::new()
        }

        fn parse_arguments(_arguments: &str) -> ChatbotResult<()> {
            Ok(())
        }

        fn parse_response(_arguments: &(), _answer: &ClientToolAnswer) -> ChatbotResult<()> {
            Ok(())
        }

        fn output(_arguments: &(), _response: &()) -> String {
            "answered".to_string()
        }

        fn output_description_instructions() -> Option<String> {
            None
        }
    }

    chatbot_tool_registry!(
        server_tools: [],
        client_tools: [OpenTool, TeacherTool, UncategorizedTool],
        action_tools: [],
    );

    async fn offered(conn: &mut PgConnection, user_context: &ChatbotTurnContext) -> Vec<String> {
        function_definitions(
            get_client_chatbot_tool_definitions(conn, user_context)
                .await
                .expect("the offered tools are decided"),
        )
        .into_iter()
        .map(|definition| definition.name)
        .collect()
    }

    /// The registry's mappings all come from its one list, so a tool that is in the list is in
    /// every one of them.
    #[tokio::test]
    async fn every_mapping_covers_every_tool_in_the_list() {
        insert_data!(:tx, :user, :org, :course);
        let admin = context(
            Some(user),
            Some(course),
            vec![
                crate::chatbot_tools::tool_authorization::test_helpers::global_role(
                    user,
                    UserRole::Admin,
                ),
            ],
        );

        for name in [OpenTool::NAME, TeacherTool::NAME, UncategorizedTool::NAME] {
            assert!(tool_is_answered_by_client(name), "{name}");
            assert_eq!(
                check_client_tool_call(tx.as_mut(), &admin, name, "{}")
                    .await
                    .unwrap_or_else(|e| panic!("{name}: {e:?}")),
                Ok(()),
                "{name}"
            );
            assert!(client_tool_category(name).is_some(), "{name}");
        }
        assert_eq!(
            check_client_tool_call(tx.as_mut(), &admin, "open_tool_but_misspelled", "{}")
                .await
                .expect_err("no tool goes by that name")
                .error_type(),
            &ChatbotErrorType::InvalidToolName
        );
        assert_eq!(
            client_tool_category(OpenTool::NAME),
            Some(ToolCategory::Interaction)
        );
        assert_eq!(
            client_tool_category(UncategorizedTool::NAME),
            Some(ToolCategory::AdminSupportAccounts)
        );
        assert!(client_tool_category("open_tool_but_misspelled").is_none());

        let rendered = client_tool_answer_output(
            OpenTool::NAME,
            "{}",
            &ClientToolAnswer::Data {
                result: serde_json::json!({}),
            },
        )
        .expect("the answer renders");
        assert!(rendered.contains("answered"), "{rendered}");
    }

    #[tokio::test]
    async fn a_tool_is_kept_from_a_caller_who_is_not_authorized_for_it() {
        insert_data!(:tx, :user, :org, :course);

        let anonymous = context(None, Some(course), Vec::new());
        assert_eq!(
            offered(tx.as_mut(), &anonymous).await,
            vec![
                OpenTool::NAME.to_string(),
                UncategorizedTool::NAME.to_string()
            ],
            "an anonymous caller is offered only what needs no privileges"
        );

        let learner = context(Some(user), Some(course), Vec::new());
        assert_eq!(
            offered(tx.as_mut(), &learner).await,
            vec![
                OpenTool::NAME.to_string(),
                UncategorizedTool::NAME.to_string()
            ]
        );

        let teacher = context(
            Some(user),
            Some(course),
            vec![course_role(user, course, UserRole::Teacher)],
        );
        assert_eq!(
            offered(tx.as_mut(), &teacher).await,
            vec![
                OpenTool::NAME.to_string(),
                TeacherTool::NAME.to_string(),
                UncategorizedTool::NAME.to_string()
            ]
        );
    }

    /// The category filter keeps an authorized tool out on its own: [UncategorizedTool] requires
    /// nothing of its caller, but its category is not in the enabled set.
    #[tokio::test]
    async fn a_tool_is_kept_from_a_configuration_that_does_not_enable_its_category() {
        insert_data!(:tx, :user, :org, :course);

        let interaction_only = context_with_categories(
            Some(user),
            Some(course),
            Vec::new(),
            &[ToolCategory::Interaction],
        );
        assert_eq!(
            offered(tx.as_mut(), &interaction_only).await,
            vec![OpenTool::NAME.to_string()],
            "UncategorizedTool needs AdminSupportAccounts, which is not enabled"
        );

        let admin_accounts_only = context_with_categories(
            Some(user),
            Some(course),
            Vec::new(),
            &[ToolCategory::AdminSupportAccounts],
        );
        assert_eq!(
            offered(tx.as_mut(), &admin_accounts_only).await,
            vec![UncategorizedTool::NAME.to_string()],
            "OpenTool needs Interaction, which is not enabled here"
        );
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::{
        insert_data,
        test_helper::{Conn, init_app_conf},
    };

    use super::*;
    use crate::chatbot_tools::tool_authorization::test_helpers::context;

    /// Every definition either registry can put in a request, whether the server or the client
    /// answers the call.
    fn all_tool_definitions() -> Vec<AzureLLMFunctionToolDefinition> {
        let mut definitions = vec![
            <AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::get_tool_definition(),
            <GeneratePasswordResetLinkTool as ChatbotToolDeclaration>::get_tool_definition(),
            <ResetExercisesTool as ChatbotToolDeclaration>::get_tool_definition(),
            <UpdateCheatingStatusTool as ChatbotToolDeclaration>::get_tool_definition(),
            <EditUserAccountTool as ChatbotToolDeclaration>::get_tool_definition(),
        ];
        definitions.extend(function_definitions(get_chatbot_tool_definitions()));
        definitions
    }

    /// Azure rejects tool definitions that are not strict or that allow additional
    /// properties, and two tools sharing a name would make one of them unreachable.
    #[test]
    fn tool_definitions_are_strict_and_uniquely_named() {
        let mut names = std::collections::HashSet::new();
        for definition in all_tool_definitions() {
            let json =
                serde_json::to_value(&definition).expect("The tool definition serializes to JSON");
            assert_eq!(json["strict"], true, "{json}");
            assert_eq!(json["parameters"]["additionalProperties"], false, "{json}");
            assert!(
                names.insert(json["name"].to_string()),
                "Two tools are registered under the name {}",
                json["name"]
            );
        }
        assert!(!names.is_empty());
    }

    /// Tool definitions sit at the front of every prompt and Azure's prompt cache matches an exact
    /// prefix, so a definition that serializes differently between two requests misses the cache
    /// for the whole prompt. `RandomState` reseeds per map instance, which is why the parameter
    /// schemas must not be built from a `HashMap`. Repeated because one comparison can match by
    /// chance even when the ordering is random.
    #[test]
    fn tool_definitions_serialize_byte_identically_across_requests() {
        let serialize = || {
            serde_json::to_string(&all_tool_definitions())
                .expect("The tool definitions serialize to JSON")
        };
        let first = serialize();
        for _ in 0..50 {
            assert_eq!(
                serialize(),
                first,
                "Tool definitions serialize differently between two requests, which misses the prompt cache"
            );
        }
    }

    /// The two registries dispatch on the same names, and a name in both would either be run by
    /// the server or suspend the turn depending on which check ran first.
    #[test]
    fn no_tool_is_both_run_by_the_server_and_answered_by_the_client() {
        for definition in get_chatbot_tool_definitions() {
            let AzureLLMToolDefinition::Function(function) = definition else {
                continue;
            };
            assert!(
                !tool_is_answered_by_client(&function.name),
                "{} is registered in both tool registries",
                function.name
            );
        }
        assert!(tool_is_answered_by_client(
            <AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::NAME
        ));
        assert!(!tool_is_answered_by_client("a_tool_the_llm_made_up"));
    }

    /// Asking the learner to pick an answer needs no privileges, so even an anonymous visitor of
    /// a public chatbot is offered it.
    #[tokio::test]
    async fn the_multiple_choice_question_is_offered_anonymously() {
        insert_data!(:tx, :user, :org, :course);
        let name = <AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::NAME.to_string();
        let anonymous = context(None, Some(course), Vec::new());

        let offered: Vec<String> = function_definitions(
            get_client_chatbot_tool_definitions(tx.as_mut(), &anonymous)
                .await
                .expect("the offered tools are decided"),
        )
        .into_iter()
        .map(|definition| definition.name)
        .collect();
        assert!(offered.contains(&name), "{offered:?}");
    }
}
