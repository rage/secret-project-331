use sqlx::PgConnection;

use crate::{
    azure_chatbot::ChatbotUserContext,
    chatbot_tools::{AzureLLMFunctionToolDefinition, ChatbotTool, LLMToolType, ToolProperties},
    prelude::ChatbotResult,
};

pub type DocumentLookupTool = ToolProperties<i32, i32>;

impl ChatbotTool for DocumentLookupTool {
    type State = i32;

    type Arguments = i32;

    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        todo!()
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        arguments: Self::Arguments,
        user_context: &ChatbotUserContext,
    ) -> ChatbotResult<Self> {
        todo!()
    }

    fn output(&self) -> String {
        todo!()
    }

    fn output_description_instructions(&self) -> Option<String> {
        todo!()
    }

    fn get_arguments(&self) -> &Self::Arguments {
        &self.arguments
    }

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: "document_lookup".to_string(),
            description: todo!(),
            parameters: todo!(),
            strict: true,
        }
    }
}
