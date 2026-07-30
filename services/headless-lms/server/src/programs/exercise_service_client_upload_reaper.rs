//! Removes files uploaded through the exercise-services client API that no submission was ever
//! made from.
//!
//! A client uploads immediately before submitting, so anything still unreferenced an hour later
//! is the residue of a crashed or abandoned run. The binding row is soft-deleted rather than
//! removed so that a submit naming a reaped file can still answer `upload_expired` instead of the
//! misleading `unknown_upload`.

use std::{env, path::Path};

use crate::config::{FileStoreRuntimeConfig, program_config::ProgramConfig};
use crate::{setup_file_store, setup_tracing};
use chrono::Utc;
use dotenvy::dotenv;
use headless_lms_models::{self as models, error::TryToOptional};
use headless_lms_utils::file_store::FileStore;
use sqlx::{PgConnection, PgPool};

pub async fn main() -> anyhow::Result<()> {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    dotenv().ok();
    setup_tracing()?;
    let database_url = ProgramConfig::database_url_with_default();
    let base_url = ProgramConfig::required("BASE_URL")?;
    let file_store = setup_file_store(&FileStoreRuntimeConfig::try_from_env()?, &base_url).await;
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;
    reap(&mut conn, file_store.as_ref()).await
}

async fn reap(conn: &mut PgConnection, file_store: &dyn FileStore) -> anyhow::Result<()> {
    let cutoff = models::exercise_service_client_uploads::retention_cutoff(Utc::now());
    let reapable = models::exercise_service_client_uploads::get_reapable(conn, cutoff).await?;
    info!("Reaping {} orphaned client uploads.", reapable.len());

    let mut reaped = 0;
    let mut skipped = 0;
    let mut failed = 0;
    for upload in reapable {
        match reap_one(conn, file_store, &upload).await {
            Ok(true) => reaped += 1,
            Ok(false) => skipped += 1,
            Err(err) => {
                failed += 1;
                error!(
                    "Failed to reap client upload {}: {:#?}",
                    upload.file_upload_id, err
                );
            }
        }
    }
    info!(
        "Orphaned client uploads reaped. Succeeded: {reaped}, skipped: {skipped}, failed: {failed}, retention cutoff: {cutoff}."
    );
    // The CronJob's exit status is the only signal anyone watches, so a run where every delete
    // failed must not look green.
    if failed > 0 {
        anyhow::bail!(
            "Failed to reap {failed} of {} client uploads.",
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
    upload: &models::exercise_service_client_uploads::ReapableUpload,
) -> anyhow::Result<bool> {
    if !models::exercise_service_client_uploads::mark_reaped(conn, upload.id).await? {
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
    use std::sync::Mutex;

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

    /// Covers the whole per-row sequence: the object goes, the file row is soft-deleted, and the
    /// binding survives soft-deleted so submit can still answer `upload_expired`.
    #[actix_web::test]
    async fn reaps_an_orphaned_upload_and_leaves_a_row_behind() {
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let path = "exercise-services-client/orphan";
        let file_id = models::file_uploads::insert(
            tx.as_mut(),
            "orphan.tar.zst",
            path,
            "application/octet-stream",
            Some(user),
        )
        .await
        .expect("file upload");
        models::exercise_service_client_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
        .await
        .expect("binding");
        backdate(tx.as_mut(), file_id, Duration::hours(2)).await;

        let file_store = RecordingFileStore::default();
        reap(tx.as_mut(), &file_store).await.expect("reap");

        assert_eq!(*file_store.deleted.lock().expect("lock"), vec![path]);
        assert!(
            models::file_uploads::get_many(tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .is_empty()
        );
        let recorded = models::exercise_service_client_uploads::get_for_exercise_and_user(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
        .await
        .expect("binding lookup");
        assert_eq!(recorded.len(), 1);
        assert!(recorded[0].deleted);
        tx.rollback().await;
    }

    #[actix_web::test]
    async fn spares_an_upload_inside_the_retention_window() {
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let file_id = models::file_uploads::insert(
            tx.as_mut(),
            "fresh.tar.zst",
            "exercise-services-client/fresh",
            "application/octet-stream",
            Some(user),
        )
        .await
        .expect("file upload");
        models::exercise_service_client_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
        .await
        .expect("binding");

        let file_store = RecordingFileStore::default();
        reap(tx.as_mut(), &file_store).await.expect("reap");

        assert!(file_store.deleted.lock().expect("lock").is_empty());
        assert_eq!(
            models::file_uploads::get_many(tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .len(),
            1
        );
        tx.rollback().await;
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
    #[actix_web::test]
    async fn a_failed_object_delete_fails_the_run_and_is_retried() {
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let path = "exercise-services-client/transient";
        let file_id = models::file_uploads::insert(
            tx.as_mut(),
            "transient.tar.zst",
            path,
            "application/octet-stream",
            Some(user),
        )
        .await
        .expect("file upload");
        models::exercise_service_client_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
        .await
        .expect("binding");
        backdate(tx.as_mut(), file_id, Duration::hours(2)).await;

        let failing = FailingFileStore::default();
        reap(tx.as_mut(), &failing)
            .await
            .expect_err("a run where every delete failed must not exit successfully");
        assert_eq!(*failing.attempts.lock().expect("lock"), vec![path]);
        assert_eq!(
            models::file_uploads::get_many(tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .len(),
            1,
            "the file row must survive, since it is what makes the retry possible"
        );

        let retry = RecordingFileStore::default();
        reap(tx.as_mut(), &retry).await.expect("retry");
        assert_eq!(*retry.deleted.lock().expect("lock"), vec![path]);
        assert!(
            models::file_uploads::get_many(tx.as_mut(), &[file_id])
                .await
                .expect("file lookup")
                .is_empty()
        );
        tx.rollback().await;
    }

    /// Not a `query!`: `cargo sqlx prepare -- --lib` does not cache test-only queries.
    async fn backdate(conn: &mut PgConnection, file_upload_id: uuid::Uuid, age: Duration) {
        sqlx::query(
            "UPDATE exercise_service_client_uploads SET created_at = now() - $2 WHERE file_upload_id = $1",
        )
        .bind(file_upload_id)
        .bind(age)
        .execute(conn)
        .await
        .expect("backdate");
    }
}
