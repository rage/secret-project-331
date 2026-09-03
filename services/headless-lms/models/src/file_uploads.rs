use crate::prelude::*;
use chrono::Duration;

/// Records a stored object. `size_bytes` is the byte count measured while receiving it; `None`
/// where the upload path does not count bytes.
pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    path: &str,
    mime: &str,
    uploader: Option<Uuid>,
    size_bytes: Option<i64>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO file_uploads(path, name, mime, uploaded_by_user, size_bytes)
VALUES ($1, $2, $3, $4, $5)
RETURNING *
"#,
        path,
        name,
        mime,
        uploader,
        size_bytes
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// A stored file's name and object-store path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileUploadRef {
    pub id: Uuid,
    pub name: String,
    pub path: String,
}

/// The named files, in unspecified order and omitting deleted ones. Callers that need a
/// particular order must impose it themselves.
pub async fn get_many(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<Vec<FileUploadRef>> {
    let res = sqlx::query_as!(
        FileUploadRef,
        "
SELECT id,
  name,
  path
FROM file_uploads
WHERE id = ANY($1)
  AND deleted_at IS NULL
",
        ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_filename(conn: &mut PgConnection, path: &str) -> ModelResult<String> {
    let res = sqlx::query!(
        r#"
SELECT *
FROM file_uploads
WHERE path = $1
"#,
        path,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.name)
}

pub async fn delete_and_fetch_path(conn: &mut PgConnection, id: Uuid) -> ModelResult<String> {
    let res = sqlx::query!(
        "
UPDATE file_uploads
SET deleted_at = now()
WHERE id = $1
AND deleted_at IS NULL
RETURNING *
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.path)
}

/// Moves an upload's creation time `age` into the past, to bring it within a retention window.
///
/// Shifts the row rather than the clock because the retention filters compare against Postgres
/// `now()`, which no Rust-side clock reaches.
pub async fn backdate(conn: &mut PgConnection, id: Uuid, age: Duration) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE file_uploads SET created_at = now() - $2::interval WHERE id = $1",
        id,
        age as Duration
    )
    .execute(conn)
    .await?;
    Ok(())
}
