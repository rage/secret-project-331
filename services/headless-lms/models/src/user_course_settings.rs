use crate::{course_instance_enrollments::CourseInstanceEnrollment, prelude::*};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct UserCourseSettings {
    pub user_id: Uuid,
    pub course_language_group_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub current_course_id: Uuid,
    pub current_course_instance_id: Uuid,
    /// Whether the user has hidden this course from their personal "My courses" list. Does not
    /// affect course progress.
    pub hidden: bool,
}

/// Creates new user course settings based on the enrollment or updates an existing one.
pub async fn upsert_user_course_settings_for_enrollment(
    conn: &mut PgConnection,
    course_instance_enrollment: &CourseInstanceEnrollment,
) -> ModelResult<UserCourseSettings> {
    use crate::{courses, user_chapter_locking_statuses};

    let course = courses::get_course(conn, course_instance_enrollment.course_id).await?;

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
    .fetch_one(&mut *conn)
    .await?;

    if course.chapter_locking_enabled {
        let _ = user_chapter_locking_statuses::get_or_init_all_for_course(
            &mut *conn,
            course_instance_enrollment.user_id,
            course_instance_enrollment.course_id,
        )
        .await?;
    }

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

/// Sets whether the given course is hidden from the user's personal "My courses" list. The course
/// is matched by its language group, so any language version of the course resolves to the same
/// settings row.
///
/// Returns the number of settings rows updated. This is 0 when the user has no settings for the
/// course (e.g. they only hold a role in it and never enrolled), in which case the course cannot be
/// hidden.
pub async fn set_hidden(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    hidden: bool,
) -> ModelResult<u64> {
    let res = sqlx::query!(
        "
UPDATE user_course_settings ucs
SET hidden = $3
FROM courses c
WHERE c.id = $1
  AND ucs.course_language_group_id = c.course_language_group_id
  AND ucs.user_id = $2
  AND ucs.deleted_at IS NULL
  AND c.deleted_at IS NULL
        ",
        course_id,
        user_id,
        hidden,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

/// Gets all of the user's course settings that have their current course id included in the provided
/// list.
///
/// The distinction for current courses is stated, because multiple courses can share the same
/// course settings if they are different language versions of each other. Course settings that may
/// exist for inactive courses will be omited. This behavior can be desireable in some cases, and
/// should not be changed.
///
/// Note that this function doesn't create any settings that are missing for the user, so the amount
/// of results may be less than the amount of courses provided.
pub async fn get_all_by_user_and_multiple_current_courses(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
    user_id: Uuid,
) -> ModelResult<Vec<UserCourseSettings>> {
    let res = sqlx::query_as!(
        UserCourseSettings,
        "
SELECT *
FROM user_course_settings
WHERE current_course_id = ANY($1)
  AND user_id = $2
  AND deleted_at IS NULL
        ",
        course_ids,
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Returns all non-deleted user course settings for a user.
pub async fn get_all_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<UserCourseSettings>> {
    let res = sqlx::query_as!(
        UserCourseSettings,
        "
SELECT *
FROM user_course_settings
WHERE user_id = $1
  AND deleted_at IS NULL
        ",
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<UserCourseSettings>> {
    let res = sqlx::query_as!(
        UserCourseSettings,
        "
SELECT ucs.*
FROM courses c
  JOIN user_course_settings ucs ON (
    ucs.course_language_group_id = c.course_language_group_id
  )
WHERE c.id = $1
  AND c.deleted_at IS NULL
  AND ucs.deleted_at IS NULL
        ",
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
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
            PKeyPolicy::Generate,
            NewCourseInstance {
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

    #[tokio::test]
    async fn settings_default_to_not_hidden() {
        insert_data!(:tx, :user, :org, :course, :instance);
        course_instance_enrollments::insert_enrollment_and_set_as_current(
            tx.as_mut(),
            NewCourseInstanceEnrollment {
                course_id: course,
                course_instance_id: instance.id,
                user_id: user,
            },
        )
        .await
        .unwrap();

        let settings = get_user_course_settings_by_course_id(tx.as_mut(), user, course)
            .await
            .unwrap()
            .unwrap();
        assert!(!settings.hidden);
    }

    #[tokio::test]
    async fn set_hidden_toggles_the_flag() {
        insert_data!(:tx, :user, :org, :course, :instance);
        course_instance_enrollments::insert_enrollment_and_set_as_current(
            tx.as_mut(),
            NewCourseInstanceEnrollment {
                course_id: course,
                course_instance_id: instance.id,
                user_id: user,
            },
        )
        .await
        .unwrap();

        let updated = set_hidden(tx.as_mut(), user, course, true).await.unwrap();
        assert_eq!(updated, 1);
        assert!(
            get_user_course_settings_by_course_id(tx.as_mut(), user, course)
                .await
                .unwrap()
                .unwrap()
                .hidden
        );

        set_hidden(tx.as_mut(), user, course, false).await.unwrap();
        assert!(
            !get_user_course_settings_by_course_id(tx.as_mut(), user, course)
                .await
                .unwrap()
                .unwrap()
                .hidden
        );
    }

    #[tokio::test]
    async fn set_hidden_without_settings_updates_nothing() {
        insert_data!(:tx, :user, :org, :course);

        // The user only exists, has never enrolled, so there is no settings row to hide.
        let updated = set_hidden(tx.as_mut(), user, course, true).await.unwrap();
        assert_eq!(updated, 0);
    }
}
