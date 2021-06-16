use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
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

pub async fn all_courses(conn: &mut PgConnection) -> Result<Vec<Course>> {
    let courses = sqlx::query_as!(Course, r#"SELECT * FROM courses WHERE deleted_at IS NULL;"#)
        .fetch_all(conn)
        .await?;
    Ok(courses)
}

pub async fn get_course(conn: &mut PgConnection, course_id: Uuid) -> Result<Course> {
    let course = sqlx::query_as!(Course, r#"SELECT * FROM courses WHERE id = $1;"#, course_id)
        .fetch_one(conn)
        .await?;
    Ok(course)
}

pub async fn get_organization_id(conn: &mut PgConnection, id: Uuid) -> Result<Uuid> {
    let organization_id = sqlx::query!("SELECT organization_id FROM courses WHERE id = $1", id)
        .fetch_one(conn)
        .await?
        .organization_id;
    Ok(organization_id)
}

pub async fn get_course_structure(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> Result<CourseStructure> {
    let course = get_course(conn, course_id).await?;
    let pages = course_pages(conn, course_id).await?;
    let chapters = course_chapters(conn, course_id).await?;
    Ok(CourseStructure {
        course,
        pages,
        chapters,
    })
}

pub async fn organization_courses(
    conn: &mut PgConnection,
    organization_id: &Uuid,
) -> Result<Vec<Course>> {
    let courses = sqlx::query_as!(
        Course,
        r#"SELECT * FROM courses WHERE organization_id = $1 AND deleted_at IS NULL;"#,
        organization_id
    )
    .fetch_all(conn)
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

pub async fn insert_course(conn: &mut PgConnection, course: NewCourse) -> Result<Course> {
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
    .fetch_one(conn)
    .await?;
    Ok(res)
}

// Represents the subset of page fields that one is allowed to update in a course
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct CourseUpdate {
    name: String,
}

pub async fn update_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    course_update: CourseUpdate,
) -> Result<Course> {
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
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete_course(conn: &mut PgConnection, course_id: Uuid) -> Result<Course> {
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
    .fetch_one(conn)
    .await?;
    Ok(deleted)
}
