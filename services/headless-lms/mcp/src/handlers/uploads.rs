//! `start_file_upload`: stores an image or file for the course the way the CMS media upload
//! does, from bytes sent to a signed upload link.

use std::path::{Path, PathBuf};

use actix_web::web::Bytes;
use async_trait::async_trait;
use chrono::{Duration, Utc};
use futures::stream;
use headless_lms_base::{
    error::backend_error::BackendError,
    jwt::{sign_hs256_claim, validate_hs256_claim},
};
use headless_lms_models::{
    ModelError, ModelErrorType,
    file_uploads::{self, NewUpload},
};
use headless_lms_utils::file_store::{
    GenericPayload,
    media_uploads::{self, MediaKind, MediaOwner},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::access::{authorize_course, connection};
use crate::state::McpState;
use crate::tools::args::StartFileUploadArgs;
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};

/// Handler of the `start_file_upload` tool.
pub struct StartFileUpload;

const UPLOAD_LINK_LIFETIME_MINUTES: i64 = 15;

/// Where upload links point; the server mounts [`crate::http::configure_upload_links`] here.
const UPLOAD_LINK_ROUTE: &str = "/api/v0/mcp-uploads";

fn is_heif(mime: &str) -> bool {
    matches!(
        mime,
        "image/heif" | "image/heic" | "image/heif-sequence" | "image/heic-sequence"
    )
}

fn heif_refused() -> ToolError {
    ToolError::InvalidArguments {
        message: "HEIC/HEIF images don't show in browsers; convert the image to JPEG, PNG or WebP and upload that".into(),
    }
}

fn top_level(mime: &str) -> &str {
    mime.split('/').next().unwrap_or_default()
}

fn size_limit(mime: &str) -> usize {
    media_uploads::size_limit_bytes(Some(top_level(mime))) as usize
}

fn course_media_path(course_id: Uuid, file_name: &str, mime: &str) -> PathBuf {
    media_uploads::media_path(
        MediaOwner::Course(course_id),
        MediaKind::from_mime_top_level(top_level(mime)),
        &media_uploads::stored_file_name(file_name),
    )
}

/// A file name accepted for upload, with the MIME type its extension names.
struct NamedFile {
    name: String,
    mime: mime_guess::Mime,
}

impl NamedFile {
    /// The file name without directories; refuses names without one and HEIF names.
    fn new(raw: &str) -> Result<Self, ToolError> {
        let name = Path::new(raw.trim())
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| !n.is_empty())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "file_name must be a file name with an extension, e.g. diagram.png".into(),
            })?
            .to_string();
        let mime = mime_guess::from_path(&name).first_or_octet_stream();
        if is_heif(mime.essence_str()) {
            return Err(heif_refused());
        }
        Ok(Self { name, mime })
    }

    /// The most bytes a file of this name may have.
    fn size_limit_bytes(&self) -> usize {
        size_limit(self.mime.essence_str())
    }

    /// The MIME type to store `contents` under: its type where a binary signature shows it, else
    /// the name's. Refuses HEIF, which browsers can't show, and content whose kind (image or not)
    /// contradicts the name.
    fn content_mime(&self, contents: &[u8]) -> Result<String, ToolError> {
        let file_name = &self.name;
        let by_name = &self.mime;
        // infer's text matchers guess from a prefix, e.g. `<!--` as HTML, so they would mislabel
        // SVGs and plain text.
        let detected = infer::get(contents)
            .filter(|kind| kind.matcher_type() != infer::MatcherType::Text)
            .map(|kind| kind.mime_type());
        if detected.is_some_and(is_heif) {
            return Err(heif_refused());
        }
        let is_named_image = by_name.type_() == "image";
        let is_svg = by_name.essence_str() == "image/svg+xml";
        let refuse = |message: String| Err(ToolError::InvalidArguments { message });
        match detected {
            Some(detected) if detected.starts_with("image/") != is_named_image => refuse(format!(
                "{file_name} is named as {} but its content is {detected}; give it a file name that matches its content",
                by_name.essence_str()
            )),
            Some(detected) => Ok(detected.to_string()),
            None if is_svg && !contents.windows(4).any(|window| window == b"<svg") => {
                refuse(format!(
                    "{file_name} is named as an SVG image, but its content has no <svg> element"
                ))
            }
            None if is_named_image && !is_svg => refuse(format!(
                "{file_name} is named as an image, but its content isn't an image format this server recognises; upload a JPEG, PNG, GIF, WebP or SVG"
            )),
            None => Ok(by_name.essence_str().to_string()),
        }
    }

    /// Checks `contents` against the name and its size limit, and returns its MIME type.
    fn checked_content(&self, contents: &[u8]) -> Result<String, ToolError> {
        if contents.is_empty() {
            return Err(ToolError::InvalidArguments {
                message: "the file is empty".into(),
            });
        }
        let mime = self.content_mime(contents)?;
        let limit = size_limit(&mime);
        if contents.len() > limit {
            return Err(ToolError::InvalidArguments {
                message: format!(
                    "the file is {} bytes; {mime} files may be at most {limit} bytes",
                    contents.len()
                ),
            });
        }
        Ok(mime)
    }
}

fn new_upload<'a>(
    user_id: Uuid,
    path: &'a Path,
    file_name: &'a str,
    mime: &'a str,
    size_bytes: usize,
) -> NewUpload<'a> {
    NewUpload {
        path,
        name: file_name,
        mime,
        uploader: Some(user_id),
        size_bytes: Some(size_bytes as i64),
    }
}

fn payload(contents: Bytes) -> GenericPayload {
    Box::pin(stream::once(async move { Ok(contents) }))
}

fn storing_failed(error: ModelError) -> ToolError {
    match error.error_type() {
        ModelErrorType::Util => ToolError::retryable(
            format!("storing the file failed ({error}); the same call can be retried"),
            2,
        ),
        _ => error.into(),
    }
}

/// What the tools answer about a stored file.
fn stored_file(
    state: &McpState,
    path: &Path,
    file_name: &str,
    mime: &str,
    size_bytes: usize,
) -> Value {
    json!({
        "url": state.file_store.get_download_url(path, &state.app_conf),
        "file_name": file_name,
        "mime_type": mime,
        "size_bytes": size_bytes,
    })
}

/// What an upload link lets its holder store, signed with the server's JWT key.
#[derive(Debug, Serialize, Deserialize)]
struct UploadLinkClaim {
    user_id: Uuid,
    course_id: Uuid,
    file_name: String,
    /// Chosen when the link is made, so that the file's URL is known up front and a stored file
    /// at the path marks the link used.
    path: String,
    exp: usize,
    iat: usize,
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for StartFileUpload {
    type Args = StartFileUploadArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: StartFileUploadArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let course_id = args.course.id();
        let file = NamedFile::new(&args.file_name)?;
        let user_id = ctx.principal.actor.user_id;
        let mut conn = connection(state).await?;
        authorize_course(&mut conn, user_id, course_id).await?;
        drop(conn);
        let path = course_media_path(course_id, &file.name, file.mime.essence_str());
        let now = Utc::now();
        let expires_at = now + Duration::minutes(UPLOAD_LINK_LIFETIME_MINUTES);
        let claim = UploadLinkClaim {
            user_id,
            course_id,
            file_name: file.name.clone(),
            path: path.to_string_lossy().into_owned(),
            exp: expires_at.timestamp().max(0) as usize,
            iat: now.timestamp().max(0) as usize,
        };
        let token = sign_hs256_claim(&claim, &state.jwt_key)
            .map_err(|e| ToolError::Internal(format!("signing the upload link failed: {e}")))?;
        let upload_url = state
            .app_conf
            .public_url(&format!("{UPLOAD_LINK_ROUTE}/{token}"));
        Ok(ToolResult::success(json!({
            "upload_url": upload_url,
            "url": state.file_store.get_download_url(&path, &state.app_conf),
            "expires_at": expires_at,
            "size_limit_bytes": file.size_limit_bytes(),
            "how": format!("Send the file's raw bytes to upload_url with one PUT before expires_at, e.g. curl -sS -T '<local file>' '{upload_url}'. The answer is JSON with url, mime_type and size_bytes, or an error. The link works once; url shows the file after the upload succeeds."),
        }))
        .into())
    }
}

/// Why an upload through a link was refused, with the HTTP status to answer with.
pub struct UploadLinkError {
    pub status: u16,
    pub message: String,
}

impl From<ToolError> for UploadLinkError {
    fn from(error: ToolError) -> Self {
        let status = match &error {
            ToolError::InvalidArguments { .. } => 400,
            ToolError::Forbidden { .. } => 403,
            ToolError::NotFound { .. } => 404,
            ToolError::Retryable { .. } => 503,
            _ => 500,
        };
        Self {
            status,
            message: error.to_string(),
        }
    }
}

/// A validated upload link, read before its body is.
pub struct UploadLink {
    claim: UploadLinkClaim,
    file: NamedFile,
}

impl UploadLink {
    /// Validates `token`, which the link's URL carries.
    pub fn open(state: &McpState, token: &str) -> Result<Self, UploadLinkError> {
        let claim: UploadLinkClaim =
            validate_hs256_claim(token, &state.jwt_key).map_err(|_| UploadLinkError {
                status: 403,
                message:
                    "the upload link is invalid or expired; call start_file_upload again for a new one"
                        .into(),
            })?;
        let file = NamedFile::new(&claim.file_name)?;
        Ok(Self { claim, file })
    }

    /// The most bytes a file of the link's name may have.
    pub fn size_limit_bytes(&self) -> usize {
        self.file.size_limit_bytes()
    }
}

/// Stores `contents` as the file `link` was made for, unless the link has been used.
pub async fn upload_with_link(
    state: &McpState,
    link: UploadLink,
    contents: Bytes,
) -> Result<Value, UploadLinkError> {
    let UploadLink { claim, file } = link;
    let mime = file.checked_content(&contents)?;
    // The path's folder was picked from the file name when the link was made.
    if MediaKind::from_mime_top_level(top_level(&mime))
        != MediaKind::from_mime_top_level(file.mime.type_().as_str())
    {
        return Err(ToolError::InvalidArguments {
            message: format!(
                "the content is {mime}, which doesn't match {}; make a link for a file name that matches the content",
                file.name
            ),
        }
        .into());
    }
    let mut conn = connection(state).await?;
    authorize_course(&mut conn, claim.user_id, claim.course_id).await?;
    let path = Path::new(&claim.path);
    let size_bytes = contents.len();
    let stored = file_uploads::store_and_insert_once(
        &mut conn,
        state.file_store.as_ref(),
        new_upload(claim.user_id, path, &claim.file_name, &mime, size_bytes),
        payload(contents),
    )
    .await
    .map_err(storing_failed)?;
    if stored.is_none() {
        return Err(UploadLinkError {
            status: 409,
            message:
                "the upload link has been used already; call start_file_upload again for a new one"
                    .into(),
        });
    }
    Ok(stored_file(
        state,
        path,
        &claim.file_name,
        &mime,
        size_bytes,
    ))
}
