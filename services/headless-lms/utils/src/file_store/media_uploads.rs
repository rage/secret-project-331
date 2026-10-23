//! Where uploaded course media is stored and how large it may be. Shared by the CMS upload and
//! the agent upload so both put files in the same places under the same limits.

use std::path::PathBuf;

use uuid::Uuid;

/// Who an upload belongs to; the first folder of its path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaOwner {
    Organization(Uuid),
    Course(Uuid),
    Exam(Uuid),
}

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

// These limits must match the limits in CMS/src/services/backend/media/uploadMediaToServer.ts
// If you modify these, update the TypeScript file as well.
// Note: The nginx ingress also has a limit on max request size (see kubernetes/base/ingress.yml)
const SIZE_LIMITS_BYTES: &[(&str, i32)] = &[
    ("image", 10 * 1024 * 1024),
    ("audio", 100 * 1024 * 1024),
    ("video", 100 * 1024 * 1024),
    ("application", 25 * 1024 * 1024),
];
const DEFAULT_SIZE_LIMIT_BYTES: i32 = 10 * 1024 * 1024;

/// The largest upload allowed for a MIME top-level type such as `image`.
pub fn size_limit_bytes(mime_top_level: Option<&str>) -> i32 {
    mime_top_level
        .and_then(|top_level| SIZE_LIMITS_BYTES.iter().find(|(t, _)| *t == top_level))
        .map(|(_, size)| *size)
        .unwrap_or(DEFAULT_SIZE_LIMIT_BYTES)
}
