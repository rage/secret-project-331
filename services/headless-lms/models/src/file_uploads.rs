use crate::prelude::*;

pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    path: &str,
    mime: &str,
    uploader: Option<Uuid>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO file_uploads(path, name, mime, uploaded_by_user)
VALUES ($1, $2, $3, $4)
RETURNING *
"#,
        path,
        name,
        mime,
        uploader
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
