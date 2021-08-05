use crate::models::{chapters, course_instances, user_exercise_states};
use anyhow::{Context, Result};
use csv::Writer;
use futures::stream::FuturesUnordered;
use sqlx::PgConnection;
use std::array::IntoIter;
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tokio::task::JoinHandle;
use tokio_stream::StreamExt;
use uuid::Uuid;

/// Convenience struct for creating CSV data.
struct CsvWriter<W: Write> {
    csv_writer: Arc<Mutex<Writer<W>>>,
    handles: FuturesUnordered<JoinHandle<Result<()>>>,
}

impl<W: Write + Send + 'static> CsvWriter<W> {
    /// Creates a new CsvWriter, and also writes the given headers before returning.
    async fn new_with_initialized_headers<I, T>(writer: W, headers: I) -> Result<Self>
    where
        I: IntoIterator<Item = T> + Send + 'static,
        T: AsRef<[u8]>,
    {
        let mut writer = csv::WriterBuilder::new()
            .has_headers(false)
            .from_writer(writer);

        // write headers first
        let writer = tokio::task::spawn_blocking(move || {
            writer
                .write_record(headers)
                .context("Failed to write headers")?;
            Result::<_, anyhow::Error>::Ok(writer)
        })
        .await??;

        Ok(Self {
            csv_writer: Arc::new(Mutex::new(writer)),
            handles: FuturesUnordered::new(),
        })
    }

    /// Spawns a task that writes a single CSV record
    fn write_record<I, T>(&self, csv_row: I)
    where
        I: IntoIterator<Item = T> + Send + 'static,
        T: AsRef<[u8]>,
    {
        let writer = self.csv_writer.clone();
        let handle = tokio::task::spawn_blocking(move || {
            writer
                .lock()
                .map_err(|_| anyhow::anyhow!("Failed to lock mutex"))?
                .write_record(csv_row)
                .context("Failed to serialize points")
        });
        self.handles.push(handle);
    }

    /// Waits for handles to finish, flushes the writer and extracts the inner writer.
    /// Should always be called before dropping the writer to make sure writing the CSV finishes properly.
    async fn finish(mut self) -> Result<W> {
        // ensure every task is finished before the writer is extracted
        while let Some(handle) = self.handles.next().await {
            handle??;
        }

        let writer = tokio::task::spawn_blocking(move || {
            Arc::try_unwrap(self.csv_writer)
                .map_err(|_| anyhow::anyhow!("Failed to extract inner writer from arc"))?
                .into_inner()
                .map_err(|e| {
                    anyhow::anyhow!(
                        "Failed to extract inner writer from mutex: {}",
                        e.to_string()
                    )
                })?
                .into_inner()
                .map_err(|e| {
                    anyhow::anyhow!(
                        "Failed to extract inner writer from CSV writer: {}",
                        e.to_string()
                    )
                })
        })
        .await??;
        Ok(writer)
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
    let headers = IntoIter::new(["user_id".to_string()])
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

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        models::{
            exercise_tasks,
            exercises::{self, GradingProgress},
            gradings,
            submissions::{self, GradingResult},
            users,
        },
        test_helper::{insert_data, Conn, Data},
    };
    use bytes::Bytes;
    use serde_json::Value;
    use std::io::{self};
    use std::{io::Cursor, sync::mpsc::Sender};

    #[tokio::test]
    async fn exports() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let Data {
            user,
            course,
            instance,
            exercise,
            task,
            page,
            ..
        } = insert_data(tx.as_mut(), "").await.unwrap();
        let u2 = users::insert(tx.as_mut(), "second@example.org")
            .await
            .unwrap();
        let c2 = chapters::insert(tx.as_mut(), "", course, 2).await.unwrap();
        let e2 = exercises::insert(tx.as_mut(), course, "", page, c2, 0)
            .await
            .unwrap();
        let et2 = exercise_tasks::insert(tx.as_mut(), e2, "", vec![], Value::Null, Value::Null)
            .await
            .unwrap();
        let e3 = exercises::insert(tx.as_mut(), course, "", page, c2, 1)
            .await
            .unwrap();
        let et3 = exercise_tasks::insert(tx.as_mut(), e3, "", vec![], Value::Null, Value::Null)
            .await
            .unwrap();
        submit_and_grade(tx.as_mut(), exercise, course, task, user, instance, 12.34).await;
        submit_and_grade(tx.as_mut(), e2, course, et2, user, instance, 23.45).await;
        submit_and_grade(tx.as_mut(), e2, course, et2, u2, instance, 34.56).await;
        submit_and_grade(tx.as_mut(), e3, course, et3, u2, instance, 45.67).await;

        let buf = vec![];
        let buf = export_course_instance_points(tx.as_mut(), instance, buf)
            .await
            .unwrap();
        let buf = Cursor::new(buf);

        let mut reader = csv::Reader::from_reader(buf);
        let mut count = 0;
        for record in reader.records() {
            count += 1;
            let record = record.unwrap();
            println!("{}", record.as_slice());
            let user_id = Uuid::parse_str(&record[0]).unwrap();
            let first = record[1].parse::<f32>().unwrap();
            let second = record[2].parse::<f32>().unwrap();
            if user_id == user {
                assert!((first - 0.1234).abs() < 0.1 && (second - 0.2345).abs() < 0.1);
            } else if user_id == u2 {
                assert!((first - 0.0).abs() < 0.1 && (second - 0.8023).abs() < 0.1);
            } else {
                panic!("unexpected user id");
            }
        }
        assert_eq!(count, 2)
    }

    async fn submit_and_grade(
        tx: &mut PgConnection,
        ex: Uuid,
        c: Uuid,
        et: Uuid,
        u: Uuid,
        ci: Uuid,
        score_given: f32,
    ) {
        let s = submissions::insert(tx, ex, c, et, u, ci, Value::Null)
            .await
            .unwrap();
        let submission = submissions::get_by_id(tx, s).await.unwrap();
        let grading = gradings::new_grading(tx, &submission).await.unwrap();
        let grading_result = GradingResult {
            feedback_json: None,
            feedback_text: None,
            grading_progress: GradingProgress::FullyGraded,
            score_given,
            score_maximum: 100,
        };
        let exercise = exercises::get_by_id(tx, ex).await.unwrap();
        let grading = gradings::update_grading(tx, &grading, &grading_result, &exercise)
            .await
            .unwrap();
        submissions::set_grading_id(tx, grading.id, submission.id)
            .await
            .unwrap();
        user_exercise_states::update_user_exercise_state(tx, &grading, &submission)
            .await
            .unwrap();
    }

    struct WriteAdapter {
        sender: Sender<Bytes>,
    }

    impl Write for WriteAdapter {
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }

        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            let bytes = Bytes::copy_from_slice(buf);
            self.sender
                .send(bytes)
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
            Ok(buf.len())
        }
    }
}
