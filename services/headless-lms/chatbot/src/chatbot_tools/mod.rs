use headless_lms_models::ModelError;
use serde::Serialize;
use sqlx::PgConnection;

use crate::azure_chatbot::ChatbotUserContext;

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

    fn get_arguments(&self) -> &Self::Arguments;

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
