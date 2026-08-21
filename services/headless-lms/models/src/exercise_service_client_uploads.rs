//! Files uploaded through the exercise-services client API, bound to the exercise and user
//! they were uploaded for.
//!
//! The binding is what lets submit reject a file uploaded for a different exercise; ownership
//! alone would let any exercise's submission name any of the user's uploads. It lives in its own
//! table rather than as a nullable column on `file_uploads` because `file_uploads` is shared with
//! CMS media, organization images, certificates and iframe-uploaded answer files, and the reaper's
//! safety depends on the distinction being structural.

use crate::prelude::*;
use chrono::Duration;

/// A client upload as seen by submit validation. `deleted` distinguishes a reaped upload
/// (answerable with `upload_expired`) from one that was never recorded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClientUpload {
    pub file_upload_id: Uuid,
    pub deleted: bool,
}

/// Binds freshly uploaded files to the exercise and user they were uploaded for.
pub async fn insert_many(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    user_id: Uuid,
    file_upload_ids: &[Uuid],
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO exercise_service_client_uploads (file_upload_id, exercise_id, user_id)
SELECT file_upload_id,
  $2,
  $3
FROM UNNEST($1::uuid []) AS t(file_upload_id)
",
        file_upload_ids,
        exercise_id,
        user_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The requested uploads that belong to this exercise and user, soft-deleted ones included.
///
/// Rows bound to another exercise or another user are deliberately not returned: to the caller
/// they must be indistinguishable from ids that were never uploaded, so a foreign id leaks
/// nothing beyond "not yours".
pub async fn get_for_exercise_and_user(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    user_id: Uuid,
    file_upload_ids: &[Uuid],
) -> ModelResult<Vec<ClientUpload>> {
    let res = sqlx::query!(
        "
SELECT file_upload_id,
  deleted_at
FROM exercise_service_client_uploads
WHERE file_upload_id = ANY($1)
  AND exercise_id = $2
  AND user_id = $3
",
        file_upload_ids,
        exercise_id,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res
        .into_iter()
        .map(|row| ClientUpload {
            file_upload_id: row.file_upload_id,
            deleted: row.deleted_at.is_some(),
        })
        .collect())
}

/// Like [`get_for_exercise_and_user`], but takes a row lock on the bindings so the reaper cannot
/// retire them between this check and the caller's `exercise_task_submission_files` insert.
///
/// Must be called inside the transaction that later records the association, or the lock is
/// released before it protects anything. Without it, a reap that lands between validation and the
/// association commits a submission whose files are already gone: `download_submission` then
/// reports zero files forever and the student never sees `upload_expired`.
pub async fn lock_for_exercise_and_user(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    exercise_id: Uuid,
    user_id: Uuid,
    file_upload_ids: &[Uuid],
) -> ModelResult<Vec<ClientUpload>> {
    let res = sqlx::query!(
        "
SELECT file_upload_id,
  deleted_at
FROM exercise_service_client_uploads
WHERE file_upload_id = ANY($1)
  AND exercise_id = $2
  AND user_id = $3
FOR UPDATE
",
        file_upload_ids,
        exercise_id,
        user_id
    )
    .fetch_all(&mut **tx)
    .await?;
    Ok(res
        .into_iter()
        .map(|row| ClientUpload {
            file_upload_id: row.file_upload_id,
            deleted: row.deleted_at.is_some(),
        })
        .collect())
}

/// Oldest upload time the reaper still spares. Kept short because an upload is only ever meant
/// to live for the few seconds between a client's upload call and its submit call.
pub fn retention_cutoff(now: DateTime<Utc>) -> DateTime<Utc> {
    now - Duration::hours(1)
}

/// An upload the reaper may remove: old enough, and named by no submission.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReapableUpload {
    pub id: Uuid,
    pub file_upload_id: Uuid,
    /// Object-store path of the file to remove.
    pub path: String,
}

/// Client uploads created before `cutoff` that no submission was ever made from.
///
/// `FROM exercise_service_client_uploads` is the safety property of this whole feature, not an
/// optimisation: `file_uploads` also holds CMS media, organization images, certificates and
/// iframe-uploaded answer files, and iframe uploads are referenced only from inside opaque
/// answer blobs the host cannot parse, so the host cannot tell whether one is still needed.
/// Widening this query to `file_uploads` would silently destroy student answers and course
/// media. Never do it.
///
/// Progress is tracked by `file_uploads.deleted_at`, not by the binding's: the binding is retired
/// first and the object removed afterwards, so a row whose object delete failed still has a live
/// `file_uploads` row and comes back on the next run. Filtering on `u.deleted_at IS NULL` instead
/// would make every transient object-store error orphan its object permanently.
pub async fn get_reapable(
    conn: &mut PgConnection,
    cutoff: DateTime<Utc>,
) -> ModelResult<Vec<ReapableUpload>> {
    let res = sqlx::query_as!(
        ReapableUpload,
        "
SELECT u.id,
  u.file_upload_id,
  f.path
FROM exercise_service_client_uploads AS u
  JOIN file_uploads AS f ON f.id = u.file_upload_id
WHERE f.deleted_at IS NULL
  AND u.created_at < $1
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_task_submission_files AS s
    WHERE s.file_upload_id = u.file_upload_id
      AND s.deleted_at IS NULL
  )
ORDER BY u.created_at
",
        cutoff
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Retires an upload, keeping the row so a submit naming it answers `upload_expired` instead of
/// the misleading `unknown_upload`. Idempotent, so a run retrying a failed object delete can call
/// it again.
///
/// Re-checks that no submission has come to reference the upload since `get_reapable` listed it,
/// and reports `false` if one has. That re-check plus the row lock
/// [`lock_for_exercise_and_user`] takes is what stops a reap from landing in the middle of a
/// submit and destroying its files.
///
/// The lock is taken in a statement of its own, and that ordering is the whole point. Under READ
/// COMMITTED a statement's snapshot is fixed when the statement starts, and Postgres refreshes only
/// the row an `UPDATE` locks — never the rows its subqueries read. So a single locking `UPDATE`
/// blocks on the submit's lock, unblocks, and then evaluates `NOT EXISTS` against a snapshot from
/// *before* the submit committed: it finds no submission and reaps the files of a submission that
/// already answered 200. Locking first makes the `UPDATE` a later statement, so its snapshot
/// includes that commit.
pub async fn mark_reaped(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let mut tx = conn.begin().await?;
    let locked = sqlx::query_scalar!(
        "
SELECT id
FROM exercise_service_client_uploads
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
UPDATE exercise_service_client_uploads AS u
SET deleted_at = COALESCE(u.deleted_at, now())
WHERE u.id = $1
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_task_submission_files AS s
    WHERE s.file_upload_id = u.file_upload_id
      AND s.deleted_at IS NULL
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

#[cfg(test)]
mod test {
    use super::*;
    use crate::test_helper::*;

    async fn insert_file(tx: &mut PgConnection, name: &str) -> Uuid {
        crate::file_uploads::insert(
            tx,
            name,
            &format!("exercise-services-client/{name}"),
            "application/octet-stream",
            None,
        )
        .await
        .unwrap()
    }

    /// Deliberately not a `query!`: `cargo sqlx prepare -- --lib` does not cache test-only
    /// queries, so a checked macro here would break every offline build. Same for the raw
    /// queries below.
    async fn soft_delete(tx: &mut PgConnection, file_upload_id: Uuid) {
        sqlx::query(
            "UPDATE exercise_service_client_uploads SET deleted_at = now() WHERE file_upload_id = $1",
        )
        .bind(file_upload_id)
        .execute(tx)
        .await
        .unwrap();
    }

    async fn insert_file_at(tx: &mut PgConnection, name: &str, path: &str) -> Uuid {
        crate::file_uploads::insert(tx, name, path, "application/octet-stream", None)
            .await
            .unwrap()
    }

    /// Backdates both the binding and the file, so that a query widened to `file_uploads` cannot
    /// pass the negative test by accidentally tripping the age filter.
    async fn backdate_file(tx: &mut PgConnection, file_upload_id: Uuid, age: Duration) {
        sqlx::query("UPDATE file_uploads SET created_at = now() - $2 WHERE id = $1")
            .bind(file_upload_id)
            .bind(age)
            .execute(tx)
            .await
            .unwrap();
    }

    async fn backdate(tx: &mut PgConnection, file_upload_id: Uuid, age: Duration) {
        backdate_file(&mut *tx, file_upload_id, age).await;
        sqlx::query(
            "UPDATE exercise_service_client_uploads SET created_at = now() - $2 WHERE file_upload_id = $1",
        )
        .bind(file_upload_id)
        .bind(age)
        .execute(tx)
        .await
        .unwrap();
    }

    /// Records a task submission made from the given uploads, the thing that makes an upload
    /// permanently un-reapable.
    async fn insert_task_submission_referencing(
        tx: &mut PgConnection,
        course_id: Uuid,
        user_id: Uuid,
        exercise_id: Uuid,
        slide_id: Uuid,
        task_id: Uuid,
        file_upload_ids: &[Uuid],
    ) -> Option<Uuid> {
        let slide_submission = crate::exercise_slide_submissions::insert_exercise_slide_submission(
            &mut *tx,
            crate::exercise_slide_submissions::NewExerciseSlideSubmission {
                exercise_slide_id: slide_id,
                course_id: Some(course_id),
                exam_id: None,
                user_id,
                exercise_id,
                user_points_update_strategy:
                    crate::exercise_task_gradings::UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
            },
        )
        .await
        .unwrap();
        let task_submission = crate::exercise_task_submissions::insert(
            &mut *tx,
            PKeyPolicy::Generate,
            slide_submission.id,
            slide_id,
            task_id,
            &serde_json::json!({ "opaque": "plugin owned" }),
        )
        .await
        .unwrap();
        crate::exercise_task_submission_files::insert_many(
            &mut *tx,
            task_submission,
            file_upload_ids,
        )
        .await
        .unwrap();
        Some(task_submission)
    }

    async fn reapable_file_ids(tx: &mut PgConnection) -> Vec<Uuid> {
        get_reapable(tx, retention_cutoff(Utc::now()))
            .await
            .unwrap()
            .into_iter()
            .map(|upload| upload.file_upload_id)
            .collect()
    }

    #[tokio::test]
    async fn finds_only_uploads_bound_to_the_same_exercise_and_user() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:chapter_id, page:page_id, exercise:exercise_id, slide:_slide, task:_task);
        let other_exercise = crate::exercises::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            course_id,
            "Other",
            page_id,
            chapter_id,
            1,
        )
        .await
        .unwrap();
        let other_user = crate::users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "other@example.com",
            None,
            None,
        )
        .await
        .unwrap();

        let mine = insert_file(tx.as_mut(), "mine").await;
        let for_other_exercise = insert_file(tx.as_mut(), "other-exercise").await;
        let for_other_user = insert_file(tx.as_mut(), "other-user").await;
        insert_many(tx.as_mut(), exercise_id, user_id, &[mine])
            .await
            .unwrap();
        insert_many(tx.as_mut(), other_exercise, user_id, &[for_other_exercise])
            .await
            .unwrap();
        insert_many(tx.as_mut(), exercise_id, other_user, &[for_other_user])
            .await
            .unwrap();

        let found = get_for_exercise_and_user(
            tx.as_mut(),
            exercise_id,
            user_id,
            &[mine, for_other_exercise, for_other_user],
        )
        .await
        .unwrap();
        assert_eq!(
            found,
            vec![ClientUpload {
                file_upload_id: mine,
                deleted: false
            }]
        );
        tx.rollback().await;
    }

    /// A reaped upload must still be found, or submit cannot tell "expired" from "never yours".
    #[tokio::test]
    async fn a_soft_deleted_upload_is_still_found_and_flagged() {
        insert_data!(:tx, user:user_id, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:_slide, task:_task);
        let file_id = insert_file(tx.as_mut(), "reaped").await;
        insert_many(tx.as_mut(), exercise_id, user_id, &[file_id])
            .await
            .unwrap();
        soft_delete(tx.as_mut(), file_id).await;

        let found = get_for_exercise_and_user(tx.as_mut(), exercise_id, user_id, &[file_id])
            .await
            .unwrap();
        assert_eq!(
            found,
            vec![ClientUpload {
                file_upload_id: file_id,
                deleted: true
            }]
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn an_unrecorded_id_is_not_found() {
        insert_data!(:tx, user:user_id, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:_slide, task:_task);
        let found = get_for_exercise_and_user(tx.as_mut(), exercise_id, user_id, &[Uuid::new_v4()])
            .await
            .unwrap();
        assert!(found.is_empty());
        assert!(
            get_for_exercise_and_user(tx.as_mut(), exercise_id, user_id, &[])
                .await
                .unwrap()
                .is_empty()
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn inserting_an_empty_list_records_nothing() {
        insert_data!(:tx, user:user_id, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:_slide, task:_task);
        insert_many(tx.as_mut(), exercise_id, user_id, &[])
            .await
            .unwrap();
        tx.rollback().await;
    }

    #[tokio::test]
    async fn reaps_only_uploads_past_the_retention_window() {
        insert_data!(:tx, user:user_id, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:_slide, task:_task);
        let just_under = insert_file(tx.as_mut(), "just-under").await;
        let just_over = insert_file(tx.as_mut(), "just-over").await;
        insert_many(tx.as_mut(), exercise_id, user_id, &[just_under, just_over])
            .await
            .unwrap();
        backdate(tx.as_mut(), just_under, Duration::minutes(59)).await;
        backdate(tx.as_mut(), just_over, Duration::minutes(61)).await;

        assert_eq!(reapable_file_ids(tx.as_mut()).await, vec![just_over]);
        tx.rollback().await;
    }

    /// A fully reaped upload drops out of the listing, and its binding survives soft-deleted so
    /// submit can still answer `upload_expired`.
    #[tokio::test]
    async fn a_fully_reaped_upload_is_not_reaped_again() {
        insert_data!(:tx, user:user_id, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:_slide, task:_task);
        let file_id = insert_file(tx.as_mut(), "old").await;
        insert_many(tx.as_mut(), exercise_id, user_id, &[file_id])
            .await
            .unwrap();
        backdate(tx.as_mut(), file_id, Duration::hours(2)).await;
        assert_eq!(reapable_file_ids(tx.as_mut()).await, vec![file_id]);

        let id = get_reapable(tx.as_mut(), retention_cutoff(Utc::now()))
            .await
            .unwrap()[0]
            .id;
        assert!(mark_reaped(tx.as_mut(), id).await.unwrap());
        // Removing the file row is what records that the object is gone.
        crate::file_uploads::delete_and_fetch_path(tx.as_mut(), file_id)
            .await
            .unwrap();

        assert!(reapable_file_ids(tx.as_mut()).await.is_empty());
        assert_eq!(
            get_for_exercise_and_user(tx.as_mut(), exercise_id, user_id, &[file_id])
                .await
                .unwrap(),
            vec![ClientUpload {
                file_upload_id: file_id,
                deleted: true
            }]
        );
        tx.rollback().await;
    }

    #[tokio::test]
    async fn an_upload_a_submission_was_made_from_is_never_reaped() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let submitted = insert_file(tx.as_mut(), "submitted").await;
        let orphan = insert_file(tx.as_mut(), "orphan").await;
        insert_many(tx.as_mut(), exercise_id, user_id, &[submitted, orphan])
            .await
            .unwrap();
        backdate(tx.as_mut(), submitted, Duration::hours(2)).await;
        backdate(tx.as_mut(), orphan, Duration::hours(2)).await;

        insert_task_submission_referencing(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
            &[submitted],
        )
        .await;

        assert_eq!(reapable_file_ids(tx.as_mut()).await, vec![orphan]);
        tx.rollback().await;
    }

    /// The load-bearing negative test. `file_uploads` is shared with CMS media, organization
    /// images and iframe-uploaded student answers, and the host cannot tell whether an iframe
    /// upload is still referenced, because that reference lives inside an opaque answer blob.
    /// Anyone widening `get_reapable` to select from `file_uploads` must fail here.
    #[tokio::test]
    async fn uploads_outside_the_client_api_are_never_reaped() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:_slide, task:_task);
        let org_id = crate::organizations::all_organizations(tx.as_mut())
            .await
            .unwrap()[0]
            .id;

        let iframe_answer =
            insert_file_at(tx.as_mut(), "answer.tar.zst", "tmc/AbCdEfGhIjKlMnOp").await;
        let cms_media = insert_file_at(
            tx.as_mut(),
            "lecture.pdf",
            &format!("course/{course_id}/files/qRsTuVwXyZ"),
        )
        .await;
        let organization_image = insert_file_at(
            tx.as_mut(),
            "logo.png",
            &format!("organization/{org_id}/images/aBcDeFgHiJ"),
        )
        .await;
        let client_upload = insert_file(tx.as_mut(), "orphan").await;
        insert_many(tx.as_mut(), exercise_id, user_id, &[client_upload])
            .await
            .unwrap();
        backdate(tx.as_mut(), client_upload, Duration::hours(2)).await;
        for foreign in [iframe_answer, cms_media, organization_image] {
            backdate_file(tx.as_mut(), foreign, Duration::hours(2)).await;
        }

        assert_eq!(reapable_file_ids(tx.as_mut()).await, vec![client_upload]);
        tx.rollback().await;
    }

    /// The submit side of the reap race. A reaper that listed this upload as orphaned before the
    /// submission referenced it must not go through with the reap, or the submission commits with
    /// its files already gone.
    ///
    /// This covers the interleaving logically, in one transaction. The row lock that makes the two
    /// orderings the *only* possibilities needs two connections, and so committed fixtures, which
    /// this harness cannot produce; that half lives in the server crate, as
    /// `programs::exercise_service_client_upload_reaper`'s
    /// `a_concurrent_reaper_blocks_on_the_submit_lock_and_then_declines_to_reap`.
    #[tokio::test]
    async fn a_reap_cannot_retire_an_upload_a_submission_just_referenced() {
        insert_data!(:tx, user:user_id, :org, course:course_id, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:slide_id, task:task_id);
        let file_id = insert_file(tx.as_mut(), "raced").await;
        insert_many(tx.as_mut(), exercise_id, user_id, &[file_id])
            .await
            .unwrap();
        backdate(tx.as_mut(), file_id, Duration::hours(2)).await;

        // The reaper lists it while the submit is still validating.
        let listed = get_reapable(tx.as_mut(), retention_cutoff(Utc::now()))
            .await
            .unwrap();
        assert_eq!(listed.len(), 1);

        // The submit wins the race and records the association.
        let task_submission = insert_task_submission_referencing(
            tx.as_mut(),
            course_id,
            user_id,
            exercise_id,
            slide_id,
            task_id,
            &[file_id],
        )
        .await;
        assert!(task_submission.is_some());

        assert!(
            !mark_reaped(tx.as_mut(), listed[0].id).await.unwrap(),
            "the reaper must abandon an upload that became referenced after it was listed"
        );
        assert_eq!(
            get_for_exercise_and_user(tx.as_mut(), exercise_id, user_id, &[file_id])
                .await
                .unwrap(),
            vec![ClientUpload {
                file_upload_id: file_id,
                deleted: false
            }],
            "the upload must stay usable, so download_submission can still serve it"
        );
        tx.rollback().await;
    }

    /// The other ordering: the reaper wins, and the locked re-check submit runs inside its own
    /// transaction reports the upload as expired instead of letting a fileless submission commit.
    #[tokio::test]
    async fn a_locked_lookup_reports_an_upload_the_reaper_already_retired() {
        insert_data!(:tx, user:user_id, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:_slide, task:_task);
        let file_id = insert_file(tx.as_mut(), "reaped-first").await;
        insert_many(tx.as_mut(), exercise_id, user_id, &[file_id])
            .await
            .unwrap();
        backdate(tx.as_mut(), file_id, Duration::hours(2)).await;
        let listed = get_reapable(tx.as_mut(), retention_cutoff(Utc::now()))
            .await
            .unwrap();
        assert!(mark_reaped(tx.as_mut(), listed[0].id).await.unwrap());

        let mut inner = tx.begin().await;
        let locked = lock_for_exercise_and_user(inner.as_mut(), exercise_id, user_id, &[file_id])
            .await
            .unwrap();
        assert_eq!(
            locked,
            vec![ClientUpload {
                file_upload_id: file_id,
                deleted: true
            }]
        );
        inner.rollback().await;
        tx.rollback().await;
    }

    /// A run retrying an object delete that failed earlier calls `mark_reaped` again on a row it
    /// already retired; that must succeed, not read as "someone referenced it".
    #[tokio::test]
    async fn mark_reaped_is_idempotent_so_a_failed_object_delete_can_be_retried() {
        insert_data!(:tx, user:user_id, :org, course:_course, instance:_instance, course_module:_cm, chapter:_chapter, page:_page, exercise:exercise_id, slide:_slide, task:_task);
        let file_id = insert_file(tx.as_mut(), "retry").await;
        insert_many(tx.as_mut(), exercise_id, user_id, &[file_id])
            .await
            .unwrap();
        backdate(tx.as_mut(), file_id, Duration::hours(2)).await;
        let id = get_reapable(tx.as_mut(), retention_cutoff(Utc::now()))
            .await
            .unwrap()[0]
            .id;

        assert!(mark_reaped(tx.as_mut(), id).await.unwrap());
        assert!(mark_reaped(tx.as_mut(), id).await.unwrap());
        // Still listed, because the object delete has not been confirmed by removing the file row.
        assert_eq!(reapable_file_ids(tx.as_mut()).await, vec![file_id]);
        tx.rollback().await;
    }

    #[tokio::test]
    async fn the_retention_window_is_one_hour() {
        let now = Utc::now();
        assert_eq!(retention_cutoff(now), now - Duration::hours(1));
    }
}
