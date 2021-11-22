use actix_http::{body::Body, Request};
use actix_session::CookieSession;
use actix_web::{dev::ServiceResponse, test, web::Data, App};
use headless_lms_actix::{
    models::organizations::{self, Organization},
    setup_tracing,
    utils::file_store::local_file_store::LocalFileStore,
    ApplicationConfiguration,
};
use sqlx::{migrate::MigrateDatabase, Connection, PgConnection, PgPool, Postgres};
use std::{env, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;

// tried storing PgPool here but that caused strange errors
static DB_URL: Mutex<Option<String>> = Mutex::const_new(None);

/// Reinitializes the test database once per `cargo test` call.
/// This is done because there's no good way to clean up the database after testing,
/// so there may be leftover data.
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
    setup_tracing().expect("Could not setup tracing.");
    db
}

/// Initialises the actix server for testing
pub async fn init_actix() -> (
    impl actix_web::dev::Service<Request, Response = ServiceResponse<Body>, Error = actix_web::Error>,
    PgPool,
) {
    let db = init_db().await;
    let private_cookie_key = "sMG87WlKnNZoITzvL2+jczriTR7JRsCtGu/bSKaSIvw=";
    let pool = PgPool::connect(&db)
        .await
        .expect("failed to connect to test db");
    let file_store = Arc::new(futures::executor::block_on(async {
        LocalFileStore::new("uploads".into(), "http://localhost:3000".to_string())
            .await
            .expect("Failed to initialize test file store")
    }));
    let app_conf = ApplicationConfiguration {
        test_mode: true,
        base_url: "http://project-331.local".to_string(),
        development_uuid_login: false,
    };
    let app = App::new()
        .configure(move |config| headless_lms_actix::configure(config, file_store, app_conf))
        .wrap(CookieSession::private(private_cookie_key.as_bytes()).secure(false))
        // .app_data(Data::new(oauth_client.clone()))
        .app_data(Data::new(pool.clone()));
    (actix_web::test::init_service(app).await, pool)
}

#[tokio::test]
async fn gets_organizations() {
    let (actix, pool) = init_actix().await;
    let mut conn = pool.acquire().await.unwrap();
    organizations::insert(
        &mut conn,
        "org",
        "slug",
        "descr",
        Uuid::parse_str("b1bde372-cc86-4e3a-a978-35695fdd884b").unwrap(),
    )
    .await
    .unwrap();
    let req = test::TestRequest::with_uri("/api/v0/main-frontend/organizations").to_request();
    let organizations: Vec<Organization> = test::read_response_json(&actix, req).await;
    assert_eq!(organizations.len(), 1);
}
