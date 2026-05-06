use std::{env, error::Error, sync::Arc, time::Duration};

use crate::config::program_config::ProgramConfig;
use crate::domain::models_requests::{self, JwtKey};
use headless_lms_models as models;
use models::library::regrading;
use sqlx::PgPool;

/**
Starts a thread that will periodically send regrading submissions to the corresponding exercise services for regrading.
*/
pub async fn main() -> anyhow::Result<()> {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    dotenvy::dotenv().ok();
    crate::setup_tracing()?;
    let db_url = ProgramConfig::database_url_with_default();
    let jwt_password = ProgramConfig::required("JWT_PASSWORD")?;
    let jwt_key = Arc::new(JwtKey::new(&jwt_password)?);

    let mut interval = tokio::time::interval(Duration::from_secs(10));
    let mut ticks = 60;

    // Since this is repeating every 10 seconds we can keep the connection open.
    let db_pool = PgPool::connect(&db_url).await?;
    let mut conn = db_pool.acquire().await?;
    loop {
        interval.tick().await;

        ticks += 1;
        // 60 10 second intervals = 10 minutes
        if ticks > 60 {
            // occasionally prints a reminder that the service is still running
            ticks = 0;
            tracing::info!("running the regrader");
        }

        let exercise_services_by_type =
            models::exercise_service_info::get_upsert_all_exercise_services_by_type(
                &mut conn,
                models_requests::fetch_service_info,
            )
            .await?;
        // do not stop the thread on error, report it and try again next tick
        if let Err(err) = regrading::regrade(
            &mut conn,
            &exercise_services_by_type,
            models_requests::make_grading_request_sender(Arc::clone(&jwt_key)),
        )
        .await
        {
            tracing::error!("Error in regrader: {}", err);

            if let Some(sqlx::Error::Io(..)) =
                err.source().and_then(|s| s.downcast_ref::<sqlx::Error>())
            {
                // this usually happens if the database is reset while running bin/dev etc.
                tracing::info!(
                    "regrader may have lost its connection to the db, trying to reconnect"
                );
                conn = db_pool.acquire().await?;
            }
        }
    }
}
