//! `patch_course_glossary_and_references`: glossary terms and BibTeX references.
//!
//! Renaming a citation key rewrites its `\cite{…}` citations in page content; other changes only
//! report the pages that use the term or key.

use std::collections::{BTreeSet, HashMap};
use std::sync::LazyLock;

use headless_lms_utils::strings::decode_html_entities;
use regex::Regex;
use serde::Serialize;
use uuid::Uuid;

use super::blocks;
use super::error::{EditError, EditErrorCode};
use super::op::Op;
use super::path::{parse_uuid, split_path};
use super::{
    CreatedIdLog, CreatedIds, Document, DocumentKey, DocumentRef, new_item_objects,
    non_empty_string, reject_unknown_keys,
};
use crate::ids::IdGenerator;
use crate::text::{plain_text, whole_word_matches};
use headless_lms_utils::strings::escape_html_text;

/// The document `get_course_glossary_and_references` shows and its patch tool edits.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GlossaryAndReferences {
    pub glossary: Vec<GlossaryTerm>,
    pub references: Vec<Reference>,
}

/// A glossary term; its editable fields are [`TERM_FIELDS`].
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GlossaryTerm {
    pub id: Uuid,
    pub term: String,
    pub definition: String,
}

/// A BibTeX reference; its editable fields are [`REFERENCE_FIELDS`].
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Reference {
    pub id: Uuid,
    pub citation_key: String,
    /// One BibTeX entry whose key equals `citation_key`.
    pub bibtex: String,
}

/// The key of the single entry in `bibtex`, or a message saying why it doesn't parse. Checks the
/// shape `@type{key, field = {…}, …}` with balanced braces and exactly one entry.
fn bibtex_entry_key(bibtex: &str) -> Result<String, String> {
    static HEAD: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"^\s*@([A-Za-z]+)\s*([{(])\s*([^,\s{}()]+)\s*,")
            .expect("a constant pattern the unit tests compile")
    });
    let head = HEAD
        .captures(bibtex)
        .ok_or_else(|| "expected an entry like @article{key, title = {…}}".to_string())?;
    let is_parenthesized = head.get(2).is_some_and(|m| m.as_str() == "(");
    let body_start = head.get(2).map(|m| m.end()).unwrap_or(0);
    // Braces nest inside field values; a parenthesized entry ends at a `)` outside them and
    // outside quotes.
    let mut brace_depth = 0i32;
    let mut is_in_quotes = false;
    let mut end = None;
    for (offset, c) in bibtex[body_start..].char_indices() {
        match c {
            '{' => brace_depth += 1,
            '}' if brace_depth > 0 => brace_depth -= 1,
            '}' if !is_parenthesized => {
                end = Some(body_start + offset);
                break;
            }
            '}' => return Err("unbalanced braces".to_string()),
            '"' if brace_depth == 0 => is_in_quotes = !is_in_quotes,
            ')' if is_parenthesized && brace_depth == 0 && !is_in_quotes => {
                end = Some(body_start + offset);
                break;
            }
            _ => {}
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

/// A document that uses a term or citation key the call removed or renamed.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Usage {
    #[serde(flatten)]
    pub document: DocumentKey,
    pub kind: UsageKind,
    pub value: String,
}

/// Whether a [`Usage`] is of a glossary term or a citation key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UsageKind {
    GlossaryTerm,
    CitationKey,
}

/// The new state after a successful call, and what it means for the pages.
#[derive(Debug, Clone, PartialEq)]
pub struct GlossaryReferencesResult {
    pub document: GlossaryAndReferences,
    pub created: Vec<CreatedIds>,
    /// Documents whose citations were rewritten after a citation-key rename.
    pub rewritten_pages: Vec<Document>,
    pub usages: Vec<Usage>,
}

/// Glossary term fields ops may set.
pub(crate) const TERM_FIELDS: [&str; 2] = ["term", "definition"];
/// Reference fields ops may set.
pub(crate) const REFERENCE_FIELDS: [&str; 2] = ["citation_key", "bibtex"];

/// The edited document, before its effects on the pages are worked out.
#[derive(Debug, Clone, PartialEq)]
pub struct GlossaryEdit {
    document: GlossaryAndReferences,
    created: Vec<CreatedIds>,
    renames: Vec<(String, String)>,
    reported_keys: BTreeSet<String>,
    reported_terms: BTreeSet<String>,
}

impl GlossaryEdit {
    /// Whether a term or citation key was renamed or removed, so page text may cite or use it.
    pub fn affects_pages(&self) -> bool {
        !self.renames.is_empty()
            || !self.reported_keys.is_empty()
            || !self.reported_terms.is_empty()
    }

    /// `pages` should hold every course page so renames reach all citations; it may be empty when
    /// [GlossaryEdit::affects_pages] is false.
    pub fn with_page_effects(self, pages: &[DocumentRef]) -> GlossaryReferencesResult {
        let (rewritten_pages, usages) = page_effects(
            pages,
            &self.renames,
            &self.reported_keys,
            &self.reported_terms,
        );
        GlossaryReferencesResult {
            document: self.document,
            created: self.created,
            rewritten_pages,
            usages,
        }
    }
}

/// Applies `ops` to `doc`; [GlossaryEdit::with_page_effects] then works out what it does to pages.
pub fn apply(
    doc: &GlossaryAndReferences,
    ops: &[Op],
    ids: &dyn IdGenerator,
) -> Result<GlossaryEdit, EditError> {
    let mut next = doc.clone();
    let mut ids = CreatedIdLog::new(ids);
    for (index, op) in ops.iter().enumerate() {
        ids.set_op(index);
        apply_op(&mut next, op, &mut ids).map_err(|e| e.at_op(index))?;
    }
    validate(doc, &next)?;

    let after_terms: HashMap<Uuid, &str> = next
        .glossary
        .iter()
        .map(|t| (t.id, t.term.as_str()))
        .collect();
    let after_keys: HashMap<Uuid, &str> = next
        .references
        .iter()
        .map(|r| (r.id, r.citation_key.as_str()))
        .collect();

    let mut renames: Vec<(String, String)> = Vec::new();
    let mut reported_keys: BTreeSet<String> = BTreeSet::new();
    for reference in &doc.references {
        let old = &reference.citation_key;
        match after_keys.get(&reference.id) {
            Some(new) if new != old => renames.push((old.clone(), new.to_string())),
            Some(_) => {}
            None => {
                reported_keys.insert(old.clone());
            }
        }
    }
    let reported_terms: BTreeSet<String> = doc
        .glossary
        .iter()
        .filter(|term| after_terms.get(&term.id) != Some(&term.term.as_str()))
        .map(|term| term.term.clone())
        .collect();

    Ok(GlossaryEdit {
        document: next,
        created: ids.into_created(),
        renames,
        reported_keys,
        reported_terms,
    })
}

/// The pages whose citations `renames` rewrites, and the pages that use a reported key or term.
fn page_effects(
    pages: &[DocumentRef],
    renames: &[(String, String)],
    reported_keys: &BTreeSet<String>,
    reported_terms: &BTreeSet<String>,
) -> (Vec<Document>, Vec<Usage>) {
    let mut rewritten_pages = Vec::new();
    let mut usages = Vec::new();
    if renames.is_empty() && reported_keys.is_empty() && reported_terms.is_empty() {
        return (rewritten_pages, usages);
    }
    for page in pages {
        let mut cited: BTreeSet<String> = BTreeSet::new();
        let mut texts: Vec<String> = Vec::new();
        blocks::walk_outside_exercises(page.blocks, &mut |block, _| {
            blocks::for_each_string(&block.attributes, &mut |text| {
                if !renames.is_empty() || !reported_keys.is_empty() {
                    cited.extend(citation_keys(text));
                }
                if !reported_terms.is_empty() {
                    texts.push(plain_text(text).into_owned());
                }
            });
        });
        for key in cited.intersection(reported_keys) {
            usages.push(Usage {
                document: page.key,
                kind: UsageKind::CitationKey,
                value: key.clone(),
            });
        }
        for term in reported_terms {
            if texts.iter().any(|t| uses_term(t, term)) {
                usages.push(Usage {
                    document: page.key,
                    kind: UsageKind::GlossaryTerm,
                    value: term.clone(),
                });
            }
        }
        if renames.iter().any(|(old, _)| cited.contains(old)) {
            let mut page = page.to_document();
            blocks::walk_mut_outside_exercises(&mut page.blocks, &mut |block| {
                blocks::for_each_string_mut(&mut block.attributes, &mut |text| {
                    *text = rewrite_citations(text, renames);
                });
            });
            rewritten_pages.push(page);
        }
    }
    (rewritten_pages, usages)
}

fn apply_op(
    doc: &mut GlossaryAndReferences,
    op: &Op,
    ids: &mut CreatedIdLog,
) -> Result<(), EditError> {
    let segments = split_path(op.path()).ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidPath,
            "paths look like /glossary, /references or /<id>/term",
        )
    })?;
    let segments: Vec<&str> = segments.iter().map(String::as_str).collect();
    match (op, segments.as_slice()) {
        (Op::Add { value, .. }, ["glossary"]) => {
            for object in new_item_objects(
                value,
                "a glossary term",
                "a glossary term is {\"term\":\"…\",\"definition\":\"…\"}",
                &TERM_FIELDS,
            )? {
                let id = ids.new_id();
                doc.glossary.push(GlossaryTerm {
                    id,
                    term: non_empty_string(object.get("term"), "term")?,
                    definition: non_empty_string(object.get("definition"), "definition")?,
                });
            }
            Ok(())
        }
        (Op::Add { value, .. }, ["references"]) => {
            for object in new_item_objects(
                value,
                "a reference",
                "a reference is {\"citation_key\":\"…\",\"bibtex\":\"@book{…}\"}",
                &REFERENCE_FIELDS,
            )? {
                let id = ids.new_id();
                doc.references.push(Reference {
                    id,
                    citation_key: non_empty_string(object.get("citation_key"), "citation_key")?,
                    bibtex: non_empty_string(object.get("bibtex"), "bibtex")?,
                });
            }
            Ok(())
        }
        (Op::Add { .. }, _) => Err(EditError::new(
            EditErrorCode::InvalidPath,
            "add new items to /glossary or /references; the lists are unordered",
        )),
        (_, ["glossary" | "references", ..]) => Err(EditError::numeric_index(
            op.path(),
            "glossary terms and references",
        )
        .with_fix("use /<id> or /<id>/term")),
        (_, [raw_id, field @ ..]) => {
            let id = parse_uuid(raw_id, op.path())?;
            if let Some(position) = doc.glossary.iter().position(|t| t.id == id) {
                let edit = entry_edit(op, field, &TERM_FIELDS, "a glossary term")?;
                return edit_entry(&mut doc.glossary, position, edit, |term, field, value| {
                    match field {
                        "term" => term.term = value,
                        "definition" => term.definition = value,
                        _ => return Err(unknown_entry_field(&TERM_FIELDS)),
                    }
                    Ok(())
                });
            }
            if let Some(position) = doc.references.iter().position(|r| r.id == id) {
                let edit = entry_edit(op, field, &REFERENCE_FIELDS, "a reference")?;
                return edit_entry(
                    &mut doc.references,
                    position,
                    edit,
                    |reference, field, value| {
                        match field {
                            "citation_key" => reference.citation_key = value,
                            "bibtex" => reference.bibtex = value,
                            _ => return Err(unknown_entry_field(&REFERENCE_FIELDS)),
                        }
                        Ok(())
                    },
                );
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

/// What a `remove` or `replace` does to one glossary term or reference.
enum EntryEdit {
    Remove,
    /// Field names and their new values.
    Set(Vec<(&'static str, String)>),
}

/// The edit `op` makes at `field` (the path after the entry's id) of an entry with `fields`.
fn entry_edit(
    op: &Op,
    field: &[&str],
    fields: &[&'static str],
    noun: &str,
) -> Result<EntryEdit, EditError> {
    match (op, field) {
        (Op::Remove { .. }, []) => Ok(EntryEdit::Remove),
        (Op::Replace { value, .. }, [name]) => match fields.iter().find(|f| *f == name) {
            Some(field) => Ok(EntryEdit::Set(vec![(
                *field,
                non_empty_string(Some(value), field)?,
            )])),
            None => Err(unknown_entry_field(fields)),
        },
        (Op::Replace { value, .. }, []) => {
            let object = value.as_object().ok_or_else(|| {
                EditError::new(
                    EditErrorCode::InvalidValue,
                    "replace takes an object of fields",
                )
            })?;
            let allowed: Vec<&str> = fields.iter().copied().chain(["id"]).collect();
            reject_unknown_keys(object, &allowed, noun)?;
            let mut set = Vec::new();
            for name in fields {
                if let Some(v) = object.get(*name) {
                    set.push((*name, non_empty_string(Some(v), name)?));
                }
            }
            Ok(EntryEdit::Set(set))
        }
        (Op::Remove { .. }, [name]) if fields.contains(name) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("{name} can't be empty; remove the whole item with /<id>"),
        )),
        _ => Err(EditError::new(
            EditErrorCode::UnknownField,
            format!("fields: {}", fields.join(", ")),
        )),
    }
}

/// Applies `edit` to `entries[position]`; `set` writes one named field.
fn edit_entry<T>(
    entries: &mut Vec<T>,
    position: usize,
    edit: EntryEdit,
    set: impl Fn(&mut T, &str, String) -> Result<(), EditError>,
) -> Result<(), EditError> {
    match edit {
        EntryEdit::Remove => {
            entries.remove(position);
        }
        EntryEdit::Set(fields) => {
            if let Some(entry) = entries.get_mut(position) {
                for (field, value) in fields {
                    set(entry, field, value)?;
                }
            }
        }
    }
    Ok(())
}

/// A field an entry with `fields` doesn't have.
fn unknown_entry_field(fields: &[&str]) -> EditError {
    EditError::new(
        EditErrorCode::UnknownField,
        format!("fields: {}", fields.join(", ")),
    )
}

/// Checks the terms and references of `doc` that differ from `before`: entries the call left alone
/// may predate these rules, and mustn't block unrelated edits.
fn validate(before: &GlossaryAndReferences, doc: &GlossaryAndReferences) -> Result<(), EditError> {
    let is_touched = |term: &GlossaryTerm| !before.glossary.contains(term);
    let mut terms: HashMap<String, &GlossaryTerm> = HashMap::new();
    for term in &doc.glossary {
        if let Some(other) = terms.insert(term.term.trim().to_lowercase(), term)
            && (is_touched(term) || is_touched(other))
        {
            return Err(EditError::new(
                EditErrorCode::DuplicateTerm,
                format!(
                    "the glossary would have \"{}\" twice ({} and {})",
                    term.term, other.id, term.id
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
        if before.references.contains(reference) {
            continue;
        }
        let entry_key = bibtex_entry_key(&reference.bibtex).map_err(|reason| {
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

static CITE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\\cite((?:\[[^\]]*\]){0,2})\{(.*?)\}")
        .expect("a constant pattern the unit tests compile")
});

/// The renderer hands `[latex]…[/latex]` to KaTeX before it looks for citations, so a `\cite` in
/// there is no citation.
static LATEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[latex\].*?\[/latex\]").expect("a constant pattern the unit tests compile")
});

/// The keys of the citations the renderer shows. Rich text stores keys HTML-escaped.
fn citation_keys(text: &str) -> Vec<String> {
    let outside_latex = LATEX.replace_all(text, "");
    CITE.captures_iter(&outside_latex)
        .map(|c| decode_html_entities(&c[2]).into_owned())
        .collect()
}

fn rewrite_citations(text: &str, renames: &[(String, String)]) -> String {
    let rewrite = |segment: &str| {
        CITE.replace_all(segment, |caps: &regex::Captures| {
            let key = decode_html_entities(&caps[2]);
            match renames.iter().find(|(old, _)| *old == key) {
                Some((_, new)) => format!("\\cite{}{{{}}}", &caps[1], escape_html_text(new)),
                None => caps[0].to_string(),
            }
        })
        .into_owned()
    };
    let mut rewritten = String::with_capacity(text.len());
    let mut rest_start = 0;
    for latex in LATEX.find_iter(text) {
        rewritten.push_str(&rewrite(&text[rest_start..latex.start()]));
        rewritten.push_str(latex.as_str());
        rest_start = latex.end();
    }
    rewritten.push_str(&rewrite(&text[rest_start..]));
    rewritten
}

/// Whole-word and case-sensitive, as the renderer highlights glossary terms.
fn uses_term(text: &str, term: &str) -> bool {
    !term.is_empty() && whole_word_matches(text, term).next().is_some()
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use serde_json::{Value, json};

    use super::*;
    use crate::engine::op::PatchTarget;
    use crate::engine::{PageDocument, PageType};
    use crate::ids::SequentialIds;
    use crate::test_fixtures::{document_refs, id, p, page, para};

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

    /// Cases main-frontend's renderer tests run too (tests/rendererTextCases.test.ts).
    #[test]
    fn citations_and_terms_are_found_as_the_renderer_finds_them() {
        let cases: Value =
            serde_json::from_str(include_str!("renderer_text_cases.json")).expect("valid JSON");
        for case in cases["citations"].as_array().expect("citation cases") {
            let text = case["text"].as_str().expect("a text");
            assert_eq!(json!(citation_keys(text)), case["keys"], "{text}");
        }
        assert_term_cases(&cases["terms"], "is_used");
        assert_term_cases(&cases["term_divergences"], "mcp");
    }

    fn assert_term_cases(cases: &Value, expected_field: &str) {
        for case in cases.as_array().expect("term cases") {
            let text = case["text"].as_str().expect("a text");
            let term = case["term"].as_str().expect("a term");
            assert_eq!(
                uses_term(text, term),
                case[expected_field],
                "{term} in {text}"
            );
        }
    }

    #[test]
    fn renaming_skips_latex_and_keeps_keys_escaped() {
        let renames = [("a&b".to_string(), "c&d".to_string())];
        assert_eq!(
            rewrite_citations(
                r"[latex]\cite{a&amp;b}[/latex] \cite[p. 1]{a&amp;b}",
                &renames
            ),
            r"[latex]\cite{a&amp;b}[/latex] \cite[p. 1]{c&amp;d}"
        );
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
        let ops = crate::test_fixtures::ops(ops, PatchTarget::GlossaryAndReferences)?;
        let ids = SequentialIds::default();
        apply(&sample(), &ops, &ids).map(|edit| edit.with_page_effects(&document_refs(&pages())))
    }

    #[test]
    fn several_items_are_added_from_a_list() {
        let result = run(json!([
            {"op":"add","path":"/glossary","value":[{"term":"a","definition":"A"},{"term":"b","definition":"B"}]},
            {"op":"add","path":"/references","value":[{"citation_key":"x1","bibtex":"@misc{x1, title={X}}"}]},
        ]))
        .unwrap();
        assert_eq!(result.document.glossary.len(), 3);
        assert_eq!(result.document.references.len(), 2);
    }

    #[test]
    fn terms_are_whole_words_even_with_symbols() {
        assert!(uses_term("C++ is a language", "C++"));
        assert!(uses_term("Learn .NET today", ".NET"));
        assert!(!uses_term("Learn .NETwork", ".NET"));
        assert!(uses_term("a muuttuja.", "muuttuja"));
        assert!(!uses_term("muuttujat", "muuttuja"));
    }

    #[test]
    fn parenthesized_entries_may_hold_parentheses() {
        assert_eq!(
            bibtex_entry_key(r#"@misc(k, note = "see (x) here")"#).unwrap(),
            "k"
        );
        assert_eq!(bibtex_entry_key("@misc(k, note = {a (b) c})").unwrap(), "k");
        assert!(bibtex_entry_key("@misc(k, note = {x}) @misc(j, t={y})").is_err());
    }

    #[test]
    fn citation_renames_leave_exercise_content_alone() {
        let ops = crate::test_fixtures::ops(
            json!([{"op":"replace","path":format!("{}/citation_key", p("r1")),"value":"knuth98"}]),
            PatchTarget::GlossaryAndReferences,
        )
        .unwrap();
        let ids = SequentialIds::default();
        let pages = vec![page(
            "pg1",
            PageType::CoursePage,
            vec![
                para("p1", "\\cite{knuth1997}"),
                crate::test_fixtures::block(
                    "ex",
                    blocks::EXERCISE_BLOCK,
                    json!({"id": id("e1").to_string()}),
                    vec![para("inside", "\\cite{knuth1997}")],
                ),
            ],
        )];
        let mut renamed = sample();
        renamed.references[0].bibtex = "@book{knuth98, title = {The Art}}".into();
        let result = apply(&renamed, &ops, &ids)
            .unwrap()
            .with_page_effects(&document_refs(&pages));
        let blocks = &result.rewritten_pages[0].blocks;
        assert_eq!(blocks[0].attributes["content"], json!("\\cite{knuth98}"));
        assert_eq!(
            blocks[1].inner_blocks[0].attributes["content"],
            json!("\\cite{knuth1997}")
        );
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
                document: DocumentKey::Page(id("pg1")),
                kind: UsageKind::GlossaryTerm,
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
        assert_eq!(result.usages[0].kind, UsageKind::CitationKey);
    }

    #[test]
    fn basic_bibtex_parser() {
        assert_eq!(
            bibtex_entry_key("@article{a1, title={X {nested}}}").unwrap(),
            "a1"
        );
        assert!(bibtex_entry_key("@article{a1, x={1}} @book{b, y={2}}").is_err());
        assert!(bibtex_entry_key("not bibtex").is_err());
    }
}
