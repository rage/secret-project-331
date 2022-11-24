#![allow(clippy::too_many_arguments)]

pub mod seed_courses;
pub mod seed_exercise_services;
pub mod seed_file_storage;
pub mod seed_helpers;
pub mod seed_organizations;
pub mod seed_playground_examples;
pub mod seed_roles;
pub mod seed_users;

use std::{env, process::Command, sync::Arc};

use crate::{domain::models_requests::JwtKey, setup_tracing};

use futures::try_join;

use headless_lms_utils::futures::run_parallelly;
use sqlx::{migrate::MigrateDatabase, postgres::PgPoolOptions, Pool, Postgres};
use tracing::info;

pub async fn main() -> anyhow::Result<()> {
    let db_pool = setup_seed_environment().await?;
    let jwt_key = Arc::new(JwtKey::try_from_env().expect("Failed to create JwtKey"));

    // Run parallelly to improve performance.
    let (_, seed_users_result, _) = try_join!(
        run_parallelly(seed_exercise_services::seed_exercise_services(
            db_pool.clone()
        ),),
        run_parallelly(seed_users::seed_users(db_pool.clone())),
        run_parallelly(seed_playground_examples::seed_playground_examples(
            db_pool.clone()
        ),),
    )?;

    let (uh_cs_organization_result, _uh_mathstat_organization_id) = try_join!(
        run_parallelly(seed_organizations::uh_cs::seed_organization_uh_cs(
            db_pool.clone(),
            seed_users_result.clone(),
            Arc::clone(&jwt_key),
        )),
        run_parallelly(
            seed_organizations::uh_mathstat::seed_organization_uh_mathstat(
                db_pool.clone(),
                seed_users_result.clone(),
                Arc::clone(&jwt_key),
            )
        )
    )?;

    seed_roles::seed_roles(&db_pool, &seed_users_result, &uh_cs_organization_result).await?;

    seed_file_storage::seed_file_storage().await?;

    Ok(())
}

async fn setup_seed_environment() -> anyhow::Result<Pool<Postgres>> {
    env::set_var("RUST_LOG", "info,sqlx=warn,headless_lms_models=info");

    dotenv::dotenv().ok();
    setup_tracing()?;

    let clean = env::args().any(|a| a == "clean");

    let db_url = env::var("DATABASE_URL")?;
    let db_pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(5)
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
