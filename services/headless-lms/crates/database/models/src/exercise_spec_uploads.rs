//! Files uploaded through the exercise-service upload route, which is how a teacher's CMS editor
//! and the playground store files.
//!
//! These are recorded so that abandoned ones can be reclaimed. Nothing else can: the host never
//! reads a spec blob, so a stored file's only reference may live inside content the host cannot
//! parse. The counterpart is [`crate::exercise_task_spec_files`], where an exercise service
//! declares which files its spec actually names.

use crate::prelude::*;
use chrono::Duration;

/// Cap on one reaper run's listing, bounding its object-store fan-out and its runtime under the
/// CronJob deadline. A backlog is worked off over successive runs.
const REAP_BATCH_LIMIT: i64 = 1000;

/// Records freshly uploaded files so the reaper can later tell an abandoned one from a file it
/// knows nothing about.
pub async fn insert_many(
    conn: &mut PgConnection,
    exercise_service_slug: &str,
    uploaded_by_user: Option<Uuid>,
    file_upload_ids: &[Uuid],
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exercise_spec_uploads (file_upload_id, exercise_service_slug, uploaded_by_user)
SELECT file_upload_id,
  $2,
  $3
FROM UNNEST($1::uuid []) AS t(file_upload_id)
",
        file_upload_ids,
        exercise_service_slug,
        uploaded_by_user
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// An upload the reaper may remove: old enough, and named by no spec anywhere.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReapableUpload {
    pub id: Uuid,
    pub file_upload_id: Uuid,
    /// Object-store path of the file to remove.
    pub path: String,
}

/// Uploads older than seven days that no live spec and no page-history version references, oldest
/// first, at most [`REAP_BATCH_LIMIT`] of them.
///
/// Seven days is generous on purpose: the window has to cover the gap between uploading a file and
/// saving the page that references it, which is a teacher's editing session and can span days.
///
/// `FROM exercise_spec_uploads` is the safety property of this whole feature, not an optimisation:
/// `file_uploads` also holds CMS media, organization images, certificates and answer files, none of
/// which are recorded here, so the host cannot tell whether one is still needed. Widening this
/// query to `file_uploads` would silently destroy course media. Never do it.
///
/// The `declares_spec_files` gate is the second half of that safety. A service that does not
/// declare what its specs reference gives the host no evidence at all that a file is unused, so
/// none of its uploads are ever considered — the flag exists precisely so services written before
/// the declarations do not lose files. The playground is exempt because it has no specs and no
/// exercise service behind its reserved slug: what it uploads is throwaway by construction.
///
/// Both reference tables are consulted, and the history one is why this reaper collects less than
/// it looks like it should: a restore has to be able to bring back a version whose specs name a
/// file, so a file that ever reached a saved spec stays out of reach for as long as its history is
/// kept. What is left to collect is uploads that never made it into a save — a file the teacher
/// replaced before saving, or an editing session that was closed.
///
/// Progress is tracked by `file_uploads.deleted_at`, not by this table's: the upload is retired
/// first and the object removed afterwards, so a row whose object delete failed still has a live
/// `file_uploads` row and comes back on the next run. Filtering on `u.deleted_at IS NULL` instead
/// would make every transient object-store error orphan its object permanently.
pub async fn get_reapable(conn: &mut PgConnection) -> ModelResult<Vec<ReapableUpload>> {
    let res = sqlx::query_as!(
        ReapableUpload,
        "
SELECT u.id,
  u.file_upload_id,
  f.path
FROM exercise_spec_uploads AS u
  JOIN file_uploads AS f ON f.id = u.file_upload_id
WHERE f.deleted_at IS NULL
  AND u.created_at < now() - interval '7 days'
  AND (
    u.exercise_service_slug = 'playground'
    OR EXISTS (
      SELECT 1
      FROM exercise_services AS s
        JOIN exercise_service_info AS i ON i.exercise_service_id = s.id
      WHERE s.slug = u.exercise_service_slug
        AND s.deleted_at IS NULL
        AND i.declares_spec_files
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_task_spec_files AS t
    WHERE t.file_upload_id = u.file_upload_id
      AND t.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM page_history_spec_files AS h
    WHERE h.file_upload_id = u.file_upload_id
      AND h.deleted_at IS NULL
  )
ORDER BY u.created_at
LIMIT $1
",
        REAP_BATCH_LIMIT
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Retires an upload. Idempotent, so a run retrying a failed object delete can call it again.
///
/// Re-checks the two reference tables under a row lock, and reports `false` if a save has come to
/// reference the upload since `get_reapable` listed it. The lock is taken in a statement of its own
/// because under READ COMMITTED a statement's snapshot is fixed when it starts and Postgres
/// refreshes only the row an `UPDATE` locks, never the rows its subqueries read: a single locking
/// `UPDATE` would block on a concurrent save, unblock, and then evaluate `NOT EXISTS` against a
/// snapshot from before that save committed.
pub async fn mark_reaped(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let mut tx = conn.begin().await?;
    let locked = sqlx::query_scalar!(
        "
SELECT id
FROM exercise_spec_uploads
WHERE id = $1
FOR UPDATE
",
        id
    )
    .fetch_optional(&mut *tx)
    .await?;
    if locked.is_none() {
        tx.rollback().await?;
        return Ok(false);
    }
    let retired = sqlx::query_scalar!(
        "
UPDATE exercise_spec_uploads AS u
SET deleted_at = COALESCE(u.deleted_at, now())
WHERE u.id = $1
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_task_spec_files AS t
    WHERE t.file_upload_id = u.file_upload_id
      AND t.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM page_history_spec_files AS h
    WHERE h.file_upload_id = u.file_upload_id
      AND h.deleted_at IS NULL
  )
RETURNING u.id
",
        id
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(retired.is_some())
}

/// The recorded upload for a file, if any. `deleted` marks one the reaper has retired.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecUpload {
    pub id: Uuid,
    pub file_upload_id: Uuid,
    pub deleted: bool,
}

pub async fn get_by_file_upload_id(
    conn: &mut PgConnection,
    file_upload_id: Uuid,
) -> ModelResult<Option<SpecUpload>> {
    let res = sqlx::query!(
        "
SELECT id,
  file_upload_id,
  deleted_at
FROM exercise_spec_uploads
WHERE file_upload_id = $1
",
        file_upload_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res.map(|row| SpecUpload {
        id: row.id,
        file_upload_id: row.file_upload_id,
        deleted: row.deleted_at.is_some(),
    }))
}

/// Ages a recorded upload, so a test can reach the retention window without waiting a week.
pub async fn backdate(
    conn: &mut PgConnection,
    file_upload_id: Uuid,
    age: Duration,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_spec_uploads
SET created_at = now() - $2::interval
WHERE file_upload_id = $1
",
        file_upload_id,
        age as Duration
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::exercise_task_spec_files::SpecKind;
    use crate::test_helper::*;

    const DECLARING_SLUG: &str = "declaring-service";
    const SILENT_SLUG: &str = "silent-service";

    async fn insert_file(tx: &mut PgConnection, name: &str) -> Uuid {
        crate::file_uploads::insert(
            tx,
            name,
            &format!("{DECLARING_SLUG}/{name}"),
            "application/octet-stream",
            None,
            None,
        )
        .await
        .unwrap()
    }

    /// A service and its info row, since the reaper only considers uploads of a service that
    /// declares what its specs reference.
    async fn insert_service(tx: &mut PgConnection, slug: &str, declares_spec_files: bool) {
        let service = crate::exercise_services::insert_exercise_service(
            tx,
            &crate::exercise_services::ExerciseServiceNewOrUpdate {
                name: slug.to_string(),
                slug: slug.to_string(),
                public_url: format!("http://{slug}.example.com/api/service-info"),
                internal_url: None,
                max_reprocessing_submissions_at_once: 1,
            },
        )
        .await
        .unwrap();
        crate::exercise_service_info::insert(
            tx,
            &crate::exercise_service_info::PathInfo {
                exercise_service_id: service.id,
                user_interface_iframe_path: "/iframe".to_string(),
                grade_endpoint_path: "/api/grade".to_string(),
                public_spec_endpoint_path: "/api/public-spec".to_string(),
                model_solution_spec_endpoint_path: "/api/model-solution".to_string(),
                has_custom_view: false,
                supports_native_client: false,
                produces_file_answers: false,
                declares_spec_files,
            },
        )
        .await
        .unwrap();
    }

    /// Records an abandoned-looking upload: old enough, declared by nothing.
    async fn insert_stale_upload(tx: &mut PgConnection, slug: &str, name: &str) -> Uuid {
        let file_id = insert_file(&mut *tx, name).await;
        insert_many(&mut *tx, slug, None, &[file_id]).await.unwrap();
        backdate(&mut *tx, file_id, Duration::days(8))
            .await
            .unwrap();
        file_id
    }

    fn lists(reapable: &[ReapableUpload], file_upload_id: Uuid) -> bool {
        reapable
            .iter()
            .any(|upload| upload.file_upload_id == file_upload_id)
    }

    #[tokio::test]
    async fn lists_an_upload_no_spec_declares() {
        insert_data!(:tx, user:_user, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:_exercise, slide:_slide, task:_task);
        insert_service(tx.as_mut(), DECLARING_SLUG, true).await;
        let file_id = insert_stale_upload(tx.as_mut(), DECLARING_SLUG, "abandoned").await;

        let reapable = get_reapable(tx.as_mut()).await.unwrap();

        assert!(lists(&reapable, file_id));
    }

    #[tokio::test]
    async fn spares_an_upload_inside_the_retention_window() {
        insert_data!(:tx, user:_user, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:_exercise, slide:_slide, task:_task);
        insert_service(tx.as_mut(), DECLARING_SLUG, true).await;
        let file_id = insert_file(tx.as_mut(), "fresh").await;
        insert_many(tx.as_mut(), DECLARING_SLUG, None, &[file_id])
            .await
            .unwrap();

        let reapable = get_reapable(tx.as_mut()).await.unwrap();

        assert!(!lists(&reapable, file_id));
    }

    /// The gate that protects every service written before the declarations existed: without a
    /// declaration the host has no evidence a file is unused, so it must keep it.
    #[tokio::test]
    async fn never_lists_an_upload_of_a_service_that_declares_nothing() {
        insert_data!(:tx, user:_user, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:_exercise, slide:_slide, task:_task);
        insert_service(tx.as_mut(), SILENT_SLUG, false).await;
        let file_id = insert_stale_upload(tx.as_mut(), SILENT_SLUG, "kept-forever").await;

        let reapable = get_reapable(tx.as_mut()).await.unwrap();

        assert!(!lists(&reapable, file_id));
    }

    /// The playground has no specs and no service behind its reserved slug, so what it stores is
    /// throwaway and reapable without any declaration.
    #[tokio::test]
    async fn lists_a_playground_upload_although_no_service_declares() {
        insert_data!(:tx, user:_user, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:_exercise, slide:_slide, task:_task);
        let file_id = insert_stale_upload(tx.as_mut(), "playground", "playground-file").await;

        let reapable = get_reapable(tx.as_mut()).await.unwrap();

        assert!(lists(&reapable, file_id));
    }

    #[tokio::test]
    async fn spares_an_upload_a_live_spec_declares() {
        insert_data!(:tx, user:_user, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:_exercise, slide:_slide, task:task_id);
        insert_service(tx.as_mut(), DECLARING_SLUG, true).await;
        let file_id = insert_stale_upload(tx.as_mut(), DECLARING_SLUG, "in-a-spec").await;
        crate::exercise_task_spec_files::replace_for_exercise_task(
            tx.as_mut(),
            task_id,
            SpecKind::Private,
            &[file_id],
        )
        .await
        .unwrap();

        let reapable = get_reapable(tx.as_mut()).await.unwrap();

        assert!(!lists(&reapable, file_id));
    }

    /// A derived spec's declaration counts too. It is the only one that can: a file uploaded while
    /// deriving is named by no private spec, so checking one kind would delete tmc's stub archives.
    #[tokio::test]
    async fn spares_an_upload_only_a_derived_spec_declares() {
        insert_data!(:tx, user:_user, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:_exercise, slide:_slide, task:task_id);
        insert_service(tx.as_mut(), DECLARING_SLUG, true).await;
        let file_id = insert_stale_upload(tx.as_mut(), DECLARING_SLUG, "stub-archive").await;
        crate::exercise_task_spec_files::replace_for_exercise_task(
            tx.as_mut(),
            task_id,
            SpecKind::Public,
            &[file_id],
        )
        .await
        .unwrap();

        let reapable = get_reapable(tx.as_mut()).await.unwrap();

        assert!(!lists(&reapable, file_id));
    }

    /// A file dropped from the current spec but still named by a snapshot a restore could bring
    /// back. This is what makes the reaper collect abandoned uploads rather than dropped files.
    #[tokio::test]
    async fn spares_an_upload_only_page_history_declares() {
        insert_data!(:tx, user:user_id, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:page_id, exercise:_exercise, slide:_slide, task:_task);
        insert_service(tx.as_mut(), DECLARING_SLUG, true).await;
        let file_id =
            insert_stale_upload(tx.as_mut(), DECLARING_SLUG, "dropped-but-in-history").await;
        let history_id = crate::page_history::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            page_id,
            "Snapshot",
            &crate::page_history::PageHistoryContent {
                content: serde_json::json!([]),
                exercises: vec![],
                exercise_slides: vec![],
                exercise_tasks: vec![],
                peer_or_self_review_configs: vec![],
                peer_or_self_review_questions: vec![],
            },
            crate::page_history::HistoryChangeReason::PageSaved,
            user_id,
            None,
        )
        .await
        .unwrap();
        crate::page_history_spec_files::insert_many(tx.as_mut(), history_id, &[file_id])
            .await
            .unwrap();

        let reapable = get_reapable(tx.as_mut()).await.unwrap();

        assert!(!lists(&reapable, file_id));
    }

    /// The re-check under the row lock, which is what stops a reap landing between `get_reapable`
    /// and the delete of a file a save has since declared.
    #[tokio::test]
    async fn declines_to_retire_an_upload_declared_after_it_was_listed() {
        insert_data!(:tx, user:_user, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:_exercise, slide:_slide, task:task_id);
        insert_service(tx.as_mut(), DECLARING_SLUG, true).await;
        let file_id = insert_stale_upload(tx.as_mut(), DECLARING_SLUG, "declared-late").await;
        let listed = get_reapable(tx.as_mut()).await.unwrap();
        let upload = listed
            .iter()
            .find(|upload| upload.file_upload_id == file_id)
            .expect("listed");
        crate::exercise_task_spec_files::replace_for_exercise_task(
            tx.as_mut(),
            task_id,
            SpecKind::Private,
            &[file_id],
        )
        .await
        .unwrap();

        assert!(!mark_reaped(tx.as_mut(), upload.id).await.unwrap());
        assert_eq!(
            get_by_file_upload_id(tx.as_mut(), file_id)
                .await
                .unwrap()
                .map(|recorded| recorded.deleted),
            Some(false)
        );
    }

    #[tokio::test]
    async fn retires_an_upload_nothing_declares() {
        insert_data!(:tx, user:_user, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:_exercise, slide:_slide, task:_task);
        insert_service(tx.as_mut(), DECLARING_SLUG, true).await;
        let file_id = insert_stale_upload(tx.as_mut(), DECLARING_SLUG, "retired").await;
        let recorded = get_by_file_upload_id(tx.as_mut(), file_id)
            .await
            .unwrap()
            .expect("recorded");

        assert!(mark_reaped(tx.as_mut(), recorded.id).await.unwrap());

        assert_eq!(
            get_by_file_upload_id(tx.as_mut(), file_id)
                .await
                .unwrap()
                .map(|recorded| recorded.deleted),
            Some(true),
            "the row survives soft-deleted, as the audit trail of what was reclaimed"
        );
    }
}
