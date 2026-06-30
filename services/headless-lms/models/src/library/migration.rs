use futures::future::BoxFuture;
use headless_lms_utils::document_schema_processor::{
    GutenbergBlock, contains_blocks_not_allowed_in_top_level_pages,
};
use headless_lms_utils::strings::strip_html_tags;
use url::Url;

use std::collections::HashSet;

use crate::{
    SpecFetcher,
    exercise_service_info::ExerciseServiceInfoApi,
    pages::{CmsPageUpdate, NewPage, PageVisibility, normalize_url_path_for_storage},
    prelude::*,
};

/// Creates a new course page from a CMS update payload and returns its id.
///
/// When `title` or `url_path` are empty they are derived from the page content
/// (the first hero-section or heading block, slugified respectively).
pub async fn create_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    mut cms_update: CmsPageUpdate,
    author: Uuid,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<Uuid> {
    if cms_update.title.trim().is_empty() {
        cms_update.title = extract_title_from_blocks(&cms_update.content)
            .unwrap_or_else(|| "Untitled Page".to_string());
    }
    if cms_update.url_path.trim().is_empty() {
        let mut slug = slugify(&cms_update.title);
        if slug.is_empty() {
            slug = "untitled-page".to_string();
        }
        cms_update.url_path =
            ensure_unique_url_path(conn, course_id, &format!("/{}", slug)).await?;
    }

    cms_update.validate_exercise_data()?;

    if cms_update.chapter_id.is_none()
        && contains_blocks_not_allowed_in_top_level_pages(&cms_update.content)
    {
        return Err(model_err!(
            Generic,
            "Top level pages cannot contain exercises, exercise tasks or a list of exercises in the chapter".to_string()
        ));
    }

    let new_page = NewPage {
        exercises: cms_update.exercises,
        exercise_slides: cms_update.exercise_slides,
        exercise_tasks: cms_update.exercise_tasks,
        content: cms_update.content,
        url_path: cms_update.url_path,
        title: cms_update.title,
        course_id: Some(course_id),
        exam_id: None,
        chapter_id: cms_update.chapter_id,
        front_page_of_chapter_id: None,
        content_search_language: None,
        hidden: cms_update.hidden,
    };

    let created = crate::pages::create_for_course_id(
        conn,
        course_id,
        new_page,
        author,
        spec_fetcher,
        fetch_service_info,
    )
    .await?;

    Ok(created.id)
}

/// Extract title from Gutenberg blocks (looks for hero-section or first heading)
fn extract_title_from_blocks(blocks: &[GutenbergBlock]) -> Option<String> {
    fn extract_from_block(block: &GutenbergBlock) -> Option<String> {
        // Blank candidates fall through (not returned) so the search continues to the
        // next block; if nothing usable is found the caller defaults to "Untitled Page".
        if block.name == "moocfi/hero-section" {
            let attrs = &block.attributes;
            if let Some(title) = attrs.get("title").and_then(|v| v.as_str()) {
                let title = title.trim_matches('\'').trim_matches('"').trim();
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
        if block.name.starts_with("core/heading") {
            let attrs = &block.attributes;
            if let Some(content) = attrs.get("content").and_then(|v| v.as_str()) {
                let clean = strip_html_tags(content);
                let clean = clean.trim();
                if !clean.is_empty() {
                    return Some(clean.to_string());
                }
            }
        }
        // Recursively check inner blocks
        for inner in &block.inner_blocks {
            if let Some(title) = extract_from_block(inner) {
                return Some(title);
            }
        }
        None
    }

    for block in blocks {
        if let Some(title) = extract_from_block(block) {
            return Some(title);
        }
    }
    None
}

/// Generate a URL-safe slug from a title.
///
/// Lowercases, keeps alphanumeric characters, and collapses every run of other characters
/// (whitespace and punctuation alike) into a single `-`, with no leading or trailing separator.
fn slugify(text: &str) -> String {
    let mut slug = String::with_capacity(text.len());
    let mut pending_separator = false;
    for c in text.to_lowercase().chars() {
        if c.is_alphanumeric() {
            if pending_separator && !slug.is_empty() {
                slug.push('-');
            }
            pending_separator = false;
            slug.push(c);
        } else {
            pending_separator = true;
        }
    }
    slug
}

/// Appends a numeric suffix to `base_path` until it no longer collides with an existing
/// (non-deleted) page in the course, so deriving slugs from duplicate or empty titles cannot
/// hit the unique `(course_id, url_path)` constraint and abort the migration.
async fn ensure_unique_url_path(
    conn: &mut PgConnection,
    course_id: Uuid,
    base_path: &str,
) -> ModelResult<String> {
    let existing: HashSet<String> =
        crate::pages::get_all_by_course_id_and_visibility(conn, course_id, PageVisibility::Any)
            .await?
            .into_iter()
            .map(|p| p.url_path)
            .collect();

    let mut candidate = base_path.to_string();
    let mut counter = 2;
    while existing.contains(&normalize_url_path_for_storage(&candidate)) {
        candidate = format!("{}-{}", base_path, counter);
        counter += 1;
    }
    Ok(candidate)
}
