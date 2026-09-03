//! The files each page-history version's specs reference.
//!
//! Append-only, because history is. A restore has to be able to bring back a version whose specs
//! name these files, so recording them here keeps [`crate::exercise_spec_uploads`]' reaper away
//! from a file for as long as any snapshot names it.

use crate::prelude::*;

/// Records the files the specs of one history version name. Duplicates within `file_upload_ids`
/// collapse: several tasks in a page may name the same file, and one row per version and file is
/// all a reference check needs.
pub async fn insert_many(
    conn: &mut PgConnection,
    page_history_id: Uuid,
    file_upload_ids: &[Uuid],
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO page_history_spec_files (page_history_id, file_upload_id)
SELECT DISTINCT $1::uuid,
  file_upload_id
FROM UNNEST($2::uuid []) AS t(file_upload_id)
",
        page_history_id,
        file_upload_ids
    )
    .execute(conn)
    .await?;
    Ok(())
}
