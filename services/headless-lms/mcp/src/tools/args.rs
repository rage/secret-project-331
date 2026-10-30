//! Tool arguments. Their JSON Schemas are the tools' input schemas; keep field docs short, every
//! schema must stay well under the clients' size limits.

use std::borrow::Cow;

use schemars::{JsonSchema, Schema, SchemaGenerator};
use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::engine::op::PatchOp;
use crate::engine::read::{ReadState, Selector};
use crate::engine::structural_replace::{StructuralAction, StructuralMatch};
use crate::guide::GuideTopic;

/// An id argument: a UUID, also accepted with the leading `/` of a path to it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct IdArgument(Uuid);

impl IdArgument {
    /// The id, without the leading `/` it may have been sent with.
    pub fn id(self) -> Uuid {
        self.0
    }
}

/// A UUID's schema, without the type's description in every id field.
impl JsonSchema for IdArgument {
    fn schema_name() -> Cow<'static, str> {
        Uuid::schema_name()
    }

    fn inline_schema() -> bool {
        true
    }

    fn json_schema(generator: &mut SchemaGenerator) -> Schema {
        Uuid::json_schema(generator)
    }
}

impl<'de> Deserialize<'de> for IdArgument {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = String::deserialize(deserializer)?;
        Uuid::parse_str(raw.trim().trim_start_matches('/'))
            .map(IdArgument)
            .map_err(|_| D::Error::custom(format!("expected an id (a UUID), got \"{raw}\"")))
    }
}

/// A field that may be null: `Some(None)` for null, `None` (through `default`) when left out.
fn present<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> Result<Option<Option<T>>, D::Error> {
    Option::<T>::deserialize(deserializer).map(Some)
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ListCoursesArgs {}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GetCourseStructureArgs {
    /// Course id.
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    /// What to read; none reads an outline of the whole course.
    pub selectors: Option<Vec<Selector>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GetPageContentArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    /// Page id; the page must belong to the course.
    pub page: IdArgument,
    /// What to read; none reads an outline of the whole page.
    pub selectors: Option<Vec<Selector>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CourseArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PatchPageContentArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    pub page: IdArgument,
    /// Applied in order; all or nothing.
    #[schemars(with = "Vec<PatchOp>")]
    pub ops: Vec<Value>,
    /// Stage nothing; return the diff.
    #[serde(default)]
    pub dry_run: bool,
    /// Read after the ops; $labels allowed.
    pub read_back: Option<Selector>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GetExerciseArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    /// Exercise id, from an exercise block's exercise_id.
    pub exercise: IdArgument,
    /// Paths start at /tasks/<task id>, /tasks/<task id>/specs or /review_instructions; none reads an outline of each.
    pub selectors: Option<Vec<Selector>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ListExercisesArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    pub scope: Option<ContentScope>,
    /// staged (default, with your unpublished changes) or published.
    pub state: Option<ReadState>,
    pub offset: Option<u32>,
    /// Default 100, at most 300.
    pub limit: Option<u32>,
}

/// Which review settings `patch_exercise` changes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReviewConfigChoice {
    /// Review ops edit the course default, which every exercise without its own uses.
    EditCourseDefault,
    /// The exercise gets its own copy of the course default; review ops edit the copy.
    Fork,
    /// The exercise drops its own settings and uses the course default.
    UseCourseDefault,
}

/// Serialized as the call's audit record, without the course the record has already.
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PatchExerciseArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    #[serde(skip_serializing)]
    pub course: IdArgument,
    pub exercise: IdArgument,
    /// New name, plain text.
    pub name: Option<String>,
    /// Own deadline, RFC 3339 with offset; null clears it so the chapter's applies. Prefer chapter deadlines.
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[schemars(with = "Option<String>")]
    pub deadline: Option<Option<String>>,
    /// Page-content ops; paths start at /tasks/<task id> or /review_instructions.
    #[schemars(with = "Option<Vec<PatchOp>>")]
    pub ops: Option<Vec<Value>>,
    pub review_config: Option<ReviewConfigChoice>,
    #[serde(default)]
    pub dry_run: bool,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PatchCourseStructureArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    #[schemars(with = "Vec<PatchOp>")]
    pub ops: Vec<Value>,
    #[serde(default)]
    pub dry_run: bool,
    /// With dry_run: also return the full staging diff, not just the outline of what changes.
    #[serde(default)]
    pub detail: bool,
    pub read_back: Option<Selector>,
}

/// Arguments of `patch_course_settings` and `patch_course_glossary_and_references`.
#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PatchCourseArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    #[schemars(with = "Vec<PatchOp>")]
    pub ops: Vec<Value>,
    #[serde(default)]
    pub dry_run: bool,
}

/// Part of a course; empty means the whole course.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ContentScope {
    pub chapter: Option<IdArgument>,
    pub page: Option<IdArgument>,
}

/// Serialized as the call's audit record, without the course the record has already.
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct FindReplaceArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    #[serde(skip_serializing)]
    pub course: IdArgument,
    pub scope: Option<ContentScope>,
    /// Literal text (whole words at word edges) or, with regex, a pattern. Matches the stored HTML.
    pub find: String,
    /// Leave out to search only.
    pub replace: Option<String>,
    #[serde(default)]
    pub regex: bool,
    /// Attribute names, or /regex/ on names; default: text attributes.
    pub attributes: Option<Vec<String>>,
    /// Fail unless exactly this many matches.
    pub expected_count: Option<u32>,
    /// Also search exercises' task and review instructions. Default true.
    pub include_exercise_instructions: Option<bool>,
    /// Also search exercise names. Default false.
    pub include_exercise_names: Option<bool>,
    #[serde(default)]
    pub dry_run: bool,
}

/// Serialized as the call's audit record, without the course the record has already.
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct StructuralReplaceArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    #[serde(skip_serializing)]
    pub course: IdArgument,
    pub scope: Option<ContentScope>,
    #[serde(rename = "match")]
    pub pattern: StructuralMatch,
    pub action: StructuralAction,
    pub expected_count: Option<u32>,
    /// Also match blocks in exercises' task and review instructions. Default true.
    pub include_exercise_instructions: Option<bool>,
    #[serde(default)]
    pub dry_run: bool,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct UploadFileArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    /// File name with extension, e.g. diagram.png.
    pub file_name: String,
    /// The file's bytes, base64-encoded.
    pub content_base64: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ListChangesetsArgs {
    /// Limit to one course.
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: Option<IdArgument>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ChangesetArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    /// Changeset id from list_changesets or a write result.
    pub changeset: IdArgument,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct DiscardChangesetArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    /// Changeset id from list_changesets or a write result.
    pub changeset: IdArgument,
    /// Entity ids to drop, e.g. those a publish_conflict lists; the rest stays staged. Omit to drop everything.
    pub entities: Option<Vec<IdArgument>>,
    /// The changeset revision you last saw (changeset_revision of a write result, or list_changesets); if it changed since, nothing is dropped.
    pub revision: Option<i32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GetPreviewLinkArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    /// One page; its link comes back as `url`. Give this or `pages`, or neither for one link to the whole changeset.
    pub page: Option<IdArgument>,
    /// Several pages; their links come back in `previews`, one per page. Give this or `page`, or neither for one link to the whole changeset.
    pub pages: Option<Vec<IdArgument>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GetHistoryArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    /// A page, chapter, module, term or reference id; none lists the whole course.
    pub entity: Option<IdArgument>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RevertChangeArgs {
    #[schemars(extend("x-mcp-header" = "Course"))]
    pub course: IdArgument,
    /// The write call's id from get_history.
    pub call: IdArgument,
    #[serde(default)]
    pub dry_run: bool,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ReadPublicCourseArgs {
    /// A courses.mooc.fi course or page URL, /org/<organization>/courses/<course>/<page path>. Or give course_slug.
    pub url: Option<String>,
    /// The course's slug, instead of url.
    pub course_slug: Option<String>,
    /// Page path in the course, e.g. /chapter-1/loops; / is the front page. Overrides the URL's page. None reads the outline.
    pub path: Option<String>,
    /// Where to continue a long page or outline; next_offset of the previous result.
    pub offset: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct GuideArgs {
    /// e.g. ["core/paragraph", "moocfi/infobox"].
    pub block_types: Option<Vec<String>>,
    pub topics: Option<Vec<GuideTopic>>,
}
