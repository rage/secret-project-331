use crate::error::missing_model_error;
use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy, ToSchema, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "chapter_locking_status", rename_all = "snake_case")]
pub enum ChapterLockingStatus {
    /// Chapter is unlocked and exercises can be submitted.
    Unlocked,
    /// Chapter content is accessible, but exercises are locked (chapter has been completed).
    CompletedAndLocked,
    /// Chapter is locked because previous chapters are not completed.
    NotUnlockedYet,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema, sqlx::FromRow)]

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

async fn get_or_init_status_row(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Option<Uuid>,
    course_locking_enabled: Option<bool>,
) -> ModelResult<Option<UserChapterLockingStatus>> {
    let res = sqlx::query_as!(
        UserChapterLockingStatus,
        r#"
SELECT id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status as "status: ChapterLockingStatus"
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
        return Ok(Some(row));
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
    Ok(
        get_or_init_status_row(conn, user_id, chapter_id, course_id, course_locking_enabled)
            .await?
            .map(|s| s.status),
    )
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
        UserChapterLockingStatus,
        r#"
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
VALUES ($1, $2, $3, 'unlocked'::chapter_locking_status, NULL)
ON CONFLICT ON CONSTRAINT idx_user_chapter_locking_statuses_user_chapter_active DO UPDATE
SET status = 'unlocked'::chapter_locking_status, deleted_at = NULL
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status as "status: ChapterLockingStatus"
        "#,
        user_id,
        chapter_id,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    res.ok_or_else(missing_model_error(
        ModelErrorType::NotFound,
        "Failed to unlock chapter",
    ))
}

pub async fn complete_and_lock_chapter(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
) -> ModelResult<UserChapterLockingStatus> {
    let res = sqlx::query_as!(
        UserChapterLockingStatus,
        r#"
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
VALUES ($1, $2, $3, 'completed_and_locked'::chapter_locking_status, NULL)
ON CONFLICT ON CONSTRAINT idx_user_chapter_locking_statuses_user_chapter_active DO UPDATE
SET status = 'completed_and_locked'::chapter_locking_status, deleted_at = NULL
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status as "status: ChapterLockingStatus"
        "#,
        user_id,
        chapter_id,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    res.ok_or_else(missing_model_error(
        ModelErrorType::NotFound,
        "Failed to complete chapter",
    ))
}

pub async fn set_chapter_status(
    conn: &mut PgConnection,
    user_id: Uuid,
    chapter_id: Uuid,
    course_id: Uuid,
    status: ChapterLockingStatus,
) -> ModelResult<UserChapterLockingStatus> {
    let res = sqlx::query_as!(
        UserChapterLockingStatus,
        r#"
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
VALUES ($1, $2, $3, $4, NULL)
ON CONFLICT ON CONSTRAINT idx_user_chapter_locking_statuses_user_chapter_active DO UPDATE
SET status = $4, deleted_at = NULL
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status as "status: ChapterLockingStatus"
        "#,
        user_id,
        chapter_id,
        course_id,
        status as ChapterLockingStatus,
    )
    .fetch_optional(&mut *conn)
    .await?;

    res.ok_or_else(missing_model_error(
        ModelErrorType::NotFound,
        "Failed to set chapter status",
    ))
}

pub async fn get_or_init_all_for_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<UserChapterLockingStatus>> {
    let course = crate::courses::get_course(conn, course_id).await?;
    let course_locking_enabled = course.chapter_locking_enabled;

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

    async fn get_statuses_for_user_and_course(
        conn: &mut PgConnection,
        user_id: Uuid,
        course_id: Uuid,
    ) -> ModelResult<Vec<UserChapterLockingStatus>> {
        let rows = sqlx::query_as!(
            UserChapterLockingStatus,
            r#"
SELECT id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status as "status: ChapterLockingStatus"
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

        Ok(rows)
    }

    let mut statuses = get_statuses_for_user_and_course(conn, user_id, course_id).await?;

    if course_locking_enabled
        && !statuses.is_empty()
        && statuses
            .iter()
            .all(|s| matches!(s.status, ChapterLockingStatus::NotUnlockedYet))
    {
        crate::chapters::unlock_first_chapters_for_user(conn, user_id, course_id).await?;

        statuses = get_statuses_for_user_and_course(conn, user_id, course_id).await?;
    }

    Ok(statuses)
}

pub async fn get_all_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<UserChapterLockingStatus>> {
    let rows = sqlx::query_as!(
        UserChapterLockingStatus,
        r#"
SELECT id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status as "status: ChapterLockingStatus"
FROM user_chapter_locking_statuses
WHERE course_id = $1
  AND deleted_at IS NULL
        "#,
        course_id
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(rows)
}

/// Returns all chapter locking statuses for a specific user in a course.
pub async fn get_for_user_and_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<UserChapterLockingStatus>> {
    let rows = sqlx::query_as!(
        UserChapterLockingStatus,
        r#"
SELECT id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status as "status: ChapterLockingStatus"
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

    Ok(rows)
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
    let res: Option<UserChapterLockingStatus> = sqlx::query_as!(
        UserChapterLockingStatus,
        r#"
INSERT INTO user_chapter_locking_statuses (user_id, chapter_id, course_id, status, deleted_at)
VALUES ($1, $2, $3, 'not_unlocked_yet'::chapter_locking_status, NULL)
ON CONFLICT (user_id, chapter_id, deleted_at) DO NOTHING
RETURNING id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status as "status: ChapterLockingStatus"
        "#,
        user_id,
        chapter_id,
        course_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    if let Some(status) = res {
        return Ok(status);
    }

    let retrieved = sqlx::query_as!(
        UserChapterLockingStatus,
        r#"
SELECT id, created_at, updated_at, deleted_at, user_id, chapter_id, course_id, status as "status: ChapterLockingStatus"
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

    retrieved.ok_or_else(missing_model_error(
        ModelErrorType::NotFound,
        "Failed to ensure not_unlocked_yet status",
    ))
}

/// Unlocks the provided chapters for a user within a course.
pub async fn unlock_chapters_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    chapter_ids: &[Uuid],
) -> ModelResult<()> {
    for chapter_id in chapter_ids {
        unlock_chapter(conn, user_id, *chapter_id, course_id).await?;
    }

    Ok(())
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
    async fn complete_and_lock_chapter_creates_completed_status() {
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

        let status = complete_and_lock_chapter(tx.as_mut(), user, chapter, course)
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

        complete_and_lock_chapter(tx.as_mut(), user, chapter, course)
            .await
            .unwrap();
        let status = get_or_init_status(tx.as_mut(), user, chapter, Some(course), None)
            .await
            .unwrap();
        assert_eq!(status, Some(ChapterLockingStatus::CompletedAndLocked));
    }

    #[tokio::test]
    async fn get_or_init_all_for_course_returns_all_statuses() {
        insert_data!(:tx, :user, :org, course: course);
        // Use the base module (order_number == 0) so that the unlocking logic,
        // which operates on the base module, affects these chapters.
        let all_modules = crate::course_modules::get_by_course_id(tx.as_mut(), course)
            .await
            .unwrap();
        let base_module = all_modules
            .into_iter()
            .find(|m| m.order_number == 0)
            .unwrap();

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
                course_module_id: Some(base_module.id),
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
                course_module_id: Some(base_module.id),
            },
        )
        .await
        .unwrap();

        unlock_chapter(tx.as_mut(), user, chapter1, course)
            .await
            .unwrap();
        complete_and_lock_chapter(tx.as_mut(), user, chapter2, course)
            .await
            .unwrap();

        let statuses = get_or_init_all_for_course(tx.as_mut(), user, course)
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

    #[tokio::test]
    async fn get_or_init_all_for_course_unlocks_first_chapter_when_all_not_unlocked_yet() {
        insert_data!(:tx, :user, :org, course: course);

        let all_modules = crate::course_modules::get_by_course_id(tx.as_mut(), course)
            .await
            .unwrap();
        let base_module = all_modules
            .into_iter()
            .find(|m| m.order_number == 0)
            .unwrap();

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
                course_module_id: Some(base_module.id),
            },
        )
        .await
        .unwrap();

        // insert a second chapter to ensure only the first is auto-unlocked
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
                course_module_id: Some(base_module.id),
            },
        )
        .await
        .unwrap();

        // Enable chapter locking for the course
        let existing_course = crate::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();

        crate::courses::update_course(
            tx.as_mut(),
            course,
            crate::courses::CourseUpdate {
                name: existing_course.name,
                description: existing_course.description,
                is_draft: existing_course.is_draft,
                is_test_mode: existing_course.is_test_mode,
                can_add_chatbot: existing_course.can_add_chatbot,
                is_unlisted: existing_course.is_unlisted,
                is_joinable_by_code_only: existing_course.is_joinable_by_code_only,
                ask_marketing_consent: existing_course.ask_marketing_consent,
                flagged_answers_threshold: existing_course.flagged_answers_threshold.unwrap_or(1),
                flagged_answers_skip_manual_review_and_allow_retry: existing_course
                    .flagged_answers_skip_manual_review_and_allow_retry,
                closed_at: existing_course.closed_at,
                closed_additional_message: existing_course.closed_additional_message,
                closed_course_successor_id: existing_course.closed_course_successor_id,
                chapter_locking_enabled: true,
            },
        )
        .await
        .unwrap();

        // Ensure we start from a state where all chapters are not_unlocked_yet
        let _ = ensure_not_unlocked_yet_status(tx.as_mut(), user, chapter1, course)
            .await
            .unwrap();
        let _ = ensure_not_unlocked_yet_status(tx.as_mut(), user, chapter2, course)
            .await
            .unwrap();

        let statuses = get_or_init_all_for_course(tx.as_mut(), user, course)
            .await
            .unwrap();

        assert!(!statuses.is_empty());
        assert!(
            statuses
                .iter()
                .any(|s| s.chapter_id == chapter1 && s.status == ChapterLockingStatus::Unlocked)
        );
    }

    #[tokio::test]
    async fn get_all_for_course_returns_existing_statuses_without_initializing_missing_rows() {
        insert_data!(:tx, :user, user_2: user_2, :org, course: course, instance: _instance, :course_module);
        let chapter = crate::chapters::insert(
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

        unlock_chapter(tx.as_mut(), user, chapter, course)
            .await
            .unwrap();

        let statuses = get_all_for_course(tx.as_mut(), course).await.unwrap();

        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].user_id, user);
        assert_eq!(statuses[0].chapter_id, chapter);
        assert_eq!(statuses[0].status, ChapterLockingStatus::Unlocked);
        assert!(statuses.iter().all(|status| status.user_id != user_2));
    }

    #[tokio::test]
    async fn unlock_chapters_for_user_only_updates_selected_chapters() {
        insert_data!(:tx, :user, :org, course: course);

        let all_modules = crate::course_modules::get_by_course_id(tx.as_mut(), course)
            .await
            .unwrap();
        let base_module = all_modules
            .into_iter()
            .find(|m| m.order_number == 0)
            .unwrap();

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
                course_module_id: Some(base_module.id),
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
                course_module_id: Some(base_module.id),
            },
        )
        .await
        .unwrap();

        complete_and_lock_chapter(tx.as_mut(), user, chapter1, course)
            .await
            .unwrap();
        complete_and_lock_chapter(tx.as_mut(), user, chapter2, course)
            .await
            .unwrap();

        unlock_chapters_for_user(tx.as_mut(), user, course, &[chapter1])
            .await
            .unwrap();

        let chapter1_status = get_or_init_status(tx.as_mut(), user, chapter1, Some(course), None)
            .await
            .unwrap();
        let chapter2_status = get_or_init_status(tx.as_mut(), user, chapter2, Some(course), None)
            .await
            .unwrap();

        assert_eq!(chapter1_status, Some(ChapterLockingStatus::Unlocked));
        assert_eq!(
            chapter2_status,
            Some(ChapterLockingStatus::CompletedAndLocked)
        );
    }
}
