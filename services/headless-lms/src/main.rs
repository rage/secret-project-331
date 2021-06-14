#[macro_use]
extern crate log;

use actix_session::CookieSession;
use actix_web::{error, middleware::Logger, web, App, HttpResponse, HttpServer};
use anyhow::Result;
use dotenv::dotenv;
use headless_lms_actix::{controllers::configure_controllers, OAuthClient};
use listenfd::ListenFd;
use oauth2::{basic::BasicClient, AuthUrl, ClientId, ClientSecret, TokenUrl};
use sqlx::PgPool;
use std::{env, sync::Arc};
use url::Url;

/// The entrypoint to the application.
#[actix_web::main]
async fn main() -> Result<()> {
    std::env::set_var("RUST_LOG", "info,actix_web=info");
    dotenv().ok();
    env_logger::init();

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
        let json_config = web::JsonConfig::default()
            .limit(81920)
            .error_handler(|err, _req| {
                info!("Bad request: {}", &err);
                // create custom error response
                let response = HttpResponse::BadRequest().body(format!(
                    "{{\"title\": \"Bad Request\", \"detail\": \"{}\"}}",
                    &err
                ));
                error::InternalError::from_response(err, response).into()
            });

        App::new()
            .wrap(CookieSession::private(private_cookie_key.as_bytes()).secure(false))
            .wrap(Logger::new(
                "\"%r\" %s %b \"%{Referer}i\" \"%{User-Agent}i\" %a %Dms",
            ))
            .app_data(json_config)
            .data(db_pool.clone()) // pass database pool to application so we can access it inside handlers
            .data(oauth_client.clone())
            .service(web::scope("/api/v0").configure(configure_controllers))
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
