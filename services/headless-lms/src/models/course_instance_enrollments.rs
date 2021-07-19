use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct CourseInstanceEnrollment {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
    pub current: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    course_instance_id: Uuid,
    current: bool,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_instance_enrollments (user_id, course_id, course_instance_id, current)
VALUES ($1, $2, $3, $4)
",
        user_id,
        course_id,
        course_instance_id,
        current
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NewCourseInstanceEnrollment {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
    pub current: bool,
}

pub async fn insert_enrollment(
    conn: &mut PgConnection,
    enrollment: NewCourseInstanceEnrollment,
) -> ModelResult<CourseInstanceEnrollment> {
    let enrollment = sqlx::query_as!(
        CourseInstanceEnrollment,
        "
INSERT INTO course_instance_enrollments (user_id, course_id, course_instance_id, current)
VALUES ($1, $2, $3, $4)
RETURNING *;
",
        enrollment.user_id,
        enrollment.course_id,
        enrollment.course_instance_id,
        enrollment.current
    )
    .fetch_one(conn)
    .await?;
    Ok(enrollment)
}
