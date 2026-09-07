//! Streams every file-typed answer of one exercise to a teacher as a zip archive.
//!
//! Entries are named positionally rather than from `file_uploads.name`, so that a plugin which
//! anonymizes filenames for its own views cannot leak the real ones through this export.

use std::{
    io,
    path::Path,
    pin::Pin,
    task::{Context, Poll},
};

use async_zip::{Compression, ZipEntryBuilder, base::write::ZipFileWriter};
use bytes::Bytes;
use futures::{StreamExt, io::AsyncWrite, io::AsyncWriteExt, ready};
use models::exercise_task_submission_files::ExerciseAnswerFile;
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::sync::PollSender;

use super::{authorization::AuthorizationToken, csv_export::make_authorized_streamable};
use crate::prelude::*;

/// Extensions for the mime types answer files realistically arrive as. Anything else is written
/// without an extension rather than guessed at.
const MIME_EXTENSIONS: &[(&str, &str)] = &[
    ("application/gzip", "gz"),
    ("application/json", "json"),
    ("application/pdf", "pdf"),
    ("application/x-tar", "tar"),
    ("application/x-zstd-compressed-tar", "tar.zst"),
    ("application/zip", "zip"),
    ("application/zstd", "zst"),
    ("image/gif", "gif"),
    ("image/jpeg", "jpg"),
    ("image/png", "png"),
    ("image/svg+xml", "svg"),
    ("image/webp", "webp"),
    ("text/csv", "csv"),
    ("text/html", "html"),
    ("text/markdown", "md"),
    ("text/plain", "txt"),
];

/// The extension to give an archive entry, without the leading dot. `None` for a mime type we have
/// no confident extension for, including `application/octet-stream`.
fn extension_for_mime(mime: &str) -> Option<&'static str> {
    let essence = mime
        .split(';')
        .next()
        .unwrap_or(mime)
        .trim()
        .to_ascii_lowercase();
    MIME_EXTENSIONS
        .iter()
        .find(|(candidate, _)| *candidate == essence)
        .map(|(_, extension)| *extension)
}

/// `<user_id>/<submission_id>/<order_number><ext>`, so that the two things a teacher needs to
/// identify an answer come from host-owned data only.
fn entry_name(file: &ExerciseAnswerFile) -> String {
    let stem = format!(
        "{}/{}/{}",
        file.user_id, file.exercise_task_submission_id, file.order_number
    );
    match extension_for_mime(&file.mime) {
        Some(extension) => format!("{stem}.{extension}"),
        None => stem,
    }
}

/// Lowercased `[a-z0-9-]` rendering of user-authored text, for use inside a download filename.
fn filename_component(text: &str) -> String {
    let mut component = String::new();
    for character in text.chars() {
        if character.is_ascii_alphanumeric() {
            component.extend(character.to_lowercase());
        } else if !component.ends_with('-') {
            component.push('-');
        }
    }
    let trimmed = component.trim_matches('-');
    if trimmed.is_empty() {
        "answers".to_string()
    } else {
        trimmed.to_string()
    }
}

/// `attachment; filename="..."` for an exercise's archive.
pub fn content_disposition(course_or_exam_name: &str, exercise_name: &str) -> String {
    format!(
        "attachment; filename=\"{}-{}-answers.zip\"",
        filename_component(course_or_exam_name),
        filename_component(exercise_name)
    )
}

/// How many written chunks may sit between the archive writer and the client before the writer has
/// to wait. The producer reads from the file store as fast as it is served, so without a bound a
/// slow client makes the whole archive accumulate in memory.
const ARCHIVE_CHANNEL_CAPACITY: usize = 8;

/// Writes the archive bytes into the streaming response channel as they are produced, waiting when
/// the client is not reading them fast enough.
struct ArchiveSink {
    sender: PollSender<ControllerResult<Bytes>>,
    authorization_token: AuthorizationToken,
}

impl AsyncWrite for ArchiveSink {
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        let sink = self.get_mut();
        ready!(sink.sender.poll_reserve(cx))
            .map_err(|error| io::Error::other(error.to_string()))?;
        let token = sink.authorization_token;
        sink.sender
            .send_item(token.authorized_ok(Bytes::copy_from_slice(buf)))
            .map_err(|error| io::Error::other(error.to_string()))?;
        Poll::Ready(Ok(buf.len()))
    }

    fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }

    fn poll_close(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }
}

/// Starts the archive download for one exercise.
///
/// The status line is committed before the first byte is read from the file store, so an upload
/// that has vanished from it is logged and skipped rather than failing the response.
pub async fn stream_exercise_answer_files(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    exercise_id: Uuid,
    content_disposition: String,
    token: AuthorizationToken,
) -> ControllerResult<HttpResponse> {
    let (sender, receiver) =
        tokio::sync::mpsc::channel::<ControllerResult<Bytes>>(ARCHIVE_CHANNEL_CAPACITY);
    let mut conn = pool.acquire().await?;
    let files = models::exercise_task_submission_files::get_answer_files_by_exercise_id(
        &mut conn,
        exercise_id,
    )
    .await?;
    drop(conn);
    // `FileStore`'s futures are `?Send`, so the writer task has to stay on this thread.
    actix_web::rt::spawn(async move {
        let sink = ArchiveSink {
            sender: PollSender::new(sender),
            authorization_token: token,
        };
        if let Err(error) = write_archive(file_store.as_ref(), files, sink).await {
            tracing::error!("Failed to write answer file archive: {}", error);
        }
    });

    token.authorized_ok(
        HttpResponse::Ok()
            .append_header(("Content-Disposition", content_disposition))
            .append_header(("Content-Type", "application/zip"))
            .streaming(make_authorized_streamable(ReceiverStream::new(receiver))),
    )
}

async fn write_archive(
    file_store: &dyn FileStore,
    files: Vec<ExerciseAnswerFile>,
    sink: ArchiveSink,
) -> anyhow::Result<()> {
    let mut archive = ZipFileWriter::new(sink);
    for file in files {
        let contents = match file_store.download_stream(Path::new(&file.path)).await {
            Ok(contents) => contents,
            Err(error) => {
                tracing::warn!(
                    "Skipping answer file {} missing from the file store: {}",
                    file.path,
                    error
                );
                continue;
            }
        };
        let mut contents = Box::into_pin(contents);
        let mut entry = archive
            .write_entry_stream(ZipEntryBuilder::new(
                entry_name(&file).into(),
                Compression::Deflate,
            ))
            .await?;
        while let Some(chunk) = contents.next().await {
            entry.write_all(&chunk?).await?;
        }
        entry.close().await?;
    }
    archive.close().await?;
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn maps_known_mime_types_to_extensions() {
        assert_eq!(extension_for_mime("application/zip"), Some("zip"));
        assert_eq!(extension_for_mime("text/plain"), Some("txt"));
        assert_eq!(extension_for_mime("TEXT/PLAIN; charset=utf-8"), Some("txt"));
        assert_eq!(extension_for_mime("image/jpeg"), Some("jpg"));
        assert_eq!(
            extension_for_mime("application/x-zstd-compressed-tar"),
            Some("tar.zst")
        );
    }

    #[test]
    fn leaves_an_unknown_mime_type_without_an_extension() {
        assert_eq!(extension_for_mime("application/octet-stream"), None);
        assert_eq!(extension_for_mime("application/x-made-up"), None);
        assert_eq!(extension_for_mime(""), None);
    }

    #[test]
    fn names_entries_positionally() {
        let user_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
        let submission_id = Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap();
        let file = ExerciseAnswerFile {
            user_id,
            exercise_task_submission_id: submission_id,
            created_at: Utc::now(),
            path: "uploads/secret-real-name.png".to_string(),
            mime: "image/png".to_string(),
            order_number: 3,
        };
        assert_eq!(
            entry_name(&file),
            format!("{user_id}/{submission_id}/3.png")
        );

        let unknown = ExerciseAnswerFile {
            mime: "application/octet-stream".to_string(),
            ..file
        };
        assert_eq!(entry_name(&unknown), format!("{user_id}/{submission_id}/3"));

        let two_part_extension = ExerciseAnswerFile {
            mime: "application/x-zstd-compressed-tar".to_string(),
            ..unknown
        };
        assert_eq!(
            entry_name(&two_part_extension),
            format!("{user_id}/{submission_id}/3.tar.zst")
        );
    }

    #[test]
    fn builds_a_filename_from_course_and_exercise_names() {
        assert_eq!(
            content_disposition("Introduction to Everything", "Exercise 1: Loops!"),
            "attachment; filename=\"introduction-to-everything-exercise-1-loops-answers.zip\""
        );
        assert_eq!(
            content_disposition("", "  "),
            "attachment; filename=\"answers-answers-answers.zip\""
        );
    }
}
