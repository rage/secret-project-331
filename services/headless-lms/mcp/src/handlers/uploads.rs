//! `upload_file`: stores an image or file for the course the way the CMS media upload does.

use std::path::Path;
use std::sync::Arc;

use async_trait::async_trait;
use base64::Engine;
use headless_lms_models::file_uploads;
use headless_lms_utils::file_store::{
    FileStore,
    file_utils::get_extension_from_filename,
    media_uploads::{self, MediaKind, MediaOwner},
};
use headless_lms_utils::strings::generate_random_string;
use serde_json::{Map, Value, json};
use sqlx::Connection;

use crate::access::{authorize_course, connection};
use crate::state::McpState;
use crate::tools::args::UploadFileArgs;
use crate::tools::{
    RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult, parse_arguments, parse_id,
};

pub struct UploadFile;

/// The file store's futures aren't `Send`, so the upload runs on a blocking thread of its own.
async fn store(
    file_store: Arc<dyn FileStore + Send + Sync>,
    path: std::path::PathBuf,
    contents: Vec<u8>,
    mime_type: String,
) -> Result<(), ToolError> {
    let runtime = tokio::runtime::Handle::current();
    tokio::task::spawn_blocking(move || {
        runtime.block_on(file_store.upload(&path, contents, &mime_type))
    })
    .await
    .map_err(|e| ToolError::Internal(format!("the upload task failed: {e}")))?
    .map_err(|e| ToolError::Retryable {
        message: format!("storing the file failed ({e:?}); the same call can be retried"),
        retry_after_seconds: Some(2),
    })
}

#[async_trait]
impl ToolHandler<McpState> for UploadFile {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: UploadFileArgs = parse_arguments(arguments)?;
        let course_id = parse_id(&args.course, "course")?;
        let file_name = Path::new(args.file_name.trim())
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| !n.is_empty())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "file_name must be a file name with an extension, e.g. diagram.png".into(),
            })?
            .to_string();
        let contents = base64::engine::general_purpose::STANDARD
            .decode(args.content_base64.split_whitespace().collect::<String>())
            .map_err(|e| ToolError::InvalidArguments {
                message: format!("content_base64 isn't valid base64: {e}"),
            })?;
        if contents.is_empty() {
            return Err(ToolError::InvalidArguments {
                message: "the file is empty".into(),
            });
        }
        let mime_type = mime_guess::from_path(&file_name).first_or_octet_stream();
        let size_limit = media_uploads::size_limit_bytes(Some(mime_type.type_().as_str()));
        if contents.len() > size_limit as usize {
            return Err(ToolError::InvalidArguments {
                message: format!(
                    "the file is {} bytes; {} files may be at most {size_limit} bytes",
                    contents.len(),
                    mime_type.type_()
                ),
            });
        }

        let mut conn = connection(state).await?;
        authorize_course(&mut conn, ctx.principal.user_id, course_id).await?;
        let mut stored_name = generate_random_string(30);
        if let Some(extension) = get_extension_from_filename(&file_name) {
            let extension: String = extension.chars().filter(|c| c.is_alphanumeric()).collect();
            if !extension.is_empty() {
                stored_name.push('.');
                stored_name.push_str(&extension);
            }
        }
        let path = media_uploads::media_path(
            MediaOwner::Course(course_id),
            MediaKind::from_mime_top_level(mime_type.type_().as_str()),
            &stored_name,
        );
        let path_string = path.to_string_lossy().to_string();
        let size_bytes = contents.len();
        let mut tx = conn
            .begin()
            .await
            .map_err(|e| ToolError::Internal(e.to_string()))?;
        file_uploads::insert(
            &mut tx,
            &file_name,
            &path_string,
            mime_type.essence_str(),
            Some(ctx.principal.user_id),
            Some(size_bytes as i64),
        )
        .await?;
        store(
            state.file_store.clone(),
            path.clone(),
            contents,
            mime_type.essence_str().to_string(),
        )
        .await?;
        tx.commit()
            .await
            .map_err(|e| ToolError::Internal(e.to_string()))?;
        let url = state.file_store.get_download_url(&path, &state.app_conf);
        Ok(ToolResult::success(json!({
            "url": url,
            "file_name": file_name,
            "mime_type": mime_type.essence_str(),
            "size_bytes": size_bytes,
        }))
        .into())
    }
}
