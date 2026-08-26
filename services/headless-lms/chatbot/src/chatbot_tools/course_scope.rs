//! Shared course resolution for tools that can act on a course other than the one the chatbot
//! is on.

use crate::{
    chatbot_tools::tool_permission::ToolPermission, prelude::*, user_context::ChatbotTurnContext,
};

/// Shared schema description for the `course_id` argument of every course-material tool
/// (`course_structure`, `document_lookup`) that accepts the lenient sentinel form.
pub const COURSE_ID_ARGUMENT_DESCRIPTION: &str = "The course whose structure to list. Leave empty to use the course this chatbot is on; a global support chatbot must always pass one.";

/// Resolves which course a material tool acts on, and enforces that leaving the chatbot's own
/// course is a global-admin move. Tool-level [ToolPermission] is checked before the call by the
/// registry; this is the per-argument half it cannot express.
pub async fn resolve_course_scope(
    conn: &mut PgConnection,
    user_context: &ChatbotTurnContext,
    requested: Option<Uuid>,
) -> ChatbotResult<Uuid> {
    match requested {
        Some(course_id) if user_context.course_id == Some(course_id) => Ok(course_id),
        Some(course_id) => {
            if ToolPermission::GlobalAdmin
                .is_satisfied_by(conn, user_context)
                .await?
            {
                Ok(course_id)
            } else {
                Err(chatbot_err!(
                    ToolUseError,
                    "This tool can only read the course this chatbot is on.".to_string()
                ))
            }
        }
        None => user_context.course_id.ok_or_else(|| {
            chatbot_err!(
                InvalidToolArguments,
                "No course_id was given and this chatbot is not on a course. Resolve the course with find_course first.".to_string()
            )
        }),
    }
}
