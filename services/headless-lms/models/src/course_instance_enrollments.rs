use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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

/**
Inserts enrollment if it doesn't exist yet.

If the enrollment exists, this just makes sure that the record is not deleted. This is useful because the user might accidentally request entrolling to the same course instance twice for example with two differet browser tabs.
*/
pub async fn insert_enrollment_if_it_doesnt_exist(
    conn: &mut PgConnection,
    enrollment: NewCourseInstanceEnrollment,
) -> ModelResult<CourseInstanceEnrollment> {
    let enrollment = sqlx::query_as!(
        CourseInstanceEnrollment,
        "
INSERT INTO course_instance_enrollments (user_id, course_id, course_instance_id)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, course_instance_id)
DO UPDATE SET deleted_at = NULL
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

    let enrollment = insert_enrollment_if_it_doesnt_exist(&mut tx, new_enrollment).await?;
    crate::user_course_settings::upsert_user_course_settings_for_enrollment(&mut tx, &enrollment)
        .await?;
    tx.commit().await?;

    Ok(enrollment)
}

pub async fn get_by_user_and_course_instance_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<CourseInstanceEnrollment> {
    let res = sqlx::query_as!(
        CourseInstanceEnrollment,
        "
SELECT *
FROM course_instance_enrollments
WHERE user_id = $1
  AND course_instance_id = $2
  AND deleted_at IS NULL
        ",
        user_id,
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
