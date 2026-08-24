//! Recording the files a submission was made from when the submitter named none.
//!
//! A native client uploads its files first and names them in the submit, so the host knows them
//! without reading the answer. An answer made in an exercise service's IFrame names nothing: its
//! files are inside the service's own answer blob, which the host must not interpret. The service
//! itself can, so the host asks it — over the `answer_files_endpoint_path` it declares — and stores
//! what comes back as ordinary `file_uploads`. Both origins therefore end up in
//! `exercise_task_submission_files`, which is the only thing `download_submission` reads.

use crate::domain::models_requests;
use crate::prelude::*;
use base64::Engine;
use headless_lms_utils::strings::generate_random_string;
use std::path::Path;

/// Object-store namespace for files the host extracted from a service's answer. Kept apart from
/// the native client's uploads because nothing binds these to a pending submit — they are recorded
/// against a submission from the moment they exist, so the client-upload reaper must not see them.
const ANSWER_FILE_PATH_PREFIX: &str = "exercise-answer-files";

/// Ceiling on what one answer may materialize, mirroring the native client's per-batch upload
/// limit. Without it a service could turn one submit into an unbounded number of object writes.
const MAX_ANSWER_FILES: usize = 10;
const MAX_ANSWER_FILE_BYTES: usize = 100 * 1024 * 1024;

/// Creates a submission of an answer that names no host-stored uploads, recording the files the
/// answer consists of against it.
///
/// The counterpart of the exercise-services client API's submit, which records the uploads the
/// client named instead. Both leave the same rows behind, which is what makes
/// `GET submissions/{id}/download` return the same shape for either origin.
pub async fn submit_recording_answer_files(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: models::exercises::Exercise,
    submission: &models::library::grading::StudentExerciseSlideSubmission,
    jwt_key: std::sync::Arc<crate::domain::models_requests::JwtKey>,
    file_store: &dyn FileStore,
) -> Result<models::library::grading::StudentExerciseSlideSubmissionResult, ControllerError> {
    // Ahead of the transaction because it makes an HTTP hop per task, and the exercise service is
    // free to take its time.
    let mut materialized: Vec<MaterializedAnswerFiles> =
        Vec::with_capacity(submission.exercise_task_submissions.len());
    for task_submission in &submission.exercise_task_submissions {
        let exercise_task =
            models::exercise_tasks::get_exercise_task_by_id(conn, task_submission.exercise_task_id)
                .await?;
        let files = match materialize_answer_files(
            conn,
            &exercise_task,
            &task_submission.data_json,
            file_store,
        )
        .await
        {
            Ok(files) => files,
            Err(error) => {
                discard_materialized(file_store, &materialized).await;
                return Err(error);
            }
        };
        materialized.push(MaterializedAnswerFiles {
            exercise_task_id: task_submission.exercise_task_id,
            files,
        });
    }

    // The submission and the record of which files it was made from must land together: a
    // submission without that record is one `download_submission` can never serve.
    let mut tx = conn.begin().await?;
    let result = create_and_record(
        &mut tx,
        user_id,
        exercise,
        submission,
        jwt_key,
        &materialized,
    )
    .await;
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            // A failed grading hop discards its own writes and records a rejected submission
            // instead; committing is what keeps that audit row rather than rolling it back too.
            if let Err(commit_error) = tx.commit().await {
                error!("Failed to commit after a failed submission: {commit_error}");
            }
            discard_materialized(file_store, &materialized).await;
            return Err(error);
        }
    };
    tx.commit().await?;
    Ok(result)
}

async fn create_and_record(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    exercise: models::exercises::Exercise,
    submission: &models::library::grading::StudentExerciseSlideSubmission,
    jwt_key: std::sync::Arc<crate::domain::models_requests::JwtKey>,
    materialized: &[MaterializedAnswerFiles],
) -> Result<models::library::grading::StudentExerciseSlideSubmissionResult, ControllerError> {
    let result = crate::domain::exercises::process_submission(
        &mut *tx, user_id, exercise, submission, jwt_key,
    )
    .await?;
    for entry in materialized {
        if entry.files.is_empty() {
            continue;
        }
        let created = result
            .exercise_task_submission_results
            .iter()
            .find(|result| result.submission.exercise_task_id == entry.exercise_task_id)
            .ok_or_else(|| {
                controller_err!(
                    InternalServerError,
                    format!(
                        "No submission was created for exercise task {}",
                        entry.exercise_task_id
                    )
                )
            })?;
        record_answer_files(tx, created.submission.id, user_id, &entry.files).await?;
    }
    Ok(result)
}

async fn discard_materialized(
    file_store: &dyn FileStore,
    materialized: &[MaterializedAnswerFiles],
) {
    for entry in materialized {
        discard_written_answer_files(file_store, &entry.files).await;
    }
}

/// A file written to the object store but not yet recorded, so a caller that fails can delete it.
pub struct WrittenAnswerFile {
    pub path: String,
    pub name: String,
    pub mime: String,
}

/// The files of one task's answer, ready to be recorded once the submission row exists.
pub struct MaterializedAnswerFiles {
    pub exercise_task_id: Uuid,
    pub files: Vec<WrittenAnswerFile>,
}

/// Asks the task's exercise service which files the answer consists of and writes them to the
/// object store. Returns an empty list when the service declares no such endpoint, which is the
/// one case in which an IFrame-made submission stays undownloadable.
///
/// Writes objects but no rows: the caller records the `file_uploads` inside the transaction that
/// creates the submission, so a rollback cannot leave a file pointing at no submission. The
/// returned paths are the caller's to delete if it does roll back.
pub async fn materialize_answer_files(
    conn: &mut PgConnection,
    exercise_task: &models::exercise_tasks::ExerciseTask,
    answer: &serde_json::Value,
    file_store: &dyn FileStore,
) -> Result<Vec<WrittenAnswerFile>, ControllerError> {
    let exercise_service = models::exercise_services::get_exercise_service_by_exercise_type(
        conn,
        &exercise_task.exercise_type,
    )
    .await?;
    let service_info =
        models::exercise_service_info::get_service_info(conn, exercise_service.id).await?;
    let Some(url) =
        models::exercise_services::get_internal_answer_files_url(&exercise_service, &service_info)?
    else {
        return Ok(Vec::new());
    };

    let reported =
        models_requests::post_answer_files_request(url, exercise_task.public_spec.as_ref(), answer)
            .await?;
    if reported.len() > MAX_ANSWER_FILES {
        return Err(controller_err!(
            InternalServerError,
            format!(
                "The exercise service '{}' reported {} files for one answer, more than the {MAX_ANSWER_FILES} allowed",
                exercise_task.exercise_type,
                reported.len()
            )
        ));
    }

    let mut written = Vec::with_capacity(reported.len());
    let mut total_bytes = 0usize;
    for file in reported {
        let contents = base64::engine::general_purpose::STANDARD
            .decode(&file.data)
            .map_err(|error| {
                controller_err!(
                    InternalServerError,
                    format!(
                        "The exercise service '{}' reported file '{}' with data that is not base64",
                        exercise_task.exercise_type, file.name
                    ),
                    anyhow::Error::from(error)
                )
            })?;
        total_bytes += contents.len();
        if total_bytes > MAX_ANSWER_FILE_BYTES {
            return Err(controller_err!(
                InternalServerError,
                format!(
                    "The exercise service '{}' reported more than {MAX_ANSWER_FILE_BYTES} bytes of files for one answer",
                    exercise_task.exercise_type
                )
            ));
        }
        let mime = file
            .mime
            .filter(|mime| !mime.is_empty())
            .unwrap_or_else(|| "application/octet-stream".to_string());
        let path = format!("{ANSWER_FILE_PATH_PREFIX}/{}", generate_random_string(32));
        file_store.upload(Path::new(&path), contents, &mime).await?;
        written.push(WrittenAnswerFile {
            path,
            name: file.name,
            mime,
        });
    }
    Ok(written)
}

/// Records already-written answer files against a task submission, in the order the service
/// reported them. Runs in the caller's transaction so the rows and the submission land together.
pub async fn record_answer_files(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    exercise_task_submission_id: Uuid,
    uploader: Uuid,
    files: &[WrittenAnswerFile],
) -> Result<(), ControllerError> {
    let mut file_upload_ids = Vec::with_capacity(files.len());
    for file in files {
        file_upload_ids.push(
            models::file_uploads::insert(tx, &file.name, &file.path, &file.mime, Some(uploader))
                .await?,
        );
    }
    models::exercise_task_submission_files::insert_many(
        tx,
        exercise_task_submission_id,
        &file_upload_ids,
    )
    .await?;
    Ok(())
}

/// Deletes objects written for a submission that never landed. Reported, not propagated: the
/// caller is already failing for a reason the user needs to see.
pub async fn discard_written_answer_files(file_store: &dyn FileStore, files: &[WrittenAnswerFile]) {
    for file in files {
        if let Err(error) = file_store.delete(Path::new(&file.path)).await {
            error!(
                "Failed to delete the answer file {} of a submission that was not created: {error}",
                file.path
            );
        }
    }
}
