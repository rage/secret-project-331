//! A compact account of what a structure call changed, for dry runs.

use std::collections::{HashMap, HashSet};

use serde::Serialize;
use uuid::Uuid;

use super::model::{CourseStructure, StructureChapter, StructurePage};

/// Lines of an outline in brief form; the counts still cover everything.
const BRIEF_MAX_LINES: usize = 60;

/// What a call changed of chapters and pages: counts, and one line per changed entity.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StructureOutline {
    pub chapters: OutlineCounts,
    pub pages: OutlineCounts,
    /// `+` created, `-` removed, `~` changed; chapters first.
    pub lines: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lines_omitted: Option<usize>,
}

/// How many entities of a kind a call created, removed or changed.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct OutlineCounts {
    pub created: usize,
    pub removed: usize,
    pub changed: usize,
}

struct PageSite<'a> {
    page: &'a StructurePage,
    chapter: Option<&'a StructureChapter>,
    index: usize,
}

fn page_sites(structure: &CourseStructure) -> HashMap<Uuid, PageSite<'_>> {
    let top_level = structure.pages.iter().enumerate().map(|(index, page)| {
        (
            page.id,
            PageSite {
                page,
                chapter: None,
                index,
            },
        )
    });
    let in_chapters = structure.chapters().flat_map(|chapter| {
        chapter.pages.iter().enumerate().map(move |(index, page)| {
            (
                page.id,
                PageSite {
                    page,
                    chapter: Some(chapter),
                    index,
                },
            )
        })
    });
    top_level.chain(in_chapters).collect()
}

fn place(chapter: Option<&StructureChapter>) -> String {
    match chapter {
        Some(chapter) => format!("chapter {}", chapter.chapter_number),
        None => "top level".to_string(),
    }
}

/// The order of the pages of `chapter` that exist in both `before` and `after`.
fn surviving_order(chapter: &[StructurePage], survivors: &HashSet<Uuid>) -> Vec<Uuid> {
    chapter
        .iter()
        .map(|page| page.id)
        .filter(|id| survivors.contains(id))
        .collect()
}

/// The chapters and pages `after` has, lacks or changes compared with `before`. Positions are
/// 1-based and reported only for pages that moved relative to the pages that stayed.
pub fn outline(
    before: &CourseStructure,
    after: &CourseStructure,
    is_brief: bool,
) -> StructureOutline {
    let mut lines = Vec::new();
    let mut chapter_counts = OutlineCounts::default();
    let mut page_counts = OutlineCounts::default();

    let modules_before: HashMap<Uuid, Uuid> = before
        .modules()
        .flat_map(|module| module.chapters.iter().map(move |c| (c.id, module.id)))
        .collect();
    let chapters_before: HashMap<Uuid, &StructureChapter> = before
        .chapters()
        .map(|chapter| (chapter.id, chapter))
        .collect();
    let chapters_after: HashMap<Uuid, &StructureChapter> = after
        .chapters()
        .map(|chapter| (chapter.id, chapter))
        .collect();

    for module in after.modules() {
        for chapter in &module.chapters {
            match chapters_before.get(&chapter.id) {
                None => {
                    chapter_counts.created += 1;
                    lines.push(format!(
                        "+ chapter {} \"{}\" as chapter {}",
                        chapter.id, chapter.name, chapter.chapter_number
                    ));
                }
                Some(old) => {
                    let mut parts = Vec::new();
                    if old.name != chapter.name {
                        parts.push(format!("name \"{}\" -> \"{}\"", old.name, chapter.name));
                    }
                    if old.chapter_number != chapter.chapter_number {
                        parts.push(format!(
                            "number {} -> {}",
                            old.chapter_number, chapter.chapter_number
                        ));
                    }
                    if modules_before.get(&chapter.id) != Some(&module.id) {
                        parts.push(format!(
                            "moved to module {}",
                            module.name.as_deref().unwrap_or("(default)")
                        ));
                    }
                    for (field, is_changed) in [
                        ("color", old.color != chapter.color),
                        ("opens_at", old.opens_at != chapter.opens_at),
                        ("deadline", old.deadline != chapter.deadline),
                    ] {
                        if is_changed {
                            parts.push(format!("{field} changed"));
                        }
                    }
                    if !parts.is_empty() {
                        chapter_counts.changed += 1;
                        lines.push(format!(
                            "~ chapter {} \"{}\": {}",
                            chapter.id,
                            chapter.name,
                            parts.join("; ")
                        ));
                    }
                }
            }
        }
    }
    for chapter in before.chapters() {
        if !chapters_after.contains_key(&chapter.id) {
            chapter_counts.removed += 1;
            lines.push(format!(
                "- chapter {} \"{}\" (was chapter {})",
                chapter.id, chapter.name, chapter.chapter_number
            ));
        }
    }

    let sites_before = page_sites(before);
    let sites_after = page_sites(after);
    let survivors: HashSet<Uuid> = sites_after
        .keys()
        .filter(|id| sites_before.contains_key(*id))
        .copied()
        .collect();
    let order_before: HashMap<Option<Uuid>, Vec<Uuid>> =
        std::iter::once((None, surviving_order(&before.pages, &survivors)))
            .chain(
                before
                    .chapters()
                    .map(|c| (Some(c.id), surviving_order(&c.pages, &survivors))),
            )
            .collect();
    let order_after: HashMap<Option<Uuid>, Vec<Uuid>> =
        std::iter::once((None, surviving_order(&after.pages, &survivors)))
            .chain(
                after
                    .chapters()
                    .map(|c| (Some(c.id), surviving_order(&c.pages, &survivors))),
            )
            .collect();
    let rank = |orders: &HashMap<Option<Uuid>, Vec<Uuid>>, site: &PageSite<'_>| {
        orders
            .get(&site.chapter.map(|c| c.id))
            .and_then(|order| order.iter().position(|id| *id == site.page.id))
    };

    let after_in_order = after.pages().map(|(_, page)| page.id);
    for id in after_in_order {
        let new = &sites_after[&id];
        let Some(old) = sites_before.get(&id) else {
            page_counts.created += 1;
            lines.push(format!(
                "+ page {id} \"{}\" {} ({}, position {})",
                new.page.title,
                new.page.url_path,
                place(new.chapter),
                new.index + 1
            ));
            continue;
        };
        let mut parts = Vec::new();
        if old.page.title != new.page.title {
            parts.push(format!(
                "title \"{}\" -> \"{}\"",
                old.page.title, new.page.title
            ));
        }
        if old.page.url_path != new.page.url_path {
            parts.push(format!("{} -> {}", old.page.url_path, new.page.url_path));
        }
        if old.page.hidden != new.page.hidden {
            parts.push(format!("hidden {} -> {}", old.page.hidden, new.page.hidden));
        }
        let old_chapter = old.chapter.map(|c| c.id);
        let new_chapter = new.chapter.map(|c| c.id);
        if old_chapter != new_chapter {
            parts.push(format!(
                "moved from {} to {}, position {}",
                place(old.chapter),
                place(new.chapter),
                new.index + 1
            ));
        } else if rank(&order_before, old) != rank(&order_after, new) {
            parts.push(format!("position {} -> {}", old.index + 1, new.index + 1));
        }
        if !parts.is_empty() {
            page_counts.changed += 1;
            lines.push(format!(
                "~ page {id} \"{}\": {}",
                new.page.title,
                parts.join("; ")
            ));
        }
    }
    for (_, page) in before.pages() {
        if !sites_after.contains_key(&page.id) {
            page_counts.removed += 1;
            let site = &sites_before[&page.id];
            lines.push(format!(
                "- page {} \"{}\" {} ({})",
                page.id,
                page.title,
                page.url_path,
                place(site.chapter)
            ));
        }
    }

    let lines_omitted = (is_brief && lines.len() > BRIEF_MAX_LINES).then(|| {
        let omitted = lines.len() - BRIEF_MAX_LINES;
        lines.truncate(BRIEF_MAX_LINES);
        omitted
    });
    StructureOutline {
        chapters: chapter_counts,
        pages: page_counts,
        lines,
        lines_omitted,
    }
}
