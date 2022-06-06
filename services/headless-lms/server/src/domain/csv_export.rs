use std::{
    collections::HashMap,
    io,
    io::Write,
    sync::{Arc, Mutex},
};

use anyhow::{Context, Result};
use bytes::Bytes;
use csv::Writer;
use futures::stream::FuturesUnordered;
use headless_lms_models::{
    chapters, course_instances, exercise_task_submissions, exercises, user_exercise_states,
};
use sqlx::PgConnection;
use tokio::{sync::mpsc::UnboundedSender, task::JoinHandle};
use tokio_stream::StreamExt;
use uuid::Uuid;

use crate::controllers::ControllerResult;

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
            let _ = &self;
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

pub struct CSVExportAdapter {
    pub sender: UnboundedSender<ControllerResult<Bytes>>,
}

impl Write for CSVExportAdapter {
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }

    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let bytes = Bytes::copy_from_slice(buf);
        self.sender
            .send(Ok(bytes))
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
        Ok(buf.len())
    }
}

#[cfg(test)]
mod test {
    use std::{
        io::{self, Cursor},
        sync::mpsc::Sender,
    };

    use bytes::Bytes;
    use headless_lms_models::{
        exercise_slides,
        exercise_task_gradings::ExerciseTaskGradingResult,
        exercise_tasks::{self, NewExerciseTask},
        exercises::{self, GradingProgress},
        library::grading::{StudentExerciseSlideSubmission, StudentExerciseTaskSubmission},
        users,
    };
    use serde_json::Value;

    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn exports() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise, :slide, :task);

        let u2 = users::insert(tx.as_mut(), "second@example.org", None, None)
            .await
            .unwrap();
        let c2 = chapters::insert(tx.as_mut(), "", course, 2, None)
            .await
            .unwrap();
        let e2 = exercises::insert(tx.as_mut(), course, "", page, c2, 0)
            .await
            .unwrap();
        let s2 = exercise_slides::insert(tx.as_mut(), e2, 0).await.unwrap();
        let et2 = exercise_tasks::insert(
            tx.as_mut(),
            NewExerciseTask {
                exercise_slide_id: s2,
                exercise_type: "".to_string(),
                assignment: vec![],
                public_spec: Some(Value::Null),
                private_spec: Some(Value::Null),
                spec_file_id: None,
                model_solution_spec: Some(Value::Null),
                order_number: 1,
            },
        )
        .await
        .unwrap();
        let e3 = exercises::insert(tx.as_mut(), course, "", page, c2, 1)
            .await
            .unwrap();
        let s3 = exercise_slides::insert(tx.as_mut(), e3, 0).await.unwrap();
        let et3 = exercise_tasks::insert(
            tx.as_mut(),
            NewExerciseTask {
                exercise_slide_id: s3,
                exercise_type: "".to_string(),
                assignment: vec![],
                public_spec: Some(Value::Null),
                private_spec: Some(Value::Null),
                spec_file_id: None,
                model_solution_spec: Some(Value::Null),
                order_number: 2,
            },
        )
        .await
        .unwrap();
        submit_and_grade(tx.as_mut(), exercise, slide, task, user, instance.id, 12.34).await;
        submit_and_grade(tx.as_mut(), e2, s2, et2, user, instance.id, 23.45).await;
        submit_and_grade(tx.as_mut(), e2, s2, et2, u2, instance.id, 34.56).await;
        submit_and_grade(tx.as_mut(), e3, s3, et3, u2, instance.id, 45.67).await;

        let buf = vec![];
        let buf = export_course_instance_points(tx.as_mut(), instance.id, buf)
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
        ex_slide: Uuid,
        et: Uuid,
        u: Uuid,
        ci: Uuid,
        score_given: f32,
    ) {
        let exercise = exercises::get_by_id(tx, ex).await.unwrap();
        user_exercise_states::get_or_create_user_exercise_state(tx, u, ex, Some(ci), None)
            .await
            .unwrap();
        user_exercise_states::upsert_selected_exercise_slide_id(
            tx,
            u,
            ex,
            Some(ci),
            None,
            Some(ex_slide),
        )
        .await
        .unwrap();
        let user_exercise_state =
            user_exercise_states::get_or_create_user_exercise_state(tx, u, ex, Some(ci), None)
                .await
                .unwrap();
        headless_lms_models::library::grading::test_only_grade_user_submission_with_fixed_results(
            tx,
            &exercise,
            user_exercise_state,
            StudentExerciseSlideSubmission {
                exercise_slide_id: ex_slide,
                exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                    exercise_task_id: et,
                    data_json: Value::Null,
                }],
            },
            HashMap::from([(
                et,
                ExerciseTaskGradingResult {
                    feedback_json: None,
                    feedback_text: None,
                    grading_progress: GradingProgress::FullyGraded,
                    score_given,
                    score_maximum: 100,
                },
            )]),
        )
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
