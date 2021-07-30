use super::{pages::Page, ModelResult};
use crate::{models::pages::NewPage, utils::document_schema_processor::GutenbergBlock};
use std::path::PathBuf;

use crate::{utils::file_store::FileStore, ApplicationConfiguration};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgConnection};
use ts_rs::TS;
use uuid::Uuid;

use super::pages::PageWithExercises;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct DatabaseChapter {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_image: Option<String>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct Chapter {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_image_url: Option<String>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
}

impl Chapter {
    pub fn from_database_chapter(
        chapter: &DatabaseChapter,
        file_store: &impl FileStore,
        app_conf: &ApplicationConfiguration,
    ) -> Self {
        let chapter_image_url = chapter.chapter_image.as_ref().map(|image| {
            let path = PathBuf::from(image);
            file_store.get_download_url(path.as_path(), app_conf)
        });
        Self {
            id: chapter.id,
            created_at: chapter.created_at,
            updated_at: chapter.updated_at,
            name: chapter.name.clone(),
            course_id: chapter.course_id,
            deleted_at: chapter.deleted_at,
            chapter_image_url,
            chapter_number: chapter.chapter_number,
            front_page_id: chapter.front_page_id,
            opens_at: chapter.opens_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, TS)]
#[serde(rename_all = "snake_case")]
pub enum ChapterStatus {
    Open,
    Closed,
}

impl Default for ChapterStatus {
    fn default() -> Self {
        Self::Closed
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ChapterPagesWithExercises {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_number: i32,
    pub pages: Vec<PageWithExercises>,
}

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NewChapter {
    pub name: String,
    pub course_id: Uuid,
    pub chapter_number: i32,
    pub front_front_page_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct ChapterUpdate {
    pub name: String,
    pub chapter_number: i32,
    pub front_front_page_id: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    course_id: Uuid,
    chapter_number: i32,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO chapters (name, course_id, chapter_number)
VALUES ($1, $2, $3)
RETURNING id
",
        name,
        course_id,
        chapter_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn set_front_page(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    front_page_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE chapters SET front_page_id = $1 WHERE id = $2",
        front_page_id,
        chapter_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_opens_at(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    opens_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE chapters SET opens_at = $1 WHERE id = $2",
        opens_at,
        chapter_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Checks the opens_at field for the chapter and compares it to the current time. If null, the chapter is always open.
pub async fn is_open(conn: &mut PgConnection, chapter_id: Uuid) -> ModelResult<bool> {
    let res = sqlx::query!(
        r#"
SELECT opens_at
FROM chapters
WHERE id = $1
"#,
        chapter_id
    )
    .fetch_one(conn)
    .await?;
    let open = res.opens_at.map(|o| o <= Utc::now()).unwrap_or(true);
    Ok(open)
}

pub async fn get_chapter(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<DatabaseChapter> {
    let chapter = sqlx::query_as!(
        DatabaseChapter,
        "
SELECT *
from chapters
where id = $1;",
        chapter_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(chapter)
}

pub async fn get_course_id(conn: &mut PgConnection, chapter_id: Uuid) -> ModelResult<Uuid> {
    let course_id = sqlx::query!("SELECT course_id from chapters where id = $1", chapter_id)
        .fetch_one(conn)
        .await?
        .course_id;
    Ok(course_id)
}

pub async fn update_chapter(
    conn: &mut PgConnection,
    course_id: Uuid,
    chapter_update: ChapterUpdate,
) -> ModelResult<DatabaseChapter> {
    let res = sqlx::query_as!(
        DatabaseChapter,
        r#"
UPDATE chapters
SET name = $1,
  chapter_number = $2
WHERE id = $3
RETURNING *;
    "#,
        chapter_update.name,
        chapter_update.chapter_number,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_chapter_image(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    chapter_image: Option<String>,
) -> ModelResult<DatabaseChapter> {
    let updated_chapter = sqlx::query_as!(
        DatabaseChapter,
        "
UPDATE chapters
SET chapter_image = $1
WHERE id = $2
RETURNING *;",
        chapter_image,
        chapter_id
    )
    .fetch_one(conn)
    .await?;
    Ok(updated_chapter)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct ChapterWithStatus {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
    pub opens_at: Option<DateTime<Utc>>,
    pub status: ChapterStatus,
}

pub async fn course_chapters(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<DatabaseChapter>> {
    let chapters = sqlx::query_as!(
        DatabaseChapter,
        r#"
SELECT id,
  created_at,
  updated_at,
  name,
  course_id,
  deleted_at,
  chapter_image,
  chapter_number,
  front_page_id,
  opens_at
FROM chapters
WHERE course_id = $1
  AND deleted_at IS NULL;
"#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(chapters)
}

pub async fn insert_chapter(
    conn: &mut PgConnection,
    chapter: NewChapter,
) -> ModelResult<(DatabaseChapter, Page)> {
    let mut tx = conn.begin().await?;

    let chapter = sqlx::query_as!(
        DatabaseChapter,
        r#"
INSERT INTO chapters(name, course_id, chapter_number)
VALUES($1, $2, $3)
RETURNING *;
"#,
        chapter.name,
        chapter.course_id,
        chapter.chapter_number
    )
    .fetch_one(&mut tx)
    .await?;

    let chapter_frontpage_content = serde_json::to_value(vec![
        GutenbergBlock::empty_block_from_name("moocfi/pages-in-chapter".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/chapter-progress".to_string()),
    ])?;
    let chapter_frontpage = NewPage {
        chapter_id: Some(chapter.id),
        content: chapter_frontpage_content,
        course_id: chapter.course_id,
        front_page_of_chapter_id: Some(chapter.id),
        title: chapter.name.clone(),
        url_path: format!("/chapter-{}", chapter.chapter_number),
    };
    let page = crate::models::pages::insert_page(&mut tx, chapter_frontpage).await?;

    tx.commit().await?;
    Ok((chapter, page))
}

pub async fn delete_chapter(
    conn: &mut PgConnection,
    chapter_id: Uuid,
) -> ModelResult<DatabaseChapter> {
    let deleted = sqlx::query_as!(
        DatabaseChapter,
        r#"
UPDATE chapters
SET deleted_at = now()
WHERE id = $1
RETURNING *;
"#,
        chapter_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}
