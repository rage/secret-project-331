use anyhow::Result;
use rand::Rng;
use serde_json::Value;
use sqlx::{Connection, PgConnection, Postgres, Transaction};
use std::env;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{
    models::{self, course_instances::NewCourseInstance, course_language_groups},
    setup_tracing,
};

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

impl Tx<'_> {
    pub async fn begin(&mut self) -> Tx<'_> {
        Tx(self.0.begin().await.unwrap())
    }

    pub async fn rollback(self) {
        self.0.rollback().await.unwrap()
    }
}

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

pub struct Data {
    pub user: Uuid,
    pub org: Uuid,
    pub course: Uuid,
    pub course_language_group: Uuid,
    pub instance: Uuid,
    pub chapter: Uuid,
    pub page: Uuid,
    pub page_history: Uuid,
    pub exercise: Uuid,
    pub exercise_slide: Uuid,
    pub task: Uuid,
}

pub async fn insert_data(conn: &mut PgConnection, exercise_type: &str) -> Result<Data> {
    let random_string: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();
    let user = models::users::insert_with_id(
        &mut *conn,
        "test@example.com",
        Uuid::parse_str("21a2b6b5-0e66-4708-8a0b-d818576ab950")?,
    )
    .await?;
    let org = models::organizations::insert(
        &mut *conn,
        "",
        &random_string,
        "",
        Uuid::parse_str("8c34e601-b5db-4b33-a588-57cb6a5b1669")?,
    )
    .await?;
    let clg_id = course_language_groups::insert_with_id(
        &mut *conn,
        Uuid::parse_str("281384b3-bbc9-4da5-b93e-4c122784a724").unwrap(),
    )
    .await?;
    let course =
        models::courses::insert(&mut *conn, "", org, clg_id, &random_string, "en-US").await?;
    let instance = models::course_instances::insert(
        &mut *conn,
        NewCourseInstance {
            id: Uuid::new_v4(),
            course_id: course,
            name: None,
            description: None,
            variant_status: None,
            teacher_in_charge_name: "teacher",
            teacher_in_charge_email: "teacher@example.com",
            support_email: None,
            opening_time: None,
            closing_time: None,
        },
    )
    .await?;
    let chapter = models::chapters::insert(&mut *conn, "", course, 1).await?;
    let (page, page_history) = models::pages::insert(&mut *conn, course, "", "", 0, user).await?;
    let exercise = models::exercises::insert(conn, course, "", page, chapter, 0).await?;
    let exercise_slide = models::exercise_slides::insert(&mut *conn, exercise, 0).await?;
    let exercise_task = models::exercise_tasks::insert(
        conn,
        exercise_slide,
        exercise_type,
        vec![],
        Value::Null,
        Value::Null,
        Value::Null,
    )
    .await?;
    Ok(Data {
        chapter,
        course,
        course_language_group: clg_id,
        exercise,
        exercise_slide,
        instance: instance.id,
        org,
        page,
        page_history,
        task: exercise_task,
        user,
    })
}
