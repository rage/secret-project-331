use sqlx::{Connection, PgConnection, Postgres, Transaction};
use std::env;
use std::error::Error;
use tokio::sync::Mutex;
use tracing_error::ErrorLayer;
use tracing_log::LogTracer;
use tracing_subscriber::{layer::SubscriberExt, EnvFilter};

pub fn setup_tracing() -> Result<(), Box<dyn Error>> {
    let subscriber = tracing_subscriber::Registry::default()
        .with(
            tracing_subscriber::fmt::layer()
                .event_format(tracing_subscriber::fmt::format().compact()),
        )
        .with(ErrorLayer::default())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")));
    tracing::subscriber::set_global_default(subscriber)?;
    LogTracer::init()?;
    Ok(())
}

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

#[macro_export]
/// Helper macro that can be used to conveniently insert data that has some prerequisites.
/// For example, if you want an exercise task for a test, you need an organization, a course, a course instance...
/// The macro accepts variable arguments in the following order:
///
/// tx, user, org, course, instance, page, chapter, exercise, exercise_slide, exercise_task
///
/// One of the commas can be replaced with a ;, arguments before that are used as-is.
/// For example,
/// insert_data!(tx, user; org, course);
/// would use tx and user to insert and declare variables for an organization and course containing their ids or corresponding structs.
macro_rules! insert_data {
    ($tx:ident; $user:ident) => {
        let rs = ::rand::Rng::sample_iter(::rand::thread_rng(), &::rand::distributions::Alphanumeric)
            .take(8)
            .map(char::from)
            .collect::<String>();
        let $user =
            $crate::users::insert($tx.as_mut(), &format!("{rs}@example.com"), None, None)
                .await
                .unwrap();
    };
    ($tx:ident, $user:ident; $org:ident) => {
        let rs = rand::Rng::sample_iter(rand::thread_rng(), &::rand::distributions::Alphanumeric)
            .take(8)
            .map(char::from)
            .collect::<String>();
        let $org =
            $crate::organizations::insert($tx.as_mut(), "", &rs, "", ::uuid::Uuid::new_v4())
                .await
                .unwrap();
    };
    ($tx:ident, $user:ident, $org:ident; $course: ident) => {
        let rs = ::rand::Rng::sample_iter(::rand::thread_rng(), &::rand::distributions::Alphanumeric)
            .take(8)
            .map(char::from)
            .collect::<String>();
        let $course = $crate::courses::insert_course(
            $tx.as_mut(),
            ::uuid::Uuid::new_v4(),
            ::uuid::Uuid::new_v4(),
            $crate::courses::NewCourse {
                name: rs.clone(),
                slug: rs.clone(),
                organization_id: $org,
                language_code: "en-US".to_string(),
                teacher_in_charge_name: rs.clone(),
                teacher_in_charge_email: format!("{rs}@example.com"),
                description: "description".to_string()
            },
            $user
        )
        .await
        .unwrap().0.id;
    };
    ($tx:ident, $user:ident, $org:ident, $course: ident; $instance:ident) => {
        let $instance = $crate::course_instances::insert(
            $tx.as_mut(),
            $crate::course_instances::NewCourseInstance {
                id: ::uuid::Uuid::new_v4(),
                course_id: $course,
                name: Some("instance"),
                description: Some("instance"),
                teacher_in_charge_name: "teacher",
                teacher_in_charge_email: "teacher@example.com",
                support_email: None,
                opening_time: None,
                closing_time: None,
                variant_status: None,
            },
        )
        .await
        .unwrap();
    };
    ($tx:ident, $user:ident, $org:ident, $course: ident, $instance:ident; $chapter:ident) => {
        let $chapter = $crate::chapters::insert_chapter(
            $tx.as_mut(),
            $crate::chapters::NewChapter {
                name: "chapter".to_string(),
                course_id: $course,
                chapter_number: 1,
                front_front_page_id: None,
            },
            $user
        )
        .await
        .unwrap().0.id;
    };
    ($tx:ident, $user:ident, $org:ident, $course: ident, $instance:ident, $chapter:ident; $page:ident) => {
        let $page = $crate::pages::insert_page(
            $tx.as_mut(),
            $crate::pages::NewPage {
                exercises: vec![],
                exercise_slides: vec![],
                exercise_tasks: vec![],
                content: ::serde_json::json!{[]},
                url_path: "/page".to_string(),
                title: "t".to_string(),
                course_id: Some($course),
                exam_id: None,
                chapter_id: Some($chapter),
                front_page_of_chapter_id: Some($chapter),
                content_search_language: None,
            },
            $user
        )
        .await
        .unwrap().id;
    };
    ($tx:ident, $user:ident, $org:ident, $course: ident, $instance:ident, $chapter:ident, $page:ident; $exercise:ident) => {
        let $exercise =
        $crate::exercises::insert($tx.as_mut(), $course, "", $page, $chapter, 0)
            .await
            .unwrap();
    };
    ($tx:ident, $user:ident, $org:ident, $course: ident, $instance:ident, $chapter:ident, $page:ident, $exercise:ident; $exercise_slide:ident) => {
        let $exercise_slide =
               $crate::exercise_slides::insert($tx.as_mut(), $exercise, 0)
                   .await
                   .unwrap();
    };
    ($tx:ident, $user:ident, $org:ident, $course: ident, $instance:ident, $chapter:ident, $page:ident, $exercise:ident, $exercise_slide:ident; $exercise_task:ident) => {
        let $exercise_task = $crate::exercise_tasks::insert(
            $tx.as_mut(),
            $exercise_slide,
            "exercise_type",
            vec![],
            ::serde_json::Value::Null,
            ::serde_json::Value::Null,
            ::serde_json::Value::Null,
        )
        .await
        .unwrap();
    };
    // handles all the other cases
    ($tx:ident, $($to_be_inserted:ident),+) => {
        let mut conn = Conn::init().await;
        let mut $tx = conn.begin().await;
        insert_data!($tx; $($to_be_inserted),*);
    };
    ($($prev:ident),+; $insert_next:ident, $($to_be_inserted:ident),+) => {
        insert_data!($($prev),*; $insert_next);
        insert_data!($($prev),*, $insert_next; $($to_be_inserted),*);
    };
}
pub use crate::insert_data;

async fn _test() {
    insert_data!(tx, user, org, course, _instance, page, chapter, exercise, slide, _task);
}
