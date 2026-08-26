//! Removes files uploaded to be named in an exercise answer that no submission was ever made
//! from.
//!
//! How long an upload is spared depends on its origin, since a native client uploads immediately
//! before submitting while an iframe student may hold an upload for the length of an exam. The
//! binding row is soft-deleted rather than removed so that a submit naming a reaped file can
//! still answer `upload_expired` instead of the misleading `unknown_upload`.

use std::{env, path::Path};

use crate::config::{FileStoreRuntimeConfig, program_config::ProgramConfig};
use crate::{setup_file_store, setup_tracing};
use dotenvy::dotenv;
use futures::{StreamExt, stream};
use headless_lms_models::{self as models, error::TryToOptional};
use headless_lms_utils::file_store::FileStore;
use sqlx::{PgConnection, PgPool};

const MAX_CONCURRENT_REAPS: usize = 8;

pub async fn main() -> anyhow::Result<()> {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    dotenv().ok();
    setup_tracing()?;
    let database_url = ProgramConfig::database_url_with_default();
    let base_url = ProgramConfig::required("BASE_URL")?;
    let file_store = setup_file_store(&FileStoreRuntimeConfig::try_from_env()?, &base_url).await;
    let db_pool = PgPool::connect(&database_url).await?;
    reap(&db_pool, file_store.as_ref()).await
}

async fn reap(pool: &PgPool, file_store: &dyn FileStore) -> anyhow::Result<()> {
    let mut conn = pool.acquire().await?;
    let reapable = models::exercise_answer_uploads::get_reapable(&mut conn).await?;
    drop(conn);
    info!("Reaping {} orphaned answer uploads.", reapable.len());

    let mut reaped = 0;
    let mut skipped = 0;
    let mut failed = 0;
    let mut results = stream::iter(reapable)
        .map(|upload| async move {
            let file_upload_id = upload.file_upload_id;
            let result = match pool.acquire().await {
                Ok(mut conn) => reap_one(&mut conn, file_store, &upload).await,
                Err(err) => Err(err.into()),
            };
            (file_upload_id, result)
        })
        .buffer_unordered(MAX_CONCURRENT_REAPS);
    while let Some((file_upload_id, result)) = results.next().await {
        match result {
            Ok(true) => reaped += 1,
            Ok(false) => skipped += 1,
            Err(err) => {
                failed += 1;
                error!(
                    "Failed to reap answer upload {}: {:#?}",
                    file_upload_id, err
                );
            }
        }
    }
    info!(
        "Orphaned answer uploads reaped. Succeeded: {reaped}, skipped: {skipped}, failed: {failed}."
    );
    // The CronJob's exit status is the only signal anyone watches, so a run where every delete
    // failed must not look green.
    if failed > 0 {
        anyhow::bail!(
            "Failed to reap {failed} of {} answer uploads.",
            reaped + failed
        );
    }
    Ok(())
}

/// Retires the binding, removes the object, and only then soft-deletes the `file_uploads` row.
/// `Ok(false)` means a submission came to reference the upload after `get_reapable` listed it, so
/// it is no longer reapable.
///
/// The order matters in both directions. Retiring the binding first means a submit naming this
/// upload answers `upload_expired` rather than succeeding and handing the exercise service a URL
/// that 404s. Deleting the `file_uploads` row last means `get_reapable` still sees the row after a
/// failed object delete and retries it on a later run, instead of orphaning the object forever.
async fn reap_one(
    conn: &mut PgConnection,
    file_store: &dyn FileStore,
    upload: &models::exercise_answer_uploads::ReapableUpload,
) -> anyhow::Result<bool> {
    if !models::exercise_answer_uploads::mark_reaped(conn, upload.id).await? {
        return Ok(false);
    }
    file_store.delete(Path::new(&upload.path)).await?;
    // `optional` tolerates a file a previous interrupted run already soft-deleted, without
    // swallowing real database errors.
    models::file_uploads::delete_and_fetch_path(conn, upload.file_upload_id)
        .await
        .optional()?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;
    use chrono::Duration;
    use headless_lms_base::error::backend_error::BackendError;
    use headless_lms_utils::prelude::{UtilError, UtilErrorType, UtilResult};
    use std::sync::{LazyLock, Mutex};

    /// `reap` is global: it takes every eligible row in the shared test database, so two of
    /// these tests in flight at once reap each other's committed fixtures. Held for the whole test,
    /// fixtures included. Tokio's mutex rather than `std`'s, so one failing test does not poison
    /// the lock and fail the rest.
    static REAPER_TESTS: LazyLock<tokio::sync::Mutex<()>> =
        LazyLock::new(|| tokio::sync::Mutex::new(()));

    /// Records what the reaper asked it to delete. The real stores are irrelevant here: the
    /// property under test is which paths the reaper touches.
    #[derive(Default)]
    struct RecordingFileStore {
        deleted: Mutex<Vec<String>>,
    }

    #[async_trait::async_trait(?Send)]
    impl FileStore for RecordingFileStore {
        async fn upload(&self, _path: &Path, _contents: Vec<u8>, _mime: &str) -> UtilResult<()> {
            unimplemented!("not reached by the reaper")
        }

        async fn upload_stream(
            &self,
            _path: &Path,
            _contents: headless_lms_utils::file_store::GenericPayload,
            _mime: &str,
        ) -> UtilResult<()> {
            unimplemented!("not reached by the reaper")
        }

        async fn download(&self, _path: &Path) -> UtilResult<Vec<u8>> {
            unimplemented!("not reached by the reaper")
        }

        async fn download_stream(
            &self,
            _path: &Path,
        ) -> UtilResult<Box<dyn futures::Stream<Item = std::io::Result<bytes::Bytes>>>> {
            unimplemented!("not reached by the reaper")
        }

        async fn get_direct_download_url(&self, _path: &Path) -> UtilResult<String> {
            unimplemented!("not reached by the reaper")
        }

        async fn delete(&self, path: &Path) -> UtilResult<()> {
            self.deleted
                .lock()
                .expect("lock")
                .push(path.to_string_lossy().to_string());
            Ok(())
        }

        fn get_cache_files_folder_path(&self) -> UtilResult<&Path> {
            unimplemented!("not reached by the reaper")
        }
    }

    /// How many times the reaper touched `path`. Scoped this way because the tests commit their
    /// fixtures, so every run also sees the rows of whatever sibling test is running beside it.
    fn deletions_of(recorded: &Mutex<Vec<String>>, path: &str) -> usize {
        recorded
            .lock()
            .expect("lock")
            .iter()
            .filter(|recorded_path| recorded_path.as_str() == path)
            .count()
    }

    /// Covers the whole per-row sequence: the object goes, the file row is soft-deleted, and the
    /// binding survives soft-deleted so submit can still answer `upload_expired`.
    ///
    /// Committed, since `reap` now reaps each row over its own pool connection rather than the
    /// connection fixtures were inserted on.
    #[actix_web::test]
    async fn reaps_an_orphaned_upload_and_leaves_a_row_behind() {
        let _serialized = REAPER_TESTS.lock().await;
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let path = "exercise-services-client/orphan";
        let file_id = models::file_uploads::insert(
            tx.as_mut(),
            "orphan.tar.zst",
            path,
            "application/octet-stream",
            Some(user),
            None,
        )
        .await
        .expect("file upload");
        models::exercise_answer_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
            models::exercise_answer_uploads::AnswerUploadOrigin::NativeClient,
        )
        .await
        .expect("binding");
        backdate(tx.as_mut(), file_id, Duration::hours(2)).await;
        tx.commit().await;

        let pool = PgPool::connect(&test_database_url())
            .await
            .expect("test pool");
        let file_store = RecordingFileStore::default();
        reap(&pool, &file_store).await.expect("reap");

        assert_eq!(deletions_of(&file_store.deleted, path), 1);
        let mut check_conn = Conn::init().await;
        let mut check_tx = check_conn.begin().await;
        assert!(
            models::file_uploads::get_many(check_tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .is_empty()
        );
        let recorded = models::exercise_answer_uploads::get_for_exercise_and_user(
            check_tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
        .await
        .expect("binding lookup");
        assert_eq!(recorded.len(), 1);
        assert!(recorded[0].deleted);
        check_tx.rollback().await;
    }

    /// Committed, for the same reason as above.
    #[actix_web::test]
    async fn spares_an_upload_inside_the_retention_window() {
        let _serialized = REAPER_TESTS.lock().await;
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let file_id = models::file_uploads::insert(
            tx.as_mut(),
            "fresh.tar.zst",
            "exercise-services-client/fresh",
            "application/octet-stream",
            Some(user),
            None,
        )
        .await
        .expect("file upload");
        models::exercise_answer_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
            models::exercise_answer_uploads::AnswerUploadOrigin::NativeClient,
        )
        .await
        .expect("binding");
        tx.commit().await;

        let pool = PgPool::connect(&test_database_url())
            .await
            .expect("test pool");
        let file_store = RecordingFileStore::default();
        reap(&pool, &file_store).await.expect("reap");

        assert_eq!(
            deletions_of(&file_store.deleted, "exercise-services-client/fresh"),
            0
        );
        let mut check_conn = Conn::init().await;
        let mut check_tx = check_conn.begin().await;
        assert_eq!(
            models::file_uploads::get_many(check_tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .len(),
            1
        );
        check_tx.rollback().await;
    }

    /// The origin split, end to end: two hours is past a native client's window but nowhere near an
    /// iframe student's, who may still be holding the file mid-exam.
    ///
    /// Committed, for the same reason as the tests above.
    #[actix_web::test]
    async fn spares_an_iframe_upload_a_native_client_upload_would_lose() {
        let _serialized = REAPER_TESTS.lock().await;
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let path = "exercise-services-client/mid-exam";
        let file_id = models::file_uploads::insert(
            tx.as_mut(),
            "mid-exam.pdf",
            path,
            "application/pdf",
            Some(user),
            None,
        )
        .await
        .expect("file upload");
        models::exercise_answer_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
            models::exercise_answer_uploads::AnswerUploadOrigin::Iframe,
        )
        .await
        .expect("binding");
        backdate(tx.as_mut(), file_id, Duration::hours(2)).await;
        tx.commit().await;

        let pool = PgPool::connect(&test_database_url())
            .await
            .expect("test pool");
        let file_store = RecordingFileStore::default();
        reap(&pool, &file_store).await.expect("reap");

        assert_eq!(deletions_of(&file_store.deleted, path), 0);
        let mut check_conn = Conn::init().await;
        let mut check_tx = check_conn.begin().await;
        assert_eq!(
            models::file_uploads::get_many(check_tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .len(),
            1
        );
        check_tx.rollback().await;
    }

    /// Committed, for the same reason as the tests above.
    #[actix_web::test]
    async fn reaps_an_iframe_upload_past_seven_days() {
        let _serialized = REAPER_TESTS.lock().await;
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let path = "exercise-services-client/abandoned";
        let file_id = models::file_uploads::insert(
            tx.as_mut(),
            "abandoned.pdf",
            path,
            "application/pdf",
            Some(user),
            None,
        )
        .await
        .expect("file upload");
        models::exercise_answer_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
            models::exercise_answer_uploads::AnswerUploadOrigin::Iframe,
        )
        .await
        .expect("binding");
        backdate(tx.as_mut(), file_id, Duration::days(8)).await;
        tx.commit().await;

        let pool = PgPool::connect(&test_database_url())
            .await
            .expect("test pool");
        let file_store = RecordingFileStore::default();
        reap(&pool, &file_store).await.expect("reap");

        assert_eq!(deletions_of(&file_store.deleted, path), 1);
        let mut check_conn = Conn::init().await;
        let mut check_tx = check_conn.begin().await;
        assert!(
            models::file_uploads::get_many(check_tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .is_empty()
        );
        check_tx.rollback().await;
    }

    /// Fails every delete, standing in for a transient object-store error.
    #[derive(Default)]
    struct FailingFileStore {
        attempts: Mutex<Vec<String>>,
    }

    #[async_trait::async_trait(?Send)]
    impl FileStore for FailingFileStore {
        async fn upload(&self, _path: &Path, _contents: Vec<u8>, _mime: &str) -> UtilResult<()> {
            unimplemented!("not reached by the reaper")
        }

        async fn upload_stream(
            &self,
            _path: &Path,
            _contents: headless_lms_utils::file_store::GenericPayload,
            _mime: &str,
        ) -> UtilResult<()> {
            unimplemented!("not reached by the reaper")
        }

        async fn download(&self, _path: &Path) -> UtilResult<Vec<u8>> {
            unimplemented!("not reached by the reaper")
        }

        async fn download_stream(
            &self,
            _path: &Path,
        ) -> UtilResult<Box<dyn futures::Stream<Item = std::io::Result<bytes::Bytes>>>> {
            unimplemented!("not reached by the reaper")
        }

        async fn get_direct_download_url(&self, _path: &Path) -> UtilResult<String> {
            unimplemented!("not reached by the reaper")
        }

        async fn delete(&self, path: &Path) -> UtilResult<()> {
            self.attempts
                .lock()
                .expect("lock")
                .push(path.to_string_lossy().to_string());
            Err(UtilError::new(
                UtilErrorType::Other,
                "simulated object store failure".to_string(),
                None,
            ))
        }

        fn get_cache_files_folder_path(&self) -> UtilResult<&Path> {
            unimplemented!("not reached by the reaper")
        }
    }

    /// A failed object delete must surface in the exit status and be retried later. Before this
    /// was fixed the run was green and the object was orphaned forever, because the binding's own
    /// `deleted_at` excluded the row from every later listing.
    ///
    /// Committed, for the same reason as the tests above.
    #[actix_web::test]
    async fn a_failed_object_delete_fails_the_run_and_is_retried() {
        let _serialized = REAPER_TESTS.lock().await;
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let path = "exercise-services-client/transient";
        let file_id = models::file_uploads::insert(
            tx.as_mut(),
            "transient.tar.zst",
            path,
            "application/octet-stream",
            Some(user),
            None,
        )
        .await
        .expect("file upload");
        models::exercise_answer_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
            models::exercise_answer_uploads::AnswerUploadOrigin::NativeClient,
        )
        .await
        .expect("binding");
        backdate(tx.as_mut(), file_id, Duration::hours(2)).await;
        tx.commit().await;

        let pool = PgPool::connect(&test_database_url())
            .await
            .expect("test pool");
        let failing = FailingFileStore::default();
        reap(&pool, &failing)
            .await
            .expect_err("a run where every delete failed must not exit successfully");
        assert_eq!(deletions_of(&failing.attempts, path), 1);
        let mut check_conn = Conn::init().await;
        let mut check_tx = check_conn.begin().await;
        assert_eq!(
            models::file_uploads::get_many(check_tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .len(),
            1,
            "the file row must survive, since it is what makes the retry possible"
        );
        check_tx.rollback().await;

        let retry = RecordingFileStore::default();
        reap(&pool, &retry).await.expect("retry");
        assert_eq!(deletions_of(&retry.deleted, path), 1);
        let mut check_conn = Conn::init().await;
        let mut check_tx = check_conn.begin().await;
        assert!(
            models::file_uploads::get_many(check_tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .is_empty()
        );
        check_tx.rollback().await;
    }

    /// The reap-vs-submit race with two real connections, which is the part
    /// `models::exercise_answer_uploads`' own tests cannot reach: they run inside one
    /// uncommitted transaction, so a second connection can never see their fixtures.
    ///
    /// What is under test is not just the outcome but the mechanism — that a reaper running
    /// concurrently with a submit *blocks* on the row lock `lock_for_exercise_and_user` takes,
    /// instead of racing past it, and that when it unblocks its `NOT EXISTS` re-check observes the
    /// association the submit committed. The second half is a Postgres detail worth pinning: the
    /// blocked `UPDATE` re-evaluates its qual, subquery included, against the committed row, so it
    /// declines rather than destroying the files of a submission that already returned 200.
    #[actix_web::test]
    async fn a_concurrent_reaper_blocks_on_the_submit_lock_and_then_declines_to_reap() {
        let _serialized = REAPER_TESTS.lock().await;
        // Committed so the reaper's connection can see them. Deliberately not backdated: an
        // upload inside the retention window is invisible to `get_reapable`, so what this test
        // leaves in the database cannot perturb the unfiltered `reap()` calls above.
        insert_data!(:tx, user: user, :org, course: course, instance: _instance, :course_module, :chapter, :page, :exercise, slide: slide, task: task);
        let file_id = models::file_uploads::insert(
            tx.as_mut(),
            "raced.tar.zst",
            "exercise-services-client/raced",
            "application/octet-stream",
            Some(user),
            None,
        )
        .await
        .expect("file upload");
        models::exercise_answer_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
            models::exercise_answer_uploads::AnswerUploadOrigin::NativeClient,
        )
        .await
        .expect("binding");
        let binding_id = binding_id_of(tx.as_mut(), file_id).await;
        tx.commit().await;

        // The submit side: validate under the row lock, inside the transaction that will record
        // the association.
        let mut submit_conn = Conn::init().await;
        let mut submit_tx = submit_conn.begin().await;
        let locked = models::exercise_answer_uploads::lock_for_exercise_and_user(
            submit_tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
        .await
        .expect("locked lookup");
        assert_eq!(locked.len(), 1);
        assert!(!locked[0].deleted);

        // The reaper, on its own connection, tries to retire the very row the submit holds.
        let mut reaper_conn = Conn::init().await;
        let mut reaper_tx = reaper_conn.begin().await;
        // Scoped so the pinned future releases its borrow of `reaper_tx` before the rollback.
        let reaped = {
            let mut reap = std::pin::pin!(models::exercise_answer_uploads::mark_reaped(
                reaper_tx.as_mut(),
                binding_id
            ));
            assert!(
                tokio::time::timeout(std::time::Duration::from_millis(500), &mut reap)
                    .await
                    .is_err(),
                "the reaper must block on the row lock the submit holds, not decide without it"
            );

            let slide_submission = models::exercise_slide_submissions::insert_exercise_slide_submission(
            submit_tx.as_mut(),
            models::exercise_slide_submissions::NewExerciseSlideSubmission {
                exercise_slide_id: slide,
                course_id: Some(course),
                exam_id: None,
                user_id: user,
                exercise_id: exercise,
                user_points_update_strategy:
                    models::exercise_task_gradings::UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
            },
        )
        .await
        .expect("slide submission");
            let task_submission = models::exercise_task_submissions::insert(
                submit_tx.as_mut(),
                models::PKeyPolicy::Generate,
                slide_submission.id,
                slide,
                task,
                &models::library::grading::SubmittedAnswer::Json {
                    data: serde_json::json!({ "opaque": "plugin owned" }),
                },
            )
            .await
            .expect("task submission");
            models::exercise_task_submission_files::insert_many(
                submit_tx.as_mut(),
                task_submission,
                &[file_id],
            )
            .await
            .expect("submission files");
            submit_tx.commit().await;

            tokio::time::timeout(std::time::Duration::from_secs(10), &mut reap)
                .await
                .expect("the reaper must unblock once the submit commits")
                .expect("mark_reaped")
        };
        assert!(
            !reaped,
            "the reaper must decline an upload the submit referenced while it waited"
        );
        reaper_tx.rollback().await;

        let mut check_conn = Conn::init().await;
        let mut check_tx = check_conn.begin().await;
        let recorded = models::exercise_answer_uploads::get_for_exercise_and_user(
            check_tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
        .await
        .expect("binding lookup");
        assert_eq!(
            recorded,
            vec![models::exercise_answer_uploads::AnswerUpload {
                file_upload_id: file_id,
                deleted: false
            }],
            "the upload must stay usable, so download_submission can still serve it"
        );
        check_tx.rollback().await;
    }

    async fn binding_id_of(conn: &mut PgConnection, file_upload_id: uuid::Uuid) -> uuid::Uuid {
        models::test_support::answer_upload_id(conn, file_upload_id)
            .await
            .expect("binding id")
    }

    async fn backdate(conn: &mut PgConnection, file_upload_id: uuid::Uuid, age: Duration) {
        models::test_support::backdate_answer_upload(conn, file_upload_id, age)
            .await
            .expect("backdate");
    }
}
