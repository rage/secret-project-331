//! Content of the `guide` tool: per block type from the CMS schema export, per topic hand-written.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::engine::{EditError, EditErrorCode};
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
}

impl GuideTopic {
    pub const ALL: [GuideTopic; 6] = [
        GuideTopic::Editing,
        GuideTopic::CourseStructure,
        GuideTopic::PublishingAndRisk,
        GuideTopic::PreviewsAndChecks,
        GuideTopic::CitationsAndGlossary,
        GuideTopic::RichText,
    ];

    fn name(self) -> &'static str {
        match self {
            GuideTopic::Editing => "editing",
            GuideTopic::CourseStructure => "course-structure",
            GuideTopic::PublishingAndRisk => "publishing-and-risk",
            GuideTopic::PreviewsAndChecks => "previews-and-checks",
            GuideTopic::CitationsAndGlossary => "citations-and-glossary",
            GuideTopic::RichText => "rich-text",
        }
    }

    fn text(self) -> &'static str {
        match self {
            GuideTopic::Editing => EDITING,
            GuideTopic::CourseStructure => COURSE_STRUCTURE,
            GuideTopic::PublishingAndRisk => PUBLISHING_AND_RISK,
            GuideTopic::PreviewsAndChecks => PREVIEWS_AND_CHECKS,
            GuideTopic::CitationsAndGlossary => CITATIONS_AND_GLOSSARY,
            GuideTopic::RichText => RICH_TEXT,
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
- Exercise blocks can be moved, copied and removed, not replaced or edited.
- dry_run: true stages nothing and returns the diff; read_back reads the result in the same call.";

const COURSE_STRUCTURE: &str = "\
get_course_structure returns {course: {pages, modules: [{chapters: [{pages}]}]}}. The first page of a chapter is its front page; the course front page (/) is always first in /course/pages; the default module is always first and has no name.
patch_course_structure ops: replace fields (module name; chapter name, color, opens_at, deadline; page title, url_path, hidden), remove (field to null, or an entity or page range), add (module, chapter or page; a chapter gets a front page; a page may carry blocks), move, copy (page or chapter; new ids, -copy suffix), reorder (value: exactly the current ids in the new order).
- Chapter numbers and /chapter-N paths are recomputed after every call. A chapter page's url_path is its last segment, e.g. \"loops\" for /chapter-2/loops; the front page's path is always /chapter-N.
- url_path is unique in the course after the call; paths can be swapped in one call. Changed paths get redirects automatically; removed pages get none.
- Pages with exercises stay inside chapters. Settings (completion, certificates) are edited with patch_course_settings.";

const PUBLISHING_AND_RISK: &str = "\
Every write stages into your open changeset for the course; later calls build on it, and reads show it unless state is published. list_changesets shows it, discard_changeset drops it, publish_changeset publishes it.
A change is risky only in live content (not draft, not test mode, not a hidden page, not a chapter that hasn't opened):
- removing an exercise block whose exercise has submissions, or a page or chapter containing one
- removing a visible page or an open chapter
- moving a deadline earlier or adding one to an open chapter; moving an open chapter's opening time later
- changing a completion policy or the module completion requirement after completions exist; turning chapter locking on or off
publish_changeset refuses changesets with risky changes; the teacher publishes those on the review page. Size alone is never risky; moving exercises is never risky. Publishing fails if a staged page or entity changed live meanwhile; restage then.
After publishing, get_history lists changes and revert_change undoes one write call.";

const PREVIEWS_AND_CHECKS: &str = "\
get_preview_link returns a read-only URL for one page's staged state, valid about 15 minutes, no login needed. Open it with your own browser tooling (playwright-cli) in a desktop or mobile viewport and check: render and console errors, LaTeX errors (.katex-error), broken links and images, and accessibility (axe). The preview shows exercises as placeholders and has no chapter navigation. Checks are expected before a changeset is published.";

const CITATIONS_AND_GLOSSARY: &str = "\
Citations are written in rich text as \\cite{key}, \\cite[postnote]{key} or \\cite[prenote][postnote]{key}, where key is a reference's citation_key. References hold one BibTeX entry each (fields citation_key, bibtex); the entry's key must equal citation_key and be unique in the course.
Glossary terms (fields term, definition) are highlighted automatically wherever the exact term appears as a whole word; nothing is marked up in the content.
Renaming a citation_key rewrites its citations in page content. Removing a reference, or renaming or removing a term, changes no content; the result lists the pages that use it.";

const RICH_TEXT: &str = "\
Rich-text attributes hold the HTML the editor stores, with inline formats only, in exactly the shapes the editor produces (see rich_text_formats). No block-level tags, scripts, event attributes, style attributes or inline images. Inline math uses the editor's math format (see rich_text_formats). Write &amp;, &lt; and &gt; as entities. Matching in find_replace sees this markup: <em>for</em> loops doesn't match \"for loops\". The validator normalises harmless differences and rejects anything that would change meaning.";

/// Builds the guide for the requested block types and topics; with neither, an index.
pub fn build_guide(
    schemas: Option<&BlockSchemas>,
    block_types: &[String],
    topics: &[GuideTopic],
) -> Result<Value, EditError> {
    let mut out = Map::new();
    if block_types.is_empty() && topics.is_empty() {
        out.insert(
            "topics".into(),
            json!(GuideTopic::ALL.iter().map(|t| t.name()).collect::<Vec<_>>()),
        );
        if let Some(schemas) = schemas {
            out.insert("block_types_by_page_type".into(), json!(schemas.page_types));
            out.insert("schema_version".into(), json!(schemas.version));
        }
        out.insert(
            "usage".into(),
            json!("Call guide with block_types and/or topics for details."),
        );
        return Ok(Value::Object(out));
    }
    if !block_types.is_empty() {
        let schemas = schemas.ok_or_else(|| {
            EditError::new(
                EditErrorCode::InvalidValue,
                "block schemas are unavailable right now; try again shortly",
            )
        })?;
        let mut blocks = Vec::new();
        for name in block_types {
            blocks.push(block_guide(schemas, name)?);
        }
        out.insert("blocks".into(), Value::Array(blocks));
        out.insert("rich_text_formats".into(), json!(schemas.rich_text_formats));
        out.insert("schema_version".into(), json!(schemas.version));
    }
    if !topics.is_empty() {
        out.insert(
            "topics".into(),
            Value::Array(
                topics
                    .iter()
                    .map(|t| json!({"topic": t.name(), "text": t.text()}))
                    .collect(),
            ),
        );
    }
    Ok(Value::Object(out))
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
    let page_types: Vec<&String> = schemas
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
                "course-page".into(),
                vec!["core/paragraph".into(), "core/list-item".into()],
            )]),
            course_feature_gated_blocks: BTreeMap::new(),
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
        let index = build_guide(Some(&schemas()), &[], &[]).unwrap();
        assert_eq!(index["topics"].as_array().unwrap().len(), 6);
        let guide = build_guide(
            Some(&schemas()),
            &["core/paragraph".into(), "core/list-item".into()],
            &[GuideTopic::RichText],
        )
        .unwrap();
        assert_eq!(guide["blocks"][0]["example_op"]["path"], json!(""));
        assert_eq!(
            guide["blocks"][1]["example_op"]["path"],
            json!("/<parent id>/innerBlocks")
        );
        assert_eq!(guide["blocks"][0]["page_types"], json!(["course-page"]));
        assert!(
            guide["topics"][0]["text"]
                .as_str()
                .unwrap()
                .contains("math format")
        );
    }

    #[test]
    fn unknown_block_lists_similar() {
        let error = build_guide(Some(&schemas()), &["moocfi/paragraph".into()], &[]).unwrap_err();
        assert_eq!(error.details.unwrap()["similar"], json!(["core/paragraph"]));
    }

    #[test]
    fn topics_work_without_schemas() {
        assert!(build_guide(None, &[], &[GuideTopic::PublishingAndRisk]).is_ok());
        assert!(build_guide(None, &["core/paragraph".into()], &[]).is_err());
    }
}
