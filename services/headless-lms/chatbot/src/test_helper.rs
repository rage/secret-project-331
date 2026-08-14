//! A database connection for the chatbot tests that need one.
//!
//! A course permission that no role in the caller's snapshot matches outright falls back to the
//! course's organization, which is a database read, so the checks cannot all be answered from
//! memory.

use std::env;

use headless_lms_models::{
    self as models, PKeyPolicy, courses::NewCourse, library::content_management::create_new_course,
};
use sqlx::{Connection, PgConnection, Postgres, Transaction};
use uuid::Uuid;

/// Where the tests look for their database, the same variable the models crate's tests read.
fn database_url() -> String {
    dotenvy::dotenv().ok();
    env::var("DATABASE_URL").expect("DATABASE_URL must name a database the tests may write to")
}

/// A connection to the test database, which only hands out transactions so that nothing a test
/// writes can outlive it.
pub struct Conn(PgConnection);

impl Conn {
    pub async fn init() -> Conn {
        Conn(
            PgConnection::connect(&database_url())
                .await
                .expect("failed to connect to the test database"),
        )
    }

    pub async fn begin(&mut self) -> Tx<'_> {
        Tx(self.0.begin().await.expect("failed to begin a test tx"))
    }
}

/// A transaction with no way to commit it, so it is rolled back when the test ends.
pub struct Tx<'a>(Transaction<'a, Postgres>);

impl Tx<'_> {
    pub fn conn(&mut self) -> &mut PgConnection {
        &mut self.0
    }
}

/// A conversation of a publicly accessible chatbot configuration, for the tests that write
/// messages into one. Needs no course, unlike [insert_course].
pub async fn insert_conversation(conn: &mut PgConnection) -> Uuid {
    let unique = Uuid::new_v4().to_string();
    let configuration = models::chatbot_configurations::insert(
        conn,
        PKeyPolicy::Generate,
        models::chatbot_configurations::NewChatbotConf {
            chatbot_name: unique.clone(),
            model_id: Uuid::new_v4(),
            publicly_accessible: true,
            ..Default::default()
        },
    )
    .await
    .expect("the chatbot configuration is inserted");

    models::chatbot_conversations::create_for_user_and_configuration(
        conn,
        PKeyPolicy::Generate,
        None,
        Some(unique),
        configuration.id,
    )
    .await
    .expect("the conversation is inserted")
    .id
}

/// A user and a course belonging to an organization, the world a course permission is asked about.
pub struct CourseFixture {
    pub user_id: Uuid,
    pub course_id: Uuid,
}

/// Inserts a fixture with names unique enough for the tests to run side by side.
pub async fn insert_course(conn: &mut PgConnection) -> CourseFixture {
    let unique = Uuid::new_v4().to_string();
    let user_id = models::users::insert(
        conn,
        PKeyPolicy::Generate,
        &format!("{unique}@example.com"),
        None,
        None,
    )
    .await
    .expect("the user is inserted");
    let organization_id =
        models::organizations::insert(conn, PKeyPolicy::Generate, "", &unique, None, false)
            .await
            .expect("the organization is inserted");
    let (course, ..) = create_new_course(
        conn,
        PKeyPolicy::Generate,
        NewCourse {
            name: unique.clone(),
            slug: unique.clone(),
            organization_id,
            language_code: "en".to_string(),
            teacher_in_charge_name: unique.clone(),
            teacher_in_charge_email: format!("{unique}@example.com"),
            description: "A course to ask permission questions about".to_string(),
            is_draft: false,
            is_test_mode: false,
            is_unlisted: false,
            copy_user_permissions: false,
            is_joinable_by_code_only: false,
            join_code: None,
            ask_marketing_consent: false,
            flagged_answers_threshold: Some(3),
            can_add_chatbot: false,
        },
        user_id,
        |_, _, _| unimplemented!("the fixture has no exercises to fetch specs for"),
        |_| unimplemented!("the fixture has no exercise services to look up"),
    )
    .await
    .expect("the course is inserted");

    CourseFixture {
        user_id,
        course_id: course.id,
    }
}
