use std::env;

use crate::setup_tracing;
use dotenv::dotenv;

pub async fn main() -> anyhow::Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
    dotenv().ok();
    setup_tracing()?;
    tracing::info!("Hello, ended exams!");
    Ok(())
}
