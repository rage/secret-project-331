//! Tool arguments. Their JSON Schemas are the tools' input schemas; keep field docs short, every
//! schema must stay well under the clients' size limits.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::engine::op::PatchOp;
use crate::engine::read::Selector;
use crate::engine::structural_replace::{StructuralAction, StructuralMatch};
use crate::guide::GuideTopic;

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ListCoursesArgs {
    /// Version from the course-material skill's VERSION file.
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GetCourseStructureArgs {
    /// Course id.
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    /// What to read; none reads an outline of the whole course.
    #[serde(default)]
    pub selectors: Option<Vec<Selector>>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GetPageContentArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    /// Page id; the page must belong to the course.
    pub page: String,
    /// What to read; none reads an outline of the whole page.
    #[serde(default)]
    pub selectors: Option<Vec<Selector>>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CourseArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PatchPageContentArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    pub page: String,
    /// Applied in order; all or nothing.
    #[schemars(with = "Vec<PatchOp>")]
    pub ops: Vec<Value>,
    /// Stage nothing; return the diff.
    #[serde(default)]
    pub dry_run: Option<bool>,
    /// Read after the ops; $labels allowed.
    #[serde(default)]
    pub read_back: Option<Selector>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PatchCourseStructureArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    #[schemars(with = "Vec<PatchOp>")]
    pub ops: Vec<Value>,
    #[serde(default)]
    pub dry_run: Option<bool>,
    #[serde(default)]
    pub read_back: Option<Selector>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

/// Arguments of `patch_course_settings` and `patch_course_glossary_and_references`.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PatchCourseArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    #[schemars(with = "Vec<PatchOp>")]
    pub ops: Vec<Value>,
    #[serde(default)]
    pub dry_run: Option<bool>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

/// Part of a course; empty means the whole course.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ContentScope {
    /// Same as the call's course, if given.
    #[serde(default)]
    pub course: Option<String>,
    #[serde(default)]
    pub chapter: Option<String>,
    #[serde(default)]
    pub page: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct FindReplaceArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    #[serde(default)]
    pub scope: Option<ContentScope>,
    /// Literal text (whole words at word edges) or, with regex, a pattern. Matches the stored HTML.
    pub find: String,
    /// Leave out to search only.
    #[serde(default)]
    pub replace: Option<String>,
    #[serde(default)]
    pub regex: Option<bool>,
    /// Attribute names, or /regex/ on names; default: text attributes.
    #[serde(default)]
    pub attributes: Option<Vec<String>>,
    /// Fail unless exactly this many matches.
    #[serde(default)]
    pub expected_count: Option<u32>,
    #[serde(default)]
    pub dry_run: Option<bool>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct StructuralReplaceArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    #[serde(default)]
    pub scope: Option<ContentScope>,
    #[serde(rename = "match")]
    pub pattern: StructuralMatch,
    pub action: StructuralAction,
    #[serde(default)]
    pub expected_count: Option<u32>,
    #[serde(default)]
    pub dry_run: Option<bool>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct UploadFileArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    /// File name with extension, e.g. diagram.png.
    pub file_name: String,
    /// The file's bytes, base64-encoded.
    pub content_base64: String,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ListChangesetsArgs {
    /// Limit to one course.
    #[serde(default)]
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: Option<String>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ChangesetArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    /// Changeset id from list_changesets or a write result.
    pub changeset: String,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GetPreviewLinkArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    pub page: String,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GetHistoryArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    /// A page, chapter, module, term or reference id; none lists the whole course.
    #[serde(default)]
    pub entity: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RevertChangeArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: String,
    /// The write call's id from get_history.
    pub call: String,
    #[serde(default)]
    pub dry_run: Option<bool>,
    #[serde(default)]
    pub skill_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GuideArgs {
    /// e.g. ["core/paragraph", "moocfi/infobox"].
    #[serde(default)]
    pub block_types: Option<Vec<String>>,
    #[serde(default)]
    pub topics: Option<Vec<GuideTopic>>,
    #[serde(default)]
    pub skill_version: Option<String>,
}
