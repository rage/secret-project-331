//! What a staged page needs before the agent may publish it: a hero section as its h1, and none of
//! the default templates' placeholder text.

use headless_lms_models::library::agent_changesets::course_state::{CourseState, PageRecord};
use headless_lms_models::library::content_management::TEMPLATE_PLACEHOLDER_TEXTS;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde::Serialize;
use uuid::Uuid;

use crate::engine::blocks::{TEXT_ATTRIBUTES, walk_outside_exercises};
use crate::text::plain_text;

/// The only blocks the CMS heading rules accept as a page's h1 (`headingHierarchy.ts`).
pub const PAGE_TITLE_BLOCKS: [&str; 2] =
    ["moocfi/hero-section", "moocfi/landing-page-hero-section"];

/// The pages of `staged` whose blocks differ from `live`, new pages included.
pub fn pages_with_content_changes<'a>(
    staged: &'a CourseState,
    live: &'a CourseState,
) -> impl Iterator<Item = &'a PageRecord> {
    staged.pages.iter().filter(|page| {
        live.page(page.id)
            .is_none_or(|live| live.content != page.content)
    })
}

/// Whether the blocks hold a [`PAGE_TITLE_BLOCKS`] block with a title.
pub fn has_page_title(blocks: &[GutenbergBlock]) -> bool {
    let mut found = false;
    walk_outside_exercises(blocks, &mut |block, _| {
        found = found
            || (PAGE_TITLE_BLOCKS.contains(&block.name.as_str())
                && block
                    .attributes
                    .get("title")
                    .and_then(serde_json::Value::as_str)
                    .is_some_and(|title| !plain_text(title).is_empty()));
    });
    found
}

/// A block text attribute that is still a default template's placeholder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PlaceholderText {
    pub block: Uuid,
    pub block_name: String,
    pub attribute: &'static str,
    pub text: &'static str,
}

/// The text attributes in `blocks` whose whole text is one of [`TEMPLATE_PLACEHOLDER_TEXTS`].
pub fn placeholder_texts(blocks: &[GutenbergBlock]) -> Vec<PlaceholderText> {
    let mut found = Vec::new();
    walk_outside_exercises(blocks, &mut |block, _| {
        for attribute in TEXT_ATTRIBUTES {
            let Some(value) = block.attributes.get(attribute).and_then(|v| v.as_str()) else {
                continue;
            };
            let text = plain_text(value);
            if let Some(placeholder) = TEMPLATE_PLACEHOLDER_TEXTS
                .iter()
                .find(|placeholder| **placeholder == text)
            {
                found.push(PlaceholderText {
                    block: block.client_id,
                    block_name: block.name.clone(),
                    attribute,
                    text: placeholder,
                });
            }
        }
    });
    found
}
