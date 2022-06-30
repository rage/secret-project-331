use std::env;

use anyhow::Result;
use dotenv::dotenv;
use headless_lms_actix::setup_tracing;

#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;

    tracing::info!("Hello from fetcher");

    Ok(())
}
