use crate::setup_tracing;
use dotenv::dotenv;
use std::env;

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    let _database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    info!("Peer review updater started");
    todo!()
}
