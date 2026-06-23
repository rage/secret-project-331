use futures::future::BoxFuture;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use url::Url;

use crate::{
    SpecFetcher,
    exercise_service_info::ExerciseServiceInfoApi,
    pages::{CmsPageUpdate, NewPage},
    prelude::*,
};

/// Creates a new course page from a CMS update payload.
///
/// When `title` or `url_path` are empty they are derived from the page content
/// (the first hero-section or heading block, slugified respectively). Returns
/// the new page id together with the id of its latest page history entry.
pub async fn create_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    mut cms_update: CmsPageUpdate,
    author: Uuid,
    spec_fetcher: impl SpecFetcher,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<(Uuid, Uuid)> {
    if cms_update.title.trim().is_empty() {
        cms_update.title = extract_title_from_blocks(&cms_update.content)
            .unwrap_or_else(|| "Untitled Page".to_string());
    }
    if cms_update.url_path.trim().is_empty() {
        cms_update.url_path = format!("/{}", slugify(&cms_update.title));
    }

    cms_update.validate_exercise_data()?;

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

    let latest_map =
        crate::page_history::get_latest_page_history_ids_by_course_ids(conn, &[course_id]).await?;
    let history_id = latest_map
        .get(&created.id)
        .cloned()
        .ok_or_else(|| model_err!(NotFound, "page history not found".to_string()))?;

    Ok((created.id, history_id))
}

/// Extract title from Gutenberg blocks (looks for hero-section or first heading)
fn extract_title_from_blocks(blocks: &[GutenbergBlock]) -> Option<String> {
    fn extract_from_block(block: &GutenbergBlock) -> Option<String> {
        if block.name == "moocfi/hero-section" {
            let attrs = &block.attributes;
            if let Some(title) = attrs.get("title").and_then(|v| v.as_str()) {
                return Some(title.trim_matches('\'').trim_matches('"').to_string());
            }
        }
        if block.name.starts_with("core/heading") {
            let attrs = &block.attributes;
            if let Some(content) = attrs.get("content").and_then(|v| v.as_str()) {
                // Strip HTML tags for a clean title
                let clean = content.replace("<strong>", "").replace("</strong>", "");
                return Some(clean.trim().to_string());
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

/// Generate a URL-safe slug from a title
fn slugify(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c
            } else if c.is_whitespace() {
                '-'
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
