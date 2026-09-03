//! The files an exercise task's specs reference.
//!
//! An exercise service declares them, the same way an answer names its files: the host stores
//! specs as opaque blobs, so a declaration is the only way it can know that a stored file is still
//! in use. The private spec's files are declared in the editor's `current-state` message, and each
//! derived spec's in the response of the endpoint that produced it.
//!
//! The kinds are tracked apart because a derived spec can name a file the private spec never did:
//! a service may upload while deriving, through `SpecRequest.upload_url`, which is how tmc stores
//! the template students download.
//!
//! Used only to keep [`crate::exercise_spec_uploads`]' reaper off files that are still referenced.

use crate::prelude::*;
use std::collections::HashMap;

/// Which of a task's three specs a reference belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "exercise_spec_kind", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SpecKind {
    Private,
    Public,
    ModelSolution,
}

/// Replaces what one of a task's specs declares with `file_upload_ids`.
///
/// Scoped to a single kind: storing a derived spec must not disturb what the private spec declares,
/// and vice versa. Rewriting in full is what makes a dropped file reclaimable — the rows for files
/// no longer named are soft-deleted, and once no history version names them either the upload
/// becomes reapable. Re-declaring a file that is already recorded leaves its row alone, so a save
/// that changes nothing does not churn the table.
pub async fn replace_for_exercise_task(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    spec_kind: SpecKind,
    file_upload_ids: &[Uuid],
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    sqlx::query!(
        "
UPDATE exercise_task_spec_files
SET deleted_at = now()
WHERE exercise_task_id = $1
  AND spec_kind = $3
  AND deleted_at IS NULL
  AND NOT file_upload_id = ANY($2)
",
        exercise_task_id,
        file_upload_ids,
        spec_kind as SpecKind
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "
INSERT INTO exercise_task_spec_files (exercise_task_id, file_upload_id, spec_kind)
SELECT $1,
  file_upload_id,
  $3
FROM UNNEST($2::uuid []) AS t(file_upload_id)
WHERE NOT EXISTS (
    SELECT 1
    FROM exercise_task_spec_files AS existing
    WHERE existing.exercise_task_id = $1
      AND existing.file_upload_id = t.file_upload_id
      AND existing.spec_kind = $3
      AND existing.deleted_at IS NULL
  )
",
        exercise_task_id,
        file_upload_ids,
        spec_kind as SpecKind
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// What each task's spec of the given kind declares, keyed by task. Tasks that declare nothing are
/// absent from the map rather than present with an empty list.
pub async fn get_by_exercise_task_ids(
    conn: &mut PgConnection,
    exercise_task_ids: &[Uuid],
    spec_kind: SpecKind,
) -> ModelResult<HashMap<Uuid, Vec<Uuid>>> {
    let rows = sqlx::query!(
        "
SELECT exercise_task_id,
  file_upload_id
FROM exercise_task_spec_files
WHERE exercise_task_id = ANY($1)
  AND spec_kind = $2
  AND deleted_at IS NULL
",
        exercise_task_ids,
        spec_kind as SpecKind
    )
    .fetch_all(conn)
    .await?;
    let mut by_task: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    for row in rows {
        by_task
            .entry(row.exercise_task_id)
            .or_default()
            .push(row.file_upload_id);
    }
    Ok(by_task)
}

/// What one of a task's specs declares, in no particular order: the order of a spec's files is the
/// exercise service's business and lives inside the spec.
pub async fn get_for_exercise_task(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    spec_kind: SpecKind,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        "
SELECT file_upload_id
FROM exercise_task_spec_files
WHERE exercise_task_id = $1
  AND spec_kind = $2
  AND deleted_at IS NULL
",
        exercise_task_id,
        spec_kind as SpecKind
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
