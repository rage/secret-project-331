use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NewUserCourseSettings {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub current_course_instance_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct UserCourseSettings {
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub current_course_instance_id: Uuid,
}

pub async fn insert_user_course_settings(
    conn: &mut PgConnection,
    settings: NewUserCourseSettings,
) -> ModelResult<UserCourseSettings> {
    let res = sqlx::query_as!(
        UserCourseSettings,
        "
INSERT INTO user_course_settings (user_id, course_id, current_course_instance_id)
VALUES ($1, $2, $3)
RETURNING *;
    ",
        settings.user_id,
        settings.course_id,
        settings.current_course_instance_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_user_course_settings_for_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<UserCourseSettings>> {
    let res = sqlx::query_as!(
        UserCourseSettings,
        "
SELECT *
FROM user_course_settings
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL;
    ",
        user_id,
        course_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}
