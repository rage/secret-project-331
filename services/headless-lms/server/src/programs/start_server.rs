use crate::{
    config::{self, ServerConfigBuilder, ServerRuntimeConfig, set_server_runtime_config},
    setup_tracing,
};
use actix_session::{
    SessionMiddleware,
    config::{CookieContentSecurity, PersistentSession, SessionLifecycle, TtlExtensionPolicy},
    storage::CookieSessionStore,
};
use actix_web::{
    App, HttpServer,
    cookie::{Key, SameSite},
    middleware::Logger,
};
use dotenvy::dotenv;
use listenfd::ListenFd;
use rustls::crypto::ring;

/// The entrypoint to the server.
pub async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    setup_tracing()?;

    // Required by rustls 0.23 so kube-client can build TLS configs.
    ring::default_provider()
        .install_default()
        .expect("failed to install rustls ring crypto provider");

    let runtime_config = ServerRuntimeConfig::try_from_env()?;
    let private_cookie_key = runtime_config.private_cookie_key.clone();
    let test_mode = runtime_config.test_mode;
    let allow_no_https_for_development = runtime_config.allow_no_https_for_development;
    let host = runtime_config.host.clone();
    let port = runtime_config.port.clone();
    set_server_runtime_config(runtime_config.clone());

    if test_mode {
        info!("***********************************");
        info!("*  Starting backend in test mode  *");
        info!("***********************************");
    }
    let server_config = ServerConfigBuilder::from_runtime_config(&runtime_config)
        .await
        .expect("Failed to create server config builder from runtime config")
        .build()
        .await
        .expect("Failed to create server config");
    let mut server = HttpServer::new(move || {
        let server_config = server_config.clone();
        App::new()
            .configure(move |config| config::configure(config, server_config))
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
            let bind_address = format!("{}:{}", host, port);
            info!("Binding to address: {}", bind_address);
            server.bind(bind_address)?
        }
    };

    info!("Starting server.");
    server.run().await?;

    Ok(())
}
