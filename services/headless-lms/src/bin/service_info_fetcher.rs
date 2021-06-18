use anyhow::Result;
use dotenv::dotenv;
use futures::stream::{self, StreamExt};
use headless_lms_actix::models::exercise_service_info::{
    fetch_and_upsert_service_info, ExerciseServiceInfo,
};
use headless_lms_actix::models::exercise_services::ExerciseService;
use sqlx::PgPool;
use std::{env, usize};
use tokio::time::{sleep, Duration};
use tracing::log::info;

const N: usize = 10;

#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=error");
    dotenv().ok();
    tracing_subscriber::fmt().init();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let db_pool = PgPool::connect(&database_url).await?;

    let mut conn = db_pool.acquire().await?;

    loop {
        let exercise_services =
            headless_lms_actix::models::exercise_services::get_exercise_services(&mut conn).await?;
        info!(
            "Fetching and updating statuses from {} services",
            exercise_services.len()
        );
        let iter_stream = stream::iter(exercise_services.iter().map(|exercise_service| {
            do_fetch_and_upsert_service_info(db_pool.clone(), exercise_service)
        }));
        // Run N futures concurrently
        let buffer_unordered = iter_stream.buffer_unordered(N);
        let results = buffer_unordered.collect::<Vec<_>>().await;
        let (succeeded, failed) = results.into_iter().partition::<Vec<_>, _>(|o| o.is_ok());
        info!(
            "Fetching and updating statuses complete. Succeeded: {}, failed: {}",
            succeeded.len(),
            failed.len()
        );
        sleep(Duration::from_secs(60)).await;
    }
}

pub async fn do_fetch_and_upsert_service_info(
    pool: PgPool,
    exercise_service: &ExerciseService,
) -> Result<ExerciseServiceInfo> {
    let mut conn = pool.acquire().await?;
    Ok(fetch_and_upsert_service_info(&mut conn, exercise_service).await?)
}
