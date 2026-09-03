//! Files uploaded through the exercise-service upload route, which is how a teacher's CMS editor
//! and the playground store files.
//!
//! These are recorded so that abandoned ones can be reclaimed. Nothing else can: the host never
//! reads a spec blob, so a stored file's only reference may live inside content the host cannot
//! parse. The counterpart is [`crate::exercise_task_spec_files`], where an exercise service
//! declares which files its spec actually names.

use crate::prelude::*;
use chrono::Duration;

/// Cap on one reaper run's listing, bounding its object-store fan-out and its runtime under the
/// CronJob deadline. A backlog is worked off over successive runs.
const REAP_BATCH_LIMIT: i64 = 1000;

/// Records freshly uploaded files so the reaper can later tell an abandoned one from a file it
/// knows nothing about.
pub async fn insert_many(
    conn: &mut PgConnection,
    exercise_service_slug: &str,
    uploaded_by_user: Option<Uuid>,
    file_upload_ids: &[Uuid],
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exercise_spec_uploads (file_upload_id, exercise_service_slug, uploaded_by_user)
SELECT file_upload_id,
  $2,
  $3
FROM UNNEST($1::uuid []) AS t(file_upload_id)
",
        file_upload_ids,
        exercise_service_slug,
        uploaded_by_user
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// An upload the reaper may remove: old enough, and named by no spec anywhere.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReapableUpload {
    pub id: Uuid,
    pub file_upload_id: Uuid,
    /// Object-store path of the file to remove.
    pub path: String,
}

/// Uploads older than seven days that no live spec and no page-history version references, oldest
/// first, at most [`REAP_BATCH_LIMIT`] of them.
///
/// Seven days is generous on purpose: the window has to cover the gap between uploading a file and
/// saving the page that references it, which is a teacher's editing session and can span days.
///
/// `FROM exercise_spec_uploads` is the safety property of this whole feature, not an optimisation:
/// `file_uploads` also holds CMS media, organization images, certificates and answer files, none of
/// which are recorded here, so the host cannot tell whether one is still needed. Widening this
/// query to `file_uploads` would silently destroy course media. Never do it.
///
/// The `declares_spec_files` gate is the second half of that safety. A service that does not
/// declare what its specs reference gives the host no evidence at all that a file is unused, so
/// none of its uploads are ever considered — the flag exists precisely so services written before
/// the declarations do not lose files. The playground is exempt because it has no specs and no
/// exercise service behind its reserved slug: what it uploads is throwaway by construction.
///
/// Both reference tables are consulted, and the history one is why this reaper collects less than
/// it looks like it should: a restore has to be able to bring back a version whose specs name a
/// file, so a file that ever reached a saved spec stays out of reach for as long as its history is
/// kept. What is left to collect is uploads that never made it into a save — a file the teacher
/// replaced before saving, or an editing session that was closed.
///
/// Progress is tracked by `file_uploads.deleted_at`, not by this table's: the upload is retired
/// first and the object removed afterwards, so a row whose object delete failed still has a live
/// `file_uploads` row and comes back on the next run. Filtering on `u.deleted_at IS NULL` instead
/// would make every transient object-store error orphan its object permanently.
pub async fn get_reapable(conn: &mut PgConnection) -> ModelResult<Vec<ReapableUpload>> {
    let res = sqlx::query_as!(
        ReapableUpload,
        "
SELECT u.id,
  u.file_upload_id,
  f.path
FROM exercise_spec_uploads AS u
  JOIN file_uploads AS f ON f.id = u.file_upload_id
WHERE f.deleted_at IS NULL
  AND u.created_at < now() - interval '7 days'
  AND (
    u.exercise_service_slug = 'playground'
    OR EXISTS (
      SELECT 1
      FROM exercise_services AS s
        JOIN exercise_service_info AS i ON i.exercise_service_id = s.id
      WHERE s.slug = u.exercise_service_slug
        AND s.deleted_at IS NULL
        AND i.declares_spec_files
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_task_spec_files AS t
    WHERE t.file_upload_id = u.file_upload_id
      AND t.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM page_history_spec_files AS h
    WHERE h.file_upload_id = u.file_upload_id
      AND h.deleted_at IS NULL
  )
ORDER BY u.created_at
LIMIT $1
",
        REAP_BATCH_LIMIT
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Retires an upload. Idempotent, so a run retrying a failed object delete can call it again.
///
/// Re-checks the two reference tables under a row lock, and reports `false` if a save has come to
/// reference the upload since `get_reapable` listed it. The lock is taken in a statement of its own
/// because under READ COMMITTED a statement's snapshot is fixed when it starts and Postgres
/// refreshes only the row an `UPDATE` locks, never the rows its subqueries read: a single locking
/// `UPDATE` would block on a concurrent save, unblock, and then evaluate `NOT EXISTS` against a
/// snapshot from before that save committed.
pub async fn mark_reaped(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let mut tx = conn.begin().await?;
    let locked = sqlx::query_scalar!(
        "
SELECT id
FROM exercise_spec_uploads
WHERE id = $1
FOR UPDATE
",
        id
    )
    .fetch_optional(&mut *tx)
    .await?;
    if locked.is_none() {
        tx.rollback().await?;
        return Ok(false);
    }
    let retired = sqlx::query_scalar!(
        "
UPDATE exercise_spec_uploads AS u
SET deleted_at = COALESCE(u.deleted_at, now())
WHERE u.id = $1
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_task_spec_files AS t
    WHERE t.file_upload_id = u.file_upload_id
      AND t.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM page_history_spec_files AS h
    WHERE h.file_upload_id = u.file_upload_id
      AND h.deleted_at IS NULL
  )
RETURNING u.id
",
        id
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(retired.is_some())
}

/// The recorded upload for a file, if any. `deleted` marks one the reaper has retired.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecUpload {
    pub id: Uuid,
    pub file_upload_id: Uuid,
    pub deleted: bool,
}

pub async fn get_by_file_upload_id(
    conn: &mut PgConnection,
    file_upload_id: Uuid,
) -> ModelResult<Option<SpecUpload>> {
    let res = sqlx::query!(
        "
SELECT id,
  file_upload_id,
  deleted_at
FROM exercise_spec_uploads
WHERE file_upload_id = $1
",
        file_upload_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res.map(|row| SpecUpload {
        id: row.id,
        file_upload_id: row.file_upload_id,
        deleted: row.deleted_at.is_some(),
    }))
}

/// Ages a recorded upload, so a test can reach the retention window without waiting a week.
pub async fn backdate(
    conn: &mut PgConnection,
    file_upload_id: Uuid,
    age: Duration,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_spec_uploads
SET created_at = now() - $2::interval
WHERE file_upload_id = $1
",
        file_upload_id,
        age as Duration
    )
    .execute(conn)
    .await?;
    Ok(())
}
