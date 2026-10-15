//! Builds the system-prompt addendum appended when Azure Search is offered, grounding answers in
//! retrieved course material and pointing the model at whichever other course-material tools this
//! chatbot's configuration actually offers.

use crate::chatbot_tools::ChatbotToolDeclaration;
use crate::chatbot_tools::custom_tools::course_structure::CourseStructureTool;
use crate::chatbot_tools::custom_tools::document_lookup::DocumentLookupTool;
use crate::chatbot_tools::tool_category::EnabledToolCategories;
use headless_lms_models::chatbot_configurations::ToolCategory;

use super::azure::tools::AZURE_AI_SEARCH_TOOL_NAME;

/// One sentence pointing the model at another tool, included only when its category is enabled.
struct ToolMention {
    category: ToolCategory,
    sentence: fn() -> String,
}

const TOOL_MENTIONS: &[ToolMention] = &[
    ToolMention {
        category: ToolCategory::CourseMaterial,
        sentence: || {
            format!(
                " If you need more information about a specific document or a topic covered in it, use the {} tool to retrieve the full document.",
                DocumentLookupTool::NAME
            )
        },
    },
    ToolMention {
        category: ToolCategory::CourseInfo,
        sentence: || {
            format!(
                " If you need more information about the course, like what pages and chapters are in it, use the {} tool.",
                CourseStructureTool::NAME
            )
        },
    },
];

/// Only called when [`AZURE_AI_SEARCH_TOOL_NAME`] itself is in the request's tool list. Each row
/// in [`TOOL_MENTIONS`] is appended only when its category is enabled, so the instruction never
/// points the model at a tool this configuration doesn't actually offer.
pub fn build_search_grounding_instruction(
    enabled_tool_categories: &EnabledToolCategories,
) -> String {
    let mut instruction = format!(
        "\n\nSearch the course material with the {AZURE_AI_SEARCH_TOOL_NAME} tool before answering, and ground your answer in the results with citations. Put only what you want to find in the query; the search is already limited to this course, so don't include the course name. Searching more than once is fine when it helps — to cover distinct sub-questions or angles, to refine when the first results don't answer, or when a follow-up or new instruction needs material you don't already have. When one search already answers, stop there."
    );
    for mention in TOOL_MENTIONS {
        if enabled_tool_categories.contains(mention.category) {
            instruction.push_str(&(mention.sentence)());
        }
    }
    instruction.push_str(
        " Skip searching only for messages that don't need course material, like greetings or thanks.",
    );
    instruction
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mentions_no_tools_when_no_categories_enabled() {
        let instruction = build_search_grounding_instruction(&EnabledToolCategories::only(&[]));
        assert!(instruction.contains("Search the course material"));
        assert!(instruction.contains("Skip searching only for messages"));
        assert!(!instruction.contains(DocumentLookupTool::NAME));
        assert!(!instruction.contains(CourseStructureTool::NAME));
    }

    #[test]
    fn mentions_document_lookup_when_course_material_enabled() {
        let instruction = build_search_grounding_instruction(&EnabledToolCategories::only(&[
            ToolCategory::CourseMaterial,
        ]));
        assert!(instruction.contains(DocumentLookupTool::NAME));
        assert!(!instruction.contains(CourseStructureTool::NAME));
    }

    #[test]
    fn mentions_course_structure_when_course_info_enabled() {
        let instruction = build_search_grounding_instruction(&EnabledToolCategories::only(&[
            ToolCategory::CourseInfo,
        ]));
        assert!(!instruction.contains(DocumentLookupTool::NAME));
        assert!(instruction.contains(CourseStructureTool::NAME));
    }

    #[test]
    fn mentions_both_tools_in_original_order_when_both_enabled() {
        let instruction = build_search_grounding_instruction(&EnabledToolCategories::only(&[
            ToolCategory::CourseMaterial,
            ToolCategory::CourseInfo,
        ]));
        let document_lookup_index = instruction
            .find(DocumentLookupTool::NAME)
            .expect("document_lookup mention missing");
        let course_structure_index = instruction
            .find(CourseStructureTool::NAME)
            .expect("course_structure mention missing");
        assert!(document_lookup_index < course_structure_index);
    }
}
