//! The course tree the structure tools read and edit, and the paths that address it.

use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::engine::{is_course_root, split_path};

/// The course tree as agents read and edit it. Children arrays are in display order.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CourseStructure {
    pub id: Uuid,
    /// Pages outside chapters; the course front page (`/`) is always first.
    pub pages: Vec<StructurePage>,
    /// The default module is always first.
    pub modules: Vec<StructureModule>,
}

/// A module and its chapters in order.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StructureModule {
    pub id: Uuid,
    pub default: bool,
    /// Null exactly for the default module.
    pub name: Option<String>,
    pub chapters: Vec<StructureChapter>,
}

/// A chapter and its pages in order.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StructureChapter {
    pub id: Uuid,
    /// Derived from order; course-wide, starting at 1.
    pub chapter_number: i32,
    pub name: String,
    pub color: Option<String>,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    /// The first page is the chapter's front page.
    pub pages: Vec<StructurePage>,
}

/// A page's own fields with counts of its content; the blocks are the page tool's.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StructurePage {
    pub id: Uuid,
    pub title: String,
    pub url_path: String,
    pub hidden: bool,
    pub block_count: u32,
    pub exercise_count: u32,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub has_submissions: bool,
    /// Shared by the page's versions in the course's other languages; `None` until the page is
    /// published, unless it was added with `pair_with`.
    pub page_language_group_id: Option<Uuid>,
}

impl CourseStructure {
    /// The modules in order.
    pub fn modules(&self) -> impl Iterator<Item = &StructureModule> {
        self.modules.iter()
    }

    /// Every chapter, in course order.
    pub fn chapters(&self) -> impl Iterator<Item = &StructureChapter> {
        self.modules.iter().flat_map(|m| m.chapters.iter())
    }

    pub(crate) fn chapters_mut(&mut self) -> impl Iterator<Item = &mut StructureChapter> {
        self.modules.iter_mut().flat_map(|m| m.chapters.iter_mut())
    }

    /// Every page with the chapter it belongs to.
    pub fn pages(&self) -> impl Iterator<Item = (Option<&StructureChapter>, &StructurePage)> {
        self.pages.iter().map(|p| (None, p)).chain(
            self.chapters()
                .flat_map(|c| c.pages.iter().map(move |p| (Some(c), p))),
        )
    }

    /// Every page, top-level ones first.
    pub(crate) fn pages_mut(&mut self) -> impl Iterator<Item = &mut StructurePage> {
        self.pages.iter_mut().chain(
            self.modules
                .iter_mut()
                .flat_map(|m| m.chapters.iter_mut())
                .flat_map(|c| c.pages.iter_mut()),
        )
    }

    /// The page `page_id`, wherever it is.
    pub fn page(&self, page_id: Uuid) -> Option<&StructurePage> {
        self.pages().map(|(_, p)| p).find(|p| p.id == page_id)
    }

    pub(crate) fn page_mut(&mut self, page_id: Uuid) -> Option<&mut StructurePage> {
        self.pages_mut().find(|p| p.id == page_id)
    }

    /// The chapter holding the page; `None` for a page outside chapters.
    pub fn chapter_of_page(&self, page_id: Uuid) -> Option<&StructureChapter> {
        self.pages()
            .find(|(_, p)| p.id == page_id)
            .and_then(|(c, _)| c)
    }

    /// Whether the page is the first of its chapter.
    pub fn is_chapter_front_page(&self, page_id: Uuid) -> bool {
        self.chapters()
            .any(|c| c.pages.first().is_some_and(|p| p.id == page_id))
    }

    /// The module `id`.
    pub fn module(&self, id: Uuid) -> Option<&StructureModule> {
        self.modules.iter().find(|m| m.id == id)
    }

    pub(crate) fn module_mut(&mut self, id: Uuid) -> Option<&mut StructureModule> {
        self.modules.iter_mut().find(|m| m.id == id)
    }

    /// The chapter `id`.
    pub fn chapter(&self, id: Uuid) -> Option<&StructureChapter> {
        self.chapters().find(|c| c.id == id)
    }

    pub(crate) fn chapter_mut(&mut self, id: Uuid) -> Option<&mut StructureChapter> {
        self.chapters_mut().find(|c| c.id == id)
    }

    /// Where the module, chapter or page `id` is.
    pub(crate) fn locate(&self, id: Uuid) -> Option<Loc> {
        let loc = |list, index| Some(Loc { list, index });
        if let Some(index) = self.pages.iter().position(|p| p.id == id) {
            return loc(ListRef::CoursePages, index);
        }
        for (module_index, module) in self.modules.iter().enumerate() {
            if module.id == id {
                return loc(ListRef::CourseModules, module_index);
            }
            for (chapter_index, chapter) in module.chapters.iter().enumerate() {
                if chapter.id == id {
                    return loc(ListRef::ModuleChapters(module.id), chapter_index);
                }
                if let Some(index) = chapter.pages.iter().position(|p| p.id == id) {
                    return loc(ListRef::ChapterPages(chapter.id), index);
                }
            }
        }
        None
    }

    /// The entities of `list` in order; none when its owner doesn't exist.
    pub(crate) fn list(&self, list: ListRef) -> Vec<EntityRef<'_>> {
        match list {
            ListRef::CoursePages => self.pages.iter().map(EntityRef::Page).collect(),
            ListRef::CourseModules => self.modules.iter().map(EntityRef::Module).collect(),
            ListRef::ModuleChapters(id) => self
                .module(id)
                .map(|m| m.chapters.iter().map(EntityRef::Chapter).collect())
                .unwrap_or_default(),
            ListRef::ChapterPages(id) => self
                .chapter(id)
                .map(|c| c.pages.iter().map(EntityRef::Page).collect())
                .unwrap_or_default(),
        }
    }
}

/// Where an entity is: its list and its index there.
#[derive(Debug, Clone, Copy)]
pub(crate) struct Loc {
    pub(crate) list: ListRef,
    pub(crate) index: usize,
}

impl Loc {
    pub(crate) fn kind(&self) -> Kind {
        self.list.kind()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Kind {
    Module,
    Chapter,
    Page,
}

impl Kind {
    pub(crate) fn noun(self) -> &'static str {
        match self {
            Kind::Module => "module",
            Kind::Chapter => "chapter",
            Kind::Page => "page",
        }
    }
}

/// One of the course tree's ordered lists.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ListRef {
    CoursePages,
    CourseModules,
    ModuleChapters(Uuid),
    ChapterPages(Uuid),
}

impl ListRef {
    /// The list `key` names under the course: `pages` or `modules`.
    pub(crate) fn of_course(key: &str) -> Option<Self> {
        match key {
            "pages" => Some(ListRef::CoursePages),
            "modules" => Some(ListRef::CourseModules),
            _ => None,
        }
    }

    /// The list `key` names under the entity `id` of `kind`: a module's `chapters` or a
    /// chapter's `pages`.
    pub(crate) fn of_entity(kind: Kind, id: Uuid, key: &str) -> Option<Self> {
        match (kind, key) {
            (Kind::Module, "chapters") => Some(ListRef::ModuleChapters(id)),
            (Kind::Chapter, "pages") => Some(ListRef::ChapterPages(id)),
            _ => None,
        }
    }

    /// The module or chapter the list belongs to; `None` for the course's lists.
    pub(crate) fn owner(self) -> Option<Uuid> {
        match self {
            ListRef::ModuleChapters(id) | ListRef::ChapterPages(id) => Some(id),
            ListRef::CoursePages | ListRef::CourseModules => None,
        }
    }

    pub(crate) fn kind(self) -> Kind {
        match self {
            ListRef::CoursePages | ListRef::ChapterPages(_) => Kind::Page,
            ListRef::CourseModules => Kind::Module,
            ListRef::ModuleChapters(_) => Kind::Chapter,
        }
    }

    pub(crate) fn path(self) -> String {
        match self {
            ListRef::CoursePages => "/course/pages".to_string(),
            ListRef::CourseModules => "/course/modules".to_string(),
            ListRef::ModuleChapters(id) => format!("/{id}/chapters"),
            ListRef::ChapterPages(id) => format!("/{id}/pages"),
        }
    }
}

/// A module, chapter or page of a [`CourseStructure`]. Serializes as the entity itself.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(untagged)]
pub(crate) enum EntityRef<'a> {
    Module(&'a StructureModule),
    Chapter(&'a StructureChapter),
    Page(&'a StructurePage),
}

impl EntityRef<'_> {
    pub(crate) fn id(self) -> Uuid {
        match self {
            EntityRef::Module(m) => m.id,
            EntityRef::Chapter(c) => c.id,
            EntityRef::Page(p) => p.id,
        }
    }

    pub(crate) fn kind(self) -> Kind {
        match self {
            EntityRef::Module(_) => Kind::Module,
            EntityRef::Chapter(_) => Kind::Chapter,
            EntityRef::Page(_) => Kind::Page,
        }
    }
}

/// A structure path split into its parts, before its ids and labels are resolved:
/// `/<root>/<child>/…`.
pub(crate) struct StructurePath {
    /// `course`, an id or a `$label`.
    pub(crate) root: String,
    /// A list (`pages`, `modules`, `chapters`) or a field after the root.
    pub(crate) child: Option<String>,
    /// Whether segments follow the child.
    pub(crate) is_deeper: bool,
}

impl StructurePath {
    /// Whether the root names the course: `course` or the course's id.
    pub(crate) fn is_course(&self, course_id: Uuid) -> bool {
        is_course_root(&self.root, course_id)
    }
}

/// Splits a structure path into its parts; `None` when it doesn't start with `/`.
pub(crate) fn parse_structure_path(path: &str) -> Option<StructurePath> {
    let mut segments = split_path(path)?.into_iter();
    let root = segments.next().unwrap_or_default();
    let child = segments.next();
    Some(StructurePath {
        root,
        child,
        is_deeper: segments.next().is_some(),
    })
}
