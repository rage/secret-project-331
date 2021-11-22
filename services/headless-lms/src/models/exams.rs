use crate::models::{courses::Course, ModelError};

use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgConnection;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, TS)]
pub struct Exam {
    id: Uuid,
    name: String,
    page_id: Uuid,
    courses: Vec<Course>,
}

#[derive(Debug, Serialize, TS)]
pub struct CourseExam {
    id: Uuid,
    course_id: Uuid,
    course_name: String,
    name: String,
}

pub async fn get(conn: &mut PgConnection, id: Uuid) -> ModelResult<Exam> {
    let exam = sqlx::query!(
        "
SELECT exams.id,
  exams.name,
  pages.id AS page_id
FROM exams
  JOIN pages ON pages.exam_id = exams.id
WHERE exams.id = $1
",
        id
    )
    .fetch_one(&mut *conn)
    .await?;
    let courses = sqlx::query_as!(
        Course,
        "
SELECT id,
  slug,
  created_at,
  updated_at,
  name,
  organization_id,
  deleted_at,
  language_code,
  copied_from,
  content_search_language::text,
  course_language_group_id
FROM courses
  JOIN course_exams ON courses.id = course_exams.course_id
WHERE course_exams.exam_id = $1
",
        id
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(Exam {
        id: exam.id,
        name: exam.name,
        page_id: exam.page_id,
        courses,
    })
}

pub async fn insert(
    conn: &mut PgConnection,
    id: Uuid,
    name: &str,
    opens_at: Option<DateTime<Utc>>,
    duration_minutes: Option<i32>,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exams (id, name, opens_at, duration_minutes)
VALUES ($1, $2, $3, $4)
",
        id,
        name,
        opens_at,
        duration_minutes
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn edit(
    conn: &mut PgConnection,
    id: Uuid,
    name: Option<&str>,
    opens_at: Option<DateTime<Utc>>,
    duration_minutes: Option<i32>,
) -> ModelResult<()> {
    if duration_minutes.map(|i| i > 0).unwrap_or_default() {
        return Err(ModelError::PreconditionFailed(
            "Exam duration has to be positive".to_string(),
        ));
    }
    sqlx::query!(
        "
UPDATE exams
SET name = COALESCE($2, name),
  opens_at = $3,
  duration_minutes = $4
WHERE id = $1
",
        id,
        name,
        opens_at,
        duration_minutes,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_course(conn: &mut PgConnection, id: Uuid, course: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_exams (course_id, exam_id)
VALUES ($1, $2)
",
        course,
        id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn unset_course(conn: &mut PgConnection, id: Uuid, course: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
DELETE FROM course_exams
WHERE exam_id = $1
  AND course_id = $2
",
        id,
        course
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_exams_for_organization(
    conn: &mut PgConnection,
    organization: Uuid,
) -> ModelResult<Vec<CourseExam>> {
    let res = sqlx::query_as!(
        CourseExam,
        "
SELECT exams.id,
    courses.id as course_id,
    courses.name as course_name,
    exams.name
FROM exams
JOIN courses ON organization_id = $1
JOIN course_exams ON exam_id = exams.id AND course_id = courses.id
",
        organization
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_exams_for_course(
    conn: &mut PgConnection,
    course: Uuid,
) -> ModelResult<Vec<CourseExam>> {
    let res = sqlx::query_as!(
        CourseExam,
        "
SELECT exams.id,
    courses.id as course_id,
    courses.name as course_name,
    exams.name
FROM exams
JOIN course_exams ON course_id = $1
JOIN courses ON courses.id = $1
",
        course
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn enroll(conn: &mut PgConnection, exam_id: Uuid, user_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exam_enrollments (exam_id, user_id)
VALUES ($1, $2)
",
        exam_id,
        user_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn start(conn: &mut PgConnection, exam_id: Uuid, user_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exam_enrollments
SET started_at = now()
WHERE exam_id = $1
  AND user_id = $2
  AND started_at IS NULL
",
        exam_id,
        user_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, TS)]
pub struct ExamEnrollment {
    user_id: Uuid,
    exam_id: Uuid,
    started_at: Option<DateTime<Utc>>,
}

pub async fn get_enrollment(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Option<ExamEnrollment>> {
    let res = sqlx::query_as!(
        ExamEnrollment,
        "
SELECT user_id,
  exam_id,
  started_at
FROM exam_enrollments
WHERE exam_id = $1
  AND user_id = $2
",
        exam_id,
        user_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}
