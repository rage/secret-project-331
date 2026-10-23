//! Pure edit engines. They take documents and ops as plain data, never touch the database or the
//! network, and either return the whole new state or reject the whole call.

pub mod blocks;
pub mod course_settings;
pub mod course_structure;
pub mod error;
pub mod find_replace;
pub mod glossary_references;
pub(crate) mod labels;
pub mod op;
pub mod page_content;
pub mod read;
pub mod read_structure;
pub mod structural_replace;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::ids::IdGenerator;

pub use error::{EditError, EditErrorCode, Warning, WarningCode};
pub use op::{OpKind, PatchOp, PatchTarget, Position, parse_ops};

/// The editor (and validator) context a page's blocks are checked against.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PageType {
    /// A page inside a chapter that isn't its front page.
    CoursePage,
    ChapterFrontPage,
    /// A page outside chapters other than the course front page.
    TopLevelPage,
    /// The course's front page, `/`.
    CourseFrontPage,
}

impl PageType {
    pub fn as_str(self) -> &'static str {
        match self {
            PageType::CoursePage => "course-page",
            PageType::ChapterFrontPage => "chapter-front-page",
            PageType::TopLevelPage => "top-level-page",
            PageType::CourseFrontPage => "course-front-page",
        }
    }

    /// Outside chapters, where exercises and chapter listings aren't allowed.
    pub fn is_outside_chapters(self) -> bool {
        matches!(self, PageType::TopLevelPage | PageType::CourseFrontPage)
    }
}

/// One page's block tree with what the engines need to know about the page.
#[derive(Debug, Clone, PartialEq)]
pub struct PageDocument {
    pub page_id: Uuid,
    pub page_type: PageType,
    pub blocks: Vec<GutenbergBlock>,
}

/// Inputs the engines can't compute themselves. Everything is plain data loaded by the caller.
pub struct EngineContext<'a> {
    pub ids: &'a dyn IdGenerator,
    /// Pages besides the edited document: cross-page targets (see
    /// [`page_content::referenced_pages`]) and, for citation and glossary usage, every course page.
    pub pages: &'a [PageDocument],
    /// Not a draft and not in test mode. New empty pages in a live course start hidden.
    pub course_is_live: bool,
    /// False for a course that has never been published, where path changes need no redirects.
    pub creates_redirects: bool,
}

impl<'a> EngineContext<'a> {
    pub fn new(ids: &'a dyn IdGenerator) -> Self {
        Self {
            ids,
            pages: &[],
            course_is_live: false,
            creates_redirects: true,
        }
    }

    pub fn with_pages(mut self, pages: &'a [PageDocument]) -> Self {
        self.pages = pages;
        self
    }

    pub fn live(mut self, course_is_live: bool) -> Self {
        self.course_is_live = course_is_live;
        self
    }

    pub fn page(&self, page_id: Uuid) -> Option<&PageDocument> {
        self.pages.iter().find(|p| p.page_id == page_id)
    }
}

/// Ids one op created, in payload order (pre-order for nested items).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CreatedIds {
    pub op: usize,
    pub ids: Vec<Uuid>,
}

pub(crate) fn push_created(created: &mut Vec<CreatedIds>, op: usize, id: Uuid) {
    match created.last_mut() {
        Some(last) if last.op == op => last.ids.push(id),
        _ => created.push(CreatedIds { op, ids: vec![id] }),
    }
}
