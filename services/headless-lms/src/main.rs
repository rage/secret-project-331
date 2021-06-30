#[macro_use]
extern crate tracing;

use actix_session::CookieSession;
use actix_web::{App, HttpServer};
use anyhow::Result;
use dotenv::dotenv;
use headless_lms_actix::{utils::file_store::local_file_store::LocalFileStore, OAuthClient};
use listenfd::ListenFd;
use oauth2::{basic::BasicClient, AuthUrl, ClientId, ClientSecret, TokenUrl};
use sqlx::PgPool;
use std::{env, sync::Arc};
use tracing_error::ErrorLayer;
use tracing_log::LogTracer;
use tracing_subscriber::{prelude::__tracing_subscriber_SubscriberExt, EnvFilter};
use url::Url;

/// The entrypoint to the application.
#[actix_web::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let subscriber = tracing_subscriber::Registry::default()
        .with(tracing_subscriber::fmt::layer())
        .with(ErrorLayer::default())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")));
    tracing::subscriber::set_global_default(subscriber)?;
    LogTracer::init()?;

    // read environment variables
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let oauth_application_id =
        env::var("OAUTH_APPLICATION_ID").expect("OAUTH_APPLICATION_ID must be defined");
    let oauth_secret = env::var("OAUTH_SECRET").expect("OAUTH_SECRET must be defined");
    let private_cookie_key =
        env::var("PRIVATE_COOKIE_KEY").expect("PRIVATE_COOKIE_KEY must be defined");

    // this will enable us to keep application running during recompile: systemfd --no-pid -s http::5000 -- cargo watch -x run
    let mut listenfd = ListenFd::from_env();

    let db_pool = PgPool::connect(&database_url).await?;

    let auth_url: Url = "https://tmc.mooc.fi/oauth/token"
        .parse()
        .expect("known to work");

    let oauth_client: OAuthClient = Arc::new(BasicClient::new(
        ClientId::new(oauth_application_id),
        Some(ClientSecret::new(oauth_secret)),
        AuthUrl::from_url(auth_url.clone()),
        Some(TokenUrl::from_url(auth_url)),
    ));

    let mut server = HttpServer::new(move || {
        let file_store = futures::executor::block_on(async {
            LocalFileStore::new("uploads".into())
                .await
                .expect("Failed to initialize file store")
        });
        App::new()
            .configure(move |config| headless_lms_actix::configure(config, file_store))
            .wrap(CookieSession::private(private_cookie_key.as_bytes()).secure(false))
            .data(db_pool.clone()) // pass database pool to application so we can access it inside handlers
            .data(oauth_client.clone())
    });

    server = match listenfd.take_tcp_listener(0)? {
        Some(listener) => server.listen(listener)?,
        None => {
            let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
            let port = env::var("PORT").unwrap_or_else(|_| "3001".to_string());
            let bind_address = format!("{}:{}", host, port);
            info!("Binding to address: {}", bind_address);
            server.bind(bind_address)?
        }
    };

    info!("Starting server.");
    server.run().await?;

    Ok(())
}
