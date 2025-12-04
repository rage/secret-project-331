use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use sqlx::PgConnection;

use crate::{
    azure_chatbot::ChatbotUserContext,
    chatbot_tools::course_progress::CourseProgressTool,
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult},
};

pub mod course_progress;

pub trait ChatbotTool {
    type State;
    type Arguments: Serialize;

    /// Parse the LLM-generated function arguments and clean them
    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments>;

    /// Create a new instance after parsing arguments
    fn from_db_and_arguments(
        conn: &mut PgConnection,
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
        let instructions = self.output_description_instructions();

        if let Some(i) = instructions {
            format!(
                "Result: [output]{output}[/output] \n\nInstructions for describing the output: [instructions]{i}[/instructions]"
            )
        } else {
            output
        }
    }

    /// Get parsed arguments
    fn get_arguments(&self) -> &Self::Arguments;

    /// Get a AzureLLMToolDefinition struct that represents this tool.
    /// The definition is sent to the LLM as part of a chat request.
    fn get_tool_definition() -> AzureLLMToolDefinition;

    /// Create a new instance from connection, args and context
    fn new(
        conn: &mut PgConnection,
        args_string: String,
        user_context: &ChatbotUserContext,
    ) -> impl std::future::Future<Output = ChatbotResult<Self>> + Send
    where
        Self: Sized,
    {
        async {
            let parsed = Self::parse_arguments(args_string)?;
            Self::from_db_and_arguments(conn, parsed, user_context).await
        }
    }
}

pub struct ToolProperties<S, A: Serialize> {
    state: S,
    arguments: A,
}

/// A tool definition that is formatted for Azure.
/// Defines a tool (function) that the LLM can call.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AzureLLMToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: LLMToolType,
    pub function: LLMTool,
}
/// Content of an AzureLLMToolDefinition
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMTool {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<LLMToolParams>,
}

/// Parameters that a chatbot tool accepts in an AzureLLMToolDefinition
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMToolParams {
    #[serde(rename = "type")]
    pub tool_type: LLMToolParamType,
    pub properties: HashMap<String, LLMToolParamProperties>,
    pub required: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMToolParamProperties {
    #[serde(rename = "type")]
    pub param_type: String,
    pub description: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolParamType {
    Object,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolType {
    Function,
}

/// Get a vec of AzureLLMToolDefinitions for all available chatbot tools
pub fn get_chatbot_tool_definitions() -> Vec<AzureLLMToolDefinition> {
    vec![CourseProgressTool::get_tool_definition()]
}

/// Create a chatbot tool with LLM-provided arguments by matching the tool call
/// made by the LLM. User context and db connection are needed for some tools.
pub async fn get_chatbot_tool(
    conn: &mut PgConnection,
    fn_name: &str,
    _fn_args: &str, // used in the future in other tool
    user_context: &ChatbotUserContext,
) -> ChatbotResult<impl ChatbotTool> {
    let tool = match fn_name {
        "course_progress" => CourseProgressTool::new(conn, "".to_string(), user_context).await?,
        _ => {
            return Err(ChatbotError::new(
                ChatbotErrorType::InvalidToolName,
                "Incorrect or unknown function name".to_string(),
                None,
            ));
        }
    };
    Result::Ok(tool)
}
