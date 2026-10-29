use std::collections::{BTreeMap, HashSet};

use utoipa::ToSchema;

use super::CourseState;
use crate::{
    chapters,
    library::entity_snapshots::{ContentEntityType, EntityKey, EntityRef},
    prelude::*,
};

/// A rule publishing relies on that a course state breaks. Pages, chapters and modules are named
/// as the state has them.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PublishBlocker {
    /// The page is in a chapter the course doesn't have.
    PageInMissingChapter { page: EntityRef, chapter_id: Uuid },
    /// The pages share a path, which must be unique in the course.
    DuplicatePath {
        url_path: String,
        pages: Vec<EntityRef>,
    },
    /// The pages share a position in their chapter, or among the top-level pages with no
    /// `chapter`.
    DuplicatePageOrderNumber {
        chapter: Option<EntityRef>,
        order_number: i32,
        pages: Vec<EntityRef>,
    },
    /// The chapter is in a module the course doesn't have.
    ChapterInMissingModule { chapter: EntityRef, module_id: Uuid },
    /// The chapter's front page is a page the course doesn't have.
    MissingFrontPage {
        chapter: EntityRef,
        front_page_id: Uuid,
    },
    /// The chapter's front page is in another chapter.
    FrontPageInOtherChapter {
        chapter: EntityRef,
        front_page: EntityRef,
    },
    /// The chapter's front page isn't at the path its chapter number gives it.
    FrontPageOffPath {
        chapter: EntityRef,
        front_page: EntityRef,
        url_path: String,
        expected_url_path: String,
    },
    /// The chapters share a number, which must be unique in the course.
    DuplicateChapterNumber {
        chapter_number: i32,
        chapters: Vec<EntityRef>,
    },
    /// The modules share an order number, which must be unique in the course.
    DuplicateModuleOrderNumber {
        order_number: i32,
        modules: Vec<EntityRef>,
    },
}

impl PublishBlocker {
    /// The blocker with every label left empty.
    fn unlabelled(mut self) -> Self {
        let clear = |entity: &mut EntityRef| entity.label.clear();
        match &mut self {
            Self::PageInMissingChapter { page, .. } => clear(page),
            Self::DuplicatePath { pages, .. } => pages.iter_mut().for_each(clear),
            Self::DuplicatePageOrderNumber { chapter, pages, .. } => {
                chapter.iter_mut().chain(pages.iter_mut()).for_each(clear)
            }
            Self::ChapterInMissingModule { chapter, .. }
            | Self::MissingFrontPage { chapter, .. } => clear(chapter),
            Self::FrontPageInOtherChapter {
                chapter,
                front_page,
            }
            | Self::FrontPageOffPath {
                chapter,
                front_page,
                ..
            } => {
                clear(chapter);
                clear(front_page);
            }
            Self::DuplicateChapterNumber { chapters, .. } => chapters.iter_mut().for_each(clear),
            Self::DuplicateModuleOrderNumber { modules, .. } => modules.iter_mut().for_each(clear),
        }
        self
    }
}

fn sorted(mut entities: Vec<EntityRef>) -> Vec<EntityRef> {
    entities.sort_by_key(|entity| entity.entity_id);
    entities
}

impl CourseState {
    /// What publishing this state would break, in a fixed order; empty if nothing.
    pub fn publish_blockers(&self) -> Vec<PublishBlocker> {
        let mut blockers = Vec::new();
        let chapter_ids: HashSet<Uuid> = self.chapters.iter().map(|c| c.id).collect();
        let module_ids: HashSet<Uuid> = self.modules.iter().map(|m| m.id).collect();
        let mut pages_by_path: BTreeMap<&str, Vec<EntityRef>> = BTreeMap::new();
        let mut pages_by_position: BTreeMap<(Option<Uuid>, i32), Vec<EntityRef>> = BTreeMap::new();
        for page in &self.pages {
            let page_ref = page.entity_ref();
            if let Some(chapter_id) = page.chapter_id
                && !chapter_ids.contains(&chapter_id)
            {
                blockers.push(PublishBlocker::PageInMissingChapter {
                    page: page_ref.clone(),
                    chapter_id,
                });
            }
            pages_by_path
                .entry(&page.url_path)
                .or_default()
                .push(page_ref.clone());
            pages_by_position
                .entry((page.chapter_id, page.order_number))
                .or_default()
                .push(page_ref);
        }
        for (url_path, pages) in pages_by_path {
            if pages.len() > 1 {
                blockers.push(PublishBlocker::DuplicatePath {
                    url_path: url_path.to_string(),
                    pages: sorted(pages),
                });
            }
        }
        for ((chapter_id, order_number), pages) in pages_by_position {
            if pages.len() > 1 {
                blockers.push(PublishBlocker::DuplicatePageOrderNumber {
                    chapter: chapter_id
                        .map(|id| self.entity_ref(EntityKey::new(ContentEntityType::Chapter, id))),
                    order_number,
                    pages: sorted(pages),
                });
            }
        }
        let mut chapters_by_number: BTreeMap<i32, Vec<EntityRef>> = BTreeMap::new();
        for chapter in &self.chapters {
            let chapter_ref =
                self.entity_ref(EntityKey::new(ContentEntityType::Chapter, chapter.id));
            if !module_ids.contains(&chapter.course_module_id) {
                blockers.push(PublishBlocker::ChapterInMissingModule {
                    chapter: chapter_ref.clone(),
                    module_id: chapter.course_module_id,
                });
            }
            if let Some(front_page_id) = chapter.front_page_id {
                let expected_url_path = chapters::front_page_path(chapter.chapter_number);
                match self.page(front_page_id) {
                    None => blockers.push(PublishBlocker::MissingFrontPage {
                        chapter: chapter_ref.clone(),
                        front_page_id,
                    }),
                    Some(page) if page.chapter_id != Some(chapter.id) => {
                        blockers.push(PublishBlocker::FrontPageInOtherChapter {
                            chapter: chapter_ref.clone(),
                            front_page: page.entity_ref(),
                        })
                    }
                    Some(page) if page.url_path != expected_url_path => {
                        blockers.push(PublishBlocker::FrontPageOffPath {
                            chapter: chapter_ref.clone(),
                            front_page: page.entity_ref(),
                            url_path: page.url_path.clone(),
                            expected_url_path,
                        })
                    }
                    Some(_) => {}
                }
            }
            chapters_by_number
                .entry(chapter.chapter_number)
                .or_default()
                .push(chapter_ref);
        }
        for (chapter_number, chapters) in chapters_by_number {
            if chapters.len() > 1 {
                blockers.push(PublishBlocker::DuplicateChapterNumber {
                    chapter_number,
                    chapters: sorted(chapters),
                });
            }
        }
        let mut modules_by_order_number: BTreeMap<i32, Vec<EntityRef>> = BTreeMap::new();
        for module in &self.modules {
            modules_by_order_number
                .entry(module.order_number)
                .or_default()
                .push(self.entity_ref(EntityKey::new(ContentEntityType::Module, module.id)));
        }
        for (order_number, modules) in modules_by_order_number {
            if modules.len() > 1 {
                blockers.push(PublishBlocker::DuplicateModuleOrderNumber {
                    order_number,
                    modules: sorted(modules),
                });
            }
        }
        blockers
    }

    /// The publish blockers of this state that `before` doesn't have. The entities' labels don't
    /// count, so a blocker that only renames them isn't new.
    pub fn blockers_added_since(&self, before: &CourseState) -> Vec<PublishBlocker> {
        let existing: Vec<PublishBlocker> = before
            .publish_blockers()
            .into_iter()
            .map(PublishBlocker::unlabelled)
            .collect();
        self.publish_blockers()
            .into_iter()
            .filter(|blocker| !existing.contains(&blocker.clone().unlabelled()))
            .collect()
    }
}
