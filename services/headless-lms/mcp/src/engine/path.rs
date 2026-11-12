//! The path grammar the engines share: segments with JSON Pointer escapes, ids and `$labels`,
//! and block paths.

use uuid::Uuid;

use super::error::{EditError, EditErrorCode};

/// A path segment with its JSON Pointer escapes (`~1` for `/`, `~0` for `~`) undone.
pub(crate) fn unescape_segment(segment: &str) -> String {
    segment.replace("~1", "/").replace("~0", "~")
}

/// `segment` JSON Pointer escaped, to put in a path; the inverse of [`unescape_segment`].
pub(crate) fn escape_segment(segment: &str) -> String {
    segment.replace('~', "~0").replace('/', "~1")
}

/// The unescaped segments of a path; `None` when it doesn't start with `/`.
pub(crate) fn split_path(path: &str) -> Option<Vec<String>> {
    Some(
        path.strip_prefix('/')?
            .split('/')
            .map(unescape_segment)
            .collect(),
    )
}

/// Whether a path's first segment names the course: `course` or the course's id.
pub(crate) fn is_course_root(segment: &str, course_id: Uuid) -> bool {
    segment == "course" || Uuid::parse_str(segment).is_ok_and(|id| id == course_id)
}

/// How an id-or-label reference outside a path (`from`, `to_page`, reorder values) was written.
pub(crate) enum ItemRef<'a> {
    Label(&'a str),
    Id(Uuid),
}

/// Parses `pg7`, `/pg7`, `$x` or `/$x`.
pub(crate) fn parse_item_ref(raw: &str) -> Result<ItemRef<'_>, EditError> {
    let trimmed = raw.strip_prefix('/').unwrap_or(raw);
    if trimmed.contains('/') {
        return Err(EditError::new(
            EditErrorCode::InvalidPath,
            format!("\"{raw}\" should name one item, like \"/<id>\""),
        ));
    }
    if trimmed.starts_with('$') {
        return Ok(ItemRef::Label(trimmed));
    }
    parse_uuid(trimmed, raw).map(ItemRef::Id)
}

/// Parses a path segment as an id. `whole` is the full path, quoted in the error.
pub(crate) fn parse_uuid(segment: &str, whole: &str) -> Result<Uuid, EditError> {
    if segment.parse::<u64>().is_ok() {
        return Err(EditError::numeric_index(whole, "items")
            .with_fix("read the outline to get ids, then use /<id>"));
    }
    if segment == "-" {
        return Err(EditError::new(
            EditErrorCode::NumericIndex,
            format!("\"{whole}\" uses \"-\"; to append, use position \"end\" on the children list"),
        )
        .with_fix("{\"path\":\"/box1/innerBlocks\",\"position\":\"end\"} or {\"path\":\"\",\"position\":\"end\"}"));
    }
    Uuid::parse_str(segment).map_err(|_| {
        EditError::new(
            EditErrorCode::InvalidPath,
            format!("\"{segment}\" in \"{whole}\" isn't an id or a $label"),
        )
        .with_fix("paths start with the full id of a block or entity: /<uuid>, /<uuid>/innerBlocks, /<uuid>/attributes/content")
    })
}

/// A block path split into its parts, before its id or label is resolved.
pub(crate) enum BlockPath<'p> {
    /// `""`, `/` or `/blocks`: the page's top level.
    TopLevel,
    /// `/<root>…`, where `root` is an id or a `$label`.
    Block { root: String, part: BlockPart<'p> },
}

/// What follows the root of a [`BlockPath`].
pub(crate) enum BlockPart<'p> {
    /// Nothing: the block itself.
    Whole,
    /// `/innerBlocks`.
    Children,
    /// `/innerBlocks/<segment>…`, which names a child by position.
    ChildIndex(String),
    /// `/name`.
    Name,
    /// `/attributes` and the JSON Pointer after it, `""` for all of them.
    Attributes(&'p str),
    /// Any other field, or `name` with segments after it.
    Other { field: String, is_deeper: bool },
}

/// Splits a block path into its parts; `None` when it doesn't start with `/`.
pub(crate) fn parse_block_path(path: &str) -> Option<BlockPath<'_>> {
    if matches!(path, "" | "/" | "/blocks") {
        return Some(BlockPath::TopLevel);
    }
    let rest = path.strip_prefix('/')?;
    let (root, after_root) = split_segment(rest);
    let part = match after_root.strip_prefix('/').map(split_segment) {
        None => BlockPart::Whole,
        Some(("attributes", pointer)) => BlockPart::Attributes(pointer),
        Some(("innerBlocks", "")) => BlockPart::Children,
        Some(("innerBlocks", index)) => {
            BlockPart::ChildIndex(unescape_segment(split_segment(&index[1..]).0))
        }
        Some(("name", "")) => BlockPart::Name,
        Some((field, after)) => BlockPart::Other {
            field: unescape_segment(field),
            is_deeper: !after.is_empty(),
        },
    };
    Some(BlockPath::Block {
        root: unescape_segment(root),
        part,
    })
}

/// The first segment of `path` (no leading `/`) and the rest, which starts with `/` or is empty.
pub(crate) fn split_segment(path: &str) -> (&str, &str) {
    match path.find('/') {
        Some(slash) => path.split_at(slash),
        None => (path, ""),
    }
}
