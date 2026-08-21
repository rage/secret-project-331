use std::collections::{HashMap, HashSet};
use std::path::Path;

use futures::{Stream, StreamExt, future::BoxFuture};
use url::Url;
use utoipa::ToSchema;

use crate::{
    CourseOrExamId,
    exercise_service_info::{self, ExerciseServiceInfoApi},
    exercise_services, exercise_slide_submissions, exercise_task_submission_files,
    exercise_tasks::{CourseMaterialExerciseTask, ExerciseTask},
    library::custom_view_exercises::{CustomViewExerciseTaskSubmission, CustomViewExerciseTasks},
    library::grading::SubmittedAnswer,
    peer_or_self_review_question_submissions::PeerOrSelfReviewQuestionSubmission,
    peer_or_self_review_questions::PeerOrSelfReviewQuestion,
    peer_or_self_review_submissions::PeerOrSelfReviewSubmission,
    prelude::*,
};

/// Which of a submission's two answer representations is the answer: the opaque blob in
/// `data_json`, or the rows in `exercise_task_submission_files`.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "answer_kind", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AnswerKind {
    Json,
    File,
}

/// The answer a submission or grading request carries, as either the raw JSON a plugin produced
/// or the files a plugin's answer consists of.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AnswerData {
    Json {
        data: serde_json::Value,
    },
    File {
        files: Vec<AnswerFile>,
        /// The plugin's own JSON about the files. `None` for a plugin whose answer is the files.
        metadata: Option<serde_json::Value>,
    },
}

impl AnswerData {
    /// The JSON an exercise service is still handed as the answer: the answer itself for `Json`,
    /// the plugin's metadata for `File`. A file answer's files are not represented, because the
    /// exercise service protocol has no field for them yet.
    pub fn plugin_json(&self) -> Option<&serde_json::Value> {
        match self {
            AnswerData::Json { data } => Some(data),
            AnswerData::File { metadata, .. } => metadata.as_ref(),
        }
    }
}

/// One host-stored file that an answer consists of.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct AnswerFile {
    pub id: Uuid,
    /// The name the file was uploaded under. Not necessarily what a viewer should be shown -- a
    /// plugin that anonymizes filenames keeps its display name in `AnswerData::File::metadata`.
    pub name: String,
    pub mime: String,
    /// `None` for a file stored before the size was recorded.
    pub size_bytes: Option<i64>,
    pub order_number: i32,
    /// Capability download URL, minted at read time from the file's path. Never persisted.
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct ExerciseTaskSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_slide_submission_id: Uuid,
    pub exercise_task_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub answer: Option<AnswerData>,
    pub exercise_task_grading_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}

/// A submission row exactly as stored, with its files still unresolved.
struct SubmissionRow {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
    exercise_slide_submission_id: Uuid,
    exercise_task_id: Uuid,
    exercise_slide_id: Uuid,
    data_json: Option<serde_json::Value>,
    answer_kind: AnswerKind,
    exercise_task_grading_id: Option<Uuid>,
    metadata: Option<serde_json::Value>,
}

/// The stored form of one submission's answer, before the files of a `file` answer are resolved.
pub struct StoredAnswer {
    pub submission_id: Uuid,
    pub answer_kind: AnswerKind,
    pub data_json: Option<serde_json::Value>,
}

/// Resolves stored answers into the outbound union in one batch, minting a download URL per file.
///
/// Keyed by submission id. A submission is absent from the map only when its `json` answer has no
/// `data_json` at all, which is the `None` its DTO carries.
pub async fn attach_answer_data(
    conn: &mut PgConnection,
    stored: &[StoredAnswer],
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<HashMap<Uuid, AnswerData>> {
    let file_answer_ids: Vec<Uuid> = stored
        .iter()
        .filter(|answer| answer.answer_kind == AnswerKind::File)
        .map(|answer| answer.submission_id)
        .collect();
    let mut files_by_submission: HashMap<Uuid, Vec<AnswerFile>> = HashMap::new();
    if !file_answer_ids.is_empty() {
        let files = exercise_task_submission_files::get_by_task_submission_ids(
            &mut *conn,
            &file_answer_ids,
        )
        .await?;
        for file in files {
            files_by_submission
                .entry(file.exercise_task_submission_id)
                .or_default()
                .push(AnswerFile {
                    id: file.file_upload_id,
                    name: file.name,
                    mime: file.mime,
                    size_bytes: file.size_bytes,
                    order_number: file.order_number,
                    url: file_store.get_download_url(Path::new(&file.path), app_conf),
                });
        }
    }

    let mut resolved = HashMap::with_capacity(stored.len());
    for answer in stored {
        match answer.answer_kind {
            AnswerKind::Json => {
                if let Some(data) = answer.data_json.clone() {
                    resolved.insert(answer.submission_id, AnswerData::Json { data });
                }
            }
            AnswerKind::File => {
                resolved.insert(
                    answer.submission_id,
                    AnswerData::File {
                        files: files_by_submission
                            .remove(&answer.submission_id)
                            .unwrap_or_default(),
                        metadata: answer.data_json.clone(),
                    },
                );
            }
        }
    }
    Ok(resolved)
}

async fn resolve_rows(
    conn: &mut PgConnection,
    rows: Vec<SubmissionRow>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<Vec<ExerciseTaskSubmission>> {
    let stored: Vec<StoredAnswer> = rows
        .iter()
        .map(|row| StoredAnswer {
            submission_id: row.id,
            answer_kind: row.answer_kind,
            data_json: row.data_json.clone(),
        })
        .collect();
    let mut answers = attach_answer_data(conn, &stored, file_store, app_conf).await?;
    Ok(rows
        .into_iter()
        .map(|row| ExerciseTaskSubmission {
            id: row.id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at,
            exercise_slide_submission_id: row.exercise_slide_submission_id,
            exercise_task_id: row.exercise_task_id,
            exercise_slide_id: row.exercise_slide_id,
            answer: answers.remove(&row.id),
            exercise_task_grading_id: row.exercise_task_grading_id,
            metadata: row.metadata,
        })
        .collect())
}

async fn resolve_row(
    conn: &mut PgConnection,
    row: SubmissionRow,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<ExerciseTaskSubmission> {
    let mut resolved = resolve_rows(conn, vec![row], file_store, app_conf).await?;
    resolved.pop().ok_or_else(|| {
        model_err!(
            Generic,
            "Resolving a submission's answer dropped the submission".to_string()
        )
    })
}

/// One file of an answer, as aggregated by a query that resolves its own files.
#[derive(Deserialize)]
struct AggregatedAnswerFile {
    id: Uuid,
    name: String,
    mime: String,
    size_bytes: Option<i64>,
    path: String,
    order_number: i32,
}

/// Builds the answer union from files the query aggregated itself, for streamed reads that cannot
/// batch their rows.
fn answer_from_aggregated_files(
    answer_kind: AnswerKind,
    data_json: Option<serde_json::Value>,
    files: serde_json::Value,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<Option<AnswerData>> {
    match answer_kind {
        AnswerKind::Json => Ok(data_json.map(|data| AnswerData::Json { data })),
        AnswerKind::File => {
            let aggregated: Vec<AggregatedAnswerFile> = serde_json::from_value(files)?;
            Ok(Some(AnswerData::File {
                files: aggregated
                    .into_iter()
                    .map(|file| AnswerFile {
                        id: file.id,
                        name: file.name,
                        mime: file.mime,
                        size_bytes: file.size_bytes,
                        order_number: file.order_number,
                        url: file_store.get_download_url(Path::new(&file.path), app_conf),
                    })
                    .collect(),
                metadata: data_json,
            }))
        }
    }
}

/// The columns a `SubmittedAnswer` writes, plus the files that must be recorded alongside them.
struct AnswerColumns<'a> {
    data_json: Option<&'a serde_json::Value>,
    answer_kind: AnswerKind,
    file_upload_ids: Option<&'a [Uuid]>,
}

/// Splits a submitted answer into the columns it is stored in. The ids are assumed to be uploads
/// the submitter is allowed to name; this does not check that.
fn answer_columns(answer: &SubmittedAnswer) -> ModelResult<AnswerColumns<'_>> {
    match answer {
        SubmittedAnswer::Json { data } => Ok(AnswerColumns {
            data_json: Some(data),
            answer_kind: AnswerKind::Json,
            file_upload_ids: None,
        }),
        SubmittedAnswer::File {
            file_upload_ids,
            metadata,
        } => {
            if file_upload_ids.is_empty() {
                return Err(model_err!(
                    InvalidRequest,
                    "A file answer must name at least one uploaded file.".to_string()
                ));
            }
            Ok(AnswerColumns {
                data_json: metadata.as_ref(),
                answer_kind: AnswerKind::File,
                file_upload_ids: Some(file_upload_ids),
            })
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct PeerOrSelfReviewsReceived {
    pub peer_or_self_review_questions: Vec<PeerOrSelfReviewQuestion>,
    pub peer_or_self_review_question_submissions: Vec<PeerOrSelfReviewQuestionSubmission>,
    pub peer_or_self_review_submissions: Vec<PeerOrSelfReviewSubmission>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]

pub struct SubmissionData {
    pub exercise_id: Uuid,
    pub course_id: Uuid,
    pub exercise_slide_submission_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    pub user_id: Uuid,
    pub course_instance_id: Uuid,
    pub answer: SubmittedAnswer,
    pub id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]

pub struct ExportedSubmission {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub score_given: Option<f32>,
    pub answer: Option<AnswerData>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]

pub struct ExportedCourseSubmission {
    pub exercise_slide_submission_id: Uuid,
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub course_id: Option<Uuid>,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub score_given: Option<f32>,
    pub answer: Option<AnswerData>,
}

/// One row for CSV export: a single attempt at an exercise task for a given exercise_slide_submission (chronological submission order).
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct ExerciseTaskSubmissionCsvExportData {
    pub exercise_slide_submission_id: Uuid,
    pub exercise_task_submission_id: Uuid,
    pub exercise_task_id: Uuid,
    pub exercise_id: Uuid,
    pub user_id: Uuid,
    pub submitted_at: DateTime<Utc>,
    pub answer: Option<AnswerData>,
}

pub async fn get_submission(
    conn: &mut PgConnection,
    submission_id: Uuid,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<ExerciseTaskSubmission> {
    let row = sqlx::query_as!(
        SubmissionRow,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_submission_id,
  exercise_task_id,
  exercise_slide_id,
  data_json,
  answer_kind AS "answer_kind: AnswerKind",
  exercise_task_grading_id,
  metadata
FROM exercise_task_submissions
WHERE id = $1
"#,
        submission_id
    )
    .fetch_one(&mut *conn)
    .await?;
    resolve_row(conn, row, file_store, app_conf).await
}

// TODO: Merge with the other insert, but need to resolve different parameters.
pub async fn insert_with_id(
    conn: &mut PgConnection,
    submission_data: &SubmissionData,
) -> ModelResult<Uuid> {
    insert(
        conn,
        PKeyPolicy::Fixed(submission_data.id),
        submission_data.exercise_slide_submission_id,
        submission_data.exercise_slide_id,
        submission_data.exercise_task_id,
        &submission_data.answer,
    )
    .await
}

/// Records a task submission and, for a file answer, the files that are the answer.
///
/// Both land in one transaction: a file answer whose file rows were rolled back would be an
/// answer with no content at all.
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    exercise_slide_submission_id: Uuid,
    exercise_slide_id: Uuid,
    exercise_task_id: Uuid,
    answer: &SubmittedAnswer,
) -> ModelResult<Uuid> {
    let columns = answer_columns(answer)?;
    let mut tx = conn.begin().await?;
    let res = sqlx::query!(
        "
INSERT INTO exercise_task_submissions (
    id,
    exercise_slide_submission_id,
    exercise_slide_id,
    exercise_task_id,
    data_json,
    answer_kind
  )
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING id
        ",
        pkey_policy.into_uuid(),
        exercise_slide_submission_id,
        exercise_slide_id,
        exercise_task_id,
        columns.data_json,
        columns.answer_kind as AnswerKind,
    )
    .fetch_one(&mut *tx)
    .await?;
    if let Some(file_upload_ids) = columns.file_upload_ids {
        exercise_task_submission_files::insert_many(&mut tx, res.id, file_upload_ids).await?;
    }
    tx.commit().await?;
    Ok(res.id)
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<ExerciseTaskSubmission> {
    let row = sqlx::query_as!(
        SubmissionRow,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_submission_id,
  exercise_task_id,
  exercise_slide_id,
  data_json,
  answer_kind AS "answer_kind: AnswerKind",
  exercise_task_grading_id,
  metadata
FROM exercise_task_submissions
WHERE id = $1
"#,
        id
    )
    .fetch_one(&mut *conn)
    .await?;
    resolve_row(conn, row, file_store, app_conf).await
}

pub async fn get_by_exercise_slide_submission_id(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<Vec<ExerciseTaskSubmission>> {
    let rows = sqlx::query_as!(
        SubmissionRow,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_submission_id,
  exercise_task_id,
  exercise_slide_id,
  data_json,
  answer_kind AS "answer_kind: AnswerKind",
  exercise_task_grading_id,
  metadata
FROM exercise_task_submissions
WHERE exercise_slide_submission_id = $1
        "#,
        exercise_slide_submission_id
    )
    .fetch_all(&mut *conn)
    .await?;
    resolve_rows(conn, rows, file_store, app_conf).await
}

/// A CSV-export row before its answer's files are resolved.
struct CsvExportRow {
    exercise_slide_submission_id: Uuid,
    exercise_task_submission_id: Uuid,
    exercise_task_id: Uuid,
    exercise_id: Uuid,
    user_id: Uuid,
    submitted_at: DateTime<Utc>,
    data_json: Option<serde_json::Value>,
    answer_kind: AnswerKind,
}

async fn resolve_csv_export_rows(
    conn: &mut PgConnection,
    rows: Vec<CsvExportRow>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<Vec<ExerciseTaskSubmissionCsvExportData>> {
    let stored: Vec<StoredAnswer> = rows
        .iter()
        .map(|row| StoredAnswer {
            submission_id: row.exercise_task_submission_id,
            answer_kind: row.answer_kind,
            data_json: row.data_json.clone(),
        })
        .collect();
    let mut answers = attach_answer_data(conn, &stored, file_store, app_conf).await?;
    Ok(rows
        .into_iter()
        .map(|row| ExerciseTaskSubmissionCsvExportData {
            exercise_slide_submission_id: row.exercise_slide_submission_id,
            exercise_task_submission_id: row.exercise_task_submission_id,
            exercise_task_id: row.exercise_task_id,
            exercise_id: row.exercise_id,
            user_id: row.user_id,
            submitted_at: row.submitted_at,
            answer: answers.remove(&row.exercise_task_submission_id),
        })
        .collect())
}

/// Fetches CSV-exportable rows at attempt granularity in intended ordering.
pub async fn get_csv_export_data_by_exercise_and_task(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    exercise_task_id: Uuid,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<Vec<ExerciseTaskSubmissionCsvExportData>> {
    let rows = sqlx::query_as!(
        CsvExportRow,
        r#"
SELECT ets.exercise_slide_submission_id,
  ets.id AS exercise_task_submission_id,
  ets.exercise_task_id,
  ess.exercise_id,
  ess.user_id,
  ets.created_at AS submitted_at,
  ets.data_json,
  ets.answer_kind AS "answer_kind: AnswerKind"
FROM exercise_task_submissions ets
  JOIN exercise_slide_submissions ess ON ets.exercise_slide_submission_id = ess.id
WHERE ess.exercise_id = $1
  AND ets.exercise_task_id = $2
  AND ess.deleted_at IS NULL
  AND ets.deleted_at IS NULL
ORDER BY ets.created_at ASC
        "#,
        exercise_id,
        exercise_task_id
    )
    .fetch_all(&mut *conn)
    .await?;
    resolve_csv_export_rows(conn, rows, file_store, app_conf).await
}

/// Fetches CSV-exportable rows for the latest submission per user only, ordered by submitted_at.
pub async fn get_csv_export_data_by_exercise_and_task_latest_per_user(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    exercise_task_id: Uuid,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<Vec<ExerciseTaskSubmissionCsvExportData>> {
    let rows = sqlx::query_as!(
        CsvExportRow,
        r#"
WITH latest AS (
  SELECT DISTINCT ON (ess.user_id) ets.id AS exercise_task_submission_id
  FROM exercise_task_submissions ets
  JOIN exercise_slide_submissions ess ON ets.exercise_slide_submission_id = ess.id
  WHERE ess.exercise_id = $1
    AND ets.exercise_task_id = $2
    AND ess.deleted_at IS NULL
    AND ets.deleted_at IS NULL
  ORDER BY ess.user_id, ets.created_at DESC
)
SELECT ets.exercise_slide_submission_id,
  ets.id AS exercise_task_submission_id,
  ets.exercise_task_id,
  ess.exercise_id,
  ess.user_id,
  ets.created_at AS submitted_at,
  ets.data_json,
  ets.answer_kind AS "answer_kind: AnswerKind"
FROM exercise_task_submissions ets
JOIN exercise_slide_submissions ess ON ets.exercise_slide_submission_id = ess.id
JOIN latest ON latest.exercise_task_submission_id = ets.id
WHERE ess.exercise_id = $1
  AND ets.exercise_task_id = $2
  AND ess.deleted_at IS NULL
  AND ets.deleted_at IS NULL
ORDER BY ets.created_at ASC
        "#,
        exercise_id,
        exercise_task_id
    )
    .fetch_all(&mut *conn)
    .await?;
    resolve_csv_export_rows(conn, rows, file_store, app_conf).await
}

pub async fn get_users_latest_exercise_task_submissions_for_exercise_slide(
    conn: &mut PgConnection,
    exercise_slide_id: Uuid,
    user_id: Uuid,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<Option<Vec<ExerciseTaskSubmission>>> {
    let exercise_slide_submission =
        exercise_slide_submissions::try_to_get_users_latest_exercise_slide_submission(
            conn,
            exercise_slide_id,
            user_id,
        )
        .await?;
    if let Some(exercise_slide_submission) = exercise_slide_submission {
        let rows = sqlx::query_as!(
            SubmissionRow,
            r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_submission_id,
  exercise_task_id,
  exercise_slide_id,
  data_json,
  answer_kind AS "answer_kind: AnswerKind",
  exercise_task_grading_id,
  metadata
FROM exercise_task_submissions
WHERE exercise_slide_submission_id = $1
  AND deleted_at IS NULL
            "#,
            exercise_slide_submission.id
        )
        .fetch_all(&mut *conn)
        .await?;
        Ok(Some(resolve_rows(conn, rows, file_store, app_conf).await?))
    } else {
        Ok(None)
    }
}

pub async fn get_course_and_exam_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseOrExamId> {
    let res = sqlx::query!(
        "
SELECT ess.course_id,
  ess.exam_id
FROM exercise_task_submissions ets
  JOIN exercise_slide_submissions ess ON ets.exercise_slide_submission_id = ess.id
WHERE ets.id = $1
  AND ets.deleted_at IS NULL
  AND ess.deleted_at IS NULL
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    CourseOrExamId::from_course_and_exam_ids(res.course_id, res.exam_id)
}

pub async fn get_peer_reviews_received(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    exercise_slide_submission_id: Uuid,
    user_id: Uuid,
) -> ModelResult<PeerOrSelfReviewsReceived> {
    let exercise = crate::exercises::get_by_id(&mut *conn, exercise_id).await?;
    let peer_or_self_review_config =
        crate::peer_or_self_review_configs::get_by_exercise_or_course_id(
            &mut *conn,
            &exercise,
            exercise.course_id.ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "Peer reviews work only on courses (and not, for example, on exams)"
                        .to_string(),
                    None,
                )
            })?,
        )
        .await?;
    let peer_or_self_review_questions =
        crate::peer_or_self_review_questions::get_by_peer_or_self_review_configs_id(
            &mut *conn,
            peer_or_self_review_config.id,
        )
        .await?;

    let peer_or_self_review_question_ids = peer_or_self_review_questions
        .iter()
        .map(|x| x.id)
        .collect::<Vec<_>>();

    let peer_or_self_review_submissions =
        crate::peer_or_self_review_submissions::get_received_peer_or_self_review_submissions_for_user_by_peer_or_self_review_config_id_and_exercise_slide_submission(
            &mut *conn,
            user_id,
            exercise_slide_submission_id,
            peer_or_self_review_config.id,
        )
        .await?;

    let peer_or_self_review_question_submissions =
        crate::peer_or_self_review_question_submissions::get_by_peer_reviews_question_ids(
            &mut *conn,
            &peer_or_self_review_question_ids,
            user_id,
            exercise_slide_submission_id,
        )
        .await?;

    Ok(PeerOrSelfReviewsReceived {
        peer_or_self_review_questions,
        peer_or_self_review_question_submissions,
        peer_or_self_review_submissions,
    })
}

pub async fn set_grading_id(
    conn: &mut PgConnection,
    grading_id: Uuid,
    submission_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_task_submissions
SET exercise_task_grading_id = $1
WHERE id = $2
",
        grading_id,
        submission_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// A submission's grading pointer, for callers that route gradings and never read the answer.
pub struct SubmissionGradingRef {
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_task_grading_id: Option<Uuid>,
}

pub async fn get_grading_ref(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<SubmissionGradingRef> {
    let res = sqlx::query_as!(
        SubmissionGradingRef,
        "
SELECT deleted_at,
  exercise_task_grading_id
FROM exercise_task_submissions
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub fn stream_exam_submissions<'a>(
    conn: &'a mut PgConnection,
    exam_id: Uuid,
    file_store: &'a dyn FileStore,
    app_conf: &'a ApplicationConfiguration,
) -> impl Stream<Item = ModelResult<ExportedSubmission>> + 'a {
    sqlx::query!(
        r#"
SELECT exercise_task_submissions.id,
  user_id,
  exercise_task_submissions.created_at,
  exercise_slide_submissions.exercise_id,
  exercise_task_submissions.exercise_task_id,
  exercise_task_gradings.score_given,
  exercise_task_submissions.data_json,
  exercise_task_submissions.answer_kind AS "answer_kind: AnswerKind",
  answer_files.files AS "files!: serde_json::Value"
FROM exercise_task_submissions
  JOIN exercise_slide_submissions ON exercise_task_submissions.exercise_slide_submission_id = exercise_slide_submissions.id
  JOIN exercise_task_gradings on exercise_task_submissions.exercise_task_grading_id = exercise_task_gradings.id
  JOIN exercises on exercise_slide_submissions.exercise_id = exercises.id
  LEFT JOIN LATERAL (
    SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', fu.id,
            'name', fu.name,
            'mime', fu.mime,
            'size_bytes', fu.size_bytes,
            'path', fu.path,
            'order_number', etsf.order_number
          )
          ORDER BY etsf.order_number
        ),
        '[]'::jsonb
      ) AS files
    FROM exercise_task_submission_files etsf
      JOIN file_uploads fu ON fu.id = etsf.file_upload_id
    WHERE etsf.exercise_task_submission_id = exercise_task_submissions.id
      AND etsf.deleted_at IS NULL
      AND fu.deleted_at IS NULL
  ) answer_files ON TRUE
WHERE exercise_slide_submissions.exam_id = $1
  AND exercise_task_submissions.deleted_at IS NULL
  AND exercise_task_gradings.deleted_at IS NULL
  AND exercises.deleted_at IS NULL;
        "#,
        exam_id
    )
    .fetch(conn)
    .map(move |row| {
        let row = row?;
        Ok(ExportedSubmission {
            id: row.id,
            user_id: row.user_id,
            created_at: row.created_at,
            exercise_id: row.exercise_id,
            exercise_task_id: row.exercise_task_id,
            score_given: row.score_given,
            answer: answer_from_aggregated_files(
                row.answer_kind,
                row.data_json,
                row.files,
                file_store,
                app_conf,
            )?,
        })
    })
}

pub fn stream_course_submissions<'a>(
    conn: &'a mut PgConnection,
    course_id: Uuid,
    file_store: &'a dyn FileStore,
    app_conf: &'a ApplicationConfiguration,
) -> impl Stream<Item = ModelResult<ExportedCourseSubmission>> + 'a {
    sqlx::query!(
        r#"
SELECT exercise_task_submissions.exercise_slide_submission_id,
  exercise_task_submissions.id,
  user_id,
  exercise_task_submissions.created_at,
  exercise_slide_submissions.course_id,
  exercise_slide_submissions.exercise_id,
  exercise_task_submissions.exercise_task_id,
  exercise_task_gradings.score_given,
  exercise_task_submissions.data_json,
  exercise_task_submissions.answer_kind AS "answer_kind: AnswerKind",
  answer_files.files AS "files!: serde_json::Value"
FROM exercise_task_submissions
  JOIN exercise_slide_submissions ON exercise_task_submissions.exercise_slide_submission_id = exercise_slide_submissions.id
  JOIN exercise_task_gradings ON exercise_task_submissions.exercise_task_grading_id = exercise_task_gradings.id
  JOIN exercises ON exercise_slide_submissions.exercise_id = exercises.id
  LEFT JOIN LATERAL (
    SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', fu.id,
            'name', fu.name,
            'mime', fu.mime,
            'size_bytes', fu.size_bytes,
            'path', fu.path,
            'order_number', etsf.order_number
          )
          ORDER BY etsf.order_number
        ),
        '[]'::jsonb
      ) AS files
    FROM exercise_task_submission_files etsf
      JOIN file_uploads fu ON fu.id = etsf.file_upload_id
    WHERE etsf.exercise_task_submission_id = exercise_task_submissions.id
      AND etsf.deleted_at IS NULL
      AND fu.deleted_at IS NULL
  ) answer_files ON TRUE
WHERE exercise_slide_submissions.course_id = $1
  AND exercise_slide_submissions.deleted_at IS NULL
  AND exercise_task_submissions.deleted_at IS NULL
  AND exercise_task_gradings.deleted_at IS NULL
  AND exercises.deleted_at IS NULL;
        "#,
        course_id
    )
    .fetch(conn)
    .map(move |row| {
        let row = row?;
        Ok(ExportedCourseSubmission {
            exercise_slide_submission_id: row.exercise_slide_submission_id,
            id: row.id,
            user_id: row.user_id,
            created_at: row.created_at,
            course_id: row.course_id,
            exercise_id: row.exercise_id,
            exercise_task_id: row.exercise_task_id,
            score_given: row.score_given,
            answer: answer_from_aggregated_files(
                row.answer_kind,
                row.data_json,
                row.files,
                file_store,
                app_conf,
            )?,
        })
    })
}

/// Used to get the necessary info for rendering a submission either when we're viewing a submission, or we're conducting a peer review.
pub async fn get_exercise_task_submission_info_by_exercise_slide_submission_id(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
    viewer_user_id: Uuid,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
    include_deleted_tasks: bool,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<Vec<CourseMaterialExerciseTask>> {
    let task_submisssions = crate::exercise_task_submissions::get_by_exercise_slide_submission_id(
        &mut *conn,
        exercise_slide_submission_id,
        file_store,
        app_conf,
    )
    .await?;
    let exercise_task_gradings =
        crate::exercise_task_gradings::get_all_gradings_by_exercise_slide_submission_id(
            &mut *conn,
            exercise_slide_submission_id,
        )
        .await?;

    let exercise_tasks = if include_deleted_tasks {
        crate::exercise_tasks::get_exercise_tasks_by_exercise_slide_id_including_deleted::<
            Vec<ExerciseTask>,
        >(&mut *conn, &task_submisssions[0].exercise_slide_id)
        .await?
    } else {
        crate::exercise_tasks::get_exercise_tasks_by_exercise_slide_id::<Vec<ExerciseTask>>(
            &mut *conn,
            &task_submisssions[0].exercise_slide_id,
        )
        .await?
    };

    let mut res = Vec::with_capacity(task_submisssions.len());

    let unique_exercise_service_slugs = exercise_tasks
        .iter()
        .cloned()
        .map(|et| et.exercise_type)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let exercise_service_slug_to_service_and_info =
        exercise_service_info::get_selected_exercise_services_by_type(
            &mut *conn,
            &unique_exercise_service_slugs,
            fetch_service_info,
        )
        .await?;

    for ts in task_submisssions {
        let grading = exercise_task_gradings
            .iter()
            .find(|g| Some(g.id) == ts.exercise_task_grading_id)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::NotFound,
                    "Grading not found".to_string(),
                    None,
                )
            })?;
        let task = exercise_tasks
            .iter()
            .find(|t| t.id == ts.exercise_task_id)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::NotFound,
                    "Exercise task not found".to_string(),
                    None,
                )
            })?;
        let (exercise_service, service_info) = exercise_service_slug_to_service_and_info
            .get(&task.exercise_type)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "Exercise service not found".to_string(),
                    None,
                )
            })?;
        let mut exercise_iframe_url =
            exercise_services::get_exercise_service_externally_preferred_baseurl(exercise_service)?;
        exercise_iframe_url.set_path(&service_info.user_interface_iframe_path);
        let course_material_exercise_task = CourseMaterialExerciseTask {
            id: task.id,
            exercise_service_slug: task.exercise_type.clone(),
            exercise_slide_id: task.exercise_slide_id,
            exercise_iframe_url: Some(exercise_iframe_url.to_string()),
            pseudonumous_user_id: Some(Uuid::new_v5(
                &service_info.exercise_service_id,
                viewer_user_id.as_bytes(),
            )),
            assignment: task.assignment.clone(),
            public_spec: task.public_spec.clone(),
            model_solution_spec: task.model_solution_spec.clone(),
            previous_submission: Some(ts),
            previous_submission_grading: Some(grading.clone()),
            order_number: task.order_number,
            deleted_at: task.deleted_at,
        };
        res.push(course_material_exercise_task);
    }
    Ok(res)
}

pub async fn get_user_custom_view_exercise_tasks_by_module_and_exercise_type(
    conn: &mut PgConnection,
    exercise_type: &str,
    course_module_id: Uuid,
    user_id: Uuid,
    course_id: Uuid,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<CustomViewExerciseTasks> {
    let task_submissions =
        crate::exercise_task_submissions::get_user_latest_exercise_task_submissions_by_course_module_and_exercise_type(
            &mut *conn,
            user_id,
            exercise_type,
            course_module_id,
            course_id,
            file_store,
            app_conf,
        )
        .await?;
    let task_gradings =
        crate::exercise_task_gradings::get_user_exercise_task_gradings_by_module_and_exercise_type(
            &mut *conn,
            user_id,
            exercise_type,
            course_module_id,
            course_id,
        )
        .await?;

    let exercise_tasks = crate::exercise_tasks::get_all_exercise_tasks_by_module_and_exercise_type(
        &mut *conn,
        exercise_type,
        course_module_id,
    )
    .await?;
    let res: CustomViewExerciseTasks = CustomViewExerciseTasks {
        exercise_tasks,
        task_submissions,
        task_gradings,
    };
    Ok(res)
}

/// get all submissions for user and course module and exercise type
pub async fn get_user_latest_exercise_task_submissions_by_course_module_and_exercise_type(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_type: &str,
    module_id: Uuid,
    course_id: Uuid,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> ModelResult<Vec<CustomViewExerciseTaskSubmission>> {
    let rows = sqlx::query!(
        r#"
        SELECT DISTINCT ON (g.exercise_task_id)
        g.id,
        g.created_at,
        g.exercise_slide_submission_id,
        g.exercise_slide_id,
        g.exercise_task_id,
        g.exercise_task_grading_id,
        g.data_json,
        g.answer_kind AS "answer_kind: AnswerKind"
      FROM exercise_task_submissions g
        JOIN exercise_tasks et ON et.id = g.exercise_task_id
        JOIN exercise_slide_submissions ess ON ess.id = g.exercise_slide_submission_id
        JOIN exercises e ON e.id = ess.exercise_id
        JOIN chapters c ON c.id = e.chapter_id
      WHERE ess.user_id = $1
      AND ess.course_id = $2
      AND et.exercise_type = $3
      AND c.course_module_id = $4
      AND g.deleted_at IS NULL
      AND et.deleted_at IS NULL
      AND ess.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND c.deleted_at IS NULL
      ORDER BY g.exercise_task_id, g.created_at DESC
      "#,
        user_id,
        course_id,
        exercise_type,
        module_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let stored: Vec<StoredAnswer> = rows
        .iter()
        .map(|row| StoredAnswer {
            submission_id: row.id,
            answer_kind: row.answer_kind,
            data_json: row.data_json.clone(),
        })
        .collect();
    let mut answers = attach_answer_data(conn, &stored, file_store, app_conf).await?;
    Ok(rows
        .into_iter()
        .map(|row| CustomViewExerciseTaskSubmission {
            id: row.id,
            created_at: row.created_at,
            exercise_slide_submission_id: row.exercise_slide_submission_id,
            exercise_slide_id: row.exercise_slide_id,
            exercise_task_id: row.exercise_task_id,
            exercise_task_grading_id: row.exercise_task_grading_id,
            answer: answers.remove(&row.id),
        })
        .collect())
}

pub async fn get_ids_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT id
FROM exercise_task_submissions
WHERE exercise_slide_submission_id IN (
    SELECT id
    FROM exercise_slide_submissions
    WHERE exercise_id = $1
)
AND deleted_at IS NULL
",
        &exercise_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res.iter().map(|x| x.id).collect())
}

/// Similar to get_ids_by_exercise_id but returns the record with the highest created_at for a user_id
pub async fn get_latest_submission_ids_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT id
FROM exercise_task_submissions
WHERE exercise_slide_submission_id IN (SELECT id
    FROM (SELECT DISTINCT ON (user_id, exercise_id) *
        FROM exercise_slide_submissions
        WHERE exercise_id = $1
        AND deleted_at IS NULL
        ORDER BY user_id, exercise_id, created_at DESC) a )
    AND deleted_at IS NULL
",
        &exercise_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res.iter().map(|x| x.id).collect())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::exercise_slide_submissions::{
        NewExerciseSlideSubmission, insert_exercise_slide_submission,
    };
    use crate::exercise_task_gradings::UserPointsUpdateStrategy;
    use crate::test_helper::*;

    async fn insert_slide_submission(
        tx: &mut PgConnection,
        course_id: Uuid,
        user_id: Uuid,
        exercise_id: Uuid,
        exercise_slide_id: Uuid,
    ) -> Uuid {
        insert_exercise_slide_submission(
            tx,
            NewExerciseSlideSubmission {
                exercise_slide_id,
                course_id: Some(course_id),
                exam_id: None,
                user_id,
                exercise_id,
                user_points_update_strategy:
                    UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
            },
        )
        .await
        .unwrap()
        .id
    }

    async fn insert_file(tx: &mut PgConnection, name: &str, size_bytes: Option<i64>) -> Uuid {
        crate::file_uploads::insert(
            tx,
            name,
            &format!("uploads/{name}"),
            "application/octet-stream",
            None,
            size_bytes,
        )
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn file_answer_records_its_files_in_order() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let slide_submission_id =
            insert_slide_submission(tx.as_mut(), course_id, user_id, exercise_id, slide_id).await;
        let first = insert_file(tx.as_mut(), "a.tar.zst", Some(11)).await;
        let second = insert_file(tx.as_mut(), "b.tar.zst", None).await;

        let submission_id = insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            slide_submission_id,
            slide_id,
            task_id,
            &SubmittedAnswer::File {
                file_upload_ids: vec![first, second],
                metadata: Some(serde_json::json!({ "plugin": "owned" })),
            },
        )
        .await
        .unwrap();

        let app_conf = init_app_conf().expect("app conf");
        let submission = get_by_id(tx.as_mut(), submission_id, &init_file_store(), &app_conf)
            .await
            .unwrap();
        let AnswerData::File { files, metadata } = submission.answer.unwrap() else {
            panic!("a file answer must read back as a file answer");
        };
        assert_eq!(metadata, Some(serde_json::json!({ "plugin": "owned" })));
        assert_eq!(
            files
                .iter()
                .map(|file| (file.id, file.order_number, file.name.as_str()))
                .collect::<Vec<_>>(),
            vec![(first, 0, "a.tar.zst"), (second, 1, "b.tar.zst")]
        );
        assert_eq!(files[0].size_bytes, Some(11));
        assert_eq!(files[1].size_bytes, None);
        assert!(files[0].url.ends_with("/uploads/a.tar.zst"));
        tx.rollback().await;
    }

    /// A file answer with no files would be an answer with no content, and no database constraint
    /// can catch it because the files live in another table.
    #[tokio::test]
    async fn file_answer_without_files_is_rejected() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let slide_submission_id =
            insert_slide_submission(tx.as_mut(), course_id, user_id, exercise_id, slide_id).await;

        insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            slide_submission_id,
            slide_id,
            task_id,
            &SubmittedAnswer::File {
                file_upload_ids: Vec::new(),
                metadata: None,
            },
        )
        .await
        .expect_err("a file answer naming no files must be rejected");
        tx.rollback().await;
    }

    #[tokio::test]
    async fn json_answer_reads_back_as_json() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let slide_submission_id =
            insert_slide_submission(tx.as_mut(), course_id, user_id, exercise_id, slide_id).await;

        let submission_id = insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            slide_submission_id,
            slide_id,
            task_id,
            &SubmittedAnswer::Json {
                data: serde_json::json!({ "opaque": "plugin owned" }),
            },
        )
        .await
        .unwrap();

        let app_conf = init_app_conf().expect("app conf");
        let submission = get_by_id(tx.as_mut(), submission_id, &init_file_store(), &app_conf)
            .await
            .unwrap();
        assert_eq!(
            submission.answer,
            Some(AnswerData::Json {
                data: serde_json::json!({ "opaque": "plugin owned" })
            })
        );
        tx.rollback().await;
    }
}
