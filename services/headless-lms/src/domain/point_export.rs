use crate::models::{chapters, course_instances, user_exercise_states};
use anyhow::{Context, Result};
use futures::stream::FuturesUnordered;
use sqlx::PgConnection;
use std::array::IntoIter;
use std::convert::TryFrom;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tokio_stream::StreamExt;
use uuid::Uuid;

// Writes the points as csv into the writer
pub async fn export<W>(conn: &mut PgConnection, course_instance_id: Uuid, writer: W) -> Result<W>
where
    W: Write + Send + 'static,
{
    let course_instance = course_instances::get_course_instance(conn, course_instance_id).await?;
    let mut chapters = chapters::course_chapters(conn, course_instance.course_id).await?;
    chapters.sort_by_key(|c| c.chapter_number);

    let header_count = chapters.len() + 1;
    let headers = IntoIter::new(["user_id".to_string()])
        .chain(chapters.into_iter().map(|c| c.chapter_number.to_string()));
    let mut writer = csv::WriterBuilder::new()
        .has_headers(false)
        .delimiter(b';')
        .from_writer(writer);

    // write headers first
    let writer = tokio::task::spawn_blocking(move || {
        writer
            .write_record(headers)
            .context("Failed to write headers")?;
        Result::<_, anyhow::Error>::Ok(writer)
    })
    .await??;

    let mut handles = FuturesUnordered::new();
    let mut stream = user_exercise_states::stream_course_instance_points(conn, course_instance_id);

    let writer = Arc::new(Mutex::new(writer));
    while let Some(next) = stream.try_next().await? {
        let mut csv_row = vec!["0".to_string(); header_count];
        csv_row[0] = next.user_id.to_string();
        for points in next.points_for_each_chapter {
            let idx = usize::try_from(points.chapter_number)
                .with_context(|| format!("Invalid chapter number {}", points.chapter_number))?;
            if idx < 1 {
                anyhow::bail!("Invalid chapter number {}", idx);
            }
            csv_row[idx] = points.points_for_chapter.to_string();
        }
        let writer = writer.clone();
        handles.push(tokio::task::spawn_blocking(move || {
            writer
                .lock()
                .unwrap()
                .serialize(&csv_row)
                .context("Failed to serialize points")
        }));
    }

    // ensure every task is finished before the writer is extracted
    while let Some(handle) = handles.next().await {
        handle??;
    }
    let writer = tokio::task::spawn_blocking(move || {
        Arc::try_unwrap(writer)
            .map_err(|_| anyhow::anyhow!("Failed to extract inner writer from arc"))?
            .into_inner()
            .map_err(|_| anyhow::anyhow!("Failed to extract inner writer from mutex"))?
            .into_inner()
            .map_err(|_| anyhow::anyhow!("Failed to extract inner writer from CSV writer"))
    })
    .await??;

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
        let buf = export(tx.as_mut(), instance, buf).await.unwrap();
        let buf = Cursor::new(buf);

        let mut reader = csv::ReaderBuilder::new().delimiter(b';').from_reader(buf);
        let mut count = 0;
        for record in reader.records() {
            count += 1;
            let record = record.unwrap();
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
