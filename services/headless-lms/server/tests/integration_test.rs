use std::{env, sync::Arc};

use actix_http::{body::BoxBody, Request};
use actix_session::{storage::CookieSessionStore, SessionMiddleware};
use actix_web::{cookie::Key, dev::ServiceResponse, test, App};
use headless_lms_models::{
    organizations::{self, Organization},
    PKeyPolicy,
};
use headless_lms_server::{
    config::{ServerConfig, ServerConfigBuilder},
    domain::models_requests::JwtKey,
    setup_tracing,
};
use headless_lms_utils::{file_store::local_file_store::LocalFileStore, ApplicationConfiguration};
use sqlx::{migrate::MigrateDatabase, Connection, PgConnection, PgPool, Postgres};
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
        "postgres://headless-lms:only-for-local-development-intentionally-public@postgres/headless_lms_test".to_string()
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
    sqlx::migrate!("../migrations")
        .run(&mut conn)
        .await
        .expect("failed to run migrations");
    setup_tracing().expect("Could not setup tracing.");
    let mut lock = DB_URL.lock().await;
    *lock = Some(db.clone());
    db
}

pub fn make_jwt_key() -> JwtKey {
    let test_jwt_key = "sMG87WlKnNZoITzvL2+jczriTR7JRsCtGu/bSKaSIvw=asdfjklasd***FSDfsdASDFDS";
    JwtKey::new(test_jwt_key).unwrap()
}

pub async fn test_config() -> ServerConfig {
    ServerConfigBuilder {
        database_url: init_db().await,
        oauth_application_id: "some-id".to_string(),
        oauth_secret: "some-secret".to_string(),
        auth_url: "https://example.com".parse().unwrap(),
        icu4x_postcard_path: "/icu4x.postcard".to_string(),
        file_store: Arc::new(futures::executor::block_on(async {
            LocalFileStore::new("uploads".into(), "http://localhost:3000".to_string())
                .expect("Failed to initialize test file store")
        })),
        app_conf: ApplicationConfiguration {
            test_mode: true,
            base_url: "http://project-331.local".to_string(),
            development_uuid_login: false,
            azure_configuration: None,
        },
        redis_url: "redis://example.com".to_string(),
        jwt_password: "sMG87WlKnNZoITzvL2+jczriTR7JRsCtGu/bSKaSIvw=asdfjklasd***FSDfsdASDFDS"
            .to_string(),
    }
    .build()
    .await
    .unwrap()
}

/// Initialises the actix server for testing
pub async fn init_actix() -> (
    impl actix_web::dev::Service<Request, Response = ServiceResponse<BoxBody>, Error = actix_web::Error>,
    PgPool,
) {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("OAUTH_APPLICATION_ID", "some-id") };
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("HEADLESS_LMS_CACHE_FILES_PATH", "/tmp") };
    let private_cookie_key =
        "sMG87WlKnNZoITzvL2+jczriTR7JRsCtGu/bSKaSIvw=asdfjklasd***FSDfsdASDFDS";
    let server_config = test_config().await;
    let pool = server_config.db_pool.clone().into_inner().as_ref().clone();
    let app = App::new()
        .configure(move |config| headless_lms_server::config::configure(config, server_config))
        .wrap(
            SessionMiddleware::builder(
                CookieSessionStore::default(),
                Key::from(private_cookie_key.as_bytes()),
            )
            .cookie_name("session".to_string())
            .cookie_secure(false)
            .build(),
        );
    (actix_web::test::init_service(app).await, pool)
}

#[ignore = "Only one integration test can be run at once in current setup."]
#[actix_web::test]
async fn gets_organizations() {
    let (actix, pool) = init_actix().await;
    let mut conn = pool.acquire().await.unwrap();
    organizations::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("b1bde372-cc86-4e3a-a978-35695fdd884b").unwrap()),
        "org",
        "slug",
        "descr",
    )
    .await
    .unwrap();
    let req = test::TestRequest::with_uri("/api/v0/main-frontend/organizations").to_request();
    let organizations: Vec<Organization> = test::call_and_read_body_json(&actix, req).await;
    assert_eq!(organizations.len(), 1);
}
