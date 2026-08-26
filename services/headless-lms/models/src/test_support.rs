//! Database operations that only tests need, kept in the models crate so they stay `query!`-checked.
//!
//! Test modules must not write SQL of their own, and a `query!` inside a `#[cfg(test)]` block is not
//! an option either: `bin/sqlx-prepare` caches the models **lib** target only, so a macro that is
//! compiled solely under `cfg(test)` has no offline metadata and breaks every offline build. Living
//! here — compiled into the lib, never gated — is what makes these both checked and cached.
//!
//! Nothing outside tests may call these: they exist to force fixture state that no production code
//! path is allowed to produce.

use crate::prelude::*;

/// Retires an answer upload the way the reaper does, so a test can observe the expired-upload paths.
pub async fn soft_delete_answer_upload(
    conn: &mut PgConnection,
    file_upload_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_answer_uploads
SET deleted_at = now()
WHERE file_upload_id = $1
  AND deleted_at IS NULL
",
        file_upload_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The binding row's id for an uploaded file.
pub async fn answer_upload_id(conn: &mut PgConnection, file_upload_id: Uuid) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        "SELECT id FROM exercise_answer_uploads WHERE file_upload_id = $1",
        file_upload_id
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// How many slide submissions a user has made to an exercise.
pub async fn slide_submission_count(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    user_id: Uuid,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        "
SELECT count(*)
FROM exercise_slide_submissions
WHERE exercise_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
",
        exercise_id,
        user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(count.unwrap_or(0))
}

/// A submission's stored answer kind, as the database spells it.
pub async fn answer_kind_text(conn: &mut PgConnection, submission_id: Uuid) -> ModelResult<String> {
    let kind = sqlx::query_scalar!(
        r#"SELECT answer_kind::text AS "kind!" FROM exercise_task_submissions WHERE id = $1"#,
        submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(kind)
}

/// The file ids a submission recorded, paired with their positions, in stored order.
pub async fn submission_file_positions(
    conn: &mut PgConnection,
    submission_id: Uuid,
) -> ModelResult<Vec<(Uuid, i32)>> {
    let rows = sqlx::query!(
        "
SELECT file_upload_id,
  order_number
FROM exercise_task_submission_files
WHERE exercise_task_submission_id = $1
  AND deleted_at IS NULL
ORDER BY order_number
",
        submission_id
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.file_upload_id, row.order_number))
        .collect())
}

/// Shifts a submission's creation time, because every row in one test transaction shares `now()`
/// and ordering is otherwise unobservable.
pub async fn shift_submission_created_at(
    conn: &mut PgConnection,
    submission_id: Uuid,
    seconds: f64,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_task_submissions
SET created_at = now() + make_interval(secs => $2)
WHERE id = $1
",
        submission_id,
        seconds
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Soft-deletes a task submission.
pub async fn soft_delete_task_submission(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE exercise_task_submissions SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Soft-deletes a slide submission.
pub async fn soft_delete_slide_submission(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE exercise_slide_submissions SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Soft-deletes one submission-to-file link.
pub async fn soft_delete_submission_file(
    conn: &mut PgConnection,
    submission_id: Uuid,
    file_upload_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_task_submission_files
SET deleted_at = now()
WHERE exercise_task_submission_id = $1
  AND file_upload_id = $2
  AND deleted_at IS NULL
",
        submission_id,
        file_upload_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Moves an exercise's deadline into the past.
pub async fn expire_exercise_deadline(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE exercises SET deadline = now() - interval '1 day' WHERE id = $1",
        exercise_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Leaves an exercise with no tries at all, so every slide is exhausted from the start.
pub async fn exhaust_exercise_tries(conn: &mut PgConnection, exercise_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercises
SET limit_number_of_tries = TRUE,
  max_tries_per_slide = 0
WHERE id = $1
",
        exercise_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// One live answer-upload binding, for asserting what a upload route recorded.
pub struct AnswerUploadBinding {
    pub file_upload_id: Uuid,
    pub exercise_id: Uuid,
    pub user_id: Uuid,
    pub origin: String,
}

/// The live bindings for the given uploaded files.
pub async fn answer_upload_bindings(
    conn: &mut PgConnection,
    file_upload_ids: &[Uuid],
) -> ModelResult<Vec<AnswerUploadBinding>> {
    let rows = sqlx::query!(
        r#"
SELECT file_upload_id,
  exercise_id,
  user_id,
  origin::text AS "origin!"
FROM exercise_answer_uploads
WHERE file_upload_id = ANY($1)
  AND deleted_at IS NULL
"#,
        file_upload_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| AnswerUploadBinding {
            file_upload_id: row.file_upload_id,
            exercise_id: row.exercise_id,
            user_id: row.user_id,
            origin: row.origin,
        })
        .collect())
}

/// `chrono` durations do not bind directly, and the conversion only fails for a span far larger
/// than any test uses.
fn as_interval(age: chrono::Duration) -> ModelResult<sqlx::postgres::types::PgInterval> {
    sqlx::postgres::types::PgInterval::try_from(age)
        .map_err(|err| model_err!(Generic, format!("Unrepresentable interval: {err}")))
}

/// Backdates an uploaded file, so an age filter can be exercised.
pub async fn backdate_file_upload(
    conn: &mut PgConnection,
    file_upload_id: Uuid,
    age: chrono::Duration,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE file_uploads SET created_at = now() - $2::interval WHERE id = $1",
        file_upload_id,
        as_interval(age)?
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Backdates an answer upload's binding row.
pub async fn backdate_answer_upload(
    conn: &mut PgConnection,
    file_upload_id: Uuid,
    age: chrono::Duration,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE exercise_answer_uploads SET created_at = now() - $2::interval WHERE file_upload_id = $1",
        file_upload_id,
        as_interval(age)?
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// How many rejected slide submissions a user has on a slide.
pub async fn rejected_slide_submission_count(
    conn: &mut PgConnection,
    exercise_slide_id: Uuid,
    user_id: Uuid,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        "
SELECT count(*)
FROM rejected_exercise_slide_submissions
WHERE exercise_slide_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
",
        exercise_slide_id,
        user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(count.unwrap_or(0))
}
