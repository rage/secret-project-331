use anyhow::{Context, Result};
use bytes::Bytes;

use futures::TryStreamExt;
use headless_lms_models::{chapters, course_instances, exercises, user_exercise_states};

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

pub struct ExamPointExportOperation {
    pub exam_id: Uuid,
}

#[async_trait]
impl CsvExportDataLoader for ExamPointExportOperation {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter> {
        export_exam_points(
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

// Writes the points as csv into the writer
pub async fn export_exam_points<W>(conn: &mut PgConnection, exam_id: Uuid, writer: W) -> Result<W>
where
    W: Write + Send + 'static,
{
    let csv_fields_before_headers = 2;

    let mut exercises = exercises::get_exercises_by_exam_id(conn, exam_id).await?;
    // I's fine to sort just by order number because exams have no chapters
    exercises.sort_by(|a, b| a.order_number.cmp(&b.order_number));

    let mut exercise_id_to_header_idx = HashMap::new();
    for (idx, exercise) in exercises.iter().enumerate() {
        exercise_id_to_header_idx.insert(exercise.id, csv_fields_before_headers + idx);
    }

    let header_count = csv_fields_before_headers + exercises.len();
    // remember to update csv_fields_before_headers if this changes!
    let headers = IntoIterator::into_iter(["user_id".to_string(), "email".to_string()]).chain(
        exercises
            .into_iter()
            .map(|e| format!("{}: {}", e.order_number, e.name)),
    );

    let mut stream = user_exercise_states::stream_exam_points(conn, exam_id);

    let writer = CsvWriter::new_with_initialized_headers(writer, headers).await?;
    while let Some(next) = stream.try_next().await? {
        let mut csv_row = vec!["0".to_string(); header_count];
        csv_row[0] = next.user_id.to_string();
        csv_row[1] = next.email;
        for points in next.points_for_exercise {
            let idx = exercise_id_to_header_idx
                .get(&points.exercise_id)
                .with_context(|| format!("Unexpected exercise id {}", points.exercise_id))?;
            let item = csv_row
                .get_mut(*idx)
                .with_context(|| format!("Invalid index {}", idx))?;
            *item = points.score_given.to_string();
        }
        writer.write_record(csv_row);
    }
    let writer = writer.finish().await?;
    Ok(writer)
}
