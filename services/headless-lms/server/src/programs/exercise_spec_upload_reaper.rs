//! Removes files uploaded through the exercise-service upload route that never reached a saved
//! spec.
//!
//! Nothing else can reclaim them: the host stores specs as opaque blobs, so a stored file's only
//! reference may sit inside content it cannot parse. What makes a file safe here is a declaration
//! — `exercise_task_spec_files` for a live spec, `page_history_spec_files` for every snapshot a
//! restore could bring back. Because history is kept, this reaper mostly collects uploads a
//! teacher abandoned before saving, not files dropped from a spec that was once saved.
//!
//! The binding row is soft-deleted rather than removed, leaving an audit trail of what was
//! reclaimed.

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
    let reapable = models::exercise_spec_uploads::get_reapable(&mut conn).await?;
    drop(conn);
    info!("Reaping {} abandoned spec uploads.", reapable.len());

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
                error!("Failed to reap spec upload {}: {:#?}", file_upload_id, err);
            }
        }
    }
    info!(
        "Abandoned spec uploads reaped. Succeeded: {reaped}, skipped: {skipped}, failed: {failed}."
    );
    // The CronJob's exit status is the only signal anyone watches, so a run where every delete
    // failed must not look green.
    if failed > 0 {
        anyhow::bail!(
            "Failed to reap {failed} of {} spec uploads.",
            reaped + failed
        );
    }
    Ok(())
}

/// Retires the record, removes the object, and only then soft-deletes the `file_uploads` row.
/// `Ok(false)` means a save came to declare the file after `get_reapable` listed it, so it is no
/// longer reapable.
///
/// Deleting the `file_uploads` row last is what makes a failed object delete recoverable:
/// `get_reapable` still sees the row and retries it on a later run, instead of orphaning the
/// object forever.
async fn reap_one(
    conn: &mut PgConnection,
    file_store: &dyn FileStore,
    upload: &models::exercise_spec_uploads::ReapableUpload,
) -> anyhow::Result<bool> {
    if !models::exercise_spec_uploads::mark_reaped(conn, upload.id).await? {
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
