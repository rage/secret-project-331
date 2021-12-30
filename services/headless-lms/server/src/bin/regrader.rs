use std::{env, time::Duration};

use anyhow::Result;
use headless_lms_actix::regrading;
use headless_lms_models as models;
use sqlx::{Connection, PgConnection};

/**
Starts a thread that will periodically send regrading submissions to the corresponding exercise services for regrading.
*/
#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv::dotenv().ok();
    headless_lms_actix::setup_tracing()?;
    let db_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());

    // fetch exercise services
    let mut conn = PgConnection::connect(&db_url).await?;
    let exercise_services_by_type =
        models::exercise_service_info::get_all_exercise_services_by_type(&mut conn).await?;
    drop(conn);

    let mut interval = tokio::time::interval(Duration::from_secs(60));
    loop {
        interval.tick().await;
        let mut conn = PgConnection::connect(&db_url).await?;
        // do not stop the thread on error, report it and try again next tick
        if let Err(err) = regrading::regrade(&mut conn, &exercise_services_by_type).await {
            tracing::error!("Error in regrader: {}", err);
        }
    }
}
