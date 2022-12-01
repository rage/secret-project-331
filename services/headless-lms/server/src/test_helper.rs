use crate::setup_tracing;
use sqlx::{Connection, PgConnection, Postgres, Transaction};
use std::env;
use tokio::sync::Mutex;

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
/// The macro accepts variable arguments in the following order:
///
/// tx, user, org, course, instance, course_module, chapter, page, exercise, slide, task
///
/// Arguments can be given in either of two forms:
///
/// 1. user: my_user_variable
/// 2. :user, which is shorthand for user: user
///
/// One of the commas can be replaced with a ;, arguments before that already exist and are used to insert the rest.
/// For example,
/// insert_data!(tx, user: u; :org, :course);
/// would use existing variables tx and u to insert and declare variables for an organization and course named org and course.
macro_rules! insert_data {
    // these rules transform individual arguments like "user" into "user: user"
    // arg before ; has no name
    ($($name:ident: $var:ident, )* :$ident:ident, $($tt:tt)*) => {
        insert_data!($($name: $var, )* $ident: $ident, $($tt)*);
    };
    // no ;, last arg has no name
    ($($name:ident: $var:ident, )* :$ident:ident) => {
        insert_data!($($name: $var, )* $ident: $ident);
    };
    // arg after ; has no name
    ($($name1:ident: $var1:ident),+; $($name2:ident: $var2:ident, )* :$ident:ident, $($tt:tt)*) => {
        insert_data!($($name1: $var1),*; $($name2: $var2, )* $ident: $ident, $($tt)*);
    };
    // ;, last arg has no name
    ($($name1:ident: $var1:ident),+; $($name2:ident: $var2:ident, )* :$ident:ident) => {
        insert_data!($($name1: $var1),*; $($name2: $var2, )* $ident: $ident);
    };
    // no ;, all args have names
    ($($name1:ident: $var1:ident),+) => {
        insert_data!(@inner $($name1: $var1),*);
    };
    // ;, all args have names
    ($($name1:ident: $var1:ident),+; $($name2:ident: $var2:ident),+) => {
        insert_data!(@inner $($name1: $var1),*; $($name2: $var2),*);
    };

    // these rules declare variables according to the args
    (@inner tx: $tx:ident) => {
        let mut conn = Conn::init().await;
        let mut $tx = conn.begin().await;
    };
    (@inner tx: $tx:ident; user: $user:ident) => {
        let rs = ::rand::Rng::sample_iter(::rand::thread_rng(), &::rand::distributions::Alphanumeric)
            .take(8)
            .map(char::from)
            .collect::<String>();
        let $user =
            headless_lms_models::users::insert($tx.as_mut(), headless_lms_models::PKeyPolicy::Generate, &format!("{rs}@example.com"), None, None)
                .await
                .unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident; org: $org:ident) => {
        let rs = rand::Rng::sample_iter(rand::thread_rng(), &::rand::distributions::Alphanumeric)
            .take(8)
            .map(char::from)
            .collect::<String>();
        let $org =
            headless_lms_models::organizations::insert($tx.as_mut(), headless_lms_models::PKeyPolicy::Generate, "", &rs, "")
                .await
                .unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident; course: $course: ident) => {
        let rs = ::rand::Rng::sample_iter(::rand::thread_rng(), &::rand::distributions::Alphanumeric)
            .take(8)
            .map(char::from)
            .collect::<String>();
        let $course = headless_lms_models::library::content_management::create_new_course(
            $tx.as_mut(),
            headless_lms_models::PKeyPolicy::Generate,
            headless_lms_models::courses::NewCourse {
                name: rs.clone(),
                slug: rs.clone(),
                organization_id: $org,
                language_code: "en-US".to_string(),
                teacher_in_charge_name: rs.clone(),
                teacher_in_charge_email: format!("{rs}@example.com"),
                description: "description".to_string(),
                is_draft: false,
                is_test_mode: false,
            },
            $user,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap().0.id;
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident; instance: $instance:ident) => {
        let $instance = headless_lms_models::course_instances::insert(
            $tx.as_mut(),
            headless_lms_models::PKeyPolicy::Generate,
            headless_lms_models::course_instances::NewCourseInstance {
                course_id: $course,
                name: Some("instance"),
                description: Some("instance"),
                teacher_in_charge_name: "teacher",
                teacher_in_charge_email: "teacher@example.com",
                support_email: None,
                opening_time: None,
                closing_time: None,
            },
        )
        .await
        .unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident, instance: $instance:ident; course_module: $course_module:ident) => {
        let $course_module = headless_lms_models::course_modules::insert($tx.as_mut(), headless_lms_models::PKeyPolicy::Generate, $course, Some("extra module"), 999).await.unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident, instance: $instance:ident, course_module: $course_module:ident; chapter: $chapter:ident) => {
        let $chapter = headless_lms_models::library::content_management::create_new_chapter(
            $tx.as_mut(),
            headless_lms_models::PKeyPolicy::Generate,
            &headless_lms_models::chapters::NewChapter {
                name: "chapter".to_string(),
                color: None,
                course_id: $course,
                chapter_number: 1,
                front_page_id: None,
                deadline: None,
                opens_at: None,
                course_module_id: Some($course_module.id),
            },
            $user,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap().0.id;
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident, instance: $instance:ident, course_module: $course_module:ident, chapter: $chapter:ident; page: $page:ident) => {
        let $page = headless_lms_models::pages::insert_page(
            $tx.as_mut(),
            headless_lms_models::pages::NewPage {
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
            $user,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap().id;
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident, instance: $instance:ident, course_module: $course_module:ident, chapter: $chapter:ident, page: $page:ident; exercise: $exercise:ident) => {
        let $exercise =
        headless_lms_models::exercises::insert($tx.as_mut(), headless_lms_models::PKeyPolicy::Generate, $course, "", $page, $chapter, 0)
            .await
            .unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident, instance: $instance:ident, course_module: $course_module:ident, chapter: $chapter:ident, page: $page:ident, exercise: $exercise:ident; slide: $exercise_slide:ident) => {
        let $exercise_slide =
               headless_lms_models::exercise_slides::insert($tx.as_mut(), headless_lms_models::PKeyPolicy::Generate, $exercise, 0)
                   .await
                   .unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident, instance: $instance:ident, course_module: $course_module:ident, chapter: $chapter:ident, page: $page:ident, exercise: $exercise:ident, slide: $exercise_slide:ident; task: $exercise_task:ident) => {
        let $exercise_task = headless_lms_models::exercise_tasks::insert(
            $tx.as_mut(),
            headless_lms_models::PKeyPolicy::Generate,
            headless_lms_models::exercise_tasks::NewExerciseTask {
                exercise_slide_id: $exercise_slide,
                exercise_type: "exercise_type".to_string(),
                assignment: vec![],
                public_spec: Some(serde_json::Value::Null),
                private_spec: Some(serde_json::Value::Null),
                model_solution_spec: Some(serde_json::Value::Null),
                order_number: 0,
            }
        )
        .await
        .unwrap();
    };


    // no ;
    (@inner tx: $tx:ident $(, $prev_name:ident: $prev_var:ident)+) => {
        insert_data!(@inner tx: $tx);
        insert_data!(@inner tx: $tx; $($prev_name: $prev_var),*);
    };
    // ;
    (@inner $($prev_name:ident: $prev_var:ident),*; $next_name:ident: $next_var:ident, $($tt:tt)*) => {
        insert_data!(@inner $($prev_name: $prev_var),*; $next_name: $next_var);
        insert_data!(@inner $($prev_name: $prev_var, )* $next_name: $next_var; $($tt)*);
    };
}
pub use crate::insert_data;

// checks that correct usage of the macro compiles
async fn _test() {
    insert_data!(:tx, user:u, org:o, course: c, instance: _instance, :course_module, chapter: c, :page, exercise: e, :slide, task: task);
    println!("{task}")
}
