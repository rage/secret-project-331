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
RETURNING id
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

pub async fn get_filename(conn: &mut PgConnection, path: &str) -> ModelResult<String> {
    let res = sqlx::query!(
        r#"
SELECT name
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
RETURNING path
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.path)
}
