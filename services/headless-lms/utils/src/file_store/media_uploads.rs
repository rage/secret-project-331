//! Where uploaded course media is stored, under which names, and how large it may be. Shared by the
//! CMS upload and the agent upload so both put files in the same places under the same limits.

use std::path::PathBuf;

use uuid::Uuid;

use super::file_utils::get_extension_from_filename;
use crate::strings::generate_random_string;

/// Who an upload belongs to; the first folder of its path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaOwner {
    Organization(Uuid),
    Course(Uuid),
    Exam(Uuid),
}

/// What an upload is, by its MIME top-level type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaKind {
    Image,
    Audio,
    File,
}

impl MediaKind {
    /// The kind for a MIME type's top-level type, e.g. `image`.
    pub fn from_mime_top_level(top_level: &str) -> Self {
        match top_level {
            "image" => MediaKind::Image,
            "audio" => MediaKind::Audio,
            _ => MediaKind::File,
        }
    }
}

/// A fresh random name to store an upload under, keeping the letters and digits of the original
/// name's extension.
pub fn stored_file_name(original_name: &str) -> String {
    let mut name = generate_random_string(30);
    let extension: String = get_extension_from_filename(original_name)
        .unwrap_or_default()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect();
    if !extension.is_empty() {
        name.push('.');
        name.push_str(&extension);
    }
    name
}

/// `<owner>/<id>/<images|audios|files>/<file_name>`.
pub fn media_path(owner: MediaOwner, kind: MediaKind, file_name: &str) -> PathBuf {
    let (base_dir, base_id) = match owner {
        MediaOwner::Organization(id) => ("organization", id),
        MediaOwner::Course(id) => ("course", id),
        MediaOwner::Exam(id) => ("exam", id),
    };
    let kind_dir = match kind {
        MediaKind::Image => "images",
        MediaKind::Audio => "audios",
        MediaKind::File => "files",
    };
    [base_dir, &base_id.to_string(), kind_dir, file_name]
        .iter()
        .collect()
}

// Mirrors shared-module/packages/common/src/utils/files.ts; the ingress caps request size too
// (kubernetes/base/ingress.yml).
const SIZE_LIMITS_BYTES: &[(&str, i32)] = &[
    ("image", 10 * 1024 * 1024),
    ("audio", 100 * 1024 * 1024),
    ("video", 100 * 1024 * 1024),
    ("application", 25 * 1024 * 1024),
    ("text", 25 * 1024 * 1024),
];
const DEFAULT_SIZE_LIMIT_BYTES: i32 = 10 * 1024 * 1024;

/// The largest upload allowed for a MIME top-level type such as `image`.
pub fn size_limit_bytes(mime_top_level: Option<&str>) -> i32 {
    mime_top_level
        .and_then(|top_level| SIZE_LIMITS_BYTES.iter().find(|(t, _)| *t == top_level))
        .map(|(_, size)| *size)
        .unwrap_or(DEFAULT_SIZE_LIMIT_BYTES)
}
