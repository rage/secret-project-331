//! Every tool's name, description, input schema, annotations and scope, in `tools/list` order.

use serde_json::{Map, Value, json};

use super::Scope;
use super::args::*;
use super::schema::input_schema;
use crate::engine::op::PatchTarget;

#[derive(Debug, Clone)]
pub struct ToolDefinition {
    pub name: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub input_schema: Map<String, Value>,
    pub is_read_only: bool,
    pub is_destructive: bool,
    pub is_idempotent: bool,
    /// The token needs this scope to see and call the tool.
    pub scope: Scope,
    /// Client-specific tool `_meta` (Claude Code's `anthropic/*` keys).
    pub meta: Map<String, Value>,
}

impl ToolDefinition {
    /// The tool as listed by `tools/list`.
    pub fn to_json(&self) -> Value {
        let mut tool = json!({
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "inputSchema": self.input_schema,
            "annotations": {
                "title": self.title,
                "readOnlyHint": self.is_read_only,
                "destructiveHint": self.is_destructive,
                "idempotentHint": self.is_idempotent,
                "openWorldHint": false,
            },
        });
        if !self.meta.is_empty() {
            tool["_meta"] = Value::Object(self.meta.clone());
        }
        tool
    }

    /// The argument names the tool promotes to `Mcp-Param-*` headers, with the header suffix.
    pub fn header_params(&self) -> Vec<(String, String)> {
        self.input_schema
            .get("properties")
            .and_then(Value::as_object)
            .map(|properties| {
                properties
                    .iter()
                    .filter_map(|(name, schema)| {
                        Some((
                            name.clone(),
                            schema.get("x-mcp-header")?.as_str()?.to_string(),
                        ))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
}

enum Kind {
    Read,
    Write {
        is_destructive: bool,
        is_idempotent: bool,
    },
}

fn define(
    name: &'static str,
    title: &'static str,
    description: &'static str,
    input_schema: Map<String, Value>,
    kind: Kind,
    scope: Scope,
) -> ToolDefinition {
    let (is_read_only, is_destructive, is_idempotent) = match kind {
        Kind::Read => (true, false, true),
        Kind::Write {
            is_destructive,
            is_idempotent,
        } => (false, is_destructive, is_idempotent),
    };
    let mut meta = Map::new();
    if is_read_only {
        meta.insert("anthropic/maxResultSizeChars".into(), json!(100_000));
    }
    if matches!(
        name,
        "list_courses"
            | "get_course_structure"
            | "get_page_content"
            | "patch_page_content"
            | "guide"
    ) {
        meta.insert("anthropic/alwaysLoad".into(), json!(true));
    }
    ToolDefinition {
        name,
        title,
        description,
        input_schema,
        is_read_only,
        is_destructive,
        is_idempotent,
        scope,
        meta,
    }
}

/// Narrows the shared op enum to the ops this tool takes.
fn ops_schema(mut schema: Map<String, Value>, target: PatchTarget) -> Map<String, Value> {
    let ops: Vec<Value> = target
        .allowed_ops()
        .iter()
        .map(|op| json!(op.as_str()))
        .collect();
    if let Some(op) = schema
        .get_mut("properties")
        .and_then(|p| p.pointer_mut("/ops/items/properties/op"))
    {
        op["enum"] = Value::Array(ops);
    }
    schema
}

pub fn definitions() -> Vec<ToolDefinition> {
    let write = |is_destructive| Kind::Write {
        is_destructive,
        is_idempotent: false,
    };
    vec![
        define(
            "list_courses",
            "List courses",
            "Lists the courses you can edit: id, name, slug, language, draft and test-mode state, organization. Start here to find a course id.",
            input_schema::<ListCoursesArgs>(),
            Kind::Read,
            Scope::MaterialRead,
        ),
        define(
            "get_course_structure",
            "Read course structure",
            "Reads modules, chapters and pages (titles, paths, chapter dates, hidden state, block and exercise counts). Selectors: path (/course, /course/pages, /<module id>/chapters, /<chapter id>, /<page id>/title), through (sibling range), around, offset/limit on lists, mode outline|raw, state staged (default, includes your unpublished changes) or published. Paged results end with has_more and an id-anchored next selector.",
            input_schema::<GetCourseStructureArgs>(),
            Kind::Read,
            Scope::MaterialRead,
        ),
        define(
            "get_page_content",
            "Read page content",
            "Reads a page's blocks. Start with an outline (no selectors): ids, types and short previews. Then read what you'll change with mode raw: path /<block id>, a field /<block id>/attributes/content, a children list /<block id>/innerBlocks, a range path+through, around n siblings, or offset/limit over a list (\"\" is the top level). Every block comes with clientId and a ready path. state: published reads what students see.",
            input_schema::<GetPageContentArgs>(),
            Kind::Read,
            Scope::MaterialRead,
        ),
        define(
            "get_course_settings",
            "Read course settings",
            "Reads course settings (name, description, listing, chapter locking, AI policy, audiences, module completion requirement) and each module's completion policy and certificates. Publishing and closing switches are shown but read-only.",
            input_schema::<CourseArgs>(),
            Kind::Read,
            Scope::MaterialRead,
        ),
        define(
            "get_course_glossary_and_references",
            "Read glossary and references",
            "Reads the course glossary (id, term, definition) and references (id, citation_key, bibtex).",
            input_schema::<CourseArgs>(),
            Kind::Read,
            Scope::MaterialRead,
        ),
        define(
            "patch_page_content",
            "Edit page content",
            concat!(
                "Edits one page's blocks with JSON-Patch-style ops. Paths start at a block id: /<id>, /<id>/innerBlocks, /<id>/attributes/<name>, /<id>/name; \"\" is the top level; numeric indexes are rejected. ",
                "add (value: block or list; position before/after a block, or start/end of a children list), remove (+through), replace (a block keeps its id; an attribute; a children list or \"\" with stubs {\"clientId\":…} to keep blocks), ",
                "move/copy (from, +through, to_page for another page, position), wrap (value: the container), unwrap, split (at_text), merge (from into path). New blocks have no id; \"label\":\"$x\" names one for later ops in the call. ",
                "Exercise blocks can only be moved, copied or removed. Call guide for a block type's schema before writing it. read_back reads the result.",
                " Every write stages into your open changeset for the course; nothing is live until publish_changeset or the teacher publishes it. Ops apply in order, all or nothing; invariants are checked at the end. dry_run: true stages nothing and returns the diff."
            ),
            ops_schema(
                input_schema::<PatchPageContentArgs>(),
                PatchTarget::PageContent,
            ),
            write(true),
            Scope::MaterialStage,
        ),
        define(
            "patch_course_structure",
            "Edit course structure",
            concat!(
                "Edits modules, chapters and pages: add (a module, a chapter with an automatic front page, or a page, optionally with blocks), remove (+through), replace fields (module name; chapter name, color, opens_at, deadline; page title, url_path, hidden; remove sets nullable fields to null), move (+through), copy (page or chapter, new ids), reorder (value: all current ids in the new order). ",
                "Paths: /course/modules, /course/pages, /<module id>/chapters, /<chapter id>/pages, /<id>, /<id>/<field>. The first page of a chapter is its front page; the course front page (/) and the default module stay first. Chapter numbers and paths are recomputed after each call; changed paths get redirects automatically. The only way to create pages.",
                " Every write stages into your open changeset for the course; nothing is live until publish_changeset or the teacher publishes it. Ops apply in order, all or nothing; invariants are checked at the end. dry_run: true stages nothing and returns the diff."
            ),
            ops_schema(
                input_schema::<PatchCourseStructureArgs>(),
                PatchTarget::CourseStructure,
            ),
            write(true),
            Scope::MaterialStage,
        ),
        define(
            "patch_course_settings",
            "Edit course settings",
            concat!(
                "Edits settings: replace /course/<field> (name, description, is_unlisted, chapter_locking_enabled, ai_policy, base_module_completion_requires_n_submodule_completions), add to /course/audiences (value {\"name\"}), remove /<audience id>, replace /<module id>/completion_policy or one of its fields (note the spelling \"treshold\"), /<module id>/certification_enabled. ",
                "Draft, test-mode and closing switches are read-only for agents. Module names are edited with patch_course_structure.",
                " Every write stages into your open changeset for the course; nothing is live until publish_changeset or the teacher publishes it. Ops apply in order, all or nothing; invariants are checked at the end. dry_run: true stages nothing and returns the diff."
            ),
            ops_schema(
                input_schema::<PatchCourseArgs>(),
                PatchTarget::CourseSettings,
            ),
            write(true),
            Scope::SettingsWrite,
        ),
        define(
            "patch_course_glossary_and_references",
            "Edit glossary and references",
            concat!(
                "Edits glossary terms and references: add to /glossary (value {\"term\",\"definition\"}) or /references (value {\"citation_key\",\"bibtex\"}), replace /<id>/<field> or /<id> with an object, remove /<id>. ",
                "A reference's bibtex holds one entry whose key equals citation_key. Renaming a citation_key rewrites its \\cite{…} citations in pages; other changes only list the pages that use the term or key.",
                " Every write stages into your open changeset for the course; nothing is live until publish_changeset or the teacher publishes it. Ops apply in order, all or nothing; invariants are checked at the end. dry_run: true stages nothing and returns the diff."
            ),
            ops_schema(
                input_schema::<PatchCourseArgs>(),
                PatchTarget::GlossaryAndReferences,
            ),
            write(true),
            Scope::MaterialStage,
        ),
        define(
            "find_replace",
            "Find and replace text",
            "Searches, and with replace changes, text across a course, chapter or page. Matches the stored HTML of text attributes (content, captions, alt texts, titles…), so markup counts: <em>for</em> loops doesn't match \"for loops\". Literal finds match whole words at word edges; regex: true takes a regex and $1-style replacements. attributes picks attribute names or /regex/ on names. expected_count fails the call on any other count. Lists likely inflected forms it didn't change. Use dry_run: true first. Replacing needs the material:stage scope; exercise blocks are skipped.",
            input_schema::<FindReplaceArgs>(),
            write(true),
            Scope::MaterialRead,
        ),
        define(
            "structural_replace",
            "Replace blocks by pattern",
            "Finds blocks by type and visible text (match: name, text_starts_with, text_contains, text_regex) across a course, chapter or page, and applies one action to each: wrap_in a container type, retype_to another type, unwrap: true or remove: true. Use dry_run: true and expected_count. Stages like other writes.",
            input_schema::<StructuralReplaceArgs>(),
            write(true),
            Scope::MaterialStage,
        ),
        define(
            "upload_file",
            "Upload a file",
            "Uploads an image or file for the course and returns its URL, to use in image or file block attributes.",
            input_schema::<UploadFileArgs>(),
            write(false),
            Scope::MaterialStage,
        ),
        define(
            "list_changesets",
            "List changesets",
            "Lists your changesets: the open one per course with its staged pages and entities, risky items and the review link, plus recently published ones.",
            input_schema::<ListChangesetsArgs>(),
            Kind::Read,
            Scope::MaterialRead,
        ),
        define(
            "publish_changeset",
            "Publish changeset",
            "Publishes your open changeset so students see it. Refused when it holds risky changes (only the teacher publishes those, on the review page given in the result) or when a staged page or entity changed live since it was staged (restage then).",
            input_schema::<ChangesetArgs>(),
            write(true),
            Scope::MaterialPublish,
        ),
        define(
            "discard_changeset",
            "Discard changeset",
            "Drops every staged change in your open changeset; the undo before publishing.",
            input_schema::<ChangesetArgs>(),
            Kind::Write {
                is_destructive: true,
                is_idempotent: true,
            },
            Scope::MaterialStage,
        ),
        define(
            "get_preview_link",
            "Get preview link",
            "Returns a read-only preview URL of a page's staged state, valid about 15 minutes without login, for visual checks in a browser.",
            input_schema::<GetPreviewLinkArgs>(),
            Kind::Read,
            Scope::MaterialRead,
        ),
        define(
            "get_history",
            "Read change history",
            "Lists recent changes to a course or one entity: who, through which client, when, and the write call id that revert_change takes.",
            input_schema::<GetHistoryArgs>(),
            Kind::Read,
            Scope::MaterialRead,
        ),
        define(
            "revert_change",
            "Revert a change",
            "Undoes one published write call by staging the versions from just before it. Rejected if an entity changed again since; the error lists them. The revert stages like any write.",
            input_schema::<RevertChangeArgs>(),
            write(true),
            Scope::MaterialStage,
        ),
        define(
            "guide",
            "Guide",
            "Returns how to write content: per block type (block_types) the attribute schema, nesting rules, allowed rich-text formats and an example add op; per topic (topics) a short guide. No arguments lists the topics and block types per page type. Call it before creating or changing a block type for the first time.",
            input_schema::<GuideArgs>(),
            Kind::Read,
            Scope::MaterialRead,
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    const MAX_SCHEMA_BYTES: usize = 4_500;

    fn walk(value: &Value, visit: &mut dyn FnMut(&str, &Value)) {
        if let Value::Object(map) = value {
            for (key, child) in map {
                visit(key, child);
                walk(child, visit);
            }
        } else if let Value::Array(items) = value {
            items.iter().for_each(|i| walk(i, visit));
        }
    }

    #[test]
    fn every_input_schema_is_small_and_flat() {
        for tool in definitions() {
            let bytes = serde_json::to_vec(&tool.input_schema).unwrap().len();
            assert!(
                bytes < MAX_SCHEMA_BYTES,
                "{} input schema is {bytes} bytes",
                tool.name
            );
            let schema = Value::Object(tool.input_schema.clone());
            walk(&schema, &mut |key, value| {
                assert!(
                    !matches!(key, "oneOf" | "anyOf" | "allOf" | "$ref" | "$defs"),
                    "{} uses {key}",
                    tool.name
                );
                if key == "type" {
                    assert!(value.is_string(), "{} has a type array", tool.name);
                }
            });
            assert_eq!(tool.input_schema["type"], json!("object"));
        }
    }

    #[test]
    fn fixed_order_unique_names_and_skill_version_everywhere() {
        let tools = definitions();
        let names: Vec<_> = tools.iter().map(|t| t.name).collect();
        assert_eq!(names.first(), Some(&"list_courses"));
        assert_eq!(names.last(), Some(&"guide"));
        assert_eq!(names.len(), 19);
        let mut unique = names.clone();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(unique.len(), names.len());
        for tool in &tools {
            let properties = tool.input_schema["properties"].as_object().unwrap();
            assert!(properties.contains_key("skill_version"), "{}", tool.name);
            let required = tool
                .input_schema
                .get("required")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            assert!(!required.contains(&json!("skill_version")));
        }
    }

    #[test]
    fn ops_are_a_flat_struct_with_untyped_value() {
        let tool = definitions()
            .into_iter()
            .find(|t| t.name == "patch_page_content")
            .unwrap();
        let op = &tool.input_schema["properties"]["ops"]["items"];
        assert_eq!(op["properties"]["op"]["enum"].as_array().unwrap().len(), 9);
        assert!(
            !op["properties"]["op"]["enum"]
                .as_array()
                .unwrap()
                .contains(&json!("reorder"))
        );
        assert!(op["properties"]["value"].get("type").is_none());
        assert_eq!(op["required"], json!(["op", "path"]));
    }

    #[test]
    fn course_is_promoted_to_a_header() {
        let tool = definitions()
            .into_iter()
            .find(|t| t.name == "patch_page_content")
            .unwrap();
        assert_eq!(
            tool.header_params(),
            vec![("course".to_string(), "Course".to_string())]
        );
    }

    #[test]
    fn reads_are_read_only_and_idempotent() {
        for tool in definitions() {
            let annotations = &tool.to_json()["annotations"];
            if tool.name.starts_with("get_")
                || tool.name.starts_with("list_")
                || tool.name == "guide"
            {
                assert_eq!(annotations["readOnlyHint"], json!(true), "{}", tool.name);
                assert_eq!(annotations["idempotentHint"], json!(true), "{}", tool.name);
            } else {
                assert_eq!(annotations["readOnlyHint"], json!(false), "{}", tool.name);
            }
        }
    }
}
