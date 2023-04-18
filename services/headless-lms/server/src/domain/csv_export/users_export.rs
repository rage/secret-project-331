use anyhow::Result;
use bytes::Bytes;

use futures::TryStreamExt;
use headless_lms_models::user_details;

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

pub struct UsersExportOperation {
    pub course_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for UsersExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_course_user_details(
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

/// Writes user details for users with any exercise submissions in courseas csv into the writer
pub async fn export_course_user_details<W>(
    conn: &mut PgConnection,
    course_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let headers = IntoIterator::into_iter([
        "user_id".to_string(),
        "created_at".to_string(),
        "updated_at".to_string(),
        "first_name".to_string(),
        "last_name".to_string(),
        "email".to_string(),
    ]);

    let mut stream =
        user_details::stream_users_details_having_user_exercise_states_on_course(conn, course_id);

    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    while let Some(next) = stream.try_next().await? {
        let csv_row = vec![
            next.user_id.to_string(),
            next.created_at.to_string(),
            next.updated_at.to_string(),
            next.first_name.unwrap_or_default(),
            next.last_name.unwrap_or_default(),
            next.email.to_string(),
        ];
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}
