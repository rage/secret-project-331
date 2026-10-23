//! `structural_replace`: match blocks by type and text, then wrap, retype, unwrap or remove each.

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use regex::Regex;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use super::blocks;
use super::error::{EditError, EditErrorCode};
use super::op::{OpKind, PatchOp};
use super::page_content::{self, PageContentResult};
use super::{EngineContext, PageDocument};
use crate::text::{plain_text, preview};

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
    /// Regex on the visible text.
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

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StructuralMatchFound {
    pub page_id: Uuid,
    pub block_id: Uuid,
    pub path: String,
    pub block_name: String,
    pub preview: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StructuralReplaceResult {
    pub matches: Vec<StructuralMatchFound>,
    /// Per changed page, the page engine's result (new blocks and created ids).
    pub changed_pages: Vec<PageContentResult>,
}

enum Action<'a> {
    Wrap(&'a str),
    Retype(&'a str),
    Unwrap,
    Remove,
}

pub fn structural_replace(
    pages: &[PageDocument],
    pattern: &StructuralMatch,
    action: &StructuralAction,
    expected_count: Option<usize>,
    ctx: &EngineContext,
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
        blocks::walk(&page.blocks, &mut |block, path| {
            let inside_exercise = blocks::ancestor_ids(&page.blocks, path).iter().any(|a| {
                blocks::find_path(&page.blocks, *a)
                    .is_some_and(|p| blocks::is_exercise_name(&blocks::get(&page.blocks, &p).name))
            });
            if inside_exercise
                || blocks::is_exercise_name(&block.name)
                || !is_match(block, pattern, text_regex.as_ref())
            {
                return;
            }
            page_matches.push((block.client_id, path.to_vec()));
        });
        if matches!(action, Action::Remove | Action::Unwrap) {
            // A removed or unwrapped ancestor already covers its matched descendants.
            let ancestors: Vec<Vec<usize>> = page_matches.iter().map(|(_, p)| p.clone()).collect();
            page_matches.retain(|(_, path)| {
                !ancestors
                    .iter()
                    .any(|a| a.len() < path.len() && path.starts_with(a))
            });
        }
        for (block_id, path) in &page_matches {
            let block = blocks::get(&page.blocks, path);
            matches.push(StructuralMatchFound {
                page_id: page.page_id,
                block_id: *block_id,
                path: format!("/{block_id}"),
                block_name: block.name.clone(),
                preview: preview(&block_text(block), 60),
            });
        }
        if page_matches.is_empty() {
            continue;
        }
        let ops: Vec<PatchOp> = page_matches
            .iter()
            .filter(|(_, path)| {
                !matches!(action, Action::Unwrap)
                    || !blocks::get(&page.blocks, path).inner_blocks.is_empty()
            })
            .map(|(id, _)| op_for(&action, *id))
            .collect();
        if ops.is_empty() {
            continue;
        }
        let result = page_content::apply(page, &ops, ctx).map_err(|mut e| {
            e.message = format!("on page {}: {}", page.page_id, e.message);
            e
        })?;
        changed_pages.push(result);
    }
    if let Some(expected) = expected_count {
        if expected != matches.len() {
            return Err(EditError::new(
                EditErrorCode::ExpectedCountMismatch,
                format!("expected {expected} matches but found {}; nothing was changed", matches.len()),
            )
            .with_details(json!({"matches": matches.iter().map(|m| json!({"page_id": m.page_id, "path": m.path})).collect::<Vec<_>>()})));
        }
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

fn op_for(action: &Action, id: Uuid) -> PatchOp {
    let mut op = PatchOp {
        op: OpKind::Remove,
        path: format!("/{id}"),
        from: None,
        through: None,
        value: None,
        position: None,
        to_page: None,
        label: None,
        at_text: None,
    };
    match action {
        Action::Wrap(name) => {
            op.op = OpKind::Wrap;
            op.value = Some(json!({"name": name}));
        }
        Action::Retype(name) => {
            op.op = OpKind::Replace;
            op.path = format!("/{id}/name");
            op.value = Some(Value::String(name.to_string()));
        }
        Action::Unwrap => op.op = OpKind::Unwrap,
        Action::Remove => {}
    }
    op
}

fn block_text(block: &GutenbergBlock) -> String {
    block
        .attributes
        .get("content")
        .and_then(Value::as_str)
        .map(plain_text)
        .unwrap_or_default()
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
    let Some(text) = block
        .attributes
        .get("content")
        .and_then(Value::as_str)
        .map(plain_text)
    else {
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
    use crate::test_fixtures::{id, infobox, page, para, top_level};

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
        let ids = SequentialIds::new();
        let action = StructuralAction {
            wrap_in: Some("moocfi/infobox".into()),
            ..Default::default()
        };
        let result = structural_replace(
            &pages(),
            &note_match(),
            &action,
            Some(2),
            &EngineContext::new(&ids),
        )
        .unwrap();
        assert_eq!(result.matches.len(), 2);
        let blocks = &result.changed_pages[0].page.blocks;
        assert_eq!(blocks[0].name, "moocfi/infobox");
        assert_eq!(top_level(&blocks[0].inner_blocks), vec![id("p1")]);
        assert_eq!(blocks[2].inner_blocks[0].name, "moocfi/infobox");
    }

    #[test]
    fn retype_and_remove() {
        let ids = SequentialIds::new();
        let retype = StructuralAction {
            retype_to: Some("core/heading".into()),
            ..Default::default()
        };
        let result = structural_replace(
            &pages(),
            &note_match(),
            &retype,
            None,
            &EngineContext::new(&ids),
        )
        .unwrap();
        assert_eq!(result.changed_pages[0].page.blocks[0].name, "core/heading");
        let remove = StructuralAction {
            remove: Some(true),
            ..Default::default()
        };
        let all = StructuralMatch {
            text_contains: Some("e".into()),
            ..Default::default()
        };
        let result =
            structural_replace(&pages(), &all, &remove, None, &EngineContext::new(&ids)).unwrap();
        assert_eq!(
            top_level(&result.changed_pages[0].page.blocks),
            vec![id("box1")]
        );
    }

    #[test]
    fn action_and_count_checks() {
        let ids = SequentialIds::new();
        let none = StructuralAction::default();
        assert_eq!(
            structural_replace(
                &pages(),
                &note_match(),
                &none,
                None,
                &EngineContext::new(&ids)
            )
            .unwrap_err()
            .code,
            EditErrorCode::InvalidValue
        );
        let wrap = StructuralAction {
            wrap_in: Some("moocfi/infobox".into()),
            ..Default::default()
        };
        let error = structural_replace(
            &pages(),
            &note_match(),
            &wrap,
            Some(5),
            &EngineContext::new(&ids),
        )
        .unwrap_err();
        assert_eq!(error.code, EditErrorCode::ExpectedCountMismatch);
    }
}
