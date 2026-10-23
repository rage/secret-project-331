//! `patch_course_glossary_and_references`: glossary terms and BibTeX references.
//!
//! Renaming a citation key rewrites its `\cite{…}` citations in page content; other changes only
//! report the pages that use the term or key.

use std::collections::{BTreeSet, HashMap};
use std::sync::LazyLock;

use regex::Regex;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

use super::blocks;
use super::error::{EditError, EditErrorCode, Warning, WarningCode};
use super::labels::parse_uuid;
use super::op::{OpKind, PatchOp, PatchTarget, parse_ops};
use super::{CreatedIds, EngineContext, PageDocument, push_created};
use crate::text::plain_text;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct GlossaryAndReferences {
    pub glossary: Vec<GlossaryTerm>,
    pub references: Vec<Reference>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct GlossaryTerm {
    pub id: Uuid,
    pub term: String,
    pub definition: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Reference {
    pub id: Uuid,
    pub citation_key: String,
    /// One BibTeX entry whose key equals `citation_key`.
    pub bibtex: String,
}

/// Parses BibTeX the way the course-material renderer does.
///
/// The renderer parses with citation-js in the browser, so a production implementation should
/// delegate to the same parser (for example through the CMS service). [`BasicBibtexParser`] is a
/// structural check for tests and as a fallback.
pub trait BibtexParser: Send + Sync {
    /// The key of the single entry in `bibtex`, or a message saying why it doesn't parse.
    fn entry_key(&self, bibtex: &str) -> Result<String, String>;
}

/// Checks the shape `@type{key, field = {…}, …}` with balanced braces and exactly one entry.
#[derive(Debug, Default, Clone, Copy)]
pub struct BasicBibtexParser;

impl BibtexParser for BasicBibtexParser {
    fn entry_key(&self, bibtex: &str) -> Result<String, String> {
        static HEAD: LazyLock<Regex> = LazyLock::new(|| {
            Regex::new(r"^\s*@([A-Za-z]+)\s*([{(])\s*([^,\s{}()]+)\s*,").expect("valid regex")
        });
        let head = HEAD
            .captures(bibtex)
            .ok_or_else(|| "expected an entry like @article{key, title = {…}}".to_string())?;
        let open = head.get(2).map(|m| m.as_str()).unwrap_or("{");
        let close = if open == "{" { '}' } else { ')' };
        let start = head.get(2).map(|m| m.start()).unwrap_or(0);
        let mut depth = 0i32;
        let mut end = None;
        for (offset, c) in bibtex[start..].char_indices() {
            match c {
                '{' | '(' if offset == 0 => depth += 1,
                '{' => depth += 1,
                '}' if close == '}' || depth > 1 => depth -= 1,
                ')' if close == ')' && depth == 1 => depth -= 1,
                _ => {}
            }
            if depth == 0 {
                end = Some(start + offset);
                break;
            }
        }
        let end = end.ok_or_else(|| "unbalanced braces".to_string())?;
        if !bibtex[end + 1..].trim().is_empty() {
            return Err("only one entry per reference".to_string());
        }
        Ok(head
            .get(3)
            .map(|m| m.as_str().to_string())
            .unwrap_or_default())
    }
}

/// A page that uses a term or citation key the call removed or renamed.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Usage {
    pub page_id: Uuid,
    /// `glossary_term` or `citation_key`.
    pub kind: &'static str,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GlossaryReferencesResult {
    pub document: GlossaryAndReferences,
    pub created: Vec<CreatedIds>,
    pub warnings: Vec<Warning>,
    /// Pages whose citations were rewritten after a citation-key rename.
    pub rewritten_pages: Vec<PageDocument>,
    pub usages: Vec<Usage>,
}

pub fn parse(raw: &[Value]) -> Result<Vec<PatchOp>, EditError> {
    parse_ops(raw, PatchTarget::GlossaryAndReferences)
}

/// `ctx.pages` should hold every course page so renames reach all citations.
pub fn apply(
    doc: &GlossaryAndReferences,
    ops: &[PatchOp],
    ctx: &EngineContext,
    bibtex: &dyn BibtexParser,
) -> Result<GlossaryReferencesResult, EditError> {
    let mut next = doc.clone();
    let mut created = Vec::new();
    for (index, op) in ops.iter().enumerate() {
        apply_op(&mut next, op, ctx, index, &mut created).map_err(|e| e.at_op(index))?;
    }
    validate(&next, bibtex)?;

    let before_terms: HashMap<Uuid, &str> = doc
        .glossary
        .iter()
        .map(|t| (t.id, t.term.as_str()))
        .collect();
    let after_terms: HashMap<Uuid, &str> = next
        .glossary
        .iter()
        .map(|t| (t.id, t.term.as_str()))
        .collect();
    let before_keys: HashMap<Uuid, &str> = doc
        .references
        .iter()
        .map(|r| (r.id, r.citation_key.as_str()))
        .collect();
    let after_keys: HashMap<Uuid, &str> = next
        .references
        .iter()
        .map(|r| (r.id, r.citation_key.as_str()))
        .collect();

    let mut renames: Vec<(String, String)> = Vec::new();
    let mut reported_keys: BTreeSet<String> = BTreeSet::new();
    for (id, old) in &before_keys {
        match after_keys.get(id) {
            Some(new) if new != old => renames.push((old.to_string(), new.to_string())),
            Some(_) => {}
            None => {
                reported_keys.insert(old.to_string());
            }
        }
    }
    let reported_terms: BTreeSet<String> = before_terms
        .iter()
        .filter(|(id, old)| after_terms.get(id) != Some(old))
        .map(|(_, old)| old.to_string())
        .collect();

    let mut rewritten_pages = Vec::new();
    let mut usages = Vec::new();
    for page in ctx.pages {
        let mut page = page.clone();
        let mut changed = false;
        let mut cited: BTreeSet<String> = BTreeSet::new();
        let mut texts: Vec<String> = Vec::new();
        blocks::walk_mut(&mut page.blocks, &mut |block| {
            if blocks::is_exercise(block) {
                return;
            }
            blocks::for_each_string_mut(&mut block.attributes, &mut |_, text| {
                for key in citation_keys(text) {
                    cited.insert(key);
                }
                if !renames.is_empty() {
                    let rewritten = rewrite_citations(text, &renames);
                    if rewritten != *text {
                        *text = rewritten;
                        changed = true;
                    }
                }
                texts.push(plain_text(text));
            });
        });
        for key in cited.intersection(&reported_keys) {
            usages.push(Usage {
                page_id: page.page_id,
                kind: "citation_key",
                value: key.clone(),
            });
        }
        for term in &reported_terms {
            if texts.iter().any(|t| uses_term(t, term)) {
                usages.push(Usage {
                    page_id: page.page_id,
                    kind: "glossary_term",
                    value: term.clone(),
                });
            }
        }
        if changed {
            rewritten_pages.push(page);
        }
    }
    let warnings = usages
        .iter()
        .map(|usage| Warning {
            code: WarningCode::StillReferenced,
            message: format!(
                "page {} still uses the {} \"{}\"",
                usage.page_id,
                usage.kind.replace('_', " "),
                usage.value
            ),
            op: None,
        })
        .collect();

    Ok(GlossaryReferencesResult {
        document: next,
        created,
        warnings,
        rewritten_pages,
        usages,
    })
}

fn apply_op(
    doc: &mut GlossaryAndReferences,
    op: &PatchOp,
    ctx: &EngineContext,
    index: usize,
    created: &mut Vec<CreatedIds>,
) -> Result<(), EditError> {
    let rest = op.path.strip_prefix('/').ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidPath,
            "paths look like /glossary, /references or /<id>/term",
        )
    })?;
    let segments: Vec<&str> = rest.split('/').collect();
    match (op.op, segments.as_slice()) {
        (OpKind::Add, ["glossary"]) => {
            let object = value_object(
                op.value.as_ref(),
                "a glossary term is {\"term\":\"…\",\"definition\":\"…\"}",
            )?;
            check_keys(object, &["term", "definition"])?;
            let id = ctx.ids.new_id();
            push_created(created, index, id);
            doc.glossary.push(GlossaryTerm {
                id,
                term: required(object, "term")?,
                definition: required(object, "definition")?,
            });
            Ok(())
        }
        (OpKind::Add, ["references"]) => {
            let object = value_object(
                op.value.as_ref(),
                "a reference is {\"citation_key\":\"…\",\"bibtex\":\"@book{…}\"}",
            )?;
            check_keys(object, &["citation_key", "bibtex"])?;
            let id = ctx.ids.new_id();
            push_created(created, index, id);
            doc.references.push(Reference {
                id,
                citation_key: required(object, "citation_key")?,
                bibtex: required(object, "bibtex")?,
            });
            Ok(())
        }
        (OpKind::Add, _) => Err(EditError::new(
            EditErrorCode::InvalidPath,
            "add new items to /glossary or /references; the lists are unordered",
        )),
        (_, ["glossary" | "references", ..]) => Err(EditError::new(
            EditErrorCode::NumericIndex,
            "items are addressed by id: /<id>, /<id>/term",
        )),
        (op_kind, [raw_id, field @ ..]) => {
            let id = parse_uuid(raw_id, &op.path)?;
            if let Some(position) = doc.glossary.iter().position(|t| t.id == id) {
                match edit_item(op_kind, field, op.value.as_ref(), &["term", "definition"])? {
                    ItemEdit::Remove => {
                        doc.glossary.remove(position);
                    }
                    ItemEdit::Set(fields) => {
                        let term = &mut doc.glossary[position];
                        for (name, value) in fields {
                            match name {
                                "term" => term.term = value,
                                _ => term.definition = value,
                            }
                        }
                    }
                }
                return Ok(());
            }
            if let Some(position) = doc.references.iter().position(|r| r.id == id) {
                match edit_item(
                    op_kind,
                    field,
                    op.value.as_ref(),
                    &["citation_key", "bibtex"],
                )? {
                    ItemEdit::Remove => {
                        doc.references.remove(position);
                    }
                    ItemEdit::Set(fields) => {
                        let reference = &mut doc.references[position];
                        for (name, value) in fields {
                            match name {
                                "citation_key" => reference.citation_key = value,
                                _ => reference.bibtex = value,
                            }
                        }
                    }
                }
                return Ok(());
            }
            Err(EditError::new(
                EditErrorCode::NotFound,
                format!("no glossary term or reference {id}"),
            )
            .with_fix("get_course_glossary_and_references lists the ids"))
        }
        _ => Err(EditError::new(EditErrorCode::InvalidPath, "empty path")),
    }
}

enum ItemEdit {
    Remove,
    Set(Vec<(&'static str, String)>),
}

fn edit_item(
    op: OpKind,
    field: &[&str],
    value: Option<&Value>,
    fields: &[&'static str],
) -> Result<ItemEdit, EditError> {
    match (op, field) {
        (OpKind::Remove, []) => Ok(ItemEdit::Remove),
        (OpKind::Replace, [name]) => match fields.iter().find(|f| *f == name) {
            Some(field) => Ok(ItemEdit::Set(vec![(*field, string_value(value, field)?)])),
            None => Err(EditError::new(
                EditErrorCode::UnknownField,
                format!("fields: {}", fields.join(", ")),
            )),
        },
        (OpKind::Replace, []) => {
            let object = value_object(value, "replace takes an object of fields")?;
            let allowed: Vec<&str> = fields.iter().copied().chain(["id"]).collect();
            check_keys(object, &allowed)?;
            let mut set = Vec::new();
            for name in fields {
                if let Some(v) = object.get(*name) {
                    set.push((*name, string_value(Some(v), name)?));
                }
            }
            Ok(ItemEdit::Set(set))
        }
        (OpKind::Remove, [name]) if fields.contains(name) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("{name} can't be empty; remove the whole item with /<id>"),
        )),
        _ => Err(EditError::new(
            EditErrorCode::UnknownField,
            format!("fields: {}", fields.join(", ")),
        )),
    }
}

fn validate(doc: &GlossaryAndReferences, bibtex: &dyn BibtexParser) -> Result<(), EditError> {
    let mut terms: HashMap<String, Uuid> = HashMap::new();
    for term in &doc.glossary {
        if let Some(other) = terms.insert(term.term.trim().to_lowercase(), term.id) {
            return Err(EditError::new(
                EditErrorCode::DuplicateTerm,
                format!(
                    "the glossary would have \"{}\" twice ({other} and {})",
                    term.term, term.id
                ),
            ));
        }
    }
    let mut keys: HashMap<&str, Uuid> = HashMap::new();
    for reference in &doc.references {
        if let Some(other) = keys.insert(reference.citation_key.as_str(), reference.id) {
            return Err(EditError::new(
                EditErrorCode::CitationKey,
                format!(
                    "citation key \"{}\" would be used by both {other} and {}",
                    reference.citation_key, reference.id
                ),
            ));
        }
        let entry_key = bibtex.entry_key(&reference.bibtex).map_err(|reason| {
            EditError::new(
                EditErrorCode::InvalidBibtex,
                format!(
                    "the BibTeX of \"{}\" doesn't parse: {reason}",
                    reference.citation_key
                ),
            )
        })?;
        if entry_key != reference.citation_key {
            return Err(EditError::new(
                EditErrorCode::CitationKey,
                format!(
                    "citation_key \"{}\" differs from the BibTeX entry key \"{entry_key}\"",
                    reference.citation_key
                ),
            )
            .with_fix("change both together in one call"));
        }
    }
    Ok(())
}

static CITE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\cite((?:\[[^\]]*\]){0,2})\{(.*?)\}").expect("valid regex"));

fn citation_keys(text: &str) -> Vec<String> {
    CITE.captures_iter(text).map(|c| c[2].to_string()).collect()
}

fn rewrite_citations(text: &str, renames: &[(String, String)]) -> String {
    CITE.replace_all(text, |caps: &regex::Captures| {
        let key = &caps[2];
        let new_key = renames
            .iter()
            .find(|(old, _)| old == key)
            .map(|(_, new)| new.as_str())
            .unwrap_or(key);
        format!("\\cite{}{{{new_key}}}", &caps[1])
    })
    .into_owned()
}

/// Whole-word, case-sensitive, like the renderer's glossary highlighting.
fn uses_term(text: &str, term: &str) -> bool {
    Regex::new(&format!(r"\b{}\b", regex::escape(term))).is_ok_and(|re| re.is_match(text))
}

fn value_object<'v>(
    value: Option<&'v Value>,
    message: &str,
) -> Result<&'v Map<String, Value>, EditError> {
    value
        .and_then(Value::as_object)
        .ok_or_else(|| EditError::new(EditErrorCode::InvalidValue, message))
}

fn check_keys(object: &Map<String, Value>, allowed: &[&str]) -> Result<(), EditError> {
    match object.keys().find(|k| !allowed.contains(&k.as_str())) {
        Some(key) => Err(EditError::new(
            EditErrorCode::UnknownField,
            format!("unknown field \"{key}\""),
        )
        .with_fix(format!("fields: {}", allowed.join(", ")))),
        None => Ok(()),
    }
}

fn required(object: &Map<String, Value>, field: &str) -> Result<String, EditError> {
    string_value(object.get(field), field)
}

fn string_value(value: Option<&Value>, field: &str) -> Result<String, EditError> {
    match value {
        Some(Value::String(s)) if !s.trim().is_empty() => Ok(s.clone()),
        _ => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("{field} is a non-empty string"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::*;
    use crate::engine::PageType;
    use crate::ids::SequentialIds;
    use crate::test_fixtures::{id, p, page, para};

    fn sample() -> GlossaryAndReferences {
        GlossaryAndReferences {
            glossary: vec![GlossaryTerm {
                id: id("g1"),
                term: "muuttuja".into(),
                definition: "A named value".into(),
            }],
            references: vec![Reference {
                id: id("r1"),
                citation_key: "knuth1997".into(),
                bibtex: "@book{knuth1997, title = {The Art}, year = {1997}}".into(),
            }],
        }
    }

    fn pages() -> Vec<PageDocument> {
        vec![
            page(
                "pg1",
                PageType::CoursePage,
                vec![para(
                    "p1",
                    "As shown \\cite[p. 3]{knuth1997}, a muuttuja holds a value.",
                )],
            ),
            page(
                "pg2",
                PageType::CoursePage,
                vec![para("p2", "Nothing here.")],
            ),
        ]
    }

    fn run(ops: Value) -> Result<GlossaryReferencesResult, EditError> {
        let raw = ops.as_array().cloned().unwrap_or_default();
        let ops = parse(&raw)?;
        let ids = SequentialIds::new();
        let pages = pages();
        apply(
            &sample(),
            &ops,
            &EngineContext::new(&ids).with_pages(&pages),
            &BasicBibtexParser,
        )
    }

    #[test]
    fn add_replace_remove_terms() {
        let result = run(json!([
            {"op":"add","path":"/glossary","value":{"term":"silmukka","definition":"A loop"}},
            {"op":"replace","path":format!("{}/definition", p("g1")),"value":"A named slot"},
        ]))
        .unwrap();
        assert_eq!(result.document.glossary.len(), 2);
        assert_eq!(result.document.glossary[0].definition, "A named slot");
        assert!(result.usages.is_empty());
    }

    #[test]
    fn renaming_or_removing_a_term_reports_pages() {
        let result = run(json!([{"op":"remove","path":p("g1")}])).unwrap();
        assert_eq!(
            result.usages,
            vec![Usage {
                page_id: id("pg1"),
                kind: "glossary_term",
                value: "muuttuja".into()
            }]
        );
        assert!(result.rewritten_pages.is_empty());
    }

    #[test]
    fn citation_key_rename_rewrites_citations() {
        let result = run(json!([
            {"op":"replace","path":p("r1"),"value":{"citation_key":"knuth97","bibtex":"@book{knuth97, title = {The Art}}"}},
        ]))
        .unwrap();
        assert_eq!(result.rewritten_pages.len(), 1);
        assert_eq!(
            result.rewritten_pages[0].blocks[0].attributes["content"],
            json!("As shown \\cite[p. 3]{knuth97}, a muuttuja holds a value.")
        );
    }

    #[test]
    fn key_must_match_bibtex_and_be_unique() {
        let mismatch = run(
            json!([{"op":"replace","path":format!("{}/citation_key", p("r1")),"value":"other"}]),
        )
        .unwrap_err();
        assert_eq!(mismatch.code, EditErrorCode::CitationKey);
        let duplicate = run(json!([{"op":"add","path":"/references","value":{"citation_key":"knuth1997","bibtex":"@misc{knuth1997, title={x}}"}}])).unwrap_err();
        assert_eq!(duplicate.code, EditErrorCode::CitationKey);
        let broken = run(json!([{"op":"add","path":"/references","value":{"citation_key":"x","bibtex":"@misc{x, title={unclosed}"}}])).unwrap_err();
        assert_eq!(broken.code, EditErrorCode::InvalidBibtex);
    }

    #[test]
    fn removing_a_reference_keeps_citations_and_reports() {
        let result = run(json!([{"op":"remove","path":p("r1")}])).unwrap();
        assert!(result.rewritten_pages.is_empty());
        assert_eq!(result.usages[0].kind, "citation_key");
    }

    #[test]
    fn basic_bibtex_parser() {
        assert_eq!(
            BasicBibtexParser
                .entry_key("@article{a1, title={X {nested}}}")
                .unwrap(),
            "a1"
        );
        assert!(
            BasicBibtexParser
                .entry_key("@article{a1, x={1}} @book{b, y={2}}")
                .is_err()
        );
        assert!(BasicBibtexParser.entry_key("not bibtex").is_err());
    }
}
