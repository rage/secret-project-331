use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageAudioFiles {
    pub id: Uuid,
    pub page_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub path: String,
    pub mime_type: String,
}

pub async fn insert_page_audio(
    conn: &mut PgConnection,
    page_id: Uuid,
    audio_file_path: &str,
    mime_type: &str,
) -> ModelResult<()> {
    sqlx::query!(
        r"
INSERT INTO page_audio_files (
  page_id,
  path,
  mime_type
)
VALUES($1, $2, $3)
      ",
        page_id,
        audio_file_path,
        mime_type,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete_page_audio(conn: &mut PgConnection, id: Uuid) -> ModelResult<String> {
    let response = sqlx::query!(
        r#"
UPDATE page_audio_files
SET deleted_at = now()
WHERE id = $1
RETURNING path
      "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(response.path)
}

pub async fn get_page_audio_files(
    conn: &mut PgConnection,
    page_id: Uuid,
) -> ModelResult<Vec<PageAudioFiles>> {
    let audio_files = sqlx::query_as!(
        PageAudioFiles,
        "
SELECT *
FROM page_audio_files
WHERE page_id = $1
AND deleted_at IS NULL;
",
        page_id
    )
    .fetch_all(conn)
    .await?;
    Ok(audio_files)
}

pub async fn get_page_audio_files_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<PageAudioFiles> {
    let audio_files = sqlx::query_as!(
        PageAudioFiles,
        "
SELECT *
FROM page_audio_files
WHERE id = $1
AND deleted_at IS NULL;
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(audio_files)
}
