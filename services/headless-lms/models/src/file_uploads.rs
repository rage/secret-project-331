use crate::prelude::*;

pub async fn insert(
    conn: &mut PgConnection,
    path: &str,
    mime: &str,
    uploader: Option<Uuid>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO file_uploads(path, mime, uploaded_by_user)
VALUES ($1, $2, $3)
"#,
        path,
        mime,
        uploader
    )
    .execute(conn)
    .await?;
    Ok(())
}
