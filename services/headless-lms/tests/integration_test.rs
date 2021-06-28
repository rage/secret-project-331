use actix_http::{body::Body, Request};
use actix_session::CookieSession;
use actix_web::{dev::ServiceResponse, test, App};
use headless_lms_actix::models::organizations::{self, Organization};
use sqlx::{migrate::MigrateDatabase, Connection, PgConnection, PgPool, Postgres};
use std::env;
use tokio::sync::Mutex;

// tried storing PgPool here but that caused strange errors
static DB_URL: Mutex<Option<String>> = Mutex::const_new(None);

/// Reinitializes the test database once per `cargo test` call
pub async fn init_db() -> String {
    if let Some(db) = DB_URL.lock().await.as_ref() {
        return db.clone();
    }
    dotenv::dotenv().ok();
    let db = env::var("DATABASE_URL_TEST").unwrap_or_else(|_| {
        "postgres://headless-lms@localhost:54328/headless_lms_test".to_string()
    });
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
    let private_cookie_key =
        env::var("PRIVATE_COOKIE_KEY").expect("PRIVATE_COOKIE_KEY must be defined");
    let pool = PgPool::connect(&db)
        .await
        .expect("failed to connect to test db");
    let app = App::new()
        .configure(headless_lms_actix::configure)
        .wrap(CookieSession::private(private_cookie_key.as_bytes()).secure(false))
        // .data(oauth_client.clone())
        .data(pool.clone());
    (actix_web::test::init_service(app).await, pool)
}

#[tokio::test]
#[ignore = "db not set up in CI, still useful as an example test"]
async fn gets_organizations() {
    let (actix, pool) = init_actix().await;
    let mut conn = pool.acquire().await.unwrap();
    organizations::insert(&mut conn, "org", "slug")
        .await
        .unwrap();
    let req = test::TestRequest::with_uri("/api/v0/main-frontend/organizations").to_request();
    let organizations: Vec<Organization> = test::read_response_json(&actix, req).await;
    assert_eq!(organizations.len(), 1);
}
