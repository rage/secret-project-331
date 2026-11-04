//! The database-backed tool handlers.

mod bulk;
mod changesets;
mod exercise;
mod guide;
mod history;
mod patches;
mod public_course;
mod reads;
mod uploads;

use crate::state::McpState;
use crate::tools::ToolRegistry;
use crate::tools::catalog;

/// Every tool with its handler, in `tools/list` order.
pub fn registry() -> ToolRegistry<McpState> {
    ToolRegistry::new(vec![
        catalog::list_courses(reads::ListCourses),
        catalog::get_course_structure(reads::GetCourseStructure),
        catalog::get_page_content(reads::GetPageContent),
        catalog::get_course_settings(reads::GetCourseSettings),
        catalog::get_course_glossary_and_references(reads::GetGlossaryAndReferences),
        catalog::get_exercise(exercise::GetExercise),
        catalog::list_exercises(exercise::ListExercises),
        catalog::read_public_course(public_course::ReadPublicCourse),
        catalog::patch_page_content(patches::PatchPageContent),
        catalog::patch_course_structure(patches::PatchCourseStructure),
        catalog::patch_course_settings(patches::PatchCourseSettings),
        catalog::patch_course_glossary_and_references(patches::PatchGlossaryAndReferences),
        catalog::patch_exercise(exercise::PatchExercise),
        catalog::find_replace(bulk::FindReplace),
        catalog::structural_replace(bulk::StructuralReplace),
        catalog::upload_file(uploads::UploadFile),
        catalog::list_changesets(changesets::ListChangesets),
        catalog::publish_changeset(changesets::PublishChangeset),
        catalog::discard_changeset(changesets::DiscardChangeset),
        catalog::get_preview_link(changesets::GetPreviewLink),
        catalog::get_history(history::GetHistory),
        catalog::revert_change(history::RevertChange),
        catalog::guide(guide::Guide),
    ])
}
