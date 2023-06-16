use std::{env, sync::Arc, time::Duration};

use headless_lms_models as models;
use models::library::regrading;
use sqlx::{Connection, PgConnection};

use crate::domain::models_requests::{self, JwtKey};

/**
Starts a thread that will periodically send regrading submissions to the corresponding exercise services for regrading.
*/
pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv::dotenv().ok();
    crate::setup_tracing()?;
    let db_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let jwt_key = Arc::new(JwtKey::try_from_env().expect("Could not initialise JwtKey"));

    let mut interval = tokio::time::interval(Duration::from_secs(10));
    // Since this is repeating every 10 seconds we can keep the connection open.
    let mut conn = PgConnection::connect(&db_url).await?;
    loop {
        interval.tick().await;

        let exercise_services_by_type =
            models::exercise_service_info::get_all_exercise_services_by_type(
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
        }
    }
}
