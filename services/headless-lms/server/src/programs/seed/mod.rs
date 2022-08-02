#![allow(clippy::too_many_arguments)]

pub mod seed_courses;
pub mod seed_exercise_services;
pub mod seed_helpers;
pub mod seed_organizations;
pub mod seed_playground_examples;
pub mod seed_roles;
pub mod seed_users;

use std::{env, process::Command};

use crate::{programs::seed::seed_helpers::seed_connect_to_db, setup_tracing};

use futures::try_join;

use sqlx::{migrate::MigrateDatabase, Postgres};
use tracing::info;

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,sqlx=warn,headless_lms_models=warn");

    dotenv::dotenv().ok();
    setup_tracing()?;

    let clean = env::args().any(|a| a == "clean");

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
    let mut conn = seed_connect_to_db().await?;
    if clean {
        info!("running migrations");
        sqlx::migrate!("../migrations").run(&mut conn).await?;
    }

    // Run in parallel to improve performance.
    let (_, seed_users_result, _) = try_join!(
        seed_exercise_services::seed_exercise_services(),
        seed_users::seed_users(),
        seed_playground_examples::seed_playground_examples()
    )?;

    let (uh_cs_organization_result, _uh_mathstat_organization_id) = try_join!(
        seed_organizations::uh_cs::seed_organization_uh_cs(&seed_users_result),
        seed_organizations::uh_mathstat::seed_organization_uh_mathstat(&seed_users_result)
    )?;

    seed_roles::seed_roles(&seed_users_result, &uh_cs_organization_result).await?;

    Ok(())
}
