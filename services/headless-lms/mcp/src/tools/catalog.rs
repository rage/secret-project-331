//! Every tool's name, description, annotations and scope. The input schema comes from the
//! handler's arguments.

use std::sync::Arc;

use rmcp::model::{MetaObject, ToolAnnotations};
use serde_json::{Map, Value, json};

use super::schema::input_schema;
use super::{McpScope, Tool, ToolHandler};
use crate::engine::op::PatchTarget;
use crate::hints::SKILL_DECLINED;

/// What dispatch needs of a tool besides its handler.
#[derive(Debug, Clone)]
pub struct ToolDefinition {
    pub name: &'static str,
    /// The token needs this scope to see and call the tool.
    pub scope: McpScope,
    /// Whether calls without `skill_version` are refused; see [`crate::hints::skill_missing`].
    pub requires_skill: bool,
    /// The arguments the tool promotes to `Mcp-Param-*` headers, with the header suffix.
    pub header_params: Vec<(String, String)>,
    /// The tool as `tools/list` lists it.
    pub listing: rmcp::model::Tool,
}

impl<S> Tool<S> {
    /// Lets agents without the skill call the tool.
    fn usable_without_skill(mut self) -> Self {
        self.definition.requires_skill = false;
        self
    }

    /// Asks Claude Code to load the tool up front instead of on demand.
    fn always_loaded(mut self) -> Self {
        self.definition
            .listing
            .meta
            .get_or_insert_with(MetaObject::default)
            .insert("anthropic/alwaysLoad".into(), json!(true));
        self
    }

    /// Narrows the shared op enum of the input schema to the ops `target` takes.
    fn taking_ops(mut self, target: PatchTarget) -> Self {
        let schema = Arc::make_mut(&mut self.definition.listing.input_schema);
        if let Some(op) = schema
            .get_mut("properties")
            .and_then(|p| p.pointer_mut("/ops/items/properties/op"))
        {
            op["enum"] = json!(target.allowed_ops());
        }
        self
    }
}

fn read(title: &'static str) -> ToolAnnotations {
    ToolAnnotations::with_title(title)
        .read_only(true)
        .destructive(false)
        .idempotent(true)
        .open_world(false)
}

fn write(title: &'static str, is_destructive: bool) -> ToolAnnotations {
    ToolAnnotations::with_title(title)
        .read_only(false)
        .destructive(is_destructive)
        .idempotent(false)
        .open_world(false)
}

/// How every patch tool stages, appended to their descriptions.
macro_rules! staging_note {
    () => {
        " Every write stages into your open changeset for the course; nothing is live until publish_changeset or the teacher publishes it. Ops apply in order, all or nothing; invariants are checked at the end. dry_run: true stages nothing and returns the diff."
    };
}

fn define<S, H: ToolHandler<S> + 'static>(
    handler: H,
    name: &'static str,
    description: &'static str,
    annotations: ToolAnnotations,
    scope: McpScope,
) -> Tool<S> {
    let mut input_schema = input_schema::<H::Args>();
    // Dispatch takes `skill_version` out before the handler parses its arguments.
    if let Value::Object(properties) = input_schema
        .entry("properties")
        .or_insert_with(|| json!({}))
    {
        properties.insert(
            "skill_version".into(),
            json!({"type": "string", "description": format!("Version from the course-material skill's VERSION file, or \"{SKILL_DECLINED}\" once the teacher has said no to installing the skill. Without either, calls are refused.")}),
        );
    }
    let header_params = header_params(&input_schema);
    let title = annotations.title.clone().unwrap_or_default();
    let mut listing =
        rmcp::model::Tool::new(name, description, Arc::new(input_schema)).with_title(title);
    if annotations.read_only_hint == Some(true) {
        listing = listing.with_meta(MetaObject::from(Map::from_iter([(
            "anthropic/maxResultSizeChars".to_string(),
            json!(100_000),
        )])));
    }
    Tool {
        definition: ToolDefinition {
            name,
            scope,
            requires_skill: true,
            header_params,
            listing: listing.with_annotations(annotations),
        },
        handler: Box::new(handler),
    }
}

fn header_params(input_schema: &Map<String, Value>) -> Vec<(String, String)> {
    input_schema
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

/// The `list_courses` tool, run by `handler`.
pub fn list_courses<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "list_courses",
        "Lists the courses you can edit: id, name, slug, language, draft and test-mode state, organization, copied_from_id (the course it was copied from), language_group_id and language_versions (the group's other courses, id and language only; those you can edit are rows here too). Start here to find a course id.",
        read("List courses"),
        McpScope::MaterialRead,
    )
    .always_loaded()
}

/// The `get_course_structure` tool, run by `handler`.
pub fn get_course_structure<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "get_course_structure",
        "Reads modules, chapters and pages (titles, paths, chapter dates, hidden state, block and exercise counts, page_language_group_id: shared with the page's versions in the course's other languages, null until a new page is published). Selectors: path (/course, /course/pages, /<module id>/chapters, /<chapter id>, /<page id>/title), through (sibling range), around, offset/limit on lists, mode outline|raw, state staged (default, includes your unpublished changes) or published. Paged results end with has_more and an id-anchored next selector.",
        read("Read course structure"),
        McpScope::MaterialRead,
    )
    .always_loaded()
}

/// The `get_page_content` tool, run by `handler`.
pub fn get_page_content<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "get_page_content",
        "Reads a page's blocks. Start with an outline (no selectors): ids, types and short previews. Then read what you'll change with mode raw: path /<block id>, a field /<block id>/attributes/content, a children list /<block id>/innerBlocks, a range path+through, around n siblings, or offset/limit over a list (\"\" is the top level). Every block comes with clientId and a ready path. state: published reads what students see.",
        read("Read page content"),
        McpScope::MaterialRead,
    )
    .always_loaded()
}

/// The `get_course_settings` tool, run by `handler`.
pub fn get_course_settings<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "get_course_settings",
        "Reads course settings (name, description, listing, chapter locking, AI policy, audiences, module completion requirement) and each module's completion policy and certificates. Publishing and closing switches are shown but read-only. default_peer_review is the course default peer review config (counts, threshold, strategy, questions; read-only) or null; get_exercise reads its instructions.",
        read("Read course settings"),
        McpScope::MaterialRead,
    )
}

/// The `get_course_glossary_and_references` tool, run by `handler`.
pub fn get_course_glossary_and_references<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "get_course_glossary_and_references",
        "Reads the course glossary (id, term, definition) and references (id, citation_key, bibtex).",
        read("Read glossary and references"),
        McpScope::MaterialRead,
    )
}

/// The `get_exercise` tool, run by `handler`.
pub fn get_exercise<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "get_exercise",
        "Reads an exercise: name, tasks, own and effective deadline, whether it uses the course default review config or its own, read-only settings, has_submissions (only when students have answered), and an outline of each task's instructions and of the review instructions it shows. Selectors as in get_page_content, with paths starting at /tasks/<task id> or /review_instructions. /tasks/<task id>/specs (each task's specs_path) reads the task's private, public and model solution specs (answer keys included); /specs/<kind>/<JSON pointer> reads part of one when the whole is too large.",
        read("Read exercise"),
        McpScope::MaterialRead,
    )
}

/// The `list_exercises` tool, run by `handler`.
pub fn list_exercises<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "list_exercises",
        "Lists the exercises of a course, chapter or page (scope) in course order: id, name, page, chapter_id (whose deadline applies without an own one), order on the page, task types, score_maximum, tries, deadline_own, deadline_effective, review_source (own, default or none), has_submissions, copied_from and exercise_language_group_id (pairs language versions and copies). state staged (default) or published; offset/limit page the list. Chapter dates and paths come from get_course_structure, review details from get_exercise and get_course_settings.",
        read("List exercises"),
        McpScope::MaterialRead,
    )
}

/// The `read_public_course` tool, run by `handler`.
pub fn read_public_course<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "read_public_course",
        "Reads another course on courses.mooc.fi as reference material, published state only, as far as the course site lets you open it (drafts, join-code courses and the pages of unopened chapters are refused unless your roles or a used join code open them; hidden pages aren't read). Takes its course or page URL, or course_slug. Without path: the course's name, organization, language, URL and outline (chapters with status and page titles with paths). With path: that page's Gutenberg blocks and its exercises' names, points, deadlines, and the instructions and public specs of the tasks the course site shows you (an exercise with several slides and none chosen for you shows a random one, so calls can differ); offset continues a long page or outline. Results are reference_only: not a course you work on.",
        // Not idempotent: the shown slide is random until one is chosen for the caller.
        read("Read a public course").idempotent(false),
        McpScope::MaterialRead,
    )
}

/// The `patch_page_content` tool, run by `handler`.
pub fn patch_page_content<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        PatchTarget::PageContent.tool_name(),
        concat!(
            "Edits one page's blocks with JSON-Patch-style ops. Paths start at a block id: /<id>, /<id>/innerBlocks, /<id>/attributes/<name>, /<id>/name; \"\" is the top level; numeric indexes are rejected. ",
            "add (value: block or list; position before/after a block, or start/end of a children list), remove (+through), replace (a block keeps its id; an attribute; a children list or \"\" with stubs {\"clientId\":…} to keep blocks), ",
            "move/copy (from, +through, to_page for another page, position), wrap (value: the container), unwrap, split (at_text), merge (from into path). New blocks have no id; \"label\":\"$x\" names one for later ops in the call. ",
            "Exercise blocks can only be moved, copied or removed here; patch_exercise edits an exercise's name, own deadline and instructions. Call guide for a block type's schema before writing it. read_back reads the result.",
            staging_note!()
        ),
        write("Edit page content", true),
        McpScope::MaterialStage,
    )
    .taking_ops(PatchTarget::PageContent)
    .always_loaded()
}

/// The `patch_course_structure` tool, run by `handler`.
pub fn patch_course_structure<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        PatchTarget::CourseStructure.tool_name(),
        concat!(
            "Edits modules, chapters and pages: add (a module, a chapter with an automatic front page, or a page, optionally with blocks, and with pair_with: the id of the published page it translates in another language version of the course), remove (+through), replace fields (module name; chapter name, color, opens_at, deadline; page title, url_path, hidden; remove sets nullable fields to null), move (+through), copy (page or chapter, new ids), reorder (value: all current ids in the new order). ",
            "Paths: /course/modules, /course/pages, /<module id>/chapters, /<chapter id>/pages, /<id>, /<id>/<field>. The first page of a chapter is its front page; the course front page (/) and the default module stay first. Chapter numbers and paths are recomputed after each call; changed paths get redirects automatically. The only way to create pages.",
            staging_note!()
        ),
        write("Edit course structure", true),
        McpScope::MaterialStage,
    )
    .taking_ops(PatchTarget::CourseStructure)
}

/// The `patch_course_settings` tool, run by `handler`.
pub fn patch_course_settings<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        PatchTarget::CourseSettings.tool_name(),
        concat!(
            "Edits settings: replace /course/<field> (name, description, is_unlisted, chapter_locking_enabled, ai_policy, base_module_completion_requires_n_submodule_completions), add to /course/audiences (value {\"name\"}), remove /<audience id>, replace /<module id>/completion_policy or one of its fields (note the spelling \"treshold\"), /<module id>/certification_enabled. ",
            "Draft, test-mode and closing switches are read-only for agents. Module names are edited with patch_course_structure.",
            staging_note!()
        ),
        write("Edit course settings", true),
        McpScope::SettingsWrite,
    )
    .taking_ops(PatchTarget::CourseSettings)
}

/// The `patch_course_glossary_and_references` tool, run by `handler`.
pub fn patch_course_glossary_and_references<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        PatchTarget::GlossaryAndReferences.tool_name(),
        concat!(
            "Edits glossary terms and references: add to /glossary (value {\"term\",\"definition\"}) or /references (value {\"citation_key\",\"bibtex\"}), replace /<id>/<field> or /<id> with an object, remove /<id>. ",
            "A reference's bibtex holds one entry whose key equals citation_key. Renaming a citation_key rewrites its \\cite{…} citations in pages; other changes only list the pages that use the term or key.",
            staging_note!()
        ),
        write("Edit glossary and references", true),
        McpScope::MaterialStage,
    )
    .taking_ops(PatchTarget::GlossaryAndReferences)
}

/// The `patch_exercise` tool, run by `handler`.
pub fn patch_exercise<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "patch_exercise",
        concat!(
            "Edits an exercise's name, own deadline and instructions; its other settings are read-only. deadline overrides the chapter's; null clears it so the chapter's applies. Prefer chapter deadlines (patch_course_structure) and ask the teacher before adding an own one; making the deadline that applies earlier, or adding one, to an open exercise is risky. ops are patch_page_content ops with paths starting at /tasks/<task id> (that task's instructions) or /review_instructions; to_page isn't available. ",
            "Review instructions of an exercise using the course default review config are shared: set review_config edit_course_default to edit them for every exercise using it (preferred), or fork to give only this exercise its own copy of the default, for an exercise with special needs. use_course_default drops the exercise's own review settings. The result warns when students have already given reviews, or answered an exercise whose task instructions the call edits.",
            staging_note!()
        ),
        write("Edit exercise", true),
        McpScope::MaterialStage,
    )
    .taking_ops(PatchTarget::PageContent)
}

/// The `find_replace` tool, run by `handler`.
pub fn find_replace<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "find_replace",
        "Searches, and with replace changes, text across a course, chapter or page. Matches the stored HTML of text attributes (content, captions, alt texts, titles…), so markup counts: <em>for</em> loops doesn't match \"for loops\". Literal finds match whole words at word edges; regex: true takes a regex and $1-style replacements. attributes picks attribute names or /regex/ on names. expected_count fails the call on any other count. Lists likely inflected forms it didn't change. Use dry_run: true first. Replacing needs the material:stage scope. Searches exercises' task and review instructions too (include_exercise_instructions, default true) and, with include_exercise_names, their names; matches in the course default review instructions are listed once under course_default_review_config and change it for every exercise using it.",
        write("Find and replace text", true),
        McpScope::MaterialRead,
    )
}

/// The `structural_replace` tool, run by `handler`.
pub fn structural_replace<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "structural_replace",
        "Finds blocks by type and visible text (match: name, text_starts_with, text_contains, text_regex) across a course, chapter or page, and applies one action to each: wrap_in a container type, retype_to another type, unwrap: true or remove: true. Includes exercises' task and review instructions unless include_exercise_instructions is false. Use dry_run: true and expected_count. Stages like other writes.",
        write("Replace blocks by pattern", true),
        McpScope::MaterialStage,
    )
}

/// The `upload_file` tool, run by `handler`.
pub fn upload_file<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "upload_file",
        "Uploads an image or file for the course and returns its URL, to use in image or file block attributes.",
        write("Upload a file", false),
        McpScope::MaterialStage,
    )
}

/// The `list_changesets` tool, run by `handler`.
pub fn list_changesets<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "list_changesets",
        "Lists your changesets: the open one per course with its staged pages and entities, risky items and the review link, plus recently published ones.",
        read("List changesets"),
        McpScope::MaterialRead,
    )
}

/// The `publish_changeset` tool, run by `handler`.
pub fn publish_changeset<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "publish_changeset",
        "Publishes your open changeset so students see it. Refused when it holds risky changes (only the teacher publishes those, on the review page given in the result) or when a staged page or entity changed live since it was staged (the error says how to redo those).",
        write("Publish changeset", true),
        McpScope::MaterialPublish,
    )
}

/// The `discard_changeset` tool, run by `handler`.
pub fn discard_changeset<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "discard_changeset",
        "Drops staged changes from your open changeset, the undo before publishing: every change, or with entities only those entities, which then show their published state again.",
        write("Discard changeset", true).idempotent(true),
        McpScope::MaterialStage,
    )
}

/// The `get_preview_link` tool, run by `handler`.
pub fn get_preview_link<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "get_preview_link",
        "Returns read-only preview URLs of pages' staged state, valid about 15 minutes without login, for visual checks in a browser: page gives one url, pages gives previews, a {page, url} per page.",
        read("Get preview link"),
        McpScope::MaterialRead,
    )
}

/// The `get_history` tool, run by `handler`.
pub fn get_history<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "get_history",
        "Lists your own recent write calls in a course, or those touching one entity: when, through which client, and the call id that revert_change takes. Other people's changes aren't listed; with entity, last_published_change tells when the entity was last published and by whom, any author or the web editor included.",
        read("Read change history"),
        McpScope::MaterialRead,
    )
}

/// The `revert_change` tool, run by `handler`.
pub fn revert_change<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "revert_change",
        "Undoes one published write call by staging the versions from just before it. Rejected if an entity changed again since; the error lists them. The revert stages like any write.",
        write("Revert a change", true),
        McpScope::MaterialStage,
    )
}

/// The `guide` tool, run by `handler`.
pub fn guide<S>(handler: impl ToolHandler<S> + 'static) -> Tool<S> {
    define(
        handler,
        "guide",
        "Returns how to write content: per block type (block_types) the attribute schema, nesting rules, allowed rich-text formats and an example add op; per topic (topics) a short guide. No arguments lists the topics and block types per page type. Call it before creating or changing a block type for the first time.",
        read("Guide"),
        McpScope::MaterialRead,
    )
    .always_loaded()
    .usable_without_skill()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn definitions() -> Vec<ToolDefinition> {
        crate::handlers::registry().definitions().cloned().collect()
    }

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
            let bytes = serde_json::to_vec(&*tool.listing.input_schema)
                .unwrap()
                .len();
            assert!(
                bytes < MAX_SCHEMA_BYTES,
                "{} input schema is {bytes} bytes",
                tool.name
            );
            let schema = Value::Object((*tool.listing.input_schema).clone());
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
            assert_eq!(tool.listing.input_schema["type"], json!("object"));
        }
    }

    #[test]
    fn fixed_order_unique_names_and_skill_version_everywhere() {
        let tools = definitions();
        let names: Vec<_> = tools.iter().map(|t| t.name).collect();
        assert_eq!(names.first(), Some(&"list_courses"));
        assert_eq!(names.last(), Some(&"guide"));
        assert_eq!(names.len(), 23);
        let mut unique = names.clone();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(unique.len(), names.len());
        for tool in &tools {
            let properties = tool.listing.input_schema["properties"].as_object().unwrap();
            assert!(properties.contains_key("skill_version"), "{}", tool.name);
            let required = tool
                .listing
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
        let op = &tool.listing.input_schema["properties"]["ops"]["items"];
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
            tool.header_params,
            vec![("course".to_string(), "Course".to_string())]
        );
    }

    #[test]
    fn reads_are_read_only_and_idempotent() {
        // Shows a random exercise slide until one is chosen for the caller.
        const NONDETERMINISTIC_READS: [&str; 1] = ["read_public_course"];
        for tool in definitions() {
            let annotations = &serde_json::to_value(&tool.listing).unwrap()["annotations"];
            let is_read_only = annotations["readOnlyHint"] == json!(true);
            let is_named_as_read = tool.name.starts_with("get_")
                || tool.name.starts_with("list_")
                || tool.name.starts_with("read_")
                || tool.name == "guide";
            assert_eq!(is_read_only, is_named_as_read, "{}", tool.name);
            if is_read_only {
                assert_eq!(
                    annotations["idempotentHint"],
                    json!(!NONDETERMINISTIC_READS.contains(&tool.name)),
                    "{}",
                    tool.name
                );
            }
        }
    }
}
