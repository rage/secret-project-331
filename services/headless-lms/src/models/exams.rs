use crate::models::ModelError;

use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgConnection;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, TS)]
pub struct Exam {
    id: Uuid,
    course_id: Uuid,
    course_name: String,
    name: String,
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
) -> ModelResult<Vec<Exam>> {
    let res = sqlx::query_as!(
        Exam,
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

pub async fn get_exams_for_course(conn: &mut PgConnection, course: Uuid) -> ModelResult<Vec<Exam>> {
    let res = sqlx::query_as!(
        Exam,
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
