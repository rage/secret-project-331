//! `upload_file`: stores an image or file for the course the way the CMS media upload does.

use std::path::Path;

use actix_web::web::Bytes;
use async_trait::async_trait;
use base64::Engine;
use futures::stream;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    ModelErrorType,
    file_uploads::{self, NewUpload},
};
use headless_lms_utils::file_store::{
    GenericPayload,
    media_uploads::{self, MediaKind, MediaOwner},
};
use serde_json::json;

use crate::access::{authorize_course, connection};
use crate::state::McpState;
use crate::tools::args::UploadFileArgs;
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};

/// Handler of the `upload_file` tool.
pub struct UploadFile;

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
        let file_name = Path::new(args.file_name.trim())
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| !n.is_empty())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "file_name must be a file name with an extension, e.g. diagram.png".into(),
            })?
            .to_string();
        let contents = decode(args.content_base64).await?;
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

        let user_id = ctx.principal.actor.user_id;
        let mut conn = connection(state).await?;
        authorize_course(&mut conn, user_id, course_id).await?;
        drop(conn);
        let path = media_uploads::media_path(
            MediaOwner::Course(course_id),
            MediaKind::from_mime_top_level(mime_type.type_().as_str()),
            &media_uploads::stored_file_name(&file_name),
        );
        let size_bytes = contents.len();
        let payload: GenericPayload =
            Box::pin(stream::once(async move { Ok(Bytes::from(contents)) }));
        file_uploads::store_and_insert(
            &state.pool,
            state.file_store.as_ref(),
            NewUpload {
                path: &path,
                name: &file_name,
                mime: mime_type.essence_str(),
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
