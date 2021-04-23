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

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NewCourse {
    name: String,
    slug: String,
    organization_id: Uuid,
}

pub async fn insert_course(pool: &PgPool, course: NewCourse) -> Result<Course> {
    let mut connection = pool.acquire().await?;
    let res = sqlx::query_as!(
        Course,
        r#"
    INSERT INTO
      courses(name, slug, organization_id)
    VALUES($1, $2, $3)
    RETURNING *
            "#,
        course.name,
        course.slug,
        course.organization_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

// Represents the subset of page fields that one is allowed to update in a course
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct CourseUpdate {
    name: String,
}

pub async fn update_course(
    pool: &sqlx::Pool<sqlx::Postgres>,
    course_id: Uuid,
    course_update: CourseUpdate,
) -> Result<Course> {
    let mut connection = pool.acquire().await?;
    let res = sqlx::query_as!(
        Course,
        r#"
UPDATE courses
    SET name = $1
WHERE
    id = $2
    RETURNING *
    "#,
        course_update.name,
        course_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn delete_course(pool: &sqlx::Pool<sqlx::Postgres>, course_id: Uuid) -> Result<Course> {
    let mut connection = pool.acquire().await?;
    let deleted = sqlx::query_as!(
        Course,
        r#"
UPDATE courses
    SET deleted = true
WHERE
    id = $1
RETURNING *
    "#,
        course_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(deleted)
}
