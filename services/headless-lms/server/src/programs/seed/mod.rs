pub mod seed_certificate_fonts;
pub mod seed_courses;
pub mod seed_exercise_services;
pub mod seed_file_storage;
pub mod seed_helpers;
pub mod seed_organizations;
pub mod seed_playground_examples;
pub mod seed_roles;
mod seed_user_research_consents;
pub mod seed_users;

use std::{env, process::Command, sync::Arc, time::Duration};

use crate::{domain::models_requests::JwtKey, setup_tracing};

use anyhow::Context;
use futures::try_join;

use headless_lms_utils::futures::run_parallelly;
use sqlx::{Pool, Postgres, migrate::MigrateDatabase, postgres::PgPoolOptions};
use tracing::info;

pub async fn main() -> anyhow::Result<()> {
    let base_url = std::env::var("BASE_URL").context("BASE_URL must be defined")?;
    let db_pool = setup_seed_environment().await?;
    let jwt_key = Arc::new(JwtKey::try_from_env().expect("Failed to create JwtKey"));

    // Initialize the global spec fetcher before any seeding
    seed_helpers::init_seed_spec_fetcher(base_url.clone(), Arc::clone(&jwt_key))
        .expect("Failed to initialize seed spec fetcher");

    // Run parallelly to improve performance.
    let (_, seed_users_result, _) = try_join!(
        run_parallelly(seed_exercise_services::seed_exercise_services(
            db_pool.clone()
        )),
        run_parallelly(seed_users::seed_users(db_pool.clone())),
        run_parallelly(seed_playground_examples::seed_playground_examples(
            db_pool.clone()
        )),
    )?;

    // Not run parallely because waits another future that is not send.
    let seed_file_storage_result = seed_file_storage::seed_file_storage().await?;

    let (uh_cs_organization_result, _uh_mathstat_organization_id) = try_join!(
        run_parallelly(seed_organizations::uh_cs::seed_organization_uh_cs(
            db_pool.clone(),
            seed_users_result,
            base_url.clone(),
            Arc::clone(&jwt_key),
            seed_file_storage_result.clone()
        )),
        run_parallelly(
            seed_organizations::uh_mathstat::seed_organization_uh_mathstat(
                db_pool.clone(),
                seed_users_result,
                base_url.clone(),
                Arc::clone(&jwt_key),
                seed_file_storage_result.clone()
            )
        )
    )?;

    try_join!(
        run_parallelly(seed_roles::seed_roles(
            db_pool.clone(),
            seed_users_result,
            uh_cs_organization_result
        )),
        run_parallelly(seed_user_research_consents::seed_user_research_consents(
            db_pool.clone(),
            seed_users_result
        )),
        run_parallelly(seed_certificate_fonts::seed_certificate_fonts(
            db_pool.clone()
        ))
    )?;

    Ok(())
}

async fn setup_seed_environment() -> anyhow::Result<Pool<Postgres>> {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,sqlx=warn,headless_lms_models=info") };

    dotenv::dotenv().ok();
    setup_tracing()?;

    let clean = env::args().any(|a| a == "clean");

    let db_url = env::var("DATABASE_URL")?;
    let db_pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(5)
        // the seed process can take a while, default is 30
        .acquire_timeout(Duration::from_secs(90))
        .connect(&db_url)
        .await?;

    if clean {
        info!("cleaning");
        // hardcoded for now
        let status = Command::new("dropdb")
            .args(["-U", "headless-lms"])
            .args(["-h", "localhost"])
            .args(["-p", "54328"])
            .arg("--force")
            .arg("-e")
            .arg("headless_lms_dev")
            .status()?;
        assert!(status.success());
        let db_url = env::var("DATABASE_URL")?;
        Postgres::create_database(&db_url).await?;
    }

    if clean {
        let mut conn = db_pool.acquire().await?;
        info!("running migrations");
        sqlx::migrate!("../migrations").run(&mut conn).await?;
    }
    Ok(db_pool)
}
