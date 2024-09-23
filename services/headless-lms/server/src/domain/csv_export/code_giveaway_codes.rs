use anyhow::Result;
use bytes::Bytes;

use futures::TryStreamExt;
use headless_lms_models::code_giveaway_codes;

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

pub struct CodeGiveawayCodesExportOperation {
    pub code_giveaway_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for CodeGiveawayCodesExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_code_giveaway_codes(
            &mut *conn,
            self.code_giveaway_id,
            CSVExportAdapter {
                sender,
                authorization_token: token,
            },
        )
        .await
    }
}

/// Writes giveaway codes as csv into the writer
pub async fn export_code_giveaway_codes<W>(
    conn: &mut PgConnection,
    code_giveaway_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let headers = IntoIterator::into_iter([
        "id".to_string(),
        "created_at".to_string(),
        "updated_at".to_string(),
        "code_giveaway_id".to_string(),
        "code_given_to_user_id".to_string(),
        "added_by_user_id".to_string(),
        "code".to_string(),
    ]);

    let mut stream =
        code_giveaway_codes::stream_given_code_giveaway_codes(conn, code_giveaway_id).await;

    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    while let Some(next) = stream.try_next().await? {
        let csv_row = vec![
            next.id.to_string(),
            next.created_at.to_rfc3339(),
            next.updated_at.to_rfc3339(),
            next.code_giveaway_id.to_string(),
            next.code_given_to_user_id
                .map(|o| o.to_string())
                .unwrap_or("".to_string()),
            next.added_by_user_id.to_string(),
            next.code.to_string(),
        ];
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}
