//! Shared course resolution for tools that can act on a course other than the one the chatbot
//! is on.

use crate::{
    chatbot_tools::tool_authorization::ToolRequirement, prelude::*,
    user_context::ChatbotTurnContext,
};

/// Shared schema description for the `course_id` argument of every course-material tool
/// (`course_structure`, `document_lookup`) that accepts the lenient sentinel form.
pub const COURSE_ID_ARGUMENT_DESCRIPTION: &str = "The course whose structure to list. Leave empty to use the course this chatbot is on; a global support chatbot must always pass one.";

/// Resolves which course a material tool acts on: the one the call names, or the chatbot's own
/// when it names none.
///
/// Says nothing about whether the caller may reach that course — the tool's `call_requirements`
/// authorize the resolved id, so a course the caller has no access to is refused there rather
/// than here.
pub fn resolve_course_scope(
    user_context: &ChatbotTurnContext,
    requested: Option<Uuid>,
) -> ChatbotResult<Uuid> {
    requested.or(user_context.course_id).ok_or_else(|| {
        chatbot_err!(
            InvalidToolArguments,
            "No course_id was given and this chatbot is not on a course. Resolve the course with find_course first.".to_string()
        )
    })
}

/// Material access to `course_id`, or nothing to check when the call names no course at all —
/// such a call fails on its arguments, which is a clearer answer for the model than a denial.
pub fn material_requirements(course_id: Option<Uuid>) -> Vec<ToolRequirement> {
    course_id
        .map(ToolRequirement::CourseMaterial)
        .into_iter()
        .collect()
}
