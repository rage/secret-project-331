//! `find_replace`: literal or regex search, optionally replace, over the raw stored strings of
//! text-bearing block attributes. Matching sees markup: `<em>for</em> loops` doesn't match "for loops".

use std::collections::BTreeMap;

use regex::Regex;
use serde::Serialize;
use serde_json::Value;

use super::blocks::{self, TEXT_ATTRIBUTES};
use super::error::{EditError, EditErrorCode};
use super::{BlockMatch, Document, DocumentRef};
use crate::text::{plain_text, preview, whole_word_matches};

/// What a `find_replace` call searches for, where, and what it puts in place of each match.
#[derive(Debug, Clone, Default)]
pub struct FindReplaceRequest {
    pub find: String,
    /// None searches only.
    pub replace: Option<String>,
    pub is_regex: bool,
    /// Attribute names, or `/regex/` patterns on names; None means [`TEXT_ATTRIBUTES`].
    pub attributes: Option<Vec<String>>,
    /// When set, a different number of matches fails the call.
    pub expected_count: Option<usize>,
}

/// An attribute whose text matched, with how many times.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TextMatch {
    #[serde(flatten)]
    pub block: BlockMatch,
    pub count: usize,
}

/// A word that starts with a literal `find` but goes on, and how often it occurs.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct InflectedVariant {
    pub word: String,
    pub count: usize,
}

/// What a search found and, for a replace, the pages it changed.
#[derive(Debug, Clone, PartialEq)]
pub struct FindReplaceResult {
    pub matches: Vec<TextMatch>,
    /// Documents with replacements applied; empty for a search.
    pub changed_pages: Vec<Document>,
    /// Words that start with a literal `find` but continue (e.g. "kurssin" for "kurssi"); not changed.
    pub inflected_variants: Vec<InflectedVariant>,
}

impl FindReplaceResult {
    /// The number of matches over all pages.
    pub fn total(&self) -> usize {
        self.matches.iter().map(|m| m.count).sum()
    }
}

enum Matcher {
    Literal(String),
    Pattern(Regex),
}

impl Matcher {
    /// Byte ranges of matches. Literal matches don't start or end inside a word.
    fn ranges(&self, text: &str) -> Vec<(usize, usize)> {
        match self {
            Matcher::Pattern(re) => re
                .find_iter(text)
                .map(|m| (m.start(), m.end()))
                .filter(|(s, e)| e > s)
                .collect(),
            Matcher::Literal(needle) => whole_word_matches(text, needle).collect(),
        }
    }

    /// Replaces the matches [`Self::ranges`] counts, and no others: a pattern's empty matches
    /// are left alone.
    fn replace(&self, text: &str, replacement: &str) -> String {
        match self {
            Matcher::Pattern(re) => {
                let mut out = String::with_capacity(text.len());
                let mut last = 0;
                for captures in re.captures_iter(text) {
                    let Some(found) = captures.get(0).filter(|m| !m.is_empty()) else {
                        continue;
                    };
                    out.push_str(&text[last..found.start()]);
                    captures.expand(replacement, &mut out);
                    last = found.end();
                }
                out.push_str(&text[last..]);
                out
            }
            Matcher::Literal(_) => {
                let mut out = String::with_capacity(text.len());
                let mut last = 0;
                for (start, end) in self.ranges(text) {
                    out.push_str(&text[last..start]);
                    out.push_str(replacement);
                    last = end;
                }
                out.push_str(&text[last..]);
                out
            }
        }
    }
}

enum AttributeFilter {
    Name(String),
    Pattern(Regex),
}

fn attribute_filters(request: &FindReplaceRequest) -> Result<Vec<AttributeFilter>, EditError> {
    let names: Vec<String> = match &request.attributes {
        Some(names) if !names.is_empty() => names.clone(),
        _ => TEXT_ATTRIBUTES.iter().map(|s| s.to_string()).collect(),
    };
    names
        .into_iter()
        .map(
            |name| match name.strip_prefix('/').and_then(|n| n.strip_suffix('/')) {
                Some(pattern) => Regex::new(pattern)
                    .map(AttributeFilter::Pattern)
                    .map_err(|e| {
                        EditError::new(
                            EditErrorCode::InvalidRegex,
                            format!("attribute pattern {name} isn't a valid regex: {e}"),
                        )
                    }),
                None => Ok(AttributeFilter::Name(name)),
            },
        )
        .collect()
}

fn attribute_selected(filters: &[AttributeFilter], name: &str) -> bool {
    filters.iter().any(|f| match f {
        AttributeFilter::Name(n) => n == name,
        AttributeFilter::Pattern(re) => re.is_match(name),
    })
}

/// Strings of one attribute value that count as text: the value itself, or nested `content`
/// strings (table cells).
fn for_each_text<'v>(value: &'v Value, is_top: bool, visit: &mut dyn FnMut(&'v str)) {
    match value {
        Value::String(s) if is_top => visit(s),
        Value::Array(items) => items.iter().for_each(|v| for_each_text(v, false, visit)),
        Value::Object(map) => {
            for (key, v) in map {
                match v {
                    Value::String(s) if key == "content" => visit(s),
                    Value::Array(_) | Value::Object(_) => for_each_text(v, false, visit),
                    _ => {}
                }
            }
        }
        _ => {}
    }
}

/// [`for_each_text`], for changing the strings in place.
fn for_each_text_mut(value: &mut Value, is_top: bool, visit: &mut dyn FnMut(&mut String)) {
    match value {
        Value::String(s) if is_top => visit(s),
        Value::Array(items) => items
            .iter_mut()
            .for_each(|v| for_each_text_mut(v, false, visit)),
        Value::Object(map) => {
            for (key, v) in map.iter_mut() {
                match v {
                    Value::String(s) if key == "content" => visit(s),
                    Value::Array(_) | Value::Object(_) => for_each_text_mut(v, false, visit),
                    _ => {}
                }
            }
        }
        _ => {}
    }
}

/// Searches `pages` and, with `request.replace`, replaces every match. Fails without changing
/// anything when `request.expected_count` differs from the matches found.
pub fn find_replace(
    pages: &[DocumentRef],
    request: &FindReplaceRequest,
) -> Result<FindReplaceResult, EditError> {
    if request.find.is_empty() {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            "find can't be empty",
        ));
    }
    let matcher = if request.is_regex {
        Matcher::Pattern(Regex::new(&request.find).map_err(|e| {
            EditError::new(
                EditErrorCode::InvalidRegex,
                format!("find isn't a valid regex: {e}"),
            )
            .with_fix("Rust regex syntax; flags go inline, e.g. (?i) for case-insensitive")
        })?)
    } else {
        Matcher::Literal(request.find.clone())
    };
    let filters = attribute_filters(request)?;
    let variant_pattern = (!request.is_regex
        && request
            .find
            .chars()
            .last()
            .is_some_and(char::is_alphanumeric))
    .then(|| Regex::new(&format!(r"(?i)\b{}\w+", regex::escape(&request.find))).ok())
    .flatten();

    let mut matches = Vec::new();
    let mut changed_pages = Vec::new();
    let mut variants: BTreeMap<String, usize> = BTreeMap::new();
    for page in pages {
        let page_first_match = matches.len();
        blocks::walk_outside_exercises(page.blocks, &mut |block, _| {
            for (name, value) in &block.attributes {
                if !attribute_selected(&filters, name) {
                    continue;
                }
                let mut count = 0;
                let mut first_preview = None;
                for_each_text(value, true, &mut |text| {
                    if let Some(pattern) = &variant_pattern {
                        for word in pattern.find_iter(&plain_text(text)) {
                            *variants.entry(word.as_str().to_string()).or_default() += 1;
                        }
                    }
                    let ranges = matcher.ranges(text);
                    if let Some(first) = ranges.first() {
                        count += ranges.len();
                        first_preview.get_or_insert_with(|| context_preview(text, *first));
                    }
                });
                if count > 0 {
                    matches.push(TextMatch {
                        block: page.key.block_match(
                            block,
                            format!("/{}/attributes/{name}", block.client_id),
                            first_preview.unwrap_or_default(),
                        ),
                        count,
                    });
                }
            }
        });
        if let Some(replacement) = &request.replace
            && matches.len() > page_first_match
        {
            let mut doc = page.to_document();
            let mut is_changed = false;
            blocks::walk_mut_outside_exercises(&mut doc.blocks, &mut |block| {
                for (name, value) in block.attributes.iter_mut() {
                    if !attribute_selected(&filters, name) {
                        continue;
                    }
                    for_each_text_mut(value, true, &mut |text| {
                        let replaced = matcher.replace(text, replacement);
                        if replaced != *text {
                            *text = replaced;
                            is_changed = true;
                        }
                    });
                }
            });
            if is_changed {
                changed_pages.push(doc);
            }
        }
    }
    let find_lower = request.find.to_lowercase();
    let inflected_variants = variants
        .into_iter()
        .filter(|(word, _)| word.to_lowercase() != find_lower)
        .map(|(word, count)| InflectedVariant { word, count })
        .collect();
    let result = FindReplaceResult {
        matches,
        changed_pages,
        inflected_variants,
    };
    if let Some(expected) = request.expected_count
        && expected != result.total()
    {
        return Err(EditError::expected_count_mismatch(
            expected,
            result.total(),
            result
                .matches
                .iter()
                .map(|m| m.block.location(Some(m.count)))
                .collect(),
        ));
    }
    Ok(result)
}

fn context_preview(text: &str, (start, end): (usize, usize)) -> String {
    let before: String = text[..start]
        .chars()
        .rev()
        .take(30)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    let after: String = text[end..].chars().take(30).collect();
    preview(&format!("{before}{}{after}", &text[start..end]), 80)
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::*;
    use crate::engine::{PageDocument, PageType};
    use crate::test_fixtures::{block, document_refs, exercise, heading, id, page, para};

    fn pages() -> Vec<PageDocument> {
        vec![
            page(
                "pg1",
                PageType::CoursePage,
                vec![
                    heading("h1", "Python 3.11 kurssi"),
                    para("p1", "Tällä kurssilla opit. Kurssin aikana kurssi etenee."),
                    block(
                        "img",
                        "core/image",
                        json!({"alt": "kurssi logo", "url": "https://example.com/kurssi.png"}),
                        vec![],
                    ),
                    block(
                        "t1",
                        "core/table",
                        json!({"body": [{"cells": [{"content": "kurssi", "tag": "td"}]}]}),
                        vec![],
                    ),
                    exercise("ex1", "e1"),
                ],
            ),
            page(
                "pg2",
                PageType::CoursePage,
                vec![para("p2", "Use <em>for</em> loops in Python 3.12.")],
            ),
        ]
    }

    fn request(find: &str) -> FindReplaceRequest {
        FindReplaceRequest {
            find: find.to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn literal_search_counts_whole_words_and_reports_variants() {
        let result = find_replace(&document_refs(&pages()), &request("kurssi")).unwrap();
        assert_eq!(result.total(), 4);
        let paths: Vec<_> = result
            .matches
            .iter()
            .map(|m| m.block.path.rsplit('/').next().unwrap().to_string())
            .collect();
        assert_eq!(paths, vec!["content", "content", "alt", "body"]);
        let words: Vec<_> = result
            .inflected_variants
            .iter()
            .map(|v| v.word.as_str())
            .collect();
        assert!(words.contains(&"kurssilla"));
        assert!(words.contains(&"Kurssin"));
        assert!(result.changed_pages.is_empty());
    }

    #[test]
    fn literal_replace_changes_only_matches() {
        let mut req = request("kurssi");
        req.replace = Some("course".into());
        req.expected_count = Some(4);
        let result = find_replace(&document_refs(&pages()), &req).unwrap();
        let page = &result.changed_pages[0];
        assert_eq!(
            page.blocks[1].attributes["content"],
            json!("Tällä kurssilla opit. Kurssin aikana course etenee.")
        );
        assert_eq!(
            page.blocks[2].attributes["url"],
            json!("https://example.com/kurssi.png")
        );
    }

    #[test]
    fn regex_replace_with_groups() {
        let req = FindReplaceRequest {
            find: r"Python ?3\.(\d+)".into(),
            replace: Some("Python 3.13 (was 3.$1)".into()),
            is_regex: true,
            ..Default::default()
        };
        let result = find_replace(&document_refs(&pages()), &req).unwrap();
        assert_eq!(result.total(), 2);
        assert_eq!(
            result.changed_pages[1].blocks[0].attributes["content"],
            json!("Use <em>for</em> loops in Python 3.13 (was 3.12).")
        );
        assert!(result.inflected_variants.is_empty());
    }

    #[test]
    fn a_pattern_replaces_only_the_matches_it_counts() {
        let doc = vec![page("pg1", PageType::CoursePage, vec![para("p1", "baaa")])];
        let req = FindReplaceRequest {
            find: "a*".into(),
            replace: Some("X".into()),
            is_regex: true,
            expected_count: Some(1),
            ..Default::default()
        };
        let result = find_replace(&document_refs(&doc), &req).unwrap();
        assert_eq!(
            result.changed_pages[0].blocks[0].attributes["content"],
            json!("bX")
        );
    }

    #[test]
    fn matching_sees_markup() {
        assert_eq!(
            find_replace(&document_refs(&pages()), &request("for loops"))
                .unwrap()
                .total(),
            0
        );
        assert_eq!(
            find_replace(&document_refs(&pages()), &request("<em>for</em> loops"))
                .unwrap()
                .total(),
            1
        );
    }

    #[test]
    fn attribute_selection_by_name_and_regex() {
        let mut req = request("example.com");
        req.attributes = Some(vec!["/^ur.$/".into()]);
        let result = find_replace(&document_refs(&pages()), &req).unwrap();
        assert_eq!(result.total(), 1);
        assert_eq!(
            result.matches[0].block.path,
            format!("/{}/attributes/url", id("img"))
        );
        req.attributes = Some(vec!["href".into()]);
        assert_eq!(
            find_replace(&document_refs(&pages()), &req)
                .unwrap()
                .total(),
            0
        );
    }

    #[test]
    fn expected_count_mismatch_fails_with_matches() {
        let mut req = request("kurssi");
        req.replace = Some("x".into());
        req.expected_count = Some(2);
        let error = find_replace(&document_refs(&pages()), &req).unwrap_err();
        assert_eq!(error.code, EditErrorCode::ExpectedCountMismatch);
        assert_eq!(
            error.details.unwrap()["matches"].as_array().unwrap().len(),
            4
        );
    }

    #[test]
    fn invalid_regex_is_rejected() {
        let req = FindReplaceRequest {
            find: "(".into(),
            is_regex: true,
            ..Default::default()
        };
        assert_eq!(
            find_replace(&document_refs(&pages()), &req)
                .unwrap_err()
                .code,
            EditErrorCode::InvalidRegex
        );
    }
}
