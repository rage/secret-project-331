use crate::prelude::*;
use std::convert::TryFrom;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub enum ChapterLockingStatus {
    /// Chapter is unlocked and exercises can be submitted.
    Unlocked,
    /// Chapter content is accessible, but exercises are locked (chapter has been completed).
    CompletedAndLocked,
    /// Chapter is locked because previous chapters are not completed.
    NotUnlockedYet,
}

impl ChapterLockingStatus {
    pub fn from_db(s: &str) -> ModelResult<Self> {
        match s {
            "unlocked" => Ok(ChapterLockingStatus::Unlocked),
            "completed_and_locked" => Ok(ChapterLockingStatus::CompletedAndLocked),
            "not_unlocked_yet" => Ok(ChapterLockingStatus::NotUnlockedYet),
            _ => Err(ModelError::new(
                ModelErrorType::Database,
                format!("Invalid chapter locking status from database: {}", s),
                None,
            )),
        }
    }
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
        let status = ChapterLockingStatus::from_db(&row.status)?;
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

async fn get_status_row(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Option<Uuid>,
    course_locking_enabled: Option<bool>,
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
    .fetch_optional(&mut *conn)
    .await?;

    if let Some(row) = res {
        return row.try_into().map(Some);
    }

    if let (Some(course_id), Some(true)) = (course_id, course_locking_enabled) {
        return Ok(Some(
            ensure_not_unlocked_yet_status(&mut *conn, user_id, chapter_id, course_id).await?,
        ));
    }

    Ok(None)
}

pub async fn get_or_init_status(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Option<Uuid>,
    course_locking_enabled: Option<bool>,
) -> ModelResult<Option<ChapterLockingStatus>> {
    get_status_row(conn, user_id, chapter_id, course_id, course_locking_enabled)
        .await?
        .map(|s| Ok(s.status))
        .transpose()
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

    let status = get_or_init_status(
        conn,
        user_id,
        chapter_id,
        Some(course_id),
        Some(course.chapter_locking_enabled),
    )
    .await?;
    match status {
        None => Ok(false),
        Some(ChapterLockingStatus::Unlocked) => Ok(true),
        Some(ChapterLockingStatus::CompletedAndLocked) => Ok(true),
        Some(ChapterLockingStatus::NotUnlockedYet) => Ok(false),
    }
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

    let status = get_or_init_status(
        conn,
        user_id,
        chapter_id,
        Some(course_id),
        Some(course.chapter_locking_enabled),
    )
    .await?;

    match status {
        None => Ok(true),
        Some(ChapterLockingStatus::Unlocked) => Ok(false),
        Some(ChapterLockingStatus::CompletedAndLocked) => Ok(true),
        Some(ChapterLockingStatus::NotUnlockedYet) => Ok(true),
    }
}

pub async fn unlock_chapter(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
) -> ModelResult<UserChapterLockingStatus> {
    let res = sqlx::query_as!(
        DatabaseRow,
        r#"
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
VALUES ($1, $2, $3, 'unlocked'::chapter_locking_status, NULL)
ON CONFLICT ON CONSTRAINT idx_user_chapter_locking_statuses_user_chapter_active DO UPDATE
SET status = 'unlocked'::chapter_locking_status, deleted_at = NULL
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status::text as "status!"
        "#,
        user_id,
        chapter_id,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    res.map(|s| s.try_into())
        .transpose()?
        .ok_or_else(|| ModelError::new(ModelErrorType::NotFound, "Failed to unlock chapter", None))
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
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
VALUES ($1, $2, $3, 'completed_and_locked'::chapter_locking_status, NULL)
ON CONFLICT ON CONSTRAINT idx_user_chapter_locking_statuses_user_chapter_active DO UPDATE
SET status = 'completed_and_locked'::chapter_locking_status, deleted_at = NULL
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status::text as "status!"
        "#,
        user_id,
        chapter_id,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    res.map(|s| s.try_into()).transpose()?.ok_or_else(|| {
        ModelError::new(ModelErrorType::NotFound, "Failed to complete chapter", None)
    })
}

pub async fn get_by_user_and_chapter(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Option<Uuid>,
    course_locking_enabled: Option<bool>,
) -> ModelResult<Option<UserChapterLockingStatus>> {
    get_status_row(conn, user_id, chapter_id, course_id, course_locking_enabled).await
}

pub async fn get_by_user_and_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<UserChapterLockingStatus>> {
    let course_locking_enabled: bool = sqlx::query!(
        r#"
SELECT chapter_locking_enabled
FROM courses
WHERE id = $1
        "#,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?
    .map(|r| r.chapter_locking_enabled)
    .unwrap_or(false);

    if course_locking_enabled {
        sqlx::query!(
            r#"
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
SELECT $1, chapters.id, $2, 'not_unlocked_yet'::chapter_locking_status, NULL
FROM chapters
WHERE chapters.course_id = $2
  AND chapters.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_chapter_locking_statuses
    WHERE user_chapter_locking_statuses.user_id = $1
      AND user_chapter_locking_statuses.chapter_id = chapters.id
      AND user_chapter_locking_statuses.deleted_at IS NULL
  )
ON CONFLICT (user_id, chapter_id, deleted_at) DO NOTHING
            "#,
            user_id,
            course_id
        )
        .execute(&mut *conn)
        .await?;
    }

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
    .fetch_all(&mut *conn)
    .await?;

    res.into_iter()
        .map(|r| r.try_into())
        .collect::<ModelResult<Vec<_>>>()
}

/// Creates a status row with `not_unlocked_yet` status if one doesn't exist.
/// If a row already exists (with any status), returns the existing row without modifying it.
/// This function does not overwrite existing statuses.
pub async fn ensure_not_unlocked_yet_status(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
) -> ModelResult<UserChapterLockingStatus> {
    let res: Option<DatabaseRow> = sqlx::query_as!(
        DatabaseRow,
        r#"
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
VALUES ($1, $2, $3, 'not_unlocked_yet'::chapter_locking_status, NULL)
ON CONFLICT (user_id, chapter_id, deleted_at) DO NOTHING
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status::text as "status!"
        "#,
        user_id,
        chapter_id,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    if let Some(status) = res {
        return status.try_into();
    }

    let retrieved = sqlx::query_as!(
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
    .fetch_optional(&mut *conn)
    .await?;

    retrieved.map(|r| r.try_into()).transpose()?.ok_or_else(|| {
        ModelError::new(
            ModelErrorType::NotFound,
            "Failed to ensure not_unlocked_yet status",
            None,
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn get_status_returns_none_when_no_status_exists() {
        insert_data!(:tx, :user, :org, course: course, instance: _instance, :course_module);
        let chapter = crate::chapters::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::chapters::NewChapter {
                name: "Test Chapter".to_string(),
                color: None,
                course_id: course,
                chapter_number: 1,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(course_module.id),
            },
        )
        .await
        .unwrap();

        let status = get_or_init_status(tx.as_mut(), user, chapter, None, None)
            .await
            .unwrap();
        assert_eq!(status, None);
    }

    #[tokio::test]
    async fn unlock_chapter_creates_unlocked_status() {
        insert_data!(:tx, :user, :org, course: course, instance: _instance, :course_module);
        let chapter = crate::chapters::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::chapters::NewChapter {
                name: "Test Chapter".to_string(),
                color: None,
                course_id: course,
                chapter_number: 1,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(course_module.id),
            },
        )
        .await
        .unwrap();

        let status = unlock_chapter(tx.as_mut(), user, chapter, course)
            .await
            .unwrap();
        assert_eq!(status.status, ChapterLockingStatus::Unlocked);
        assert_eq!(status.user_id, user);
        assert_eq!(status.chapter_id, chapter);

        let retrieved_status = get_or_init_status(tx.as_mut(), user, chapter, Some(course), None)
            .await
            .unwrap();
        assert_eq!(retrieved_status, Some(ChapterLockingStatus::Unlocked));
    }

    #[tokio::test]
    async fn complete_chapter_creates_completed_status() {
        insert_data!(:tx, :user, :org, course: course, instance: _instance, :course_module);
        let chapter = crate::chapters::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::chapters::NewChapter {
                name: "Test Chapter".to_string(),
                color: None,
                course_id: course,
                chapter_number: 1,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(course_module.id),
            },
        )
        .await
        .unwrap();

        let status = complete_chapter(tx.as_mut(), user, chapter, course)
            .await
            .unwrap();
        assert_eq!(status.status, ChapterLockingStatus::CompletedAndLocked);
        assert_eq!(status.user_id, user);
        assert_eq!(status.chapter_id, chapter);

        let retrieved_status = get_or_init_status(tx.as_mut(), user, chapter, Some(course), None)
            .await
            .unwrap();
        assert_eq!(
            retrieved_status,
            Some(ChapterLockingStatus::CompletedAndLocked)
        );
    }

    #[tokio::test]
    async fn unlock_then_complete_chapter_updates_status() {
        insert_data!(:tx, :user, :org, course: course, instance: _instance, :course_module);
        let chapter = crate::chapters::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::chapters::NewChapter {
                name: "Test Chapter".to_string(),
                color: None,
                course_id: course,
                chapter_number: 1,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(course_module.id),
            },
        )
        .await
        .unwrap();

        unlock_chapter(tx.as_mut(), user, chapter, course)
            .await
            .unwrap();
        let status = get_or_init_status(tx.as_mut(), user, chapter, Some(course), None)
            .await
            .unwrap();
        assert_eq!(status, Some(ChapterLockingStatus::Unlocked));

        complete_chapter(tx.as_mut(), user, chapter, course)
            .await
            .unwrap();
        let status = get_or_init_status(tx.as_mut(), user, chapter, Some(course), None)
            .await
            .unwrap();
        assert_eq!(status, Some(ChapterLockingStatus::CompletedAndLocked));
    }

    #[tokio::test]
    async fn get_by_user_and_course_returns_all_statuses() {
        insert_data!(:tx, :user, :org, course: course, instance: _instance, :course_module);
        let chapter1 = crate::chapters::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::chapters::NewChapter {
                name: "Chapter 1".to_string(),
                color: None,
                course_id: course,
                chapter_number: 1,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(course_module.id),
            },
        )
        .await
        .unwrap();
        let chapter2 = crate::chapters::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::chapters::NewChapter {
                name: "Chapter 2".to_string(),
                color: None,
                course_id: course,
                chapter_number: 2,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(course_module.id),
            },
        )
        .await
        .unwrap();

        unlock_chapter(tx.as_mut(), user, chapter1, course)
            .await
            .unwrap();
        complete_chapter(tx.as_mut(), user, chapter2, course)
            .await
            .unwrap();

        let statuses = get_by_user_and_course(tx.as_mut(), user, course)
            .await
            .unwrap();
        assert_eq!(statuses.len(), 2);
        assert!(
            statuses
                .iter()
                .any(|s| s.chapter_id == chapter1 && s.status == ChapterLockingStatus::Unlocked)
        );
        assert!(
            statuses.iter().any(|s| s.chapter_id == chapter2
                && s.status == ChapterLockingStatus::CompletedAndLocked)
        );
    }
}
