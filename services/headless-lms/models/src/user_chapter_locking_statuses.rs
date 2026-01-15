use crate::prelude::*;
use std::convert::TryFrom;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub enum ChapterLockingStatus {
    Unlocked,
    Completed,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserChapterLockingStatus {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub chapter_id: Uuid,
    pub course_id: Uuid,
    pub status: ChapterLockingStatus,
}

struct DatabaseRow {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
    status: String,
}

impl TryFrom<DatabaseRow> for UserChapterLockingStatus {
    type Error = ModelError;

    fn try_from(row: DatabaseRow) -> Result<Self, Self::Error> {
        let status = match row.status.as_str() {
            "unlocked" => ChapterLockingStatus::Unlocked,
            "completed" => ChapterLockingStatus::Completed,
            _ => {
                return Err(ModelError::new(
                    ModelErrorType::InvalidRequest,
                    format!(
                        "Invalid chapter locking status from database: {}",
                        row.status
                    ),
                    None,
                ));
            }
        };
        Ok(UserChapterLockingStatus {
            id: row.id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at,
            user_id: row.user_id,
            chapter_id: row.chapter_id,
            course_id: row.course_id,
            status,
        })
    }
}

pub async fn get_status(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
) -> ModelResult<Option<ChapterLockingStatus>> {
    let res = sqlx::query!(
        r#"
SELECT status::text as "status!"
FROM user_chapter_locking_statuses
WHERE user_id = $1
  AND chapter_id = $2
  AND deleted_at IS NULL
        "#,
        user_id,
        chapter_id
    )
    .fetch_optional(conn)
    .await?;

    Ok(res.and_then(|r| match r.status.as_str() {
        "unlocked" => Some(ChapterLockingStatus::Unlocked),
        "completed" => Some(ChapterLockingStatus::Completed),
        _ => None,
    }))
}

pub async fn is_chapter_accessible(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
) -> ModelResult<bool> {
    use crate::courses;

    let course = courses::get_course(conn, course_id).await?;

    if !course.chapter_locking_enabled {
        return Ok(true);
    }

    let status = get_status(conn, user_id, chapter_id).await?;
    Ok(status.is_some())
}

pub async fn is_chapter_exercises_locked(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
) -> ModelResult<bool> {
    use crate::courses;

    let course = courses::get_course(conn, course_id).await?;

    if !course.chapter_locking_enabled {
        return Ok(false);
    }

    let status = get_status(conn, user_id, chapter_id).await?;

    match status {
        None => Ok(true),
        Some(ChapterLockingStatus::Unlocked) => Ok(false),
        Some(ChapterLockingStatus::Completed) => Ok(true),
    }
}

pub async fn unlock_chapter(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
) -> ModelResult<UserChapterLockingStatus> {
    let updated = sqlx::query_as!(
        DatabaseRow,
        r#"
UPDATE user_chapter_locking_statuses
SET status = 'unlocked'::chapter_locking_status, updated_at = now()
WHERE user_id = $1 AND chapter_id = $2 AND deleted_at IS NULL
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status::text as "status!"
        "#,
        user_id,
        chapter_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    if let Some(status) = updated {
        return status.try_into();
    }

    let res = sqlx::query_as!(
        DatabaseRow,
        r#"
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
VALUES ($1, $2, $3, 'unlocked'::chapter_locking_status, NULL)
ON CONFLICT (user_id, chapter_id, deleted_at) DO UPDATE
SET status = 'unlocked'::chapter_locking_status, updated_at = now()
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status::text as "status!"
        "#,
        user_id,
        chapter_id,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    if let Some(status) = res {
        status.try_into()
    } else {
        get_by_user_and_chapter(&mut *conn, user_id, chapter_id)
            .await?
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::NotFound,
                    "Failed to create or retrieve chapter locking status",
                    None,
                )
            })
    }
}

pub async fn complete_chapter(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
) -> ModelResult<UserChapterLockingStatus> {
    let res = sqlx::query_as!(
        DatabaseRow,
        r#"
UPDATE user_chapter_locking_statuses
SET status = 'completed'::chapter_locking_status, updated_at = now()
WHERE user_id = $1 AND chapter_id = $2 AND deleted_at IS NULL
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status::text as "status!"
        "#,
        user_id,
        chapter_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    if let Some(status) = res {
        return status.try_into();
    }

    let insert_res = sqlx::query_as!(
        DatabaseRow,
        r#"
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
VALUES ($1, $2, $3, 'completed'::chapter_locking_status, NULL)
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status::text as "status!"
        "#,
        user_id,
        chapter_id,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    insert_res
        .map(|s| s.try_into())
        .transpose()?
        .ok_or_else(|| {
            ModelError::new(ModelErrorType::NotFound, "Failed to complete chapter", None)
        })
}

pub async fn get_by_user_and_chapter(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
) -> ModelResult<Option<UserChapterLockingStatus>> {
    let res = sqlx::query_as!(
        DatabaseRow,
        r#"
SELECT id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status::text as "status!"
FROM user_chapter_locking_statuses
WHERE user_id = $1
  AND chapter_id = $2
  AND deleted_at IS NULL
        "#,
        user_id,
        chapter_id
    )
    .fetch_optional(conn)
    .await?;

    res.map(|r| r.try_into()).transpose()
}

pub async fn get_by_user_and_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<UserChapterLockingStatus>> {
    let res = sqlx::query_as!(
        DatabaseRow,
        r#"
SELECT id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status::text as "status!"
FROM user_chapter_locking_statuses
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
        "#,
        user_id,
        course_id
    )
    .fetch_all(conn)
    .await?;

    res.into_iter()
        .map(|r| r.try_into())
        .collect::<ModelResult<Vec<_>>>()
}
