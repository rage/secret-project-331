use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgConnection};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct CourseInstanceEnrollment {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_instance_enrollments (user_id, course_id, course_instance_id)
VALUES ($1, $2, $3)
",
        user_id,
        course_id,
        course_instance_id,
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
}

pub async fn insert_enrollment(
    conn: &mut PgConnection,
    enrollment: NewCourseInstanceEnrollment,
) -> ModelResult<CourseInstanceEnrollment> {
    let enrollment = sqlx::query_as!(
        CourseInstanceEnrollment,
        "
INSERT INTO course_instance_enrollments (user_id, course_id, course_instance_id)
VALUES ($1, $2, $3)
RETURNING *;
",
        enrollment.user_id,
        enrollment.course_id,
        enrollment.course_instance_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(enrollment)
}

pub async fn insert_enrollment_and_set_as_current(
    conn: &mut PgConnection,
    new_enrollment: NewCourseInstanceEnrollment,
) -> ModelResult<CourseInstanceEnrollment> {
    let mut tx = conn.begin().await?;

    let enrollment = insert_enrollment(&mut tx, new_enrollment).await?;
    crate::user_course_settings::upsert_user_course_settings_for_enrollment(&mut tx, &enrollment)
        .await?;
    tx.commit().await?;

    Ok(enrollment)
}
