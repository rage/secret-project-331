//! Content of the `guide` tool: per block type from the CMS schema export, per topic hand-written.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::engine::{EditError, EditErrorCode, PageType};
use crate::validator::BlockSchemas;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum GuideTopic {
    Editing,
    CourseStructure,
    PublishingAndRisk,
    PreviewsAndChecks,
    CitationsAndGlossary,
    RichText,
    Exercises,
}

impl GuideTopic {
    pub const ALL: [GuideTopic; 7] = [
        GuideTopic::Editing,
        GuideTopic::CourseStructure,
        GuideTopic::PublishingAndRisk,
        GuideTopic::PreviewsAndChecks,
        GuideTopic::CitationsAndGlossary,
        GuideTopic::RichText,
        GuideTopic::Exercises,
    ];

    fn text(self) -> &'static str {
        match self {
            GuideTopic::Editing => EDITING,
            GuideTopic::CourseStructure => COURSE_STRUCTURE,
            GuideTopic::PublishingAndRisk => PUBLISHING_AND_RISK,
            GuideTopic::PreviewsAndChecks => PREVIEWS_AND_CHECKS,
            GuideTopic::CitationsAndGlossary => CITATIONS_AND_GLOSSARY,
            GuideTopic::RichText => RICH_TEXT,
            GuideTopic::Exercises => EXERCISES,
        }
    }
}

const EDITING: &str = "\
patch_page_content takes ops {op, path, from, through, value, position, to_page, label, at_text}.
- add: value is a block or a list of blocks; position before/after a block path or start/end of a children list (\"\" or /<id>/innerBlocks).
- replace /<id>: a block, keeping its id; fields you leave out keep their values; a container's replacement needs innerBlocks (use {\"clientId\":\"…\"} stubs to keep children).
- replace /<id>/attributes/<name>: sets one attribute at any depth; a missing key is added. remove on it deletes the attribute.
- replace on a children list or \"\": array rules: a stub keeps a block, a block with clientId replaces it, a block without one is new; leaving out an existing block or naming an unknown id is an error. Use this to reorder.
- move/copy: from (+through) to path+position; to_page moves or copies to another page. move keeps ids, copy assigns new ones (a copied exercise becomes a new exercise without submissions).
- remove: a block or a range (path + through).
- wrap (path, through, value: the container), unwrap (path), split (path, at_text: the second block starts there), merge (from into path; from must be the next sibling).
- Exercise blocks can be moved, copied and removed, not replaced or edited; patch_exercise edits an exercise's name, own deadline and instructions.
- dry_run: true stages nothing and returns the diff; read_back reads the result in the same call.";

const COURSE_STRUCTURE: &str = "\
get_course_structure returns {course: {pages, modules: [{chapters: [{pages}]}]}}. The first page of a chapter is its front page (is_chapter_front_page: true); the course front page (/) is always first in /course/pages; the default module is always first and has no name.
patch_course_structure ops: replace fields (module name; chapter name, color, opens_at, deadline; page title, url_path, hidden), remove (field to null, or an entity or page range), add (module, chapter or page; a chapter gets a front page; a page may carry blocks), move, copy (page or chapter; new ids, -copy suffix), reorder (value: exactly the current ids in the new order).
- Chapter numbers and /chapter-N paths are recomputed after every call. A chapter page's url_path is its last segment, e.g. \"loops\" for /chapter-2/loops; the front page's path is always /chapter-N.
- url_path is unique in the course after the call; paths can be swapped in one call. Changed paths get redirects automatically; removed pages get none.
- A new page that translates a page of another language version of the course takes pair_with: <that page's id>; it joins that page's page_language_group_id at publish, so language switching links the two. The source page must be published, and the group can't already have a page in this course.
- dry_run: true returns an outline of the changed chapters and pages (counts, then one line each: old -> new path, title, position) and the redirects; read it against your plan, as detail: true adds the full diff.
- Pages with exercises stay inside chapters. Settings (completion, certificates) are edited with patch_course_settings.";

const PUBLISHING_AND_RISK: &str = "\
Every write stages into your open changeset for the course; later calls build on it, and reads show it unless state is published. list_changesets shows it, discard_changeset drops it, publish_changeset publishes it.
A change is risky only in live content (not draft, not test mode, not a hidden page, not a chapter that hasn't opened):
- removing an exercise block whose exercise has submissions, or a page or chapter containing one
- removing a visible page or an open chapter
- moving a deadline earlier or adding one to an open chapter; moving an open chapter's opening time later
- changing an exercise's own deadline so that the deadline that applies to it moves earlier, or it gets one, while its chapter is open
- changing a completion policy or the module completion requirement after completions exist; turning chapter locking on or off
publish_changeset refuses changesets with risky changes; the teacher publishes those on the review page. Size alone is never risky; moving exercises is never risky, even when the move changes which chapter deadline applies. Publishing fails if a staged page or entity changed live meanwhile: drop just those with discard_changeset and entities, read their published state again and redo your edits to them.
A write fails with staged_state_changed when a parallel call changed what it read; read again and repeat it.
After publishing, get_history lists changes and revert_change undoes one write call.";

const PREVIEWS_AND_CHECKS: &str = "\
get_preview_link returns read-only URLs of pages' staged state (pages: several at once), valid about 2 hours, no login needed. Open it with your own browser tooling (playwright-cli) in a desktop or mobile viewport and check: render and console errors, LaTeX errors (.katex-error), broken links and images, and accessibility (axe). The preview shows each exercise's name, task instructions and review instructions, but not the exercise itself to answer, and has no chapter navigation. Checks are expected before a changeset is published.";

const CITATIONS_AND_GLOSSARY: &str = "\
Citations are written in rich text as \\cite{key}, \\cite[postnote]{key} or \\cite[prenote][postnote]{key}, where key is a reference's citation_key. References hold one BibTeX entry each (fields citation_key, bibtex); the entry's key must equal citation_key and be unique in the course.
Glossary terms (fields term, definition) are highlighted automatically wherever the exact term appears, case-sensitively, as a whole word: a letter (ä and ö included), digit or _ at the term's edge never touches another one, so \"äly\" isn't highlighted in \"tekoäly\" and an inflected form like \"algoritmin\" isn't highlighted for \"algoritmi\". A tag counts as a word edge. Nothing is marked up in the content.
Renaming a citation_key rewrites its citations in page content and exercise instructions. Removing a reference, or renaming or removing a term, changes no content; the result lists the pages and exercise instructions that use it.";

const RICH_TEXT: &str = "\
Rich-text attributes hold the HTML the editor stores, with inline formats only, in exactly the shapes the editor produces (see rich_text_formats). No block-level tags, scripts, event attributes, style attributes or inline images. Inline math is [latex]x^2[/latex], rendered with KaTeX like moocfi/latex blocks; inside it only &amp; is decoded. The editor's <math> format renders as browser MathML and looks different: use it only where the page already does. Write &amp;, &lt; and &gt; as entities. Matching in find_replace sees this markup: <em>for</em> loops doesn't match \"for loops\". The validator normalises harmless differences and rejects anything that would change meaning.";

const EXERCISES: &str = "\
An exercise block on a page holds only the exercise id (exercise_id in reads). get_exercise reads the exercise: name, tasks, review settings and its instructions; patch_exercise edits the name, the own deadline, each task's instructions (/tasks/<task id>) and the review instructions (/review_instructions) with page-content ops. Everything else (points, tries, task specs, review thresholds and questions) is read-only; the teacher edits it in the editor.
- The effective deadline is the exercise's own, else its chapter's. Chapter deadlines are strongly preferred: own deadlines are easy to miss when dates change. Add one only when the teacher asks; deadline: null clears it. Times are RFC 3339 with an offset.
- /tasks/<task id>/specs reads a task's private, public and model solution specs together; the private spec is what the editor saves and the only authoritative one, and the service derives the others from it, so they can lag behind a staged change until publish. Specs hold answer keys: never copy them into what students see.
- Instructions take the blocks the editor allows there, which the validator checks; exercise blocks can't be nested in them.
- Review instructions show only for exercises with peer or self reviews. Most exercises use the course default review config, so its instructions are shared: review_config edit_course_default edits them for every exercise using it. Prefer that. fork gives one exercise its own copy of the default settings and questions, for an exercise with special needs; use_course_default drops an exercise's own settings again, and the result lists what it drops.
- Switching review settings is allowed after students have given reviews, but the result and the review page warn about it.
- Name and instruction edits are never risky; a deadline change is risky as in publishing-and-risk.
- find_replace and structural_replace include instructions by default (include_exercise_instructions) and find_replace exercise names with include_exercise_names; matches in the course default review instructions are listed once and change every exercise using it. Bulk tools never fork.";

/// The `guide` tool's result: the guide of each block type and topic asked for, or with neither
/// asked for, the index of both. `schemas` may be `None` only when only topics are asked for.
pub fn answer(
    schemas: Option<&BlockSchemas>,
    block_types: &[String],
    topics: &[GuideTopic],
) -> Result<Value, EditError> {
    let mut answer = Map::new();
    if let Some(schemas) = schemas {
        if block_types.is_empty() && topics.is_empty() {
            return Ok(index(schemas));
        }
        if !block_types.is_empty() {
            answer = blocks_guide(schemas, block_types)?;
        }
    }
    if !topics.is_empty() {
        answer.insert("topics".into(), topics_guide(topics));
    }
    Ok(Value::Object(answer))
}

/// What the guide covers: its topics and the block types each page type allows.
fn index(schemas: &BlockSchemas) -> Value {
    json!({
        "topics": GuideTopic::ALL,
        "block_types_by_page_type": schemas.page_types,
        "schema_version": schemas.version,
        "usage": "Call guide with block_types and/or topics for details.",
    })
}

/// The hand-written guide of each topic.
fn topics_guide(topics: &[GuideTopic]) -> Value {
    json!(
        topics
            .iter()
            .map(|topic| json!({"topic": topic, "text": topic.text()}))
            .collect::<Vec<_>>()
    )
}

/// Each block type's schema, nesting rules and an example add op, with the rich-text formats.
/// Errors on an unknown block type, listing similar ones.
fn blocks_guide(
    schemas: &BlockSchemas,
    block_types: &[String],
) -> Result<Map<String, Value>, EditError> {
    let blocks = block_types
        .iter()
        .map(|name| block_guide(schemas, name))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Map::from_iter([
        ("blocks".to_string(), Value::Array(blocks)),
        (
            "rich_text_formats".to_string(),
            json!(schemas.rich_text_formats),
        ),
        ("schema_version".to_string(), json!(schemas.version)),
    ]))
}

fn block_guide(schemas: &BlockSchemas, name: &str) -> Result<Value, EditError> {
    let Some(schema) = schemas.blocks.get(name) else {
        let suffix = name.rsplit('/').next().unwrap_or(name);
        let similar: Vec<&String> = schemas
            .blocks
            .keys()
            .filter(|k| k.contains(suffix))
            .collect();
        return Err(
            EditError::new(EditErrorCode::NotFound, format!("no block type \"{name}\""))
                .with_details(
                    json!({"similar": similar, "all": schemas.blocks.keys().collect::<Vec<_>>()}),
                ),
        );
    };
    let page_types: Vec<&PageType> = schemas
        .page_types
        .iter()
        .filter(|(_, names)| names.iter().any(|n| n == name))
        .map(|(t, _)| t)
        .collect();
    let mut example_op =
        json!({"op": "add", "path": "", "position": "end", "value": schema.example});
    if schema
        .allowed_parents
        .as_ref()
        .is_some_and(|p| !p.iter().any(|p| p == "root"))
    {
        example_op["path"] = json!("/<parent id>/innerBlocks");
    }
    Ok(json!({
        "name": name,
        "title": schema.title,
        "description": schema.description,
        "attributes": schema.attributes,
        "allowed_parents": schema.allowed_parents,
        "allowed_children": schema.allowed_children,
        "template": schema.template,
        "template_lock": schema.template_lock,
        "page_types": page_types,
        "enabled_by_course_setting": schemas.course_feature_gated_blocks.get(name),
        "example_op": example_op,
    }))
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;
    use crate::validator::{BlockSchema, RichTextFormat};

    fn schemas() -> BlockSchemas {
        BlockSchemas {
            version: "abc".into(),
            page_types: BTreeMap::from([(
                PageType::CoursePage,
                vec!["core/paragraph".into(), "core/list-item".into()],
            )]),
            course_feature_gated_blocks: BTreeMap::new(),
            max_request_bytes: 1_000_000,
            rich_text_formats: vec![RichTextFormat {
                name: "core/bold".into(),
                tag: "strong".into(),
                description: "Bold".into(),
            }],
            blocks: BTreeMap::from([
                (
                    "core/paragraph".into(),
                    BlockSchema {
                        title: "Paragraph".into(),
                        description: String::new(),
                        attributes: serde_json::from_value(
                            json!({"content": {"type": "string", "x-rich-text": true}}),
                        )
                        .unwrap(),
                        allowed_parents: None,
                        allowed_children: Some(vec![]),
                        template: None,
                        template_lock: None,
                        example: json!({"name": "core/paragraph", "attributes": {"content": "Example text."}, "innerBlocks": []}),
                    },
                ),
                (
                    "core/list-item".into(),
                    BlockSchema {
                        title: "List item".into(),
                        description: String::new(),
                        attributes: Map::new(),
                        allowed_parents: Some(vec!["core/list".into()]),
                        allowed_children: None,
                        template: None,
                        template_lock: None,
                        example: json!({}),
                    },
                ),
            ]),
        }
    }

    #[test]
    fn index_blocks_and_topics() {
        let index = index(&schemas());
        assert_eq!(index["topics"].as_array().unwrap().len(), 7);
        assert_eq!(index["topics"][1], json!("course-structure"));
        let guide = blocks_guide(
            &schemas(),
            &["core/paragraph".into(), "core/list-item".into()],
        )
        .unwrap();
        assert_eq!(guide["blocks"][0]["example_op"]["path"], json!(""));
        assert_eq!(
            guide["blocks"][1]["example_op"]["path"],
            json!("/<parent id>/innerBlocks")
        );
        assert_eq!(guide["blocks"][0]["page_types"], json!(["course-page"]));
        let topics = topics_guide(&[GuideTopic::RichText]);
        assert_eq!(topics[0]["topic"], json!("rich-text"));
        assert!(topics[0]["text"].as_str().unwrap().contains("[latex]"));
    }

    #[test]
    fn unknown_block_lists_similar() {
        let error = blocks_guide(&schemas(), &["moocfi/paragraph".into()]).unwrap_err();
        assert_eq!(error.details.unwrap()["similar"], json!(["core/paragraph"]));
    }
}
