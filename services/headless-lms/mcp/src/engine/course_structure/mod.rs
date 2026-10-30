//! `patch_course_structure`: modules, chapters and pages, their order, names, titles, paths and
//! chapter dates. Paths, chapter numbers and redirects are derived once at the end of a call.

mod editor;
mod fields;
mod model;
mod outline;
mod paths;

use std::collections::{BTreeMap, HashMap};

use headless_lms_models::url_redirections::CreatedRedirect;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde::Serialize;
use uuid::Uuid;

use editor::StructureEditor;
pub use model::{CourseStructure, StructureChapter, StructureModule, StructurePage};
pub(crate) use model::{EntityRef, ListRef, Loc, RENDERED_KEYS, parse_structure_path};
pub use outline::{StructureOutline, outline};
pub use paths::LinkToOldPath;
use paths::find_links_to_old_paths;

use super::error::{EditError, Warning};
use super::op::Op;
use super::{CreatedIds, PageRef};
use crate::ids::IdGenerator;

/// A chapter whose number changed because chapters before it moved.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ChapterRenumber {
    pub chapter_id: Uuid,
    pub from: i32,
    pub to: i32,
}

/// A page `copy` created; the caller copies the source page's content to it.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PageCopy {
    pub source_page_id: Uuid,
    pub new_page_id: Uuid,
}

/// The new state after a successful call. Nothing is stored until the caller stages it.
#[derive(Debug, Clone, PartialEq)]
pub struct StructureResult {
    pub structure: CourseStructure,
    pub created: Vec<CreatedIds>,
    pub labels: BTreeMap<String, Uuid>,
    pub warnings: Vec<Warning>,
    /// Pages that still exist and whose path changed, as the redirects publishing creates from
    /// their old paths.
    pub changed_paths: Vec<CreatedRedirect>,
    pub renumbered_chapters: Vec<ChapterRenumber>,
    /// Blocks of the pages `add` created, by page id; empty when no `blocks` were given.
    pub new_pages: HashMap<Uuid, Vec<GutenbergBlock>>,
    /// Pages created by `copy`; the caller copies content with new block and exercise ids.
    pub page_copies: Vec<PageCopy>,
    /// Pages `add` created with `pair_with`, by new page id: the page whose language group each
    /// joins, which the caller checks.
    pub page_pairings: BTreeMap<Uuid, Uuid>,
}

impl StructureResult {
    /// Links in `pages` to a page path the call changed, written `…/<course_slug><old path>`.
    pub fn links_to_old_paths(&self, pages: &[PageRef], course_slug: &str) -> Vec<LinkToOldPath> {
        find_links_to_old_paths(pages, course_slug, &self.changed_paths, &self.structure)
    }
}

/// Applies `ops` in order to `doc`. In a live course (not a draft, not in test mode) new pages
/// without content start hidden.
pub fn apply(
    doc: &CourseStructure,
    ops: &[Op],
    course_is_live: bool,
    ids: &dyn IdGenerator,
) -> Result<StructureResult, EditError> {
    let mut editor = StructureEditor::new(doc, ops, course_is_live, ids);
    for (index, op) in ops.iter().enumerate() {
        editor.ids.set_op(index);
        let first_warning = editor.warnings.len();
        editor.apply_op(op).map_err(|e| e.at_op(index))?;
        for warning in &mut editor.warnings[first_warning..] {
            warning.op = Some(index);
        }
    }
    editor.finish(doc)
}

#[cfg(test)]
mod tests;
