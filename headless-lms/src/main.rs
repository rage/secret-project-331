pub mod controllers;
pub mod models;

#[macro_use]
extern crate log;

use actix_web::{get, middleware::Logger, post, web, App, HttpResponse, HttpServer, Responder};
use anyhow::Result;
use dotenv::dotenv;
use listenfd::ListenFd;
use sqlx::PgPool;
use std::env;

#[get("/")]
async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello world!")
}

#[post("/echo")]
async fn echo(req_body: String) -> impl Responder {
    HttpResponse::Ok().body(req_body)
}

async fn manual_hello() -> impl Responder {
    HttpResponse::Ok().body("Hey there!")
}

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
        App::new()
            .wrap(Logger::default())
            .data(db_pool.clone()) // pass database pool to application so we can access it inside handlers
            .service(hello)
            .service(echo)
            .route("/hey", web::get().to(manual_hello))
            .route(
                "/api/v0/courses",
                web::get().to(controllers::courses::get_all_courses),
            )
    });

    server = match listenfd.take_tcp_listener(0)? {
        Some(listener) => server.listen(listener)?,
        None => {
            let host = env::var("HOST").unwrap_or_else(|_| "localhost".to_string());
            let port = env::var("PORT").unwrap_or_else(|_| "3001".to_string());
            server.bind(format!("{}:{}", host, port))?
        }
    };

    info!("Starting server");
    server.run().await?;

    Ok(())
}
