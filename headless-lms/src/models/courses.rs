use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Course {
    id: Uuid,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    name: String,
}

pub async fn all_courses(pool: &PgPool) -> Result<Vec<Course>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let courses = sqlx::query_as!(Course, "SELECT * FROM courses;")
        .fetch_all(connection)
        .await?;
    return Ok(courses);
}
