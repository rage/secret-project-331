use crate::{
    azure_chatbot::{ChatbotUserContext, ClientToolAnswer},
    chatbot_error::chatbot_err,
    chatbot_tools::{
        client_tools::ask_multiple_choice_question::AskMultipleChoiceQuestionTool,
        custom_tools::{
            course_finder::CourseFinderTool, course_progress::CourseProgressTool,
            course_structure::CourseStructureTool, document_lookup::DocumentLookupTool,
        },
        provider_tools::azure_ai_search::AzureAISearchToolDefinition,
        tool_permission::ToolPermission,
    },
    conversation_context::ChatbotSurface,
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult},
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::json_schema_types::Schema;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use sqlx::PgConnection;

pub mod client_tools;
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

    /// The definition sent to the LLM as part of a chat request. Azure rejects it unless `strict`
    /// is true and the parameter schema forbids additional properties.
    fn get_tool_definition() -> AzureLLMFunctionToolDefinition;
}

pub trait ChatbotTool: ChatbotToolDeclaration {
    type State;
    type Arguments: Serialize;

    /// Parse the LLM-generated function arguments and clean them
    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments>;

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

    /// Get parsed arguments
    fn get_arguments(&self) -> &Self::Arguments;

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

    /// The surfaces the tool is offered on.
    ///
    /// A surface where nothing can render the call or nobody is there to answer it must be left
    /// out: the turn would suspend on a call that never gets an answer.
    const SURFACES: &'static [ChatbotSurface];

    /// What the caller must be allowed to do for the tool to be offered to the LLM, and still be
    /// allowed to do for their answer to be applied.
    const PERMISSION: ToolPermission;

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
///
/// A [ClientToolAnswer::Decision] carries no data of its own, so a tool that expects data refuses
/// it rather than guessing what the learner meant.
pub fn client_answer_data<T: DeserializeOwned>(answer: &ClientToolAnswer) -> ChatbotResult<T> {
    match answer {
        ClientToolAnswer::Data { result } => serde_json::from_value(result.clone()).map_err(|e| {
            chatbot_err!(
                InvalidToolAnswer,
                "The answer is not in the shape this tool call expects.".to_string(),
                e
            )
        }),
        ClientToolAnswer::Decision { .. } => Err(chatbot_err!(
            InvalidToolAnswer,
            "This tool call expects data, not an approval decision.".to_string()
        )),
    }
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

pub struct ToolProperties<S, A: Serialize> {
    state: S,
    arguments: A,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum AzureLLMToolDefinition {
    Function(AzureLLMFunctionToolDefinition),
    Search(AzureAISearchToolDefinition),
}

/// A tool definition that is formatted for Azure.
/// Defines a tool (function) that the LLM can call.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AzureLLMFunctionToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: LLMToolType,
    pub name: String,
    pub description: String,
    /// Azure requires `additional_properties: false` here.
    pub parameters: Schema,
    /// Ensures that the LLM calls the tool with the correct params. Should be `true`
    pub strict: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolType {
    Function,
}

pub struct ChatbotToolCallResult {
    /// The arguments the tool was called with, as JSON, persisted with the function call message.
    pub arguments: String,
    pub output: String,
}

/// Defines the set of chatbot tools the LLM can use.
///
/// The definitions sent to the LLM and the dispatcher that runs a call are both generated
/// from this one list, so a tool cannot be advertised without being callable, or vice versa.
macro_rules! chatbot_tool_registry {
    ($($tool:ty),+ $(,)?) => {
        /// Get a vec of AzureLLMToolDefinitions for all available chatbot tools
        pub fn get_chatbot_tool_definitions() -> Vec<AzureLLMToolDefinition> {
            vec![
                $(AzureLLMToolDefinition::Function(<$tool as ChatbotToolDeclaration>::get_tool_definition()),)+
            ]
        }

        /// Run the chatbot tool the LLM asked for and return its arguments and its
        /// LLM-readable output. User context and db connection are needed for some tools.
        ///
        /// `fn_args` is the raw argument JSON from the LLM; each tool parses it itself and
        /// tools that take no arguments ignore it. Fails with `InvalidToolName` when no tool
        /// claims `fn_name`, which happens when the LLM hallucinates a tool.
        pub async fn call_chatbot_tool(
            conn: &mut PgConnection,
            app_config: &ApplicationConfiguration,
            fn_name: &str,
            fn_args: String,
            user_context: &ChatbotUserContext,
        ) -> ChatbotResult<ChatbotToolCallResult> {
            $(
                if fn_name == <$tool as ChatbotToolDeclaration>::NAME {
                    let tool = <$tool as ChatbotTool>::new(&mut *conn, app_config, fn_args, user_context).await?;
                    return Ok(ChatbotToolCallResult {
                        arguments: serde_json::to_string(tool.get_arguments())?,
                        output: tool.get_tool_output(),
                    });
                }
            )+
            Err(chatbot_err!(
                InvalidToolName,
                format!("Incorrect or unknown function name: {fn_name}")
            ))
        }
    };
}

/// Defines the set of chatbot tools the client answers instead of the server.
///
/// The definitions offered to the LLM, the check that decides a call suspends the turn, the
/// permission a tool requires and the rendering of an answer are all generated from this one
/// list, so no derived mapping can disagree with another about which tools exist.
macro_rules! client_chatbot_tool_registry {
    ($($tool:ty),+ $(,)?) => {
        /// The client tool definitions this request may offer the LLM.
        ///
        /// A tool is offered only on a surface it declares and only to a caller who holds the
        /// permission it requires, checked against the roles snapshot in `user_context` rather
        /// than by fetching roles per tool.
        pub async fn get_client_chatbot_tool_definitions(
            conn: &mut PgConnection,
            user_context: &ChatbotUserContext,
        ) -> ChatbotResult<Vec<AzureLLMToolDefinition>> {
            let mut definitions = Vec::new();
            $(
                if <$tool as ClientChatbotTool>::SURFACES.contains(&user_context.surface)
                    && <$tool as ClientChatbotTool>::PERMISSION
                        .is_satisfied_by(&mut *conn, user_context)
                        .await?
                {
                    definitions.push(AzureLLMToolDefinition::Function(
                        <$tool as ChatbotToolDeclaration>::get_tool_definition(),
                    ));
                }
            )+
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
                if tool_name == <$tool as ChatbotToolDeclaration>::NAME {
                    <$tool as ClientChatbotTool>::parse_arguments(arguments)?;
                    return Ok(());
                }
            )+
            Err(chatbot_err!(
                InvalidToolName,
                format!("No client tool is registered under the name {tool_name}")
            ))
        }

        /// The permission a client tool requires, or `None` when no client tool goes by that name.
        pub fn client_tool_permission(tool_name: &str) -> Option<ToolPermission> {
            $(
                if tool_name == <$tool as ChatbotToolDeclaration>::NAME {
                    return Some(<$tool as ClientChatbotTool>::PERMISSION);
                }
            )+
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
                if tool_name == <$tool as ChatbotToolDeclaration>::NAME {
                    let arguments = <$tool as ClientChatbotTool>::parse_arguments(arguments)?;
                    let response = <$tool as ClientChatbotTool>::parse_response(&arguments, answer)?;
                    return Ok(<$tool as ClientChatbotTool>::get_tool_output(&arguments, &response));
                }
            )+
            Err(chatbot_err!(
                InvalidToolName,
                format!("No client tool is registered under the name {tool_name}")
            ))
        }
    };
}

chatbot_tool_registry!(
    CourseProgressTool,
    DocumentLookupTool,
    CourseStructureTool,
    CourseFinderTool,
);

client_chatbot_tool_registry!(AskMultipleChoiceQuestionTool);

/// A second registry, generated from tools that exist only here.
///
/// The one real client tool is offered on every surface and to everyone, so the generated filters
/// can only be seen letting a tool through. These two differ in both, which is what lets the tests
/// see them keeping a tool out.
#[cfg(test)]
mod generated_filter_tests {
    use headless_lms_models::roles::UserRole;
    use headless_lms_utils::json_schema_types::JSONType;
    use indexmap::IndexMap;

    use super::*;
    use crate::{
        chatbot_tools::tool_permission::test_helpers::{context, global_role},
        test_helper::{Conn, CourseFixture, insert_course},
    };

    struct DialogOnlyTool;
    struct AdminEverywhereTool;

    const EVERY_SURFACE: &[ChatbotSurface] = &[
        ChatbotSurface::CourseMaterialDialog,
        ChatbotSurface::CourseMaterialBlock,
        ChatbotSurface::Embed,
        ChatbotSurface::ConfigurationPreview,
        ChatbotSurface::CommandCenter,
    ];

    fn definition(name: &str) -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: name.to_string(),
            description: "A tool that exists only in this test".to_string(),
            parameters: Schema {
                type_field: JSONType::Object,
                description: None,
                properties: IndexMap::new(),
                required: Vec::new(),
                additional_properties: false,
            },
            strict: true,
        }
    }

    impl ChatbotToolDeclaration for DialogOnlyTool {
        const NAME: &'static str = "dialog_only";

        fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
            definition(Self::NAME)
        }
    }

    impl ClientChatbotTool for DialogOnlyTool {
        type Arguments = ();
        type Response = ();

        const SURFACES: &'static [ChatbotSurface] = &[ChatbotSurface::CourseMaterialDialog];
        const PERMISSION: ToolPermission = ToolPermission::Anyone;

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

    impl ChatbotToolDeclaration for AdminEverywhereTool {
        const NAME: &'static str = "admin_everywhere";

        fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
            definition(Self::NAME)
        }
    }

    impl ClientChatbotTool for AdminEverywhereTool {
        type Arguments = ();
        type Response = ();

        const SURFACES: &'static [ChatbotSurface] = EVERY_SURFACE;
        const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

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

    client_chatbot_tool_registry!(DialogOnlyTool, AdminEverywhereTool);

    async fn offered(conn: &mut PgConnection, user_context: &ChatbotUserContext) -> Vec<String> {
        get_client_chatbot_tool_definitions(conn, user_context)
            .await
            .expect("the offered tools are decided")
            .into_iter()
            .filter_map(|definition| match definition {
                AzureLLMToolDefinition::Function(function) => Some(function.name),
                AzureLLMToolDefinition::Search(_) => None,
            })
            .collect()
    }

    /// The registry's mappings all come from its one list, so a tool that is in the list is in
    /// every one of them.
    #[test]
    fn every_mapping_covers_every_tool_in_the_list() {
        for name in [DialogOnlyTool::NAME, AdminEverywhereTool::NAME] {
            assert!(tool_is_answered_by_client(name), "{name}");
            check_client_tool_arguments(name, "{}").unwrap_or_else(|e| panic!("{name}: {e:?}"));
        }
        assert_eq!(
            check_client_tool_arguments("dialog_only_but_misspelled", "{}")
                .expect_err("no tool goes by that name")
                .error_type(),
            &ChatbotErrorType::InvalidToolName
        );
        assert_eq!(
            client_tool_permission(DialogOnlyTool::NAME),
            Some(ToolPermission::Anyone)
        );
        assert_eq!(
            client_tool_permission(AdminEverywhereTool::NAME),
            Some(ToolPermission::GlobalAdmin)
        );
        assert_eq!(client_tool_permission("dialog_only_but_misspelled"), None);

        let rendered = client_tool_answer_output(
            DialogOnlyTool::NAME,
            "{}",
            &ClientToolAnswer::Data {
                result: serde_json::json!({}),
            },
        )
        .expect("the answer renders");
        assert!(rendered.contains("answered"), "{rendered}");
    }

    #[tokio::test]
    async fn a_tool_is_kept_off_a_surface_it_does_not_declare() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let CourseFixture { user_id, course_id } = insert_course(tx.conn()).await;
        let admin = context(
            Some(user_id),
            Some(course_id),
            vec![global_role(user_id, UserRole::Admin)],
        );

        let on_the_dialog = offered(tx.conn(), &admin).await;
        assert!(on_the_dialog.contains(&DialogOnlyTool::NAME.to_string()));

        let embedded = ChatbotUserContext {
            surface: ChatbotSurface::Embed,
            ..admin
        };
        assert_eq!(
            offered(tx.conn(), &embedded).await,
            vec![AdminEverywhereTool::NAME.to_string()],
            "a permission that holds does not put a tool on a surface it left out"
        );
    }

    #[tokio::test]
    async fn a_tool_is_kept_from_a_caller_who_lacks_its_permission() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let CourseFixture { user_id, course_id } = insert_course(tx.conn()).await;

        let anonymous = context(None, Some(course_id), Vec::new());
        assert_eq!(
            offered(tx.conn(), &anonymous).await,
            vec![DialogOnlyTool::NAME.to_string()],
            "an anonymous caller is offered only what needs no privileges"
        );

        let learner = context(Some(user_id), Some(course_id), Vec::new());
        assert_eq!(
            offered(tx.conn(), &learner).await,
            vec![DialogOnlyTool::NAME.to_string()]
        );

        let admin = context(
            Some(user_id),
            Some(course_id),
            vec![global_role(user_id, UserRole::Admin)],
        );
        assert_eq!(
            offered(tx.conn(), &admin).await,
            vec![
                DialogOnlyTool::NAME.to_string(),
                AdminEverywhereTool::NAME.to_string()
            ]
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        chatbot_tools::tool_permission::test_helpers::context,
        test_helper::{Conn, CourseFixture, insert_course},
    };

    /// Every definition either registry can put in a request, whether the server or the client
    /// answers the call.
    fn all_tool_definitions() -> Vec<AzureLLMFunctionToolDefinition> {
        let mut definitions =
            vec![<AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::get_tool_definition()];
        definitions.extend(
            get_chatbot_tool_definitions()
                .into_iter()
                .filter_map(|definition| match definition {
                    AzureLLMToolDefinition::Function(function) => Some(function),
                    AzureLLMToolDefinition::Search(_) => None,
                }),
        );
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

    /// Asking the learner to pick an answer needs no privileges and there is a person reading
    /// every surface, so no surface may be missing it.
    #[tokio::test]
    async fn the_multiple_choice_question_is_offered_anonymously_on_every_surface() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let CourseFixture { course_id, .. } = insert_course(tx.conn()).await;
        let name = <AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::NAME.to_string();

        for surface in <AskMultipleChoiceQuestionTool as ClientChatbotTool>::SURFACES {
            let anonymous = ChatbotUserContext {
                surface: *surface,
                ..context(None, Some(course_id), Vec::new())
            };
            let offered: Vec<String> = get_client_chatbot_tool_definitions(tx.conn(), &anonymous)
                .await
                .expect("the offered tools are decided")
                .into_iter()
                .filter_map(|definition| match definition {
                    AzureLLMToolDefinition::Function(function) => Some(function.name),
                    AzureLLMToolDefinition::Search(_) => None,
                })
                .collect();
            assert!(offered.contains(&name), "{surface:?}");
        }
    }
}
