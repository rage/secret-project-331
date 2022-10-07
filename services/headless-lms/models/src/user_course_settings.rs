use crate::{course_instance_enrollments::CourseInstanceEnrollment, prelude::*};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserCourseSettings {
    pub user_id: Uuid,
    pub course_language_group_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub current_course_id: Uuid,
    pub current_course_instance_id: Uuid,
}

/// Creates new user course settings based on the enrollment or updates an existing one.
pub async fn upsert_user_course_settings_for_enrollment(
    conn: &mut PgConnection,
    course_instance_enrollment: &CourseInstanceEnrollment,
) -> ModelResult<UserCourseSettings> {
    let user_course_settings = sqlx::query_as!(
        UserCourseSettings,
        "
INSERT INTO user_course_settings (
    user_id,
    course_language_group_id,
    current_course_id,
    current_course_instance_id
  )
SELECT $1,
  course_language_group_id,
  $2,
  $3
FROM courses
WHERE id = $2
  AND deleted_at IS NULL ON CONFLICT (user_id, course_language_group_id) DO
UPDATE
SET current_course_id = $2,
  current_course_instance_id = $3,
  deleted_at = NULL
RETURNING *;
        ",
        course_instance_enrollment.user_id,
        course_instance_enrollment.course_id,
        course_instance_enrollment.course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(user_course_settings)
}

pub async fn get_user_course_settings(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_language_group_id: Uuid,
) -> ModelResult<UserCourseSettings> {
    let user_course_settings = sqlx::query_as!(
        UserCourseSettings,
        "
SELECT *
FROM user_course_settings
WHERE user_id = $1
  AND course_language_group_id = $2
  AND deleted_at IS NULL;
        ",
        user_id,
        course_language_group_id
    )
    .fetch_one(conn)
    .await?;
    Ok(user_course_settings)
}

pub async fn get_user_course_settings_by_course_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<UserCourseSettings>> {
    let user_course_settings = sqlx::query_as!(
        UserCourseSettings,
        "
SELECT ucs.*
FROM courses c
  JOIN user_course_settings ucs ON (
    ucs.course_language_group_id = c.course_language_group_id
  )
WHERE c.id = $1
  AND ucs.user_id = $2
  AND c.deleted_at IS NULL
  AND ucs.deleted_at IS NULL;
        ",
        course_id,
        user_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(user_course_settings)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        course_instance_enrollments::{self, NewCourseInstanceEnrollment},
        course_instances::{self, NewCourseInstance},
        test_helper::*,
    };

    #[tokio::test]
    async fn upserts_user_course_settings() {
        insert_data!(:tx, :user, :org, :course, :instance);

        let enrollment = course_instance_enrollments::insert_enrollment_if_it_doesnt_exist(
            tx.as_mut(),
            NewCourseInstanceEnrollment {
                course_id: course,
                course_instance_id: instance.id,
                user_id: user,
            },
        )
        .await
        .unwrap();
        let settings = upsert_user_course_settings_for_enrollment(tx.as_mut(), &enrollment)
            .await
            .unwrap();
        assert_eq!(settings.current_course_id, enrollment.course_id);
        assert_eq!(
            settings.current_course_instance_id,
            enrollment.course_instance_id
        );

        let instance_2 = course_instances::insert(
            tx.as_mut(),
            NewCourseInstance {
                id: Uuid::new_v4(),
                course_id: course,
                name: Some("instance-2"),
                description: None,
                teacher_in_charge_name: "teacher",
                teacher_in_charge_email: "teacher@example.com",
                support_email: None,
                opening_time: None,
                closing_time: None,
            },
        )
        .await
        .unwrap()
        .id;
        let enrollment_2 = course_instance_enrollments::insert_enrollment_if_it_doesnt_exist(
            tx.as_mut(),
            NewCourseInstanceEnrollment {
                course_id: course,
                course_instance_id: instance_2,
                user_id: user,
            },
        )
        .await
        .unwrap();
        let settings_2 = upsert_user_course_settings_for_enrollment(tx.as_mut(), &enrollment_2)
            .await
            .unwrap();
        assert_eq!(
            settings_2.current_course_instance_id,
            enrollment_2.course_instance_id
        );
    }
}
