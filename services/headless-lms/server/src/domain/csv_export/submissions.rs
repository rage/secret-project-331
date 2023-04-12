use anyhow::Result;
use bytes::Bytes;

use futures::TryStreamExt;
use headless_lms_models::exercise_task_submissions;

use async_trait::async_trait;

use crate::domain::csv_export::CsvWriter;

use sqlx::PgConnection;
use std::io::Write;
use tokio::sync::mpsc::UnboundedSender;

use uuid::Uuid;

use crate::prelude::*;

use super::{
    super::authorization::{AuthorizationToken, AuthorizedResponse},
    CSVExportAdapter, CsvExportDataLoader,
};

pub struct ExamSubmissionExportOperation {
    pub exam_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for ExamSubmissionExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_exam_submissions(
            &mut *conn,
            self.exam_id,
            CSVExportAdapter {
                sender,
                authorization_token: token,
            },
        )
        .await
    }
}

// Writes the submissions as csv into the writer
pub async fn export_exam_submissions<W>(
    conn: &mut PgConnection,
    exam_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let headers = IntoIterator::into_iter([
        "id".to_string(),
        "user_id".to_string(),
        "created_at".to_string(),
        "exercise_id".to_string(),
        "exercise_task_id".to_string(),
        "score_given".to_string(),
        "data_json".to_string(),
    ]);

    let mut stream = exercise_task_submissions::stream_exam_submissions(conn, exam_id);

    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    while let Some(next) = stream.try_next().await? {
        let csv_row = vec![
            next.id.to_string(),
            next.user_id.to_string(),
            next.created_at.to_string(),
            next.exercise_id.to_string(),
            next.exercise_task_id.to_string(),
            next.score_given.unwrap_or(0.0).to_string(),
            next.data_json
                .map(|o| o.to_string())
                .unwrap_or_else(|| "".to_string()),
        ];
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}

pub struct CourseSubmissionExportOperation {
    pub course_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for CourseSubmissionExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_course_submissions(
            &mut *conn,
            self.course_id,
            CSVExportAdapter {
                sender,
                authorization_token: token,
            },
        )
        .await
    }
}

// Writes the submissions as csv into the writer
pub async fn export_course_submissions<W>(
    conn: &mut PgConnection,
    course_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let headers = IntoIterator::into_iter([
        "id".to_string(),
        "user_id".to_string(),
        "created_at".to_string(),
        "course_instance_id".to_string(),
        "exercise_id".to_string(),
        "exercise_task_id".to_string(),
        "score_given".to_string(),
        "data_json".to_string(),
    ]);

    let mut stream = exercise_task_submissions::stream_course_submissions(conn, course_id);

    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    while let Some(next) = stream.try_next().await? {
        let csv_row = vec![
            next.id.to_string(),
            next.user_id.to_string(),
            next.created_at.to_string(),
            next.course_instance_id
                .map(|o| o.to_string())
                .unwrap_or_else(|| "".to_string()),
            next.exercise_id.to_string(),
            next.exercise_task_id.to_string(),
            next.score_given.unwrap_or(0.0).to_string(),
            next.data_json
                .map(|o| o.to_string())
                .unwrap_or_else(|| "".to_string()),
        ];
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}
