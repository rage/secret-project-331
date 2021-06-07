use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
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

pub async fn update_chapter(
    pool: &sqlx::Pool<sqlx::Postgres>,
    course_id: Uuid,
    chapter_update: ChapterUpdate,
) -> Result<Chapter> {
    let mut connection = pool.acquire().await?;
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
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn course_chapters(pool: &PgPool, course_id: Uuid) -> Result<Vec<Chapter>> {
    let mut connection = pool.acquire().await?;
    let chapters = sqlx::query_as!(
        Chapter,
        "SELECT * FROM chapters WHERE course_id = $1 AND deleted_at IS NULL;",
        course_id
    )
    .fetch_all(&mut connection)
    .await?;
    Ok(chapters)
}

pub async fn insert_chapter(pool: &PgPool, chapter: NewChapter) -> Result<Chapter> {
    let mut connection = pool.acquire().await?;
    let res = sqlx::query_as!(
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
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn delete_chapter(
    pool: &sqlx::Pool<sqlx::Postgres>,
    chapter_id: Uuid,
) -> Result<Chapter> {
    let mut connection = pool.acquire().await?;
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
    .fetch_one(&mut connection)
    .await?;
    Ok(deleted)
}
