use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, AzureLLMToolDefinition},
    chatbot_error::chatbot_err,
    chatbot_tools::{
        client_tools::ask_multiple_choice_question::AskMultipleChoiceQuestionTool,
        custom_tools::{
            course_finder::CourseFinderTool, course_progress::CourseProgressTool,
            course_structure::CourseStructureTool, document_lookup::DocumentLookupTool,
        },
        tool_permission::ToolPermission,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult},
    user_context::ChatbotUserContext,
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::json_schema_types::Schema;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use sqlx::PgConnection;
use utoipa::ToSchema;
use uuid::Uuid;

pub mod argument_parsing;
pub mod client_tools;
pub mod course_scope;
pub mod custom_tools;
pub mod provider_tools;
pub mod tool_permission;

/// What a tool is called and how it is declared to the LLM.
///
/// Shared by the tools the server runs ([ChatbotTool]) and the tools the client answers
/// ([ClientChatbotTool]): the two differ in who produces the output, not in how the tool is
/// advertised.
pub trait ChatbotToolDeclaration {
    /// The name the LLM calls this tool by. The registries dispatch on it and
    /// [Self::get_tool_definition] must advertise it, so the two cannot drift apart.
    const NAME: &'static str;

    /// What the caller must be allowed to do for the tool to be offered to the LLM, and still be
    /// allowed to do when the call is carried out: a conversation can be resumed by a caller who
    /// has since lost the role that made the tool available.
    const PERMISSION: ToolPermission;

    /// The definition sent to the LLM as part of a chat request. Azure rejects it unless `strict`
    /// is true and the parameter schema forbids additional properties.
    fn get_tool_definition() -> AzureLLMFunctionToolDefinition;
}

pub trait ChatbotTool: ChatbotToolDeclaration {
    type Arguments: DeserializeOwned;

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
        user_context: &ChatbotUserContext,
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

    /// Create a new instance from connection, application configuration, args and context
    fn new(
        conn: &mut PgConnection,
        app_config: &ApplicationConfiguration,
        args_string: String,
        user_context: &ChatbotUserContext,
    ) -> impl std::future::Future<Output = ChatbotResult<Self>> + Send
    where
        Self: Sized,
    {
        async {
            let parsed = Self::parse_arguments(args_string)?;
            Self::from_db_and_arguments(conn, app_config, parsed, user_context).await
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
}

impl ClientToolName {
    /// The wire name [ChatbotToolDeclaration::NAME] must equal for the tool this variant names.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::AskMultipleChoiceQuestion => "ask_multiple_choice_question",
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
/// the permission a tool requires and the rendering of a client's answer. A tool therefore
/// cannot be advertised without being callable, and a tool's kind is stated in one place rather
/// than implied by which list it was pasted into.
macro_rules! chatbot_tool_registry {
    (
        server_tools: [$($server_tool:ty),* $(,)?],
        client_tools: [$($client_tool:ty),* $(,)?] $(,)?
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
        /// A tool is offered only to a caller who holds the permission it requires, and the
        /// roles that decides are fetched at most once for the whole request.
        pub async fn get_permitted_chatbot_tool_definitions(
            conn: &mut PgConnection,
            user_context: &ChatbotUserContext,
        ) -> ChatbotResult<Vec<AzureLLMToolDefinition>> {
            let mut definitions = Vec::new();
            $(
                if <$server_tool as ChatbotToolDeclaration>::PERMISSION
                    .is_satisfied_by(&mut *conn, user_context)
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
        /// tools that take no arguments ignore it. The permission is checked again here, since a
        /// turn can be resumed by a caller who no longer holds it. Fails with `InvalidToolName`
        /// when no tool claims `fn_name`, which happens when the LLM hallucinates a tool.
        pub async fn call_chatbot_tool(
            conn: &mut PgConnection,
            app_config: &ApplicationConfiguration,
            fn_name: &str,
            fn_args: &str,
            user_context: &ChatbotUserContext,
        ) -> ChatbotResult<ChatbotToolCallResult> {
            $(
                if fn_name == <$server_tool as ChatbotToolDeclaration>::NAME {
                    if !<$server_tool as ChatbotToolDeclaration>::PERMISSION
                        .is_satisfied_by(&mut *conn, user_context)
                        .await?
                    {
                        return Err(chatbot_err!(
                            ToolUseError,
                            format!("The caller is not allowed to use the tool {fn_name}")
                        ));
                    }
                    let tool = <$server_tool as ChatbotTool>::new(&mut *conn, app_config, fn_args.to_owned(), user_context).await?;
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
        /// A tool is offered only to a caller who holds the permission it requires, and the
        /// roles that decides are fetched at most once for the whole request.
        pub async fn get_client_chatbot_tool_definitions(
            conn: &mut PgConnection,
            user_context: &ChatbotUserContext,
        ) -> ChatbotResult<Vec<AzureLLMToolDefinition>> {
            let mut definitions = Vec::new();
            $(
                if <$client_tool as ChatbotToolDeclaration>::PERMISSION
                    .is_satisfied_by(&mut *conn, user_context)
                    .await?
                {
                    definitions.push(AzureLLMToolDefinition::Function(
                        <$client_tool as ChatbotToolDeclaration>::get_tool_definition(),
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
            client_tool_permission(tool_name).is_some()
        }

        /// Checks the arguments a client tool was called with, before the turn suspends on the call.
        ///
        /// A call the tool would reject can never be answered, so it has to fail while the turn is
        /// still running and can report the failure to the LLM. Fails with
        /// [ChatbotErrorType::InvalidToolArguments], and with [ChatbotErrorType::InvalidToolName]
        /// when no client tool goes by `tool_name`.
        pub fn check_client_tool_arguments(tool_name: &str, arguments: &str) -> ChatbotResult<()> {
            $(
                if tool_name == <$client_tool as ChatbotToolDeclaration>::NAME {
                    <$client_tool as ClientChatbotTool>::parse_arguments(arguments)?;
                    return Ok(());
                }
            )*
            Err(chatbot_err!(
                InvalidToolName,
                format!("No client tool is registered under the name {tool_name}")
            ))
        }

        /// The permission a client tool requires, or `None` when no client tool goes by that name.
        pub fn client_tool_permission(tool_name: &str) -> Option<ToolPermission> {
            $(
                if tool_name == <$client_tool as ChatbotToolDeclaration>::NAME {
                    return Some(<$client_tool as ChatbotToolDeclaration>::PERMISSION);
                }
            )*
            None
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
    ],
    client_tools: [AskMultipleChoiceQuestionTool],
);

/// A second registry, generated from tools that exist only here.
///
/// The one real client tool is offered to everyone, so the generated permission filter can only
/// be seen letting a tool through. This registry has a tool it keeps out.
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
    use crate::chatbot_tools::tool_permission::test_helpers::{context, course_role};

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
        const PERMISSION: ToolPermission = ToolPermission::Anyone;

        fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
            definition(Self::NAME)
        }
    }

    impl ClientChatbotTool for OpenTool {
        type Arguments = ();
        type Response = ();

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
        const PERMISSION: ToolPermission = ToolPermission::TeachesCourse;

        fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
            definition(Self::NAME)
        }
    }

    impl ClientChatbotTool for TeacherTool {
        type Arguments = ();
        type Response = ();

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

    chatbot_tool_registry!(server_tools: [], client_tools: [OpenTool, TeacherTool]);

    async fn offered(conn: &mut PgConnection, user_context: &ChatbotUserContext) -> Vec<String> {
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
    #[test]
    fn every_mapping_covers_every_tool_in_the_list() {
        for name in [OpenTool::NAME, TeacherTool::NAME] {
            assert!(tool_is_answered_by_client(name), "{name}");
            check_client_tool_arguments(name, "{}").unwrap_or_else(|e| panic!("{name}: {e:?}"));
        }
        assert_eq!(
            check_client_tool_arguments("open_tool_but_misspelled", "{}")
                .expect_err("no tool goes by that name")
                .error_type(),
            &ChatbotErrorType::InvalidToolName
        );
        assert_eq!(
            client_tool_permission(OpenTool::NAME),
            Some(ToolPermission::Anyone)
        );
        assert_eq!(
            client_tool_permission(TeacherTool::NAME),
            Some(ToolPermission::TeachesCourse)
        );
        assert_eq!(client_tool_permission("open_tool_but_misspelled"), None);

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
    async fn a_tool_is_kept_from_a_caller_who_lacks_its_permission() {
        insert_data!(:tx, :user, :org, :course);

        let anonymous = context(None, Some(course), Vec::new());
        assert_eq!(
            offered(tx.as_mut(), &anonymous).await,
            vec![OpenTool::NAME.to_string()],
            "an anonymous caller is offered only what needs no privileges"
        );

        let learner = context(Some(user), Some(course), Vec::new());
        assert_eq!(
            offered(tx.as_mut(), &learner).await,
            vec![OpenTool::NAME.to_string()]
        );

        let teacher = context(
            Some(user),
            Some(course),
            vec![course_role(user, course, UserRole::Teacher)],
        );
        assert_eq!(
            offered(tx.as_mut(), &teacher).await,
            vec![OpenTool::NAME.to_string(), TeacherTool::NAME.to_string()]
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
    use crate::chatbot_tools::tool_permission::test_helpers::context;

    /// Every definition either registry can put in a request, whether the server or the client
    /// answers the call.
    fn all_tool_definitions() -> Vec<AzureLLMFunctionToolDefinition> {
        let mut definitions =
            vec![<AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::get_tool_definition()];
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
