use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Page {
    id: Uuid,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    course_id: Uuid,
    content: serde_json::Value,
    url_path: String,
    title: String,
    deleted: bool,
}

// Represents the subset of page fields that are required to create a new page.
#[derive(Debug, Serialize, Deserialize)]
pub struct NewPage {
    content: serde_json::Value,
    url_path: String,
    title: String,
    course_id: Uuid,
}

// Represents the subset of page fields that the user is allowed to modify.
#[derive(Debug, Serialize, Deserialize)]
pub struct PageUpdate {
    content: serde_json::Value,
    url_path: String,
    title: String,
}

pub async fn course_pages(pool: &PgPool, course_id: Uuid) -> Result<Vec<Page>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let pages = sqlx::query_as!(
        Page,
        "SELECT * FROM pages WHERE course_id = $1 AND deleted = false;",
        course_id
    )
    .fetch_all(connection)
    .await?;
    return Ok(pages);
}

pub async fn get_page(pool: &PgPool, page_id: Uuid) -> Result<Page> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let pages = sqlx::query_as!(Page, "SELECT * FROM pages WHERE id = $1;", page_id)
        .fetch_one(connection)
        .await?;
    return Ok(pages);
}

pub async fn update_page(pool: &PgPool, page_id: Uuid, page_update: PageUpdate) -> Result<Page> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let page = sqlx::query_as!(
        Page,
        r#"
    UPDATE pages
    SET
      content = $2,
      url_path = $3,
      title = $4
    WHERE id = $1
    RETURNING *
            "#,
        page_id,
        page_update.content,
        page_update.url_path.trim(),
        page_update.title.trim()
    )
    .fetch_one(connection)
    .await?;
    return Ok(page);
}

pub async fn insert_page(pool: &PgPool, new_page: NewPage) -> Result<Page> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let page = sqlx::query_as!(
        Page,
        r#"
  INSERT INTO
    pages(course_id, content, url_path, title)
  VALUES($1, $2, $3, $4)
  RETURNING *
          "#,
        new_page.course_id,
        new_page.content,
        new_page.url_path.trim(),
        new_page.title.trim()
    )
    .fetch_one(connection)
    .await?;
    return Ok(page);
}

pub async fn delete_page(pool: &PgPool, page_id: Uuid) -> Result<Page> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let page = sqlx::query_as!(
        Page,
        r#"
  UPDATE pages
  SET
    deleted = true
  WHERE id = $1
  RETURNING *
          "#,
        page_id,
    )
    .fetch_one(connection)
    .await?;
    return Ok(page);
}
