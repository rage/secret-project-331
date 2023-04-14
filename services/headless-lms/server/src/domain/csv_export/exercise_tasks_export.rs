use anyhow::Result;
use bytes::Bytes;

use futures::TryStreamExt;

use async_trait::async_trait;
use models::exercise_tasks;

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

pub struct CourseExerciseTasksExportOperation {
    pub course_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for CourseExerciseTasksExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_course_exercise_tasks(
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

// Writes the course exercise tasks with pravate spec as csv into the writer
pub async fn export_course_exercise_tasks<W>(
    conn: &mut PgConnection,
    course_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let headers = IntoIterator::into_iter([
        "id".to_string(),
        "created_at".to_string(),
        "updated_at".to_string(),
        "exercise_type".to_string(),
        "private_spec".to_string(),
    ]);

    let mut stream = exercise_tasks::stream_course_exercise_tasks(conn, course_id);

    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    while let Some(next) = stream.try_next().await? {
        let csv_row = vec![
            next.id.to_string(),
            next.created_at.to_string(),
            next.updated_at.to_string(),
            next.exercise_type.to_string(),
            next.private_spec
                .map(|o| o.to_string())
                .unwrap_or_else(|| "".to_string()),
        ];
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}
