use anyhow::Result;
use bytes::Bytes;

use futures::TryStreamExt;
use headless_lms_models::research_forms;

use crate::domain::csv_export::CsvWriter;
use async_trait::async_trait;

use sqlx::PgConnection;
use std::io::Write;
use tokio::sync::mpsc::UnboundedSender;

use uuid::Uuid;

use crate::prelude::*;

use super::{
    super::authorization::{AuthorizationToken, AuthorizedResponse},
    CSVExportAdapter, CsvExportDataLoader,
};

pub struct CourseResearchFormExportOperation {
    pub course_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for CourseResearchFormExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_course_research_form_question_user_answers(
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

pub async fn export_course_research_form_question_user_answers<W>(
    conn: &mut PgConnection,
    course_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let headers = IntoIterator::into_iter([
        "course_id".to_string(),
        "research_consent_form_id".to_string(),
        "research_form_question_id".to_string(),
        "question".to_string(),
        "user_id".to_string(),
        "research_consent".to_string(),
        "created_at".to_string(),
        "updated_at".to_string(),
    ]);
    let mut stream = research_forms::stream_course_research_form_user_answers(conn, course_id);

    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    while let Some(next) = stream.try_next().await? {
        let csv_row = vec![
            next.course_id.to_string(),
            next.research_consent_form_id.to_string(),
            next.research_form_question_id.to_string(),
            next.question.to_string(),
            next.user_id.to_string(),
            next.research_consent.to_string(),
            next.created_at.to_rfc3339(),
            next.updated_at.to_rfc3339(),
        ];
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}
