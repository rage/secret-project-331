use std::env;

use actix_http::{body::Body, error::InternalError, Request};
use actix_session::CookieSession;
use actix_web::{
    dev::ServiceResponse,
    web::{self, HttpResponse},
    App,
};
use sqlx::{migrate::MigrateDatabase, Connection, PgConnection, PgPool, Postgres};
use tokio::sync::Mutex;
use tracing_actix_web::TracingLogger;

// tried storing PgPool here but that caused strange errors
static DB_URL: Mutex<Option<String>> = Mutex::const_new(None);

/// Reinitializes the test database once per `cargo test` call
pub async fn init_db() -> String {
    if let Some(db) = DB_URL.lock().await.as_ref() {
        return db.clone();
    }
    dotenv::dotenv().ok();
    let db = env::var("DATABASE_URL_TEST").expect("no DATABASE_URL_TEST");
    if Postgres::database_exists(&db)
        .await
        .expect("failed to check test db existence")
    {
        Postgres::drop_database(&db)
            .await
            .expect("failed to drop test db");
    }
    Postgres::create_database(&db)
        .await
        .expect("failed to create test db");
    let mut conn = PgConnection::connect(&db)
        .await
        .expect("failed to connect to test db");
    sqlx::migrate!("./migrations")
        .run(&mut conn)
        .await
        .expect("failed to run migrations");
    let _ = tracing_subscriber::fmt().try_init();
    db
}

/// Initialises the actix server for testing
pub async fn init_actix() -> (
    impl actix_web::dev::Service<Request, Response = ServiceResponse<Body>, Error = actix_http::Error>,
    PgPool,
) {
    let db = init_db().await;
    let json_config = web::JsonConfig::default()
        .limit(81920)
        .error_handler(|err, _req| {
            tracing::info!("Bad request: {}", &err);
            // create custom error response
            let response = HttpResponse::BadRequest().body(format!(
                "{{\"title\": \"Bad Request\", \"detail\": \"{}\"}}",
                &err
            ));
            InternalError::from_response(err, response).into()
        });
    let private_cookie_key =
        env::var("PRIVATE_COOKIE_KEY").expect("PRIVATE_COOKIE_KEY must be defined");
    let pool = PgPool::connect(&db)
        .await
        .expect("failed to connect to test db");
    let app = App::new()
        .wrap(CookieSession::private(private_cookie_key.as_bytes()).secure(false))
        .wrap(TracingLogger::default())
        .app_data(json_config)
        .data(pool.clone())
        // .data(oauth_client.clone())
        .service(
            web::scope("/api/v0").configure(headless_lms_actix::controllers::configure_controllers),
        );
    (actix_web::test::init_service(app).await, pool)
}
