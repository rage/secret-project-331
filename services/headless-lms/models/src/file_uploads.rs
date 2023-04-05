use crate::prelude::*;

pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    path: &str,
    mime: &str,
    uploader: Option<Uuid>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO file_uploads(path, name, mime, uploaded_by_user)
VALUES ($1, $2, $3, $4)
"#,
        path,
        name,
        mime,
        uploader
    )
    .execute(conn)
    .await?;
    Ok(())
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
