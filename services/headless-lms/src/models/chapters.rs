use crate::{
    controllers::ApplicationError,
    models::pages::{ContentBlock, NewPage},
};
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgConnection};
use uuid::Uuid;

use super::pages::PageWithExercises;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Chapter {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub chapter_number: i32,
    pub front_page_id: Option<Uuid>,
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
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NewChapter {
    pub name: String,
    pub course_id: Uuid,
    pub chapter_number: i32,
    pub front_front_page_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ChapterUpdate {
    pub name: String,
    pub chapter_number: i32,
    pub front_front_page_id: Option<Uuid>,
}

pub async fn get_course_id(conn: &mut PgConnection, chapter_id: Uuid) -> Result<Uuid> {
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
) -> Result<Chapter> {
    let res = sqlx::query_as!(
        Chapter,
        r#"
UPDATE chapters
    SET name = $1,
    chapter_number = $2
WHERE
    id = $3
    RETURNING *
    "#,
        chapter_update.name,
        chapter_update.chapter_number,
        course_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn course_chapters(conn: &mut PgConnection, course_id: Uuid) -> Result<Vec<Chapter>> {
    let chapters = sqlx::query_as!(
        Chapter,
        "SELECT * FROM chapters WHERE course_id = $1 AND deleted_at IS NULL;",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(chapters)
}

pub async fn insert_chapter(conn: &mut PgConnection, chapter: NewChapter) -> Result<Chapter> {
    let mut tx = conn.begin().await?;

    let chapter = sqlx::query_as!(
        Chapter,
        r#"
    INSERT INTO
      chapters(name, course_id, chapter_number)
    VALUES($1, $2, $3)
    RETURNING *
            "#,
        chapter.name,
        chapter.course_id,
        chapter.chapter_number
    )
    .fetch_one(&mut tx)
    .await?;

    let chapter_frontpage_content = serde_json::to_value(vec![
        // ContentBlock::empty_block_from_name("moocfi/pages-in-chapter".to_owned()),
        ContentBlock::empty_block_from_name("moocfi/exercises-in-chapter".to_owned()),
        ContentBlock::empty_block_from_name("moocfi/chapter-progress".to_owned()),
    ])
    .map_err(|original_error| ApplicationError::InternalServerError(original_error.to_string()))?;
    let chapter_frontpage = NewPage {
        chapter_id: Some(chapter.id),
        content: chapter_frontpage_content,
        course_id: chapter.course_id,
        front_page_of_chapter_id: Some(chapter.id),
        title: chapter.name.clone(),
        url_path: format!("/chapter-{}", chapter.chapter_number),
    };
    let _page = crate::models::pages::insert_page(&mut tx, chapter_frontpage).await?;

    tx.commit().await?;
    Ok(chapter)
}

pub async fn delete_chapter(conn: &mut PgConnection, chapter_id: Uuid) -> Result<Chapter> {
    let deleted = sqlx::query_as!(
        Chapter,
        r#"
UPDATE chapters
    SET deleted_at = now()
WHERE
    id = $1
RETURNING *
    "#,
        chapter_id
    )
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}
