use anyhow::Result;
use bytes::Bytes;

use futures::TryStreamExt;
use headless_lms_models::user_exercise_states;

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

pub struct UserExerciseStatesExportOperation {
    pub course_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for UserExerciseStatesExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_user_exercise_states(
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

/// Writes user exercise states as csv into the writer
pub async fn export_user_exercise_states<W>(
    conn: &mut PgConnection,
    course_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let headers = IntoIterator::into_iter([
        "course_id".to_string(),
        "user_id".to_string(),
        "exercise_id".to_string(),
        "created_at".to_string(),
        "updated_at".to_string(),
        "activity_process".to_string(),
        "grading_progress".to_string(),
        "reviewing_stage".to_string(),
        "score_given".to_string(),
    ]);

    let course_ids = vec![course_id];
    let mut stream =
        user_exercise_states::stream_user_exercise_states_for_course(conn, &course_ids);

    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    while let Some(next) = stream.try_next().await? {
        let csv_row = vec![
            next.course_id.unwrap_or_default().to_string(),
            next.user_id.to_string(),
            next.exercise_id.to_string(),
            next.created_at.to_rfc3339(),
            next.updated_at.to_rfc3339(),
            next.activity_progress.to_string(),
            next.grading_progress.to_string(),
            next.reviewing_stage.to_string(),
            next.score_given.unwrap_or(0.0).to_string(),
        ];
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}
