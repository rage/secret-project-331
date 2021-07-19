use anyhow::Result;
use rand::Rng;
use serde_json::Value;
use sqlx::{Connection, PgConnection, Postgres, Transaction};
use std::env;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{models, setup_tracing};

// tried storing PgPool here but that caused strange errors
static DB_URL: Mutex<Option<String>> = Mutex::const_new(None);

async fn get_or_init_db() -> String {
    // if initialized, return a connection to the pool
    let mut guard = DB_URL.lock().await;
    if let Some(db) = guard.as_ref() {
        return db.clone();
    }

    // initialize logging and db
    dotenv::dotenv().ok();
    let db = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://headless-lms@localhost:54328/headless_lms_dev".to_string());
    let _ = setup_tracing();

    // store initialized pool and return connection
    guard.replace(db.clone());
    db
}

/// Wrapper to ensure the test database isn't used without a transaction
pub struct Conn(PgConnection);
impl Conn {
    /// Initializes the test database and returns a connection wrapper
    pub async fn init() -> Conn {
        let db = get_or_init_db().await;
        let conn = PgConnection::connect(&db)
            .await
            .expect("failed to connect to db");
        Conn(conn)
    }

    /// Starts a postgres transaction
    pub async fn begin(&mut self) -> Tx<'_> {
        Tx(self.0.begin().await.expect("failed to begin test tx"))
    }
}

/// Wrapper to ensure the transaction isn't committed
pub struct Tx<'a>(Transaction<'a, Postgres>);

impl<'a> AsRef<Transaction<'a, Postgres>> for Tx<'a> {
    fn as_ref(&self) -> &Transaction<'a, Postgres> {
        &self.0
    }
}

impl<'a> AsMut<Transaction<'a, Postgres>> for Tx<'a> {
    fn as_mut(&mut self) -> &mut Transaction<'a, Postgres> {
        &mut self.0
    }
}

pub async fn insert_user_organization_course_instance_exercise_task(
    conn: &mut PgConnection,
    exercise_type: &str,
) -> Result<(Uuid, Uuid, Uuid, Uuid, Uuid, Uuid)> {
    let random_string: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();
    let user = models::users::insert(
        &mut *conn,
        "test@example.com",
        Uuid::parse_str("21a2b6b5-0e66-4708-8a0b-d818576ab950")?,
    )
    .await?;
    let org = models::organizations::insert(&mut *conn, "", &random_string).await?;
    let course = models::courses::insert(&mut *conn, "", org, &random_string).await?;
    let instance = models::course_instances::insert(&mut *conn, course, None).await?;
    let page = models::pages::insert(&mut *conn, course, "", "", 0).await?;
    let exercise = models::exercises::insert(conn, course, "", page, 0).await?;
    let exercise_task = models::exercise_tasks::insert(
        conn,
        exercise,
        exercise_type,
        vec![],
        Value::Null,
        Value::Null,
    )
    .await?;
    Ok((user, org, course, instance, exercise, exercise_task))
}
