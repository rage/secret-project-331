use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Course {
    id: Uuid,
    slug: String,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    name: String,
    organization_id: Uuid,
    deleted: bool,
}

pub async fn all_courses(pool: &PgPool) -> Result<Vec<Course>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let courses = sqlx::query_as!(Course, "SELECT * FROM courses WHERE deleted = false;")
        .fetch_all(connection)
        .await?;
    return Ok(courses);
}

pub async fn organization_courses(pool: &PgPool, organization_id: &Uuid) -> Result<Vec<Course>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let courses = sqlx::query_as!(
        Course,
        "SELECT * FROM courses WHERE organization_id = $1 AND deleted = false;",
        organization_id
    )
    .fetch_all(connection)
    .await?;
    return Ok(courses);
}
