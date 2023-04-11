use anyhow::{Context, Result};
use bytes::Bytes;

use futures::TryStreamExt;
use headless_lms_models::{chapters, course_instances, user_exercise_states};

use async_trait::async_trait;

use crate::domain::csv_export::CsvWriter;

use sqlx::PgConnection;
use std::{collections::HashMap, io::Write};
use tokio::sync::mpsc::UnboundedSender;

use uuid::Uuid;

use crate::prelude::*;

use super::{
    super::authorization::{AuthorizationToken, AuthorizedResponse},
    CSVExportAdapter, CsvExportDataLoader,
};

pub struct PointExportOperation {
    pub course_instance_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for PointExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_course_instance_points(
            &mut *conn,
            self.course_instance_id,
            CSVExportAdapter {
                sender,
                authorization_token: token,
            },
        )
        .await
    }
}

// Writes the points as csv into the writer
pub async fn export_course_instance_points<W>(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    writer: W,
) -> Result<W>
where
    W: Write + Send + 'static,
{
    let csv_fields_before_headers = 1;

    let course_instance = course_instances::get_course_instance(conn, course_instance_id).await?;
    let mut chapters = chapters::course_chapters(conn, course_instance.course_id).await?;
    chapters.sort_by_key(|c| c.chapter_number);
    let mut chapter_number_to_header_idx = HashMap::new();
    for (idx, chapter) in chapters.iter().enumerate() {
        chapter_number_to_header_idx
            .insert(chapter.chapter_number, csv_fields_before_headers + idx);
    }

    let header_count = csv_fields_before_headers + chapters.len();
    // remember to update csv_fields_before_headers if this changes!
    let headers = IntoIterator::into_iter(["user_id".to_string()])
        .chain(chapters.into_iter().map(|c| c.chapter_number.to_string()));

    let mut stream = user_exercise_states::stream_course_instance_points(conn, course_instance_id);

    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    while let Some(next) = stream.try_next().await? {
        let mut csv_row = vec!["0".to_string(); header_count];
        csv_row[0] = next.user_id.to_string();
        for points in next.points_for_each_chapter {
            let idx = chapter_number_to_header_idx
                .get(&points.chapter_number)
                .with_context(|| format!("Unexpected chapter number {}", points.chapter_number))?;
            let item = csv_row
                .get_mut(*idx)
                .with_context(|| format!("Invalid chapter number {}", idx))?;
            *item = points.points_for_chapter.to_string();
        }
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}
