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
