use crate::{
    config::{self, ServerConfigBuilder},
    setup_tracing,
};
use actix_session::{
    config::{CookieContentSecurity, PersistentSession, SessionLifecycle, TtlExtensionPolicy},
    storage::CookieSessionStore,
    SessionMiddleware,
};
use actix_web::{
    cookie::{Key, SameSite},
    middleware::Logger,
    App, HttpServer,
};
use dotenv::dotenv;
use listenfd::ListenFd;
use std::env;

/// The entrypoint to the server.
pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    setup_tracing()?;

    // read environment variables
    let private_cookie_key =
        env::var("PRIVATE_COOKIE_KEY").expect("PRIVATE_COOKIE_KEY must be defined");
    let test_mode = env::var("TEST_MODE").is_ok();
    let allow_no_https_for_development = env::var("ALLOW_NO_HTTPS_FOR_DEVELOPMENT").is_ok();

    if test_mode {
        info!("***********************************");
        info!("*  Starting backend in test mode  *");
        info!("***********************************");
    }
    let server_config = ServerConfigBuilder::try_from_env()
        .expect("Failed to create server config builder")
        .build()
        .await
        .expect("Failed to create server config");
    let mut server = HttpServer::new(move || {
        let server_config = server_config.clone();
        App::new()
            .configure(move |config| config::configure(config, &server_config))
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
    });

    // this will enable us to keep application running during recompile: systemfd --no-pid -s http::5000 -- cargo watch -x run
    let mut listenfd = ListenFd::from_env();
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
