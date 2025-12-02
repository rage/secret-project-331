use std::collections::HashMap;

use headless_lms_models::ModelError;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;

use crate::{
    azure_chatbot::ChatbotUserContext, chatbot_tools::course_progress::CourseProgressTool,
};

pub mod course_progress;

pub trait ChatbotTool {
    type State;
    type Arguments: Serialize;

    /// Parse the LLM-generated function arguments and clean them
    fn parse_arguments(args_string: String) -> Self::Arguments;

    /// Create a new instance after parsing arguments
    fn from_db_and_arguments(
        conn: &mut PgConnection,
        arguments: Self::Arguments,
        user_context: &ChatbotUserContext,
    ) -> impl std::future::Future<Output = Result<Self, ModelError>> + Send
    where
        Self: Sized;

    /// Output the result of the tool call in LLM-readable form
    fn output(&self) -> String;

    /// Additional instructions for the LLM on how to describe and
    /// communicate the tool output. Just-in-time prompt.
    fn output_description_instructions(&self) -> Option<&str>;

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
    ) -> impl std::future::Future<Output = Result<Self, ModelError>> + Send
    where
        Self: Sized,
    {
        let parsed = Self::parse_arguments(args_string);
        Self::from_db_and_arguments(conn, parsed, user_context)
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
pub fn get_chatbot_tools() -> Vec<AzureLLMToolDefinition> {
    vec![CourseProgressTool::get_tool_definition()]
}

/// Call a chatbot tool with LLM-provided function (tool) name and arguments.
/// User context and db connection are needed for some tools.
pub async fn call_chatbot_tool(
    conn: &mut PgConnection,
    fn_name: &str,
    fn_args: &str,
    user_context: &ChatbotUserContext,
) -> anyhow::Result<impl ChatbotTool> {
    let output = match fn_name {
        "course_progress" => {
            CourseProgressTool::new(conn, fn_args.to_string(), user_context).await?
        }
        _ => {
            return Err(anyhow::Error::msg(
                "Incorrect or unknown function name".to_string(),
            ));
        }
    };
    anyhow::Ok(output)
}
