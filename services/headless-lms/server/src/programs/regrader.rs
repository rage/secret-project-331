use std::{env, time::Duration};

use headless_lms_models as models;
use models::library::regrading;
use sqlx::{Connection, PgConnection};

use crate::domain::models_requests;

/**
Starts a thread that will periodically send regrading submissions to the corresponding exercise services for regrading.
*/
pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv::dotenv().ok();
    crate::setup_tracing()?;
    let db_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());

    let mut interval = tokio::time::interval(Duration::from_secs(10));
    loop {
        interval.tick().await;
        let mut conn = PgConnection::connect(&db_url).await?;
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
            models_requests::send_grading_request,
        )
        .await
        {
            tracing::error!("Error in regrader: {}", err);
        }
    }
}
