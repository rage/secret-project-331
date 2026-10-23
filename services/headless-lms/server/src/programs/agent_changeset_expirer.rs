//! Expires agent changesets that have gone 14 days without a write. Their staged changes are
//! dropped; the rows stay for the audit log.

use crate::config::program_config::ProgramConfig;
use crate::setup_tracing;
use dotenvy::dotenv;
use headless_lms_models as models;
use sqlx::PgPool;

pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    setup_tracing()?;
    let database_url = ProgramConfig::database_url_with_default();
    let db_pool = PgPool::connect(&database_url).await?;
    let mut conn = db_pool.acquire().await?;
    let expired = models::agent_changesets::expire_overdue(&mut conn).await?;
    for changeset in &expired {
        info!(
            changeset_id = %changeset.id,
            user_id = %changeset.user_id,
            course_id = %changeset.course_id,
            "Expired agent changeset"
        );
    }
    info!("Expired {} agent changesets.", expired.len());
    Ok(())
}
