use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgPool};
use uuid::Uuid;

use super::{
    chapters::{course_chapters, Chapter},
    pages::{course_pages, Page},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Course {
    pub id: Uuid,
    pub slug: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub organization_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct CourseStructure {
    pub course: Course,
    pub pages: Vec<Page>,
    pub chapters: Vec<Chapter>,
}

pub async fn all_courses(pool: &PgPool) -> Result<Vec<Course>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let courses = sqlx::query_as!(Course, "SELECT * FROM courses WHERE deleted_at IS NULL;")
        .fetch_all(connection)
        .await?;
    Ok(courses)
}

pub async fn get_course(pool: &PgPool, course_id: Uuid) -> Result<Course> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let course = sqlx::query_as!(Course, "SELECT * FROM courses WHERE id = $1;", course_id)
        .fetch_one(connection)
        .await?;
    Ok(course)
}

pub async fn get_course_structure(pool: &PgPool, course_id: Uuid) -> Result<CourseStructure> {
    let course = get_course(pool, course_id).await?;
    let pages = course_pages(pool, course_id).await?;
    let chapters = course_chapters(pool, course_id).await?;
    Ok(CourseStructure {
        course,
        pages,
        chapters,
    })
}

pub async fn organization_courses(pool: &PgPool, organization_id: &Uuid) -> Result<Vec<Course>> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let courses = sqlx::query_as!(
        Course,
        "SELECT * FROM courses WHERE organization_id = $1 AND deleted_at IS NULL;",
        organization_id
    )
    .fetch_all(connection)
    .await?;
    Ok(courses)
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
    SET deleted_at = now()
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
