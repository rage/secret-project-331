//! Controllers for requests starting with `/api/v0/main-frontend/exercises`.

use std::collections::{HashMap, HashSet};

use futures::future;
use serde_json::Value;
use url::Url;

use headless_lms_models::exercises::Exercise;
use models::{
    exercise_service_info::ExerciseServiceInfoApi, exercise_services::ExerciseService,
    exercise_slide_submissions::ExerciseSlideSubmission,
    exercise_task_gradings::ExerciseTaskGrading, exercise_tasks::ExerciseTask,
    library::grading::AnswersRequiringAttention,
};

use crate::{domain::models_requests, prelude::*};

const EXERCISE_SERVICE_CSV_EXPORT_BATCH_SIZE: usize = 1000;

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSubmissions {
    pub data: Vec<ExerciseSlideSubmission>,
    pub total_pages: u32,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseCsvExportTaskOption {
    pub exercise_task_id: Uuid,
    pub exercise_type: String,
    pub order_number: i32,
    pub supports_csv_export_definitions: bool,
    pub supports_csv_export_answers: bool,
}

#[derive(Debug, Deserialize)]
pub struct ExerciseCsvExportQuery {
    pub exercise_task_id: Uuid,
    #[serde(default)]
    pub only_latest_per_user: bool,
}

#[derive(Debug, Clone)]
struct CsvColumnDefinition {
    key: String,
    header: String,
}

impl CsvColumnDefinition {
    fn new(key: impl Into<String>, header: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            header: header.into(),
        }
    }
}

#[derive(Debug, Serialize)]
struct ExerciseDefinitionsCsvExportRequestItem<'a> {
    private_spec: &'a Option<Value>,
}

#[derive(Debug, Serialize)]
struct ExerciseAnswersCsvExportRequestItem<'a> {
    private_spec: &'a Option<Value>,
    answer: &'a Option<Value>,
    grading: Option<&'a ExerciseTaskGrading>,
    model_solution_spec: &'a Option<Value>,
}

/// Returns true if the endpoint path is non-empty.
fn csv_endpoint_is_supported(path: &Option<String>) -> bool {
    path.as_ref().is_some_and(|value| !value.trim().is_empty())
}

/// Parses and validates endpoint path or returns BadRequest if missing/empty.
fn get_csv_export_endpoint_path(
    path: &Option<String>,
    endpoint_name: &str,
) -> Result<String, ControllerError> {
    let endpoint_path = path
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                format!(
                    "Exercise service does not support {} CSV export.",
                    endpoint_name
                ),
                None,
            )
        })?;
    Ok(endpoint_path.to_string())
}

/// Fetches exercise service from DB and service info via HTTP; prefers internal_url, falls back to public_url.
async fn fetch_exercise_service_and_info(
    conn: &mut PgConnection,
    exercise_type: &str,
) -> models::ModelResult<(ExerciseService, ExerciseServiceInfoApi)> {
    let exercise_service =
        models::exercise_services::get_exercise_service_by_exercise_type(conn, exercise_type)
            .await?;
    let internal_url = exercise_service.internal_url.clone();
    let public_url = exercise_service.public_url.clone();
    let slug = exercise_service.slug.clone();
    let service_info_url = match internal_url.as_ref() {
        Some(url_str) => match url_str.parse::<Url>() {
            Ok(url) => url,
            Err(error) => {
                warn!(
                    exercise_service_slug = ?slug,
                    ?error,
                    "Internal URL for service info is invalid, falling back to public URL."
                );
                public_url.parse()?
            }
        },
        None => public_url.parse()?,
    };
    let service_info = models_requests::fetch_service_info_fast(service_info_url).await?;
    Ok((exercise_service, service_info))
}

/// Builds final CSV endpoint URL using internally preferred base URL.
fn build_service_endpoint_url(
    exercise_service: &ExerciseService,
    endpoint_path: &str,
) -> Result<Url, ControllerError> {
    let mut url = models::exercise_services::get_exercise_service_internally_preferred_baseurl(
        exercise_service,
    )?;
    url.set_path(endpoint_path);
    Ok(url)
}

/// Selects task by id or returns BadRequest if not found in list.
fn get_selected_task(
    tasks: &[ExerciseTask],
    exercise_task_id: Uuid,
) -> Result<ExerciseTask, ControllerError> {
    tasks
        .iter()
        .find(|task| task.id == exercise_task_id)
        .cloned()
        .ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                "Selected task does not belong to this exercise.".to_string(),
                None,
            )
        })
}

/// Merges base and service columns ensuring unique keys and mapping; errors on duplicate original service keys or final name collisions.
fn build_final_columns(
    base_columns: &[CsvColumnDefinition],
    service_columns: &[models_requests::ExerciseServiceCsvExportColumn],
) -> Result<(Vec<CsvColumnDefinition>, HashMap<String, String>), ControllerError> {
    let mut final_columns = base_columns.to_vec();
    let mut used_keys = base_columns
        .iter()
        .map(|column| column.key.clone())
        .collect::<HashSet<_>>();
    let mut service_key_to_final_key = HashMap::new();

    for column in service_columns {
        let key = column.key.trim();
        if key.is_empty() {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Exercise service CSV export response contains an empty column key.".to_string(),
                None,
            ));
        }
        if service_key_to_final_key.contains_key(key) {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                format!(
                    "Exercise service CSV export response contains duplicate original column key '{}'.",
                    key
                ),
                None,
            ));
        }

        let mut final_key = key.to_string();
        if used_keys.contains(&final_key) {
            final_key = format!("service_{}", final_key);
        }
        if used_keys.contains(&final_key) {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                format!(
                    "Exercise service CSV export response contains duplicate column key '{}'.",
                    key
                ),
                None,
            ));
        }

        used_keys.insert(final_key.clone());
        service_key_to_final_key.insert(key.to_string(), final_key.clone());
        final_columns.push(CsvColumnDefinition::new(final_key, column.header.clone()));
    }

    Ok((final_columns, service_key_to_final_key))
}

/// Builds key -> column index map for final columns.
fn build_column_index_map(columns: &[CsvColumnDefinition]) -> HashMap<String, usize> {
    columns
        .iter()
        .enumerate()
        .map(|(index, column)| (column.key.clone(), index))
        .collect()
}

/// Converts scalar JSON to CSV string; errors on array/object.
fn scalar_json_to_csv_value(value: &Value) -> Result<String, ControllerError> {
    match value {
        Value::Null => Ok(String::new()),
        Value::Bool(value) => Ok(value.to_string()),
        Value::Number(value) => Ok(value.to_string()),
        Value::String(value) => Ok(value.clone()),
        Value::Array(_) | Value::Object(_) => Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Exercise service CSV export response contains a non-scalar cell value.".to_string(),
            None,
        )),
    }
}

/// Writes CSV rows merging base_row and service rows; validates keys against mapping.
fn write_csv_rows(
    writer: &mut csv::Writer<Vec<u8>>,
    final_columns: &[CsvColumnDefinition],
    column_index_map: &HashMap<String, usize>,
    service_key_to_final_key: &HashMap<String, String>,
    base_row: &HashMap<String, String>,
    rows: &[HashMap<String, Value>],
) -> Result<(), ControllerError> {
    let write_single_row = |service_row: Option<&HashMap<String, Value>>,
                            writer: &mut csv::Writer<Vec<u8>>|
     -> Result<(), ControllerError> {
        let mut record = vec![String::new(); final_columns.len()];

        for (base_key, base_value) in base_row {
            let index = column_index_map.get(base_key).ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    format!(
                        "Base CSV column '{}' is missing from the final header.",
                        base_key
                    ),
                    None,
                )
            })?;
            record[*index] = base_value.clone();
        }

        if let Some(row) = service_row {
            for (service_key, value) in row {
                let final_key = service_key_to_final_key.get(service_key).ok_or_else(|| {
                    ControllerError::new(
                        ControllerErrorType::BadRequest,
                        format!(
                            "Exercise service CSV export response contains an unknown column key '{}'.",
                            service_key
                        ),
                        None,
                    )
                })?;
                let index = column_index_map.get(final_key).ok_or_else(|| {
                    ControllerError::new(
                        ControllerErrorType::InternalServerError,
                        format!(
                            "CSV column '{}' is missing from the final header.",
                            final_key
                        ),
                        None,
                    )
                })?;
                record[*index] = scalar_json_to_csv_value(value)?;
            }
        }

        writer.write_record(record).map_err(|error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                format!("Failed to write CSV row: {}", error),
                Some(error.into()),
            )
        })?;
        Ok(())
    };

    if rows.is_empty() {
        write_single_row(None, writer)?;
    } else {
        for row in rows {
            write_single_row(Some(row), writer)?;
        }
    }

    Ok(())
}

/// Finalizes writer into bytes and maps CSV errors to ControllerError.
fn csv_writer_into_bytes(writer: csv::Writer<Vec<u8>>) -> Result<Vec<u8>, ControllerError> {
    writer.into_inner().map_err(|error| {
        let csv_error = error.into_error();
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            format!("Failed to finalize CSV export: {}", csv_error),
            Some(csv_error.into()),
        )
    })
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id` - Returns a single exercise.
 */
#[instrument(skip(pool))]
async fn get_exercise(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Exercise>> {
    let mut conn = pool.acquire().await?;

    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;

    let token = if let Some(course_id) = exercise.course_id {
        authorize(&mut conn, Act::View, Some(user.id), Res::Course(course_id)).await?
    } else if let Some(exam_id) = exercise.exam_id {
        authorize(&mut conn, Act::View, Some(user.id), Res::Exam(exam_id)).await?
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Exercise is not associated with a course or exam".to_string(),
            None,
        ));
    };

    token.authorized_ok(web::Json(exercise))
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/submissions` - Returns an exercise's submissions.
 */
#[instrument(skip(pool))]
async fn get_exercise_submissions(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseSubmissions>> {
    let mut conn = pool.acquire().await?;

    let token = match models::exercises::get_course_or_exam_id(&mut conn, *exercise_id).await? {
        CourseOrExamId::Course(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(id)).await?
        }
        CourseOrExamId::Exam(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(id)).await?
        }
    };

    let submission_count = models::exercise_slide_submissions::exercise_slide_submission_count(
        &mut conn,
        *exercise_id,
    );
    let mut conn = pool.acquire().await?;
    let submissions = models::exercise_slide_submissions::exercise_slide_submissions(
        &mut conn,
        *exercise_id,
        *pagination,
    );
    let (submission_count, submissions) = future::try_join(submission_count, submissions).await?;

    let total_pages = pagination.total_pages(submission_count);

    token.authorized_ok(web::Json(ExerciseSubmissions {
        data: submissions,
        total_pages,
    }))
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/submissions/user/:user_id` - Returns an exercise's submissions for a user.
 */
#[instrument(skip(pool, user))]
async fn get_exercise_submissions_for_user(
    pool: web::Data<PgPool>,
    ids: web::Path<(Uuid, Uuid)>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseSlideSubmission>>> {
    let (exercise_id, user_id) = ids.into_inner();
    let mut conn = pool.acquire().await?;

    let target_user = models::users::get_by_id(&mut conn, user_id).await?;

    let course_or_exam_id =
        models::exercises::get_course_or_exam_id(&mut conn, exercise_id).await?;

    let token = match course_or_exam_id {
        CourseOrExamId::Course(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(id)).await?
        }
        CourseOrExamId::Exam(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(id)).await?
        }
    };

    let submissions = models::exercise_slide_submissions::get_users_submissions_for_exercise(
        &mut conn,
        target_user.id,
        exercise_id,
    )
    .await?;

    token.authorized_ok(web::Json(submissions))
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/csv-export-task-options` - Returns available exercise tasks and CSV export support flags for each task's exercise service.
 */
#[instrument(skip(pool))]
async fn get_exercise_csv_export_task_options(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseCsvExportTaskOption>>> {
    let mut conn = pool.acquire().await?;
    let token = match models::exercises::get_course_or_exam_id(&mut conn, *exercise_id).await? {
        CourseOrExamId::Course(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(id)).await?
        }
        CourseOrExamId::Exam(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(id)).await?
        }
    };

    let mut tasks =
        models::exercise_tasks::get_exercise_tasks_by_exercise_id(&mut conn, *exercise_id).await?;
    tasks.sort_by_key(|task| (task.order_number, task.id));

    let unique_exercise_types = tasks
        .iter()
        .map(|task| task.exercise_type.clone())
        .collect::<HashSet<_>>();

    let mut exercise_type_support = HashMap::new();
    for exercise_type in unique_exercise_types {
        let support = match fetch_exercise_service_and_info(&mut conn, &exercise_type).await {
            Ok((_service, service_info)) => (
                csv_endpoint_is_supported(&service_info.csv_export_definitions_endpoint_path),
                csv_endpoint_is_supported(&service_info.csv_export_answers_endpoint_path),
            ),
            Err(error) => {
                warn!(
                    exercise_type = ?exercise_type,
                    ?error,
                    "Could not fetch exercise service info for CSV export support detection."
                );
                (false, false)
            }
        };
        exercise_type_support.insert(exercise_type, support);
    }

    let options = tasks
        .into_iter()
        .map(|task| {
            let (supports_csv_export_definitions, supports_csv_export_answers) =
                exercise_type_support
                    .get(&task.exercise_type)
                    .copied()
                    .unwrap_or((false, false));
            ExerciseCsvExportTaskOption {
                exercise_task_id: task.id,
                exercise_type: task.exercise_type,
                order_number: task.order_number,
                supports_csv_export_definitions,
                supports_csv_export_answers,
            }
        })
        .collect::<Vec<_>>();

    token.authorized_ok(web::Json(options))
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/export-definitions-csv` - Exports one exercise task definition as CSV using the task's exercise service.
 */
#[instrument(skip(pool))]
async fn export_exercise_task_definitions_csv(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    query: web::Query<ExerciseCsvExportQuery>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = match models::exercises::get_course_or_exam_id(&mut conn, *exercise_id).await? {
        CourseOrExamId::Course(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(id)).await?
        }
        CourseOrExamId::Exam(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(id)).await?
        }
    };

    let tasks =
        models::exercise_tasks::get_exercise_tasks_by_exercise_id(&mut conn, *exercise_id).await?;
    let selected_task = get_selected_task(&tasks, query.exercise_task_id)?;

    let (exercise_service, service_info) =
        fetch_exercise_service_and_info(&mut conn, &selected_task.exercise_type).await?;
    let endpoint_path = get_csv_export_endpoint_path(
        &service_info.csv_export_definitions_endpoint_path,
        "definitions",
    )?;
    let endpoint_url = build_service_endpoint_url(&exercise_service, &endpoint_path)?;

    let request_items = vec![ExerciseDefinitionsCsvExportRequestItem {
        private_spec: &selected_task.private_spec,
    }];
    let response =
        models_requests::post_exercise_service_csv_export_request(endpoint_url, &request_items)
            .await?;
    if response.results.len() != request_items.len() {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            format!(
                "Exercise service returned {} results for {} definition items.",
                response.results.len(),
                request_items.len()
            ),
            None,
        ));
    }

    let base_columns = vec![CsvColumnDefinition::new(
        "exercise_task_id",
        "Exercise task id",
    )];
    let (final_columns, service_key_to_final_key) =
        build_final_columns(&base_columns, &response.columns)?;
    let column_index_map = build_column_index_map(&final_columns);

    let mut writer = csv::Writer::from_writer(Vec::new());
    writer
        .write_record(final_columns.iter().map(|column| column.header.as_str()))
        .map_err(|error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                format!("Failed to write CSV headers: {}", error),
                Some(error.into()),
            )
        })?;

    let mut base_row = HashMap::new();
    base_row.insert("exercise_task_id".to_string(), selected_task.id.to_string());
    write_csv_rows(
        &mut writer,
        &final_columns,
        &column_index_map,
        &service_key_to_final_key,
        &base_row,
        &response.results[0].rows,
    )?;

    let csv_bytes = csv_writer_into_bytes(writer)?;
    let content_disposition = format!(
        "attachment; filename=\"exercise-{}-definitions-{}.csv\"",
        *exercise_id, selected_task.id
    );

    token.authorized_ok(
        HttpResponse::Ok()
            .append_header(("Content-Disposition", content_disposition))
            .append_header(("Content-Type", "text/csv; charset=utf-8"))
            .body(csv_bytes),
    )
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/export-answers-csv` - Exports all answers for one exercise task as CSV using the task's exercise service.
 */
#[instrument(skip(pool))]
async fn export_exercise_task_answers_csv(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    query: web::Query<ExerciseCsvExportQuery>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = match models::exercises::get_course_or_exam_id(&mut conn, *exercise_id).await? {
        CourseOrExamId::Course(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(id)).await?
        }
        CourseOrExamId::Exam(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(id)).await?
        }
    };

    let tasks =
        models::exercise_tasks::get_exercise_tasks_by_exercise_id(&mut conn, *exercise_id).await?;
    let selected_task = get_selected_task(&tasks, query.exercise_task_id)?;

    let (exercise_service, service_info) =
        fetch_exercise_service_and_info(&mut conn, &selected_task.exercise_type).await?;
    let endpoint_path =
        get_csv_export_endpoint_path(&service_info.csv_export_answers_endpoint_path, "answers")?;
    let endpoint_url = build_service_endpoint_url(&exercise_service, &endpoint_path)?;

    let export_data = if query.only_latest_per_user {
        models::exercise_task_submissions::get_csv_export_data_by_exercise_and_task_latest_per_user(
            &mut conn,
            *exercise_id,
            selected_task.id,
        )
        .await?
    } else {
        models::exercise_task_submissions::get_csv_export_data_by_exercise_and_task(
            &mut conn,
            *exercise_id,
            selected_task.id,
        )
        .await?
    };
    let submission_ids = export_data
        .iter()
        .map(|submission| submission.exercise_task_submission_id)
        .collect::<Vec<_>>();
    let gradings_by_submission_id =
        models::exercise_task_gradings::get_by_exercise_task_submission_ids(
            &mut conn,
            &submission_ids,
        )
        .await?;

    let base_columns = vec![
        CsvColumnDefinition::new(
            "exercise_slide_submission_id",
            "Exercise slide submission id",
        ),
        CsvColumnDefinition::new("exercise_task_submission_id", "Exercise task submission id"),
        CsvColumnDefinition::new("exercise_task_id", "Exercise task id"),
        CsvColumnDefinition::new("exercise_id", "Exercise id"),
        CsvColumnDefinition::new("user_id", "User id"),
        CsvColumnDefinition::new("submitted_at", "Submitted at"),
    ];

    let mut writer = csv::Writer::from_writer(Vec::new());
    let mut expected_service_columns: Option<Vec<models_requests::ExerciseServiceCsvExportColumn>> =
        None;
    let mut final_columns: Option<Vec<CsvColumnDefinition>> = None;
    let mut column_index_map = HashMap::new();
    let mut service_key_to_final_key = HashMap::new();

    for export_chunk in export_data.chunks(EXERCISE_SERVICE_CSV_EXPORT_BATCH_SIZE) {
        let mut request_items = Vec::with_capacity(export_chunk.len());
        let mut base_rows = Vec::with_capacity(export_chunk.len());
        for submission in export_chunk {
            let grading = gradings_by_submission_id.get(&submission.exercise_task_submission_id);
            request_items.push(ExerciseAnswersCsvExportRequestItem {
                private_spec: &selected_task.private_spec,
                answer: &submission.answer,
                grading,
                model_solution_spec: &selected_task.model_solution_spec,
            });
            let mut base_row = HashMap::new();
            base_row.insert(
                "exercise_slide_submission_id".to_string(),
                submission.exercise_slide_submission_id.to_string(),
            );
            base_row.insert(
                "exercise_task_submission_id".to_string(),
                submission.exercise_task_submission_id.to_string(),
            );
            base_row.insert(
                "exercise_task_id".to_string(),
                submission.exercise_task_id.to_string(),
            );
            base_row.insert(
                "exercise_id".to_string(),
                submission.exercise_id.to_string(),
            );
            base_row.insert("user_id".to_string(), submission.user_id.to_string());
            base_row.insert(
                "submitted_at".to_string(),
                submission.submitted_at.to_rfc3339(),
            );
            base_rows.push(base_row);
        }

        let response = models_requests::post_exercise_service_csv_export_request(
            endpoint_url.clone(),
            &request_items,
        )
        .await?;

        if response.results.len() != request_items.len() {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                format!(
                    "Exercise service returned {} results for {} answer items.",
                    response.results.len(),
                    request_items.len()
                ),
                None,
            ));
        }

        if let Some(expected_columns) = &expected_service_columns {
            if expected_columns != &response.columns {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "Exercise service returned different CSV columns for different answer batches."
                        .to_string(),
                    None,
                ));
            }
        } else {
            expected_service_columns = Some(response.columns.clone());
        }

        if final_columns.is_none() {
            let (columns, service_key_mapping) =
                build_final_columns(&base_columns, &response.columns)?;
            column_index_map = build_column_index_map(&columns);
            service_key_to_final_key = service_key_mapping;
            writer
                .write_record(columns.iter().map(|column| column.header.as_str()))
                .map_err(|error| {
                    ControllerError::new(
                        ControllerErrorType::InternalServerError,
                        format!("Failed to write CSV headers: {}", error),
                        Some(error.into()),
                    )
                })?;
            final_columns = Some(columns);
        }

        let final_columns_ref = final_columns.as_ref().ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "CSV columns were not initialized.".to_string(),
                None,
            )
        })?;

        for (chunk_row_index, result) in response.results.iter().enumerate() {
            let base_row = base_rows.get(chunk_row_index).ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Could not map CSV export response rows back to request items.".to_string(),
                    None,
                )
            })?;
            write_csv_rows(
                &mut writer,
                final_columns_ref,
                &column_index_map,
                &service_key_to_final_key,
                base_row,
                &result.rows,
            )?;
        }
    }

    if final_columns.is_none() {
        let columns = base_columns;
        writer
            .write_record(columns.iter().map(|column| column.header.as_str()))
            .map_err(|error| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    format!("Failed to write CSV headers: {}", error),
                    Some(error.into()),
                )
            })?;
    }

    let csv_bytes = csv_writer_into_bytes(writer)?;
    let content_disposition = format!(
        "attachment; filename=\"exercise-{}-answers-{}.csv\"",
        *exercise_id, selected_task.id
    );

    token.authorized_ok(
        HttpResponse::Ok()
            .append_header(("Content-Disposition", content_disposition))
            .append_header(("Content-Type", "text/csv; charset=utf-8"))
            .body(csv_bytes),
    )
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/answers-requiring-attention` - Returns an exercise's answers requiring attention.
 */
#[instrument(skip(pool))]
async fn get_exercise_answers_requiring_attention(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<web::Json<AnswersRequiringAttention>> {
    let mut conn = pool.acquire().await?;
    let token = match models::exercises::get_course_or_exam_id(&mut conn, *exercise_id).await? {
        CourseOrExamId::Course(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(id)).await?
        }
        CourseOrExamId::Exam(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(id)).await?
        }
    };
    let res = models::library::grading::get_paginated_answers_requiring_attention_for_exercise(
        &mut conn,
        *exercise_id,
        *pagination,
        user.id,
        models_requests::fetch_service_info,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/exercises/:course_id/exercises-by-course-id` - Returns all exercises for a course with course_id
 */
pub async fn get_exercises_by_course_id(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Exercise>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let mut exercises =
        models::exercises::get_exercises_by_course_id(&mut conn, *course_id).await?;

    exercises.sort_by_key(|e| (e.chapter_id, e.page_id, e.order_number));

    token.authorized_ok(web::Json(exercises))
}

#[derive(Deserialize)]
pub struct ResetExercisesPayload {
    pub user_ids: Vec<Uuid>,
    pub exercise_ids: Vec<Uuid>,
    pub threshold: Option<f64>,
    pub reset_all_below_max_points: bool,
    pub reset_only_locked_peer_reviews: bool,
}

/**
POST `/api/v0/main-frontend/exercises/:course_id/reset-exercises-for-selected-users` - Resets all selected exercises for selected users and then logs the resets to exercise_reset_logs table
 */
pub async fn reset_exercises_for_selected_users(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<ResetExercisesPayload>,
) -> ControllerResult<web::Json<i32>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    // Gets all valid users and their related exercises using the given filters
    let users_and_exercises = models::exercises::collect_user_ids_and_exercise_ids_for_reset(
        &mut conn,
        &payload.user_ids,
        &payload.exercise_ids,
        payload.threshold,
        payload.reset_all_below_max_points,
        payload.reset_only_locked_peer_reviews,
    )
    .await?;

    // Resets exercises for selected users and add the resets to a log
    let reset_results = models::exercises::reset_exercises_for_selected_users(
        &mut conn,
        &users_and_exercises,
        Some(user.id),
        *course_id,
        Some("reset-by-staff".to_string()),
    )
    .await?;

    let successful_resets_count = reset_results.len();

    token.authorized_ok(web::Json(successful_resets_count as i32))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{exercise_id}/submissions",
        web::get().to(get_exercise_submissions),
    )
    .route(
        "/{exercise_id}/csv-export-task-options",
        web::get().to(get_exercise_csv_export_task_options),
    )
    .route(
        "/{exercise_id}/export-definitions-csv",
        web::get().to(export_exercise_task_definitions_csv),
    )
    .route(
        "/{exercise_id}/export-answers-csv",
        web::get().to(export_exercise_task_answers_csv),
    )
    .route(
        "/{exercise_id}/answers-requiring-attention",
        web::get().to(get_exercise_answers_requiring_attention),
    )
    .route(
        "/{course_id}/exercises-by-course-id",
        web::get().to(get_exercises_by_course_id),
    )
    .route(
        "/{course_id}/reset-exercises-for-selected-users",
        web::post().to(reset_exercises_for_selected_users),
    )
    .route("/{exercise_id}", web::get().to(get_exercise))
    .route(
        "/{exercise_id}/submissions/user/{user_id}",
        web::get().to(get_exercise_submissions_for_user),
    );
}
