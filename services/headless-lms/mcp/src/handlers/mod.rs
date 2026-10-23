//! The database-backed tool handlers.

mod bulk;
mod changesets;
mod history;
mod patches;
mod reads;
mod uploads;

use std::sync::Arc;

use crate::state::McpState;
use crate::tools::ToolRegistry;
use crate::tools::guide_tool::GuideHandler;
use crate::validator::BlockValidator;

/// Every catalog tool with its handler.
pub fn registry(validator: Arc<dyn BlockValidator>) -> ToolRegistry<McpState> {
    ToolRegistry::with_catalog()
        .register("list_courses", Arc::new(reads::ListCourses))
        .register("get_course_structure", Arc::new(reads::GetCourseStructure))
        .register("get_page_content", Arc::new(reads::GetPageContent))
        .register("get_course_settings", Arc::new(reads::GetCourseSettings))
        .register(
            "get_course_glossary_and_references",
            Arc::new(reads::GetGlossaryAndReferences),
        )
        .register("patch_page_content", Arc::new(patches::PatchPageContent))
        .register(
            "patch_course_structure",
            Arc::new(patches::PatchCourseStructure),
        )
        .register(
            "patch_course_settings",
            Arc::new(patches::PatchCourseSettings),
        )
        .register(
            "patch_course_glossary_and_references",
            Arc::new(patches::PatchGlossaryAndReferences),
        )
        .register("find_replace", Arc::new(bulk::FindReplace))
        .register("structural_replace", Arc::new(bulk::StructuralReplace))
        .register("upload_file", Arc::new(uploads::UploadFile))
        .register("list_changesets", Arc::new(changesets::ListChangesets))
        .register("publish_changeset", Arc::new(changesets::PublishChangeset))
        .register("discard_changeset", Arc::new(changesets::DiscardChangeset))
        .register("get_preview_link", Arc::new(changesets::GetPreviewLink))
        .register("get_history", Arc::new(history::GetHistory))
        .register("revert_change", Arc::new(history::RevertChange))
        .register("guide", Arc::new(GuideHandler::new(validator)))
}
