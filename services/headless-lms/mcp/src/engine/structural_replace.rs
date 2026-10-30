//! `structural_replace`: match blocks by type and text, then wrap, retype, unwrap or remove each.

use std::borrow::Cow;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use regex::Regex;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use super::blocks;
use super::error::{EditError, EditErrorCode};
use super::op::Op;
use super::page_content;
use super::read::block_preview;
use super::{BlockMatch, Document, DocumentRef, PageDocument};
use crate::ids::IdGenerator;
use crate::text::plain_text;

/// Which blocks to act on. Every given condition must hold; text conditions look at the visible
/// text of the block's `content`, without markup.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct StructuralMatch {
    /// Block type, e.g. `core/paragraph`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_starts_with: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_contains: Option<String>,
    /// Regex on the visible text. Rust regex syntax: no backreferences or lookaround; (?i) for
    /// case-insensitive.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_regex: Option<String>,
}

/// What to do with each match. Exactly one field.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct StructuralAction {
    /// Wrap each matched block in a new block of this type.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wrap_in: Option<String>,
    /// Change each matched block's type, keeping attributes and children.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub retype_to: Option<String>,
    /// Replace each matched container with its children.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unwrap: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remove: Option<bool>,
}

/// The blocks that matched and the pages the action changed.
#[derive(Debug, Clone, PartialEq)]
pub struct StructuralReplaceResult {
    pub matches: Vec<BlockMatch>,
    pub changed_pages: Vec<Document>,
}

enum Action<'a> {
    Wrap(&'a str),
    Retype(&'a str),
    Unwrap,
    Remove,
}

/// Applies `action` to each block of `pages` that `pattern` matches, by the page tool's rules.
/// Fails without changing anything when `expected_count` differs from the matches.
pub fn structural_replace(
    pages: &[DocumentRef],
    pattern: &StructuralMatch,
    action: &StructuralAction,
    expected_count: Option<usize>,
    ids: &dyn IdGenerator,
) -> Result<StructuralReplaceResult, EditError> {
    let action = parse_action(action)?;
    if pattern == &StructuralMatch::default() {
        return Err(EditError::new(
            EditErrorCode::MissingField,
            "match needs at least one condition: name, text_starts_with, text_contains or text_regex",
        ));
    }
    let text_regex = pattern
        .text_regex
        .as_deref()
        .map(Regex::new)
        .transpose()
        .map_err(|e| {
            EditError::new(
                EditErrorCode::InvalidRegex,
                format!("text_regex isn't a valid regex: {e}"),
            )
        })?;

    let mut matches = Vec::new();
    let mut changed_pages = Vec::new();
    for page in pages {
        let mut page_matches: Vec<(Uuid, Vec<usize>)> = Vec::new();
        blocks::walk_outside_exercises(page.blocks, &mut |block, path| {
            if is_match(block, pattern, text_regex.as_ref()) {
                page_matches.push((block.client_id, path.to_vec()));
            }
        });
        match action {
            Action::Remove => {
                // A removed ancestor already removes its matched descendants.
                let ancestors: Vec<Vec<usize>> =
                    page_matches.iter().map(|(_, p)| p.clone()).collect();
                page_matches.retain(|(_, path)| {
                    !ancestors
                        .iter()
                        .any(|a| a.len() < path.len() && path.starts_with(a))
                });
            }
            Action::Unwrap => page_matches.retain(|(_, path)| {
                blocks::get(page.blocks, path).is_ok_and(|block| !block.inner_blocks.is_empty())
            }),
            _ => {}
        }
        for (block_id, path) in &page_matches {
            let block = blocks::get(page.blocks, path)?;
            matches.push(page.key.block_match(
                block,
                format!("/{block_id}"),
                block_preview(block).unwrap_or_default(),
            ));
        }
        if page_matches.is_empty() {
            continue;
        }
        let ops: Vec<Op> = page_matches
            .iter()
            .map(|(id, _)| op_for(&action, *id))
            .collect();
        // Only ops that reach other pages use the id; these don't.
        let document = PageDocument {
            page_id: page.key.page_id().unwrap_or_default(),
            page_type: page.page_type,
            blocks: page.blocks.to_vec(),
        };
        let result = page_content::apply(document, &|_| None, &ops, ids).map_err(|mut e| {
            e.message = format!("in {}: {}", page.key, e.message);
            e
        })?;
        changed_pages.push(Document {
            key: page.key,
            page_type: page.page_type,
            blocks: result.page.blocks,
        });
    }
    if let Some(expected) = expected_count
        && expected != matches.len()
    {
        return Err(EditError::expected_count_mismatch(
            expected,
            matches.len(),
            matches.iter().map(|m| m.location(None)).collect(),
        ));
    }
    Ok(StructuralReplaceResult {
        matches,
        changed_pages,
    })
}

fn parse_action(action: &StructuralAction) -> Result<Action<'_>, EditError> {
    let mut chosen = Vec::new();
    if let Some(name) = &action.wrap_in {
        chosen.push(Action::Wrap(name));
    }
    if let Some(name) = &action.retype_to {
        chosen.push(Action::Retype(name));
    }
    if action.unwrap == Some(true) {
        chosen.push(Action::Unwrap);
    }
    if action.remove == Some(true) {
        chosen.push(Action::Remove);
    }
    if chosen.len() != 1 {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            "action takes exactly one of wrap_in, retype_to, unwrap: true or remove: true",
        ));
    }
    Ok(chosen.remove(0))
}

fn op_for(action: &Action, id: Uuid) -> Op {
    let path = format!("/{id}");
    match action {
        Action::Wrap(name) => Op::Wrap {
            path,
            through: None,
            value: json!({ "name": name }),
            label: None,
        },
        Action::Retype(name) => Op::Replace {
            path: format!("{path}/name"),
            value: Value::String(name.to_string()),
        },
        Action::Unwrap => Op::Unwrap { path },
        Action::Remove => Op::Remove {
            path,
            through: None,
        },
    }
}

/// The visible text of the block's `content`, without markup.
fn block_text(block: &GutenbergBlock) -> Option<Cow<'_, str>> {
    block
        .attributes
        .get("content")
        .and_then(Value::as_str)
        .map(plain_text)
}

fn is_match(block: &GutenbergBlock, pattern: &StructuralMatch, text_regex: Option<&Regex>) -> bool {
    if pattern
        .name
        .as_ref()
        .is_some_and(|name| *name != block.name)
    {
        return false;
    }
    let needs_text = pattern.text_starts_with.is_some()
        || pattern.text_contains.is_some()
        || text_regex.is_some();
    if !needs_text {
        return true;
    }
    let Some(text) = block_text(block) else {
        return false;
    };
    pattern
        .text_starts_with
        .as_ref()
        .is_none_or(|p| text.starts_with(p.as_str()))
        && pattern
            .text_contains
            .as_ref()
            .is_none_or(|p| text.contains(p.as_str()))
        && text_regex.is_none_or(|re| re.is_match(&text))
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::engine::PageType;
    use crate::ids::SequentialIds;
    use crate::test_fixtures::{document_refs, id, infobox, page, para, top_level};

    fn pages() -> Vec<PageDocument> {
        vec![page(
            "pg1",
            PageType::CoursePage,
            vec![
                para("p1", "<strong>Note:</strong> remember this."),
                para("p2", "Regular text."),
                infobox("box1", vec![para("p3", "Note: nested.")]),
            ],
        )]
    }

    fn note_match() -> StructuralMatch {
        StructuralMatch {
            name: Some("core/paragraph".into()),
            text_starts_with: Some("Note:".into()),
            ..Default::default()
        }
    }

    #[test]
    fn wraps_each_match_ignoring_markup() {
        let ids = SequentialIds::default();
        let action = StructuralAction {
            wrap_in: Some("moocfi/infobox".into()),
            ..Default::default()
        };
        let result = structural_replace(
            &document_refs(&pages()),
            &note_match(),
            &action,
            Some(2),
            &ids,
        )
        .unwrap();
        assert_eq!(result.matches.len(), 2);
        let blocks = &result.changed_pages[0].blocks;
        assert_eq!(blocks[0].name, "moocfi/infobox");
        assert_eq!(top_level(&blocks[0].inner_blocks), vec![id("p1")]);
        assert_eq!(blocks[2].inner_blocks[0].name, "moocfi/infobox");
    }

    #[test]
    fn retype_and_remove() {
        let ids = SequentialIds::default();
        let retype = StructuralAction {
            retype_to: Some("core/heading".into()),
            ..Default::default()
        };
        let result =
            structural_replace(&document_refs(&pages()), &note_match(), &retype, None, &ids)
                .unwrap();
        assert_eq!(result.changed_pages[0].blocks[0].name, "core/heading");
        let remove = StructuralAction {
            remove: Some(true),
            ..Default::default()
        };
        let all = StructuralMatch {
            text_contains: Some("e".into()),
            ..Default::default()
        };
        let result =
            structural_replace(&document_refs(&pages()), &all, &remove, None, &ids).unwrap();
        assert_eq!(top_level(&result.changed_pages[0].blocks), vec![id("box1")]);
    }

    #[test]
    fn unwrap_reaches_nested_matches_and_skips_empty_ones() {
        let ids = SequentialIds::default();
        let doc = vec![page(
            "pg1",
            PageType::CoursePage,
            vec![
                infobox("box1", vec![infobox("box2", vec![para("p1", "Inside.")])]),
                infobox("empty", vec![]),
            ],
        )];
        let boxes = StructuralMatch {
            name: Some("moocfi/infobox".into()),
            ..Default::default()
        };
        let unwrap = StructuralAction {
            unwrap: Some(true),
            ..Default::default()
        };
        let result =
            structural_replace(&document_refs(&doc), &boxes, &unwrap, Some(2), &ids).unwrap();
        assert_eq!(result.matches.len(), 2);
        assert_eq!(
            top_level(&result.changed_pages[0].blocks),
            vec![id("p1"), id("empty")]
        );
    }

    #[test]
    fn action_and_count_checks() {
        let ids = SequentialIds::default();
        let none = StructuralAction::default();
        assert_eq!(
            structural_replace(&document_refs(&pages()), &note_match(), &none, None, &ids)
                .unwrap_err()
                .code,
            EditErrorCode::InvalidValue
        );
        let wrap = StructuralAction {
            wrap_in: Some("moocfi/infobox".into()),
            ..Default::default()
        };
        let error = structural_replace(
            &document_refs(&pages()),
            &note_match(),
            &wrap,
            Some(5),
            &ids,
        )
        .unwrap_err();
        assert_eq!(error.code, EditErrorCode::ExpectedCountMismatch);
    }
}
