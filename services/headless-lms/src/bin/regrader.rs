use anyhow::Context;
use anyhow::Result;
use headless_lms_actix::models;
use headless_lms_actix::regrading;
use sqlx::{Connection, PgConnection};
use std::{collections::HashMap, env, time::Duration};

/**
Starts a thread that will periodically send regrading submissions to the corresponding exercise services for regrading.
*/
#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv::dotenv().ok();
    headless_lms_actix::setup_tracing()?;
    let db_url = env::var("DATABASE_URL").unwrap();

    // fetch exercise services
    let mut conn = PgConnection::connect(&db_url)
        .await
        .with_context(|| format!("Failed to connect to database at {}", db_url))?;
    let mut exercise_services_by_type = HashMap::new();
    for exercise_service in models::exercise_services::get_exercise_services(&mut conn).await? {
        let info =
            models::exercise_service_info::get_service_info(&mut conn, exercise_service.id).await?;
        exercise_services_by_type.insert(exercise_service.slug.clone(), (exercise_service, info));
    }
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
