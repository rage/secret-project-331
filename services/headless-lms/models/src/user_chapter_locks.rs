use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserChapterLock {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub chapter_id: Uuid,
    pub course_id: Uuid,
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
) -> ModelResult<UserChapterLock> {
    let res = sqlx::query_as!(
        UserChapterLock,
        r#"
INSERT INTO user_chapter_locks (user_id, chapter_id, course_id)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, chapter_id) DO NOTHING
RETURNING *
        "#,
        user_id,
        chapter_id,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    if let Some(lock) = res {
        Ok(lock)
    } else {
        get_by_user_and_chapter(&mut *conn, user_id, chapter_id)
            .await?
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::NotFound,
                    "Failed to create or retrieve chapter lock",
                    None,
                )
            })
    }
}

pub async fn get_by_user_and_chapter(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
) -> ModelResult<Option<UserChapterLock>> {
    let res = sqlx::query_as!(
        UserChapterLock,
        r#"
SELECT *
FROM user_chapter_locks
WHERE user_id = $1
  AND chapter_id = $2
  AND deleted_at IS NULL
        "#,
        user_id,
        chapter_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_user_and_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<UserChapterLock>> {
    let res = sqlx::query_as!(
        UserChapterLock,
        r#"
SELECT *
FROM user_chapter_locks
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
        "#,
        user_id,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
