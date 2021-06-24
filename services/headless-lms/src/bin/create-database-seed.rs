use anyhow::Result;
use headless_lms_actix::models::{course_instances, courses, organizations};
use sqlx::{migrate::MigrateDatabase, Connection, PgConnection, Postgres};
use std::fs::File;
use std::process::Command;

#[tokio::main]
async fn main() -> Result<()> {
    let db_url = "postgres://headless-lms@localhost:54328/headless_lms_dev";
    let seed_path = "./db/seed.sql";

    Postgres::drop_database(db_url).await?;
    Postgres::create_database(db_url).await?;
    let mut conn = PgConnection::connect(db_url).await?;
    sqlx::migrate!("./migrations").run(&mut conn).await?;

    let hy_id = organizations::insert(&mut conn, "University of Helsinki", "hy").await?;
    let _mathstat_id = organizations::insert(
        &mut conn,
        "University of Helsinki, Department of Mathematics and Statistics",
        "uh-mathstat",
    )
    .await?;

    let intro_course_id = courses::insert(
        &mut conn,
        "Introduction to everything",
        hy_id,
        "Introduction to everything",
    )
    .await?;

    let _intro_course_instance_id = course_instances::insert(
        &mut conn,
        intro_course_id,
        course_instances::VariantStatus::Upcoming,
    )
    .await?;

    let output = tokio::task::spawn_blocking(move || {
        let file = File::create(seed_path).unwrap();
        Command::new("pg_dump")
            .arg("-c")
            .arg(db_url)
            .stdout(file)
            .status()
    })
    .await??;
    assert!(output.success());

    Ok(())
}
