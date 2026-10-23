//! Page URL paths: the ones a structure call derives at its end, and links to the old ones.

use std::collections::{HashMap, HashSet};

use headless_lms_models::chapters;
use headless_lms_models::library::agent_changesets::CreatedRedirect;
use headless_lms_models::pages::normalize_url_path_for_storage;
use headless_lms_utils::strings::slugify;
use serde::Serialize;
use uuid::Uuid;

use super::model::{CourseStructure, StructurePage};
use crate::engine::error::{EditError, EditErrorCode, Warning, WarningCode};
use crate::engine::{PageRef, blocks};

/// A link in course content that points at a page's old path.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LinkToOldPath {
    pub page_id: Uuid,
    pub block_id: Uuid,
    pub old_path: String,
    pub new_path: String,
    /// The page now at the old path, which wins over the redirect from it, so the link opens it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub now_opens_page: Option<Uuid>,
}

/// Links in `pages` whose target ends in `/<course slug><old path>` of a page in `changed`.
/// `structure` has the paths after the change. The links are reported, not rewritten: most keep
/// working through the redirects, but one whose old path another page now has opens that page.
pub(super) fn find_links_to_old_paths(
    pages: &[PageRef],
    course_slug: &str,
    changed: &[CreatedRedirect],
    structure: &CourseStructure,
) -> Vec<LinkToOldPath> {
    if changed.is_empty() {
        return Vec::new();
    }
    let by_old_path: HashMap<&str, &CreatedRedirect> = changed
        .iter()
        .map(|change| (change.old_url_path.trim_end_matches('/'), change))
        .collect();
    let path_owners: HashMap<&str, Uuid> = structure
        .pages()
        .map(|(_, page)| (page.url_path.as_str(), page.id))
        .collect();
    let course_prefix = format!("/{course_slug}");
    let mut found = Vec::new();
    let mut is_found: HashSet<(Uuid, &str)> = HashSet::new();
    for page in pages {
        blocks::walk(page.blocks, &mut |block, _| {
            blocks::for_each_string(&block.attributes, &mut |text| {
                for (at, _) in text.match_indices(course_prefix.as_str()) {
                    let after = &text[at + course_prefix.len()..];
                    let path = &after[..after.find(['"', '\'', '#', '?']).unwrap_or(after.len())];
                    if let Some(change) = by_old_path.get(path)
                        && is_found.insert((block.client_id, change.old_url_path.as_str()))
                    {
                        found.push(LinkToOldPath {
                            page_id: page.page_id,
                            block_id: block.client_id,
                            old_path: change.old_url_path.clone(),
                            new_path: change.new_url_path.clone(),
                            now_opens_page: path_owners
                                .get(change.old_url_path.as_str())
                                .filter(|owner| **owner != change.page_id)
                                .copied(),
                        });
                    }
                }
            });
        });
    }
    found
}

/// The paths a call's ops asked for, applied when the call ends.
#[derive(Debug, Default)]
pub(super) struct PathRequests {
    /// `url_path`s set by ops, as given.
    explicit: HashMap<Uuid, String>,
    /// The path segment of each page copy, `<source segment>-copy`; it gets a suffix on collision
    /// like other derived paths.
    copy_segments: HashMap<Uuid, String>,
}

impl PathRequests {
    /// Requests `path` for the page `page_id`.
    pub(super) fn set_explicit(&mut self, page_id: Uuid, path: String) {
        self.explicit.insert(page_id, path);
    }

    /// Derives the path segment of `copy_id`, a copy of `source`.
    pub(super) fn add_copy(&mut self, copy_id: Uuid, source: &StructurePage) {
        let segment =
            last_segment(&source.url_path).unwrap_or_else(|| title_segment(&source.title));
        self.copy_segments
            .insert(copy_id, format!("{segment}-copy"));
    }

    /// The last path segment a page gets when no op set its path: the one it had, a copy's
    /// `<source>-copy`, or its slugified title.
    fn derived_segment(
        &self,
        page: &StructurePage,
        before_paths: &HashMap<Uuid, String>,
    ) -> String {
        before_paths
            .get(&page.id)
            .and_then(|old| last_segment(old))
            .or_else(|| self.copy_segments.get(&page.id).cloned())
            .unwrap_or_else(|| title_segment(&page.title))
    }
}

/// A page's path before collisions are resolved.
struct PlannedPath {
    page_id: Uuid,
    path: String,
    /// Set by an op or fixed by the page's position; collisions with it are errors.
    is_explicit: bool,
}

/// Gives every page of `doc` its final path: chapter front pages `/chapter-N`, other chapter
/// pages `/chapter-N/<segment>`, top-level pages their own path. Derived paths get a suffix on
/// collision, with a warning; explicit duplicates are errors.
pub(super) fn assign_paths(
    doc: &mut CourseStructure,
    requests: &PathRequests,
    before_paths: &HashMap<Uuid, String>,
    front_page: Option<Uuid>,
) -> Result<Vec<Warning>, EditError> {
    let mut planned: Vec<PlannedPath> = Vec::new();
    let mut plan = |page_id, path, is_explicit| {
        planned.push(PlannedPath {
            page_id,
            path,
            is_explicit,
        })
    };
    for page in &doc.pages {
        if Some(page.id) == front_page {
            plan(page.id, "/".to_string(), true);
            continue;
        }
        match requests.explicit.get(&page.id) {
            Some(raw) => plan(page.id, normalize_top_level_path(raw)?, true),
            None => {
                let path = match before_paths.get(&page.id) {
                    Some(old) if !old.starts_with("/chapter-") && !old.is_empty() => old.clone(),
                    _ => format!("/{}", requests.derived_segment(page, before_paths)),
                };
                plan(page.id, path, false);
            }
        }
    }
    for chapter in doc.chapters() {
        let prefix = chapters::front_page_path(chapter.chapter_number);
        for (index, page) in chapter.pages.iter().enumerate() {
            if index == 0 {
                if let Some(raw) = requests.explicit.get(&page.id) {
                    let accepted = raw.trim_end_matches('/') == prefix || raw.trim().is_empty();
                    if !accepted {
                        return Err(EditError::new(
                            EditErrorCode::InvalidUrlPath,
                            format!(
                                "page {} is the first page of chapter {}, so its path is always {prefix}",
                                page.id, chapter.chapter_number
                            ),
                        ));
                    }
                }
                plan(page.id, prefix.clone(), true);
                continue;
            }
            let (segment, is_explicit) = match requests.explicit.get(&page.id) {
                Some(raw) => (chapter_page_segment(raw, &prefix)?, true),
                None => (requests.derived_segment(page, before_paths), false),
            };
            plan(page.id, format!("{prefix}/{segment}"), is_explicit);
        }
    }

    let mut taken: HashMap<String, Uuid> = HashMap::new();
    // Paths that stay as they were count as taken too, so an explicit path never silently
    // renames another page.
    for PlannedPath {
        page_id: id,
        path,
        is_explicit,
    } in &planned
    {
        let is_kept = before_paths.get(id).is_some_and(|old| old == path);
        if (*is_explicit || is_kept)
            && let Some(other) = taken.insert(path.clone(), *id)
        {
            return Err(EditError::new(
                EditErrorCode::DuplicatePath,
                format!("pages {other} and {id} would both have the path {path}"),
            )
            .with_fix("give one of them another url_path"));
        }
    }
    let mut warnings = Vec::new();
    let mut final_paths: HashMap<Uuid, String> = HashMap::new();
    for PlannedPath {
        page_id: id,
        path,
        is_explicit,
    } in planned
    {
        if is_explicit || taken.get(&path) == Some(&id) {
            final_paths.insert(id, path);
            continue;
        }
        let mut candidate = path.clone();
        let mut suffix = 2;
        while taken.get(&candidate).is_some_and(|holder| *holder != id) {
            candidate = format!("{path}-{suffix}");
            suffix += 1;
        }
        if candidate != path && before_paths.get(&id).is_none_or(|old| *old != candidate) {
            warnings.push(Warning::new(
                WarningCode::UrlPathAdjusted,
                format!("page {id} got the path {candidate} because {path} was taken"),
            ));
        }
        taken.insert(candidate.clone(), id);
        final_paths.insert(id, candidate);
    }
    for page in doc.pages_mut() {
        if let Some(path) = final_paths.remove(&page.id) {
            page.url_path = path;
        }
    }
    Ok(warnings)
}

/// Old and new paths of the pages of `doc` whose path differs from `before_paths`.
pub(super) fn path_changes(
    doc: &CourseStructure,
    before_paths: &HashMap<Uuid, String>,
) -> Vec<CreatedRedirect> {
    doc.pages()
        .filter_map(|(_, page)| {
            let old = before_paths.get(&page.id)?;
            (*old != page.url_path).then(|| CreatedRedirect {
                page_id: page.id,
                old_url_path: old.clone(),
                new_url_path: page.url_path.clone(),
            })
        })
        .collect()
}

fn is_chapter_segment(segment: &str) -> bool {
    segment
        .strip_prefix("chapter-")
        .is_some_and(|n| n.parse::<u32>().is_ok())
}

fn last_segment(path: &str) -> Option<String> {
    path.rsplit('/')
        .next()
        .filter(|s| !s.is_empty() && !is_chapter_segment(s))
        .map(str::to_string)
}

/// The path segment a page with `title` gets.
fn title_segment(title: &str) -> String {
    let slug = slugify(title);
    if slug.is_empty() {
        "page".to_string()
    } else {
        slug
    }
}

/// `raw` as one path segment, in the form storage keeps ([`normalize_url_path_for_storage`]), so
/// an agent can set any path a teacher can.
fn normalize_segment(raw: &str) -> Result<String, EditError> {
    let segment = normalize_url_path_for_storage(raw.trim());
    // A dot segment would make the page unreachable: URL resolution removes it.
    if segment.is_empty() || segment == "." || segment == ".." || segment.contains('/') {
        return Err(EditError::new(
            EditErrorCode::InvalidUrlPath,
            format!("\"{raw}\" isn't a valid path segment; use letters, digits and dashes"),
        )
        .with_fix(title_segment(raw)));
    }
    Ok(segment)
}

fn normalize_top_level_path(raw: &str) -> Result<String, EditError> {
    let trimmed = raw.trim().trim_end_matches('/');
    let Some(rest) = trimmed.strip_prefix('/') else {
        return Err(EditError::new(
            EditErrorCode::InvalidUrlPath,
            format!("\"{raw}\" must start with /"),
        )
        .with_fix(format!("/{}", raw.trim())));
    };
    let segments = rest
        .split('/')
        .map(normalize_segment)
        .collect::<Result<Vec<_>, _>>()?;
    if segments
        .first()
        .is_some_and(|first| is_chapter_segment(first))
    {
        return Err(EditError::new(
            EditErrorCode::InvalidUrlPath,
            "paths starting with /chapter-N belong to chapter pages",
        ));
    }
    Ok(format!("/{}", segments.join("/")))
}

/// A chapter page's explicit path: its last segment alone, or the whole path under some `/chapter-N`.
fn chapter_page_segment(raw: &str, prefix: &str) -> Result<String, EditError> {
    let trimmed = raw.trim().trim_end_matches('/');
    let candidate = match trimmed.strip_prefix('/') {
        None => trimmed,
        Some(rest) => match rest.split_once('/') {
            Some((first, last)) if is_chapter_segment(first) && !last.contains('/') => last,
            _ => {
                let segment = title_segment(trimmed);
                return Err(EditError::new(
                    EditErrorCode::InvalidUrlPath,
                    format!("chapter pages live under {prefix}/; \"{raw}\" doesn't fit"),
                )
                .with_fix(format!(
                    "give only the last part, e.g. \"{segment}\", which becomes {prefix}/{segment}"
                )));
            }
        },
    };
    normalize_segment(candidate)
}
