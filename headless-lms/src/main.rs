pub mod controllers;
pub mod models;
pub mod utils;

#[macro_use]
extern crate log;

use actix_web::{error, middleware::Logger, web, App, HttpResponse, HttpServer};
use anyhow::Result;
use controllers::configure_controllers;
use dotenv::dotenv;
use listenfd::ListenFd;
use sqlx::PgPool;
use std::env;

/// The entrypoint to the application.
#[actix_web::main]
async fn main() -> Result<()> {
    std::env::set_var("RUST_LOG", "info,actix_web=info");
    dotenv().ok();
    env_logger::init();

    // this will enable us to keep application running during recompile: systemfd --no-pid -s http::5000 -- cargo watch -x run
    let mut listenfd = ListenFd::from_env();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let db_pool = PgPool::connect(&database_url).await?;

    let mut server = HttpServer::new(move || {
        let json_config = web::JsonConfig::default()
            .limit(4096)
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
            .wrap(Logger::new(
                "\"%r\" %s %b \"%{Referer}i\" \"%{User-Agent}i\" %a %Dms",
            ))
            .app_data(json_config)
            .data(db_pool.clone()) // pass database pool to application so we can access it inside handlers
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
