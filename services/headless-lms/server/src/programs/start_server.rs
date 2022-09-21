use std::{env, sync::Arc};

use crate::{setup_tracing, OAuthClient};
use actix_session::{
    config::{CookieContentSecurity, PersistentSession, SessionLifecycle, TtlExtensionPolicy},
    storage::CookieSessionStore,
    SessionMiddleware,
};
use actix_web::{
    cookie::{Key, SameSite},
    middleware::Logger,
    web::Data,
    App, HttpServer,
};
use dotenv::dotenv;
use headless_lms_utils::{
    file_store::{
        google_cloud_file_store::GoogleCloudFileStore, local_file_store::LocalFileStore, FileStore,
    },
    ApplicationConfiguration,
};
use listenfd::ListenFd;
use oauth2::{basic::BasicClient, AuthUrl, ClientId, ClientSecret, TokenUrl};
use sqlx::postgres::PgPoolOptions;
use url::Url;

/// The entrypoint to the server.
pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    setup_tracing()?;

    // read environment variables
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let oauth_application_id =
        env::var("OAUTH_APPLICATION_ID").expect("OAUTH_APPLICATION_ID must be defined");
    let oauth_secret = env::var("OAUTH_SECRET").expect("OAUTH_SECRET must be defined");
    let private_cookie_key =
        env::var("PRIVATE_COOKIE_KEY").expect("PRIVATE_COOKIE_KEY must be defined");
    let base_url = env::var("BASE_URL").expect("BASE_URL must be defined");
    let test_mode = env::var("TEST_MODE").is_ok();
    let allow_no_https_for_development = env::var("ALLOW_NO_HTTPS_FOR_DEVELOPMENT").is_ok();
    if test_mode {
        info!("***********************************");
        info!("*  Starting backend in test mode  *");
        info!("***********************************");
    }
    let development_uuid_login = env::var("DEVELOPMENT_UUID_LOGIN").is_ok();

    // this will enable us to keep application running during recompile: systemfd --no-pid -s http::5000 -- cargo watch -x run
    let mut listenfd = ListenFd::from_env();

    let db_pool = PgPoolOptions::new()
        .max_connections(15)
        .min_connections(5)
        .connect(&database_url)
        .await?;

    let auth_url: Url = "https://tmc.mooc.fi/oauth/token"
        .parse()
        .expect("known to work");

    let oauth_client: OAuthClient = Arc::new(BasicClient::new(
        ClientId::new(oauth_application_id),
        Some(ClientSecret::new(oauth_secret)),
        AuthUrl::from_url(auth_url.clone()),
        Some(TokenUrl::from_url(auth_url)),
    ));

    let db_clone = db_pool.clone();

    let mut server = HttpServer::new(move || {
        let app_conf = ApplicationConfiguration {
            base_url: base_url.clone(),
            test_mode,
            development_uuid_login,
        };
        let file_store = setup_file_store();

        App::new()
            .configure(move |config| crate::configure(config, file_store, app_conf))
            .wrap(
                SessionMiddleware::builder(
                    CookieSessionStore::default(),
                    Key::from(private_cookie_key.as_bytes()),
                )
                .cookie_name("session".to_string())
                .cookie_secure(!allow_no_https_for_development)
                .cookie_same_site(SameSite::Strict) // Default api can only be accessed from the main website. Public api will be less strict on this.
                .cookie_http_only(true) // Cookie is inaccessible from javascript for security
                .cookie_path("/api".to_string()) // browser won't send the cookie unless this path exists in the request url
                .cookie_content_security(CookieContentSecurity::Private)
                .session_lifecycle(SessionLifecycle::PersistentSession(
                    PersistentSession::default()
                        .session_ttl(actix_web::cookie::time::Duration::days(100))
                        .session_ttl_extension_policy(TtlExtensionPolicy::OnEveryRequest),
                ))
                .build(),
            )
            .wrap(Logger::new(
                "Completed %r %s %b bytes - %D ms, request_id=%{request-id}o",
            ))
            .app_data(Data::new(db_clone.clone())) // pass app_databData::new(ase pool to application so we can access it inside handlers
            .app_data(Data::new(oauth_client.clone()))
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

/**
Setups file store so that it can be passed to actix web as data.
Using Arc here so that this can be accessed from all the different worker threads.
*/
fn setup_file_store() -> Arc<dyn FileStore> {
    if env::var("FILE_STORE_USE_GOOGLE_CLOUD_STORAGE").is_ok() {
        info!("Using Google Cloud Storage as the file store");
        let bucket_name = env::var("GOOGLE_CLOUD_STORAGE_BUCKET_NAME").expect("env FILE_STORE_USE_GOOGLE_CLOUD_STORAGE was defined but GOOGLE_CLOUD_STORAGE_BUCKET_NAME was not.");
        Arc::new(GoogleCloudFileStore::new(bucket_name).expect("Failed to initialize file store"))
    } else {
        info!("Using local file storage as the file store");
        Arc::new(
            LocalFileStore::new(
                "uploads".into(),
                "http://project-331.local/api/v0/files/uploads/".into(),
            )
            .expect("Failed to initialize file store"),
        )
    }
}
