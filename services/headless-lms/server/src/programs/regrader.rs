use std::{sync::Arc, time::Duration};

use crate::config::FileStoreRuntimeConfig;
use crate::config::program_config::ProgramConfig;
use crate::domain::models_requests;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_base::jwt::JwtKey;
use headless_lms_models as models;
use headless_lms_utils::error::is_db_disconnect;
use headless_lms_utils::periodic_worker::{
    PeriodicWorkerConfig, StillRunningLog, run_periodic_worker,
};
use models::library::regrading;
use sqlx::PgPool;

/// How long a grading may wait for its exercise service before it is taken for lost. Well past the
/// longest grading run an exercise service allows.
const STALE_GRADING_AFTER: chrono::Duration = chrono::Duration::minutes(30);

/**
Starts a thread that will periodically send regrading submissions to the corresponding exercise services for regrading.
*/
pub async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    ProgramConfig::ensure_default_rust_log_for_workers();
    crate::setup_tracing()?;
    let db_url = ProgramConfig::database_url_with_default();
    let app_conf = ApplicationConfiguration::try_from_env()?;
    let jwt_key = Arc::new(JwtKey::new(&app_conf.jwt_password)?);
    let file_store =
        crate::setup_file_store(&FileStoreRuntimeConfig::try_from_env()?, &app_conf.base_url).await;

    // Since this is repeating every 10 seconds we can keep the connection open.
    let db_pool = PgPool::connect(&db_url).await?;
    let mut conn = db_pool.acquire().await?;

    run_periodic_worker(
        PeriodicWorkerConfig {
            tick_interval: Duration::from_secs(10),
            still_running: Some(StillRunningLog {
                every: 60,
                message: "running the regrader",
                initial_ticks: 60,
            }),
            delay_missed_ticks: false,
        },
        async || {
            let exercise_services_by_type =
                models::exercise_service_info::get_upsert_all_exercise_services_by_type(
                    &mut conn,
                    models_requests::fetch_service_info,
                )
                .await?;
            if let Err(err) = models::library::grading::fail_stale_pending_gradings(
                &mut conn,
                STALE_GRADING_AFTER,
                file_store.as_ref(),
                &app_conf,
            )
            .await
            {
                tracing::error!("Error failing stale gradings: {}", err);
            }
            // do not stop the thread on error, report it and try again next tick
            if let Err(err) = regrading::regrade(
                &mut conn,
                &exercise_services_by_type,
                models_requests::make_grading_request_sender(
                    Arc::clone(&jwt_key),
                    app_conf.base_url.clone(),
                ),
                file_store.as_ref(),
                &app_conf,
            )
            .await
            {
                tracing::error!("Error in regrader: {}", err);
                if is_db_disconnect(&err) {
                    // this usually happens if the database is reset while running bin/dev etc.
                    tracing::info!(
                        "regrader may have lost its connection to the db, trying to reconnect"
                    );
                    conn = db_pool.acquire().await?;
                }
            }
            Ok(())
        },
    )
    .await
}
