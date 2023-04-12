pub mod course_instance_export;
pub mod exercise_tasks_export;
pub mod points;
pub mod submissions;
pub mod users_export;

use anyhow::{Context, Result};
use bytes::Bytes;
use csv::Writer;
use futures::{stream::FuturesUnordered, Stream, StreamExt};

use async_trait::async_trait;

use models::course_module_completions::CourseModuleCompletionWithRegistrationInfo;
use serde::Serialize;
use sqlx::PgConnection;
use std::{
    io,
    io::Write,
    sync::{Arc, Mutex},
};
use tokio::{sync::mpsc::UnboundedSender, task::JoinHandle};
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::prelude::*;

use super::authorization::{AuthorizationToken, AuthorizedResponse};
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

/**
 * For csv export. Return the grade as a number if there is a numeric grade. If the grade is not numeric, returns pass/fail/
 * If course module has not been completed yet, returns "-".
 */
fn course_module_completion_info_to_grade_string(
    input: Option<&CourseModuleCompletionWithRegistrationInfo>,
) -> String {
    let grade_string = input.map(|info| {
        if let Some(grade) = info.grade {
            return grade.to_string();
        }
        if info.passed {
            return "pass".to_string();
        };
        "fail".to_string()
    });
    if let Some(grade_string) = grade_string {
        if let Some(info) = input {
            if !info.prerequisite_modules_completed {
                return format!("{grade_string}*");
            }
        }
        return grade_string;
    }
    "-".to_string()
}

pub struct CSVExportAdapter {
    pub sender: UnboundedSender<ControllerResult<Bytes>>,
    pub authorization_token: AuthorizationToken,
}
impl Write for CSVExportAdapter {
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }

    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let bytes = Bytes::copy_from_slice(buf);
        let token = self.authorization_token;
        self.sender
            .send(token.authorized_ok(bytes))
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
        Ok(buf.len())
    }
}

/** Without this one, actix cannot stream our authorized streams as responses

```ignore
HttpResponse::Ok()
    .append_header((
        "Content-Disposition",
        format!(
            "attachment; filename=\"Exam: {} - Submissions {}.csv\"",
            exam.name,
            Utc::now().format("%Y-%m-%d")
        ),
    ))
    .streaming(make_authorized_streamable(UnboundedReceiverStream::new(
        receiver,
    ))),
```
*/
pub fn make_authorized_streamable(
    stream: UnboundedReceiverStream<Result<AuthorizedResponse<bytes::Bytes>, ControllerError>>,
) -> impl Stream<Item = Result<bytes::Bytes, ControllerError>> {
    stream.map(|item| item.map(|item2| item2.data))
}

/**
  For streaming arrays of json objects.
*/
pub fn serializable_sqlx_result_stream_to_json_stream(
    stream: impl Stream<Item = sqlx::Result<impl Serialize>>,
) -> impl Stream<Item = Result<bytes::Bytes, ControllerError>> {
    let res_stream = stream.enumerate().map(|(n, item)| {
        item.map(|item2| {
            match serde_json::to_vec(&item2) {
                Ok(mut v) => {
                    // Only item index available, we don't know the length of the stream
                    if n == 0 {
                        // Start of array character to the beginning of the stream
                        v.insert(0, b'[');
                    } else {
                        // Separator character before every item excluding the first item
                        v.insert(0, b',');
                    }
                    Bytes::from(v)
                }
                Err(e) => {
                    // Since we're already streaming a response, we have no way to change the status code of the response anymore.
                    // Our best option at this point is to write the error to the response, hopefully causing the response to be invalid json.
                    error!("Failed to serialize item: {}", e);
                    Bytes::from(format!(
                        "Streaming error: Failed to serialize item. Details: {:?}",
                        e
                    ))
                }
            }
        })
        .map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_error.to_string(),
                Some(original_error.into()),
            )
        })
    });
    // Chaining the end of the json array character here because in the previous map we don't know the length of the stream
    res_stream.chain(tokio_stream::iter(vec![Ok(Bytes::from_static(b"]"))]))
}

#[async_trait]
pub trait CsvExportDataLoader {
    async fn load_data(
        &self,
        sender: UnboundedSender<Result<AuthorizedResponse<Bytes>, ControllerError>>,
        conn: &mut PgConnection,
        token: AuthorizationToken,
    ) -> anyhow::Result<CSVExportAdapter>;
}

pub async fn general_export(
    pool: web::Data<PgPool>,
    filename: &str,
    data_loader: impl CsvExportDataLoader + std::marker::Send + 'static,
    token: AuthorizationToken,
) -> ControllerResult<HttpResponse> {
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<ControllerResult<Bytes>>();
    // spawn handle that writes the csv row by row into the sender
    let mut handle_conn = pool.acquire().await?;
    let _handle = tokio::spawn(async move {
        let lol = data_loader.load_data(sender, &mut handle_conn, token);
        let res = lol.await;
        if let Err(err) = res {
            tracing::error!("Failed to export: {}", err);
        }
    });

    // return response that streams data from the receiver
    return token.authorized_ok(
        HttpResponse::Ok()
            .append_header(("Content-Disposition", filename))
            .streaming(make_authorized_streamable(UnboundedReceiverStream::new(
                receiver,
            ))),
    );
}

#[cfg(test)]
mod test {
    use std::{
        collections::HashMap,
        io::{self, Cursor},
        sync::mpsc::Sender,
    };

    use bytes::Bytes;
    use headless_lms_models::{
        exercise_slides,
        exercise_task_gradings::ExerciseTaskGradingResult,
        exercise_tasks::{self, NewExerciseTask},
        exercises::{self, GradingProgress},
        library::grading::{
            GradingPolicy, StudentExerciseSlideSubmission, StudentExerciseTaskSubmission,
        },
        user_exercise_states,
        user_exercise_states::ExerciseWithUserState,
        users,
    };
    use models::chapters::{self, NewChapter};
    use serde_json::Value;

    use super::*;
    use crate::{
        domain::{
            csv_export::points::export_course_instance_points,
            models_requests::{self, JwtKey},
        },
        test_helper::*,
    };

    #[actix_web::test]
    async fn exports() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise, :slide, :task);

        let u2 = users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "second@example.org",
            None,
            None,
        )
        .await
        .unwrap();
        let c2 = chapters::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &NewChapter {
                name: "".to_string(),
                color: Some("#065853".to_string()),
                course_id: course,
                chapter_number: 2,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(course_module.id),
            },
        )
        .await
        .unwrap();
        let e2 = exercises::insert(tx.as_mut(), PKeyPolicy::Generate, course, "", page, c2, 0)
            .await
            .unwrap();
        let s2 = exercise_slides::insert(tx.as_mut(), PKeyPolicy::Generate, e2, 0)
            .await
            .unwrap();
        let et2 = exercise_tasks::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: s2,
                exercise_type: "".to_string(),
                assignment: vec![],
                public_spec: Some(Value::Null),
                private_spec: Some(Value::Null),
                model_solution_spec: Some(Value::Null),
                order_number: 1,
            },
        )
        .await
        .unwrap();
        let e3 = exercises::insert(tx.as_mut(), PKeyPolicy::Generate, course, "", page, c2, 1)
            .await
            .unwrap();
        let s3 = exercise_slides::insert(tx.as_mut(), PKeyPolicy::Generate, e3, 0)
            .await
            .unwrap();
        let et3 = exercise_tasks::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: s3,
                exercise_type: "".to_string(),
                assignment: vec![],
                public_spec: Some(Value::Null),
                private_spec: Some(Value::Null),
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
        let mut exercise_with_user_state =
            ExerciseWithUserState::new(exercise, user_exercise_state).unwrap();
        let jwt_key = Arc::new(JwtKey::test_key());
        headless_lms_models::library::grading::grade_user_submission(
            tx,
            &mut exercise_with_user_state,
            StudentExerciseSlideSubmission {
                exercise_slide_id: ex_slide,
                exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                    exercise_task_id: et,
                    data_json: Value::Null,
                }],
            },
            GradingPolicy::Fixed(HashMap::from([(
                et,
                ExerciseTaskGradingResult {
                    feedback_json: None,
                    feedback_text: None,
                    grading_progress: GradingProgress::FullyGraded,
                    score_given,
                    score_maximum: 100,
                    set_user_variables: Some(HashMap::new()),
                },
            )])),
            models_requests::fetch_service_info,
            models_requests::make_grading_request_sender(jwt_key),
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
