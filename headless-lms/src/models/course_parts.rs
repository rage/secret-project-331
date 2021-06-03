use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use super::pages::PageWithExercises;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct CoursePart {
    pub id: Uuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<NaiveDateTime>,
    pub part_number: i32,
    pub page_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct CoursePartPagesWithExercises {
    pub id: Uuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub name: String,
    pub course_id: Uuid,
    pub deleted_at: Option<NaiveDateTime>,
    pub part_number: i32,
    pub pages: Vec<PageWithExercises>,
}

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NewCoursePart {
    pub name: String,
    pub course_id: Uuid,
    pub part_number: i32,
    pub page_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct CoursePartUpdate {
    pub name: String,
    pub part_number: i32,
    pub page_id: Option<Uuid>,
}

pub async fn update_course_part(
    pool: &sqlx::Pool<sqlx::Postgres>,
    course_id: Uuid,
    course_part_update: CoursePartUpdate,
) -> Result<CoursePart> {
    let mut connection = pool.acquire().await?;
    let res = sqlx::query_as!(
        CoursePart,
        r#"
UPDATE course_parts
    SET name = $1,
    part_number = $2
WHERE
    id = $3
    RETURNING *
    "#,
        course_part_update.name,
        course_part_update.part_number,
        course_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn course_course_parts(pool: &PgPool, course_id: Uuid) -> Result<Vec<CoursePart>> {
    let mut connection = pool.acquire().await?;
    let course_parts = sqlx::query_as!(
        CoursePart,
        "SELECT * FROM course_parts WHERE course_id = $1 AND deleted_at IS NULL;",
        course_id
    )
    .fetch_all(&mut connection)
    .await?;
    Ok(course_parts)
}

pub async fn insert_course_part(pool: &PgPool, course_part: NewCoursePart) -> Result<CoursePart> {
    let mut connection = pool.acquire().await?;
    let res = sqlx::query_as!(
        CoursePart,
        r#"
    INSERT INTO
      course_parts(name, course_id, part_number)
    VALUES($1, $2, $3)
    RETURNING *
            "#,
        course_part.name,
        course_part.course_id,
        course_part.part_number
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn delete_course_part(
    pool: &sqlx::Pool<sqlx::Postgres>,
    course_part_id: Uuid,
) -> Result<CoursePart> {
    let mut connection = pool.acquire().await?;
    let deleted = sqlx::query_as!(
        CoursePart,
        r#"
UPDATE course_parts
    SET deleted_at = now()
WHERE
    id = $1
RETURNING *
    "#,
        course_part_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(deleted)
}
