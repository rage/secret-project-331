//! `upload_file` and `create_upload_link`: store an image or file for the course the way the CMS
//! media upload does, from base64 in the call or from bytes sent to a signed upload link.

use std::path::{Path, PathBuf};

use actix_web::web::Bytes;
use async_trait::async_trait;
use base64::Engine;
use chrono::{Duration, Utc};
use futures::stream;
use headless_lms_base::{
    error::backend_error::BackendError,
    jwt::{sign_hs256_claim, validate_hs256_claim},
};
use headless_lms_models::{
    ModelErrorType,
    error::TryToOptional,
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
use crate::tools::args::{CreateUploadLinkArgs, UploadFileArgs};
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};

/// Handler of the `upload_file` tool.
pub struct UploadFile;

/// Handler of the `create_upload_link` tool.
pub struct CreateUploadLink;

const UPLOAD_LINK_LIFETIME_MINUTES: i64 = 15;

/// Where upload links point; the server mounts [`crate::http::configure_upload_links`] here.
const UPLOAD_LINK_ROUTE: &str = "/api/v0/mcp-uploads";

/// Decodes on a blocking thread: the content can be tens of megabytes.
async fn decode(content_base64: String) -> Result<Vec<u8>, ToolError> {
    tokio::task::spawn_blocking(move || {
        let compact = if content_base64.contains(char::is_whitespace) {
            content_base64.split_whitespace().collect()
        } else {
            content_base64
        };
        base64::engine::general_purpose::STANDARD.decode(compact)
    })
    .await
    .map_err(|e| ToolError::Internal(format!("the decoding task failed: {e}")))?
    .map_err(|e| ToolError::InvalidArguments {
        message: format!("content_base64 isn't valid base64: {e}"),
    })
}

/// The file name without directories; errors without one.
fn checked_file_name(raw: &str) -> Result<String, ToolError> {
    Path::new(raw.trim())
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.is_empty())
        .map(str::to_string)
        .ok_or_else(|| ToolError::InvalidArguments {
            message: "file_name must be a file name with an extension, e.g. diagram.png".into(),
        })
}

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

/// The MIME type to store the file under: its content's type where that can be detected, else
/// its extension's. Refuses HEIF, which browsers can't show, and content whose kind (image or
/// not) contradicts the extension.
fn content_mime(file_name: &str, contents: &[u8]) -> Result<String, ToolError> {
    let by_name = mime_guess::from_path(file_name).first_or_octet_stream();
    let detected = infer::get(contents).map(|kind| kind.mime_type());
    if detected.is_some_and(is_heif) || is_heif(by_name.essence_str()) {
        return Err(heif_refused());
    }
    let is_named_image = by_name.type_() == "image";
    // SVG is text, which content detection doesn't recognise.
    let is_svg = by_name.essence_str() == "image/svg+xml";
    let refuse = |message: String| Err(ToolError::InvalidArguments { message });
    match detected {
        Some(detected) if detected.starts_with("image/") != is_named_image => refuse(format!(
            "{file_name} is named as {} but its content is {detected}; give it a file name that matches its content",
            by_name.essence_str()
        )),
        Some(detected) => Ok(detected.to_string()),
        None if is_named_image && !is_svg => refuse(format!(
            "{file_name} is named as an image, but its content isn't an image format this server recognises; upload a JPEG, PNG, GIF, WebP or SVG"
        )),
        None => Ok(by_name.essence_str().to_string()),
    }
}

fn size_limit(mime: &str) -> usize {
    media_uploads::size_limit_bytes(Some(top_level(mime))) as usize
}

/// Checks the content against the file name and its size limit, and returns its MIME type.
fn checked_content(file_name: &str, contents: &[u8]) -> Result<String, ToolError> {
    if contents.is_empty() {
        return Err(ToolError::InvalidArguments {
            message: "the file is empty".into(),
        });
    }
    let mime = content_mime(file_name, contents)?;
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

fn course_media_path(course_id: Uuid, file_name: &str, mime: &str) -> PathBuf {
    media_uploads::media_path(
        MediaOwner::Course(course_id),
        MediaKind::from_mime_top_level(top_level(mime)),
        &media_uploads::stored_file_name(file_name),
    )
}

/// Stores the file at `path` with its `file_uploads` row and returns what the tools answer.
async fn store(
    state: &McpState,
    user_id: Uuid,
    path: &Path,
    file_name: &str,
    mime: &str,
    contents: Vec<u8>,
) -> Result<Value, ToolError> {
    let size_bytes = contents.len();
    let payload: GenericPayload = Box::pin(stream::once(async move { Ok(Bytes::from(contents)) }));
    file_uploads::store_and_insert(
        &state.pool,
        state.file_store.as_ref(),
        NewUpload {
            path,
            name: file_name,
            mime,
            uploader: Some(user_id),
            size_bytes: Some(size_bytes as i64),
        },
        payload,
    )
    .await
    .map_err(|e| match e.error_type() {
        ModelErrorType::Util => ToolError::retryable(
            format!("storing the file failed ({e}); the same call can be retried"),
            2,
        ),
        _ => e.into(),
    })?;
    Ok(json!({
        "url": state.file_store.get_download_url(path, &state.app_conf),
        "file_name": file_name,
        "mime_type": mime,
        "size_bytes": size_bytes,
    }))
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for UploadFile {
    type Args = UploadFileArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: UploadFileArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let course_id = args.course.id();
        let file_name = checked_file_name(&args.file_name)?;
        let contents = decode(args.content_base64).await?;
        let mime = checked_content(&file_name, &contents)?;
        let user_id = ctx.principal.actor.user_id;
        let mut conn = connection(state).await?;
        authorize_course(&mut conn, user_id, course_id).await?;
        drop(conn);
        let path = course_media_path(course_id, &file_name, &mime);
        let stored = store(state, user_id, &path, &file_name, &mime, contents).await?;
        Ok(ToolResult::success(stored).into())
    }
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
impl ToolHandler<McpState> for CreateUploadLink {
    type Args = CreateUploadLinkArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: CreateUploadLinkArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let course_id = args.course.id();
        let file_name = checked_file_name(&args.file_name)?;
        let named_mime = mime_guess::from_path(&file_name).first_or_octet_stream();
        if is_heif(named_mime.essence_str()) {
            return Err(heif_refused());
        }
        let user_id = ctx.principal.actor.user_id;
        let mut conn = connection(state).await?;
        authorize_course(&mut conn, user_id, course_id).await?;
        drop(conn);
        let path = course_media_path(course_id, &file_name, named_mime.essence_str());
        let now = Utc::now();
        let expires_at = now + Duration::minutes(UPLOAD_LINK_LIFETIME_MINUTES);
        let claim = UploadLinkClaim {
            user_id,
            course_id,
            file_name: file_name.clone(),
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
            "size_limit_bytes": size_limit(named_mime.essence_str()),
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

/// Stores `contents` as the file the upload link `token` was made for.
pub async fn upload_with_link(
    state: &McpState,
    token: &str,
    contents: Vec<u8>,
) -> Result<Value, UploadLinkError> {
    let claim: UploadLinkClaim =
        validate_hs256_claim(token, &state.jwt_key).map_err(|_| UploadLinkError {
            status: 403,
            message:
                "the upload link is invalid or expired; make a new one with create_upload_link"
                    .into(),
        })?;
    let mime = checked_content(&claim.file_name, &contents)?;
    // The path's folder was picked from the file name when the link was made.
    let named_mime = mime_guess::from_path(&claim.file_name).first_or_octet_stream();
    if MediaKind::from_mime_top_level(top_level(&mime))
        != MediaKind::from_mime_top_level(named_mime.type_().as_str())
    {
        return Err(ToolError::InvalidArguments {
            message: format!(
                "the content is {mime}, which doesn't match {}; make a link for a file name that matches the content",
                claim.file_name
            ),
        }
        .into());
    }
    let mut conn = connection(state).await?;
    authorize_course(&mut conn, claim.user_id, claim.course_id).await?;
    let is_used = file_uploads::get_details_by_path(&mut conn, &claim.path)
        .await
        .optional()
        .map_err(ToolError::from)?
        .is_some();
    drop(conn);
    if is_used {
        return Err(UploadLinkError {
            status: 409,
            message:
                "the upload link has been used already; make a new one with create_upload_link"
                    .into(),
        });
    }
    Ok(store(
        state,
        claim.user_id,
        Path::new(&claim.path),
        &claim.file_name,
        &mime,
        contents,
    )
    .await?)
}
