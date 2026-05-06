use anyhow::Result;
use tracing_error::ErrorLayer;
use tracing_log::LogTracer;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt};

/**
Sets up tokio tracing. Also makes sure that log statements from libraries respect the log level
settings that have been set with RUST_LOG, for example:

```no_run
use std::env;
unsafe {
    env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
}
```
*/
pub fn setup_tracing() -> Result<()> {
    let subscriber = tracing_subscriber::Registry::default()
        .with(
            tracing_subscriber::fmt::layer()
                .event_format(tracing_subscriber::fmt::format().compact()),
        )
        .with(ErrorLayer::default())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")));
    tracing::subscriber::set_global_default(subscriber)?;
    LogTracer::init()?;
    Ok(())
}
