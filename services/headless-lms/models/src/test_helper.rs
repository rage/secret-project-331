use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::file_store::local_file_store::LocalFileStore;
use sqlx::{Connection, PgConnection, Postgres, Transaction};
use std::env;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{
    PKeyPolicy,
    chatbot_configurations::{self, NewChatbotConf},
    chatbot_conversation_message_messages::MessageRole,
    chatbot_conversation_message_reasoning::ChatbotConversationMessageReasoning,
    chatbot_conversation_message_tool_calls::{ChatbotConversationMessageToolCall, ToolKind},
    chatbot_conversation_message_tool_outputs::ChatbotConversationMessageToolOutput,
    chatbot_conversation_messages::{ChatbotConversationMessage, Message},
    chatbot_conversations,
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
    dotenvy::dotenv().ok();
    let db = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://headless-lms@localhost:54328/headless_lms_dev".to_string());
    let _ = headless_lms_base::tracing::setup_tracing();

    // store initialized pool and return connection
    guard.replace(db.clone());
    db
}

pub fn init_app_conf() -> ModelResult<ApplicationConfiguration> {
    let app_config = ApplicationConfiguration::mock_conf()?;
    Ok(app_config)
}

/// A file store for tests that only need download URLs, not stored bytes.
pub fn init_file_store() -> LocalFileStore {
    LocalFileStore::new("uploads".into(), "http://localhost:3000".to_string())
        .expect("failed to initialize the test file store")
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
        Tx(self.0.begin().await.expect("failed to begin test tx"))
    }

    pub async fn rollback(self) {
        self.0
            .rollback()
            .await
            .expect("failed to roll back test tx")
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

pub const TEST_HELPER_EXERCISE_SERVICE_NAME: &str = "exercise_type";

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
    // arg before potential ; has no name
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
        #[allow(unused_mut)]
        let mut $tx = conn.begin().await;
    };
    (@inner tx: $tx:ident; user: $user:ident) => {
        let rs = <::rand::distr::Alphanumeric as ::rand::distr::SampleString>::sample_string(
            &::rand::distr::Alphanumeric,
            &mut ::rand::rng(),
            8,
        );
        let $user =
            $crate::users::insert($tx.as_mut(), $crate::PKeyPolicy::Generate, &format!("{rs}@example.com"), None, None)
                .await
                .unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident; org: $org:ident) => {
        let rs = <::rand::distr::Alphanumeric as ::rand::distr::SampleString>::sample_string(
            &::rand::distr::Alphanumeric,
            &mut ::rand::rng(),
            8,
        );
        let $org =
            $crate::organizations::insert($tx.as_mut(), $crate::PKeyPolicy::Generate, "", &rs, None, false)
                .await
                .unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident; course: $course: ident) => {
        let rs = <::rand::distr::Alphanumeric as ::rand::distr::SampleString>::sample_string(
            &::rand::distr::Alphanumeric,
            &mut ::rand::rng(),
            8,
        );
        let app_config = init_app_conf().expect("Application Configuration initialization failed");
        let $course = $crate::library::content_management::create_new_course(
            $tx.as_mut(),
            &app_config,
            $crate::PKeyPolicy::Generate,
            $crate::courses::NewCourse {
                name: rs.clone(),
                slug: rs.clone(),
                organization_id: $org,
                language_code: "en".to_string(),
                teacher_in_charge_name: rs.clone(),
                teacher_in_charge_email: format!("{rs}@example.com"),
                description: "description".to_string(),
                is_draft: false,
                is_test_mode: false,
                is_unlisted: false,
                copy_user_permissions: false,
                is_joinable_by_code_only: false,
                join_code: None,
                ask_marketing_consent:false,
                flagged_answers_threshold: Some(3),
                can_add_chatbot: false,
            },
            $user,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap().0.id;
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident; instance: $instance:ident) => {
        let $instance = $crate::course_instances::insert(
            $tx.as_mut(),
            $crate::PKeyPolicy::Generate,
            $crate::course_instances::NewCourseInstance {
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
        let $course_module = $crate::course_modules::insert($tx.as_mut(), $crate::PKeyPolicy::Generate, &$crate::course_modules::NewCourseModule::new($course, Some("extra module".to_string()), 999)).await.unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident, instance: $instance:ident, course_module: $course_module:ident; chapter: $chapter:ident) => {
        let $chapter = $crate::library::content_management::create_new_chapter(
            $tx.as_mut(),
            $crate::PKeyPolicy::Generate,
            &$crate::chapters::NewChapter {
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
        let $page = $crate::pages::insert_page(
            $tx.as_mut(),
            $crate::pages::NewPage {
                exercises: vec![],
                exercise_slides: vec![],
                exercise_tasks: vec![],
                content: vec![],
                url_path: "/page".to_string(),
                title: "t".to_string(),
                course_id: Some($course),
                exam_id: None,
                chapter_id: Some($chapter),
                front_page_of_chapter_id: Some($chapter),
                content_search_language: None,
                hidden: false,
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
        $crate::exercises::insert($tx.as_mut(), $crate::PKeyPolicy::Generate, $course, "", $page, $chapter, 0)
            .await
            .unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident, instance: $instance:ident, course_module: $course_module:ident, chapter: $chapter:ident, page: $page:ident, exercise: $exercise:ident; slide: $exercise_slide:ident) => {
        let $exercise_slide =
               $crate::exercise_slides::insert($tx.as_mut(), $crate::PKeyPolicy::Generate, $exercise, 0)
                   .await
                   .unwrap();
    };
    (@inner tx: $tx:ident, user: $user:ident, org: $org:ident, course: $course: ident, instance: $instance:ident, course_module: $course_module:ident, chapter: $chapter:ident, page: $page:ident, exercise: $exercise:ident, slide: $exercise_slide:ident; task: $exercise_task:ident) => {
        let $exercise_task = $crate::exercise_tasks::insert(
            $tx.as_mut(),
            $crate::PKeyPolicy::Generate,
            $crate::exercise_tasks::NewExerciseTask {
                exercise_slide_id: $exercise_slide,
                exercise_type: TEST_HELPER_EXERCISE_SERVICE_NAME.to_string(),
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
use crate::ModelResult;
pub use crate::insert_data;

// checks that correct usage of the macro compiles
#[allow(unused)]
async fn _test() {
    insert_data!(tx:t, user:u, org:o, course:c, instance:i, course_module:m, chapter:c, page:p, exercise:e, slide:s, task:tsk);
    insert_data!(:tx, :user, :org, :course, :instance, :course_module, :chapter, :page, :exercise, :slide, :task);
}

/// Inserts a publicly accessible chatbot configuration and a conversation for it, returning their
/// ids. Needs no course, which keeps a committed fixture small enough to delete again.
pub async fn insert_chatbot_conversation(conn: &mut PgConnection) -> (Uuid, Uuid) {
    insert_chatbot_conversation_suggesting_messages(conn, false).await
}

/// [insert_chatbot_conversation] with the configuration's next-message suggestions turned on or off.
pub async fn insert_chatbot_conversation_suggesting_messages(
    conn: &mut PgConnection,
    suggest_next_messages: bool,
) -> (Uuid, Uuid) {
    let unique = Uuid::new_v4().to_string();
    let configuration = chatbot_configurations::insert(
        conn,
        PKeyPolicy::Generate,
        NewChatbotConf {
            chatbot_name: unique.clone(),
            model_id: Uuid::new_v4(),
            publicly_accessible: true,
            suggest_next_messages,
            ..Default::default()
        },
    )
    .await
    .expect("the chatbot configuration is inserted");
    let conversation = chatbot_conversations::create_for_user_and_configuration(
        conn,
        PKeyPolicy::Generate,
        None,
        Some(unique),
        configuration.id,
    )
    .await
    .expect("the conversation is inserted");
    (configuration.id, conversation.id)
}

/// A text message of a chatbot conversation, ready to be inserted, with no token estimate.
pub fn chatbot_text_message(
    conversation_id: Uuid,
    message_role: MessageRole,
    text: &str,
    response_id: Option<&str>,
) -> ChatbotConversationMessage {
    ChatbotConversationMessage::text(
        conversation_id,
        message_role,
        text.to_string(),
        0,
        response_id.map(|id| id.to_string()),
    )
}

/// A tool call of a chatbot conversation, ready to be inserted.
pub fn chatbot_tool_call_message(
    conversation_id: Uuid,
    tool_call_id: &str,
    tool_kind: ToolKind,
    response_id: &str,
) -> ChatbotConversationMessage {
    ChatbotConversationMessage {
        conversation_id,
        message: Message::ToolCall(ChatbotConversationMessageToolCall {
            tool_name: "course_structure".to_string(),
            tool_call_id: tool_call_id.to_string(),
            tool_kind,
            response_id: response_id.to_string(),
            ..Default::default()
        }),
        ..Default::default()
    }
}

/// The output that answers a [chatbot_tool_call_message], ready to be inserted.
pub fn chatbot_tool_output_message(
    conversation_id: Uuid,
    tool_call_id: &str,
    tool_kind: ToolKind,
    response_id: &str,
) -> ChatbotConversationMessage {
    ChatbotConversationMessage {
        conversation_id,
        message: Message::ToolOutput(ChatbotConversationMessageToolOutput {
            output: "output".to_string(),
            tool_call_id: tool_call_id.to_string(),
            tool_kind,
            response_id: response_id.to_string(),
            ..Default::default()
        }),
        ..Default::default()
    }
}

/// A reasoning item of a chatbot conversation, ready to be inserted.
///
/// Only an item with `encrypted_content` can be replayed to the model, so a test asserting what a
/// later turn sends decides whether it has one.
pub fn chatbot_reasoning_message(
    conversation_id: Uuid,
    reasoning_id: &str,
    response_id: &str,
    encrypted_content: Option<&str>,
) -> ChatbotConversationMessage {
    ChatbotConversationMessage {
        conversation_id,
        message: Message::Reasoning(ChatbotConversationMessageReasoning {
            reasoning_id: reasoning_id.to_string(),
            response_id: response_id.to_string(),
            encrypted_content: encrypted_content.map(str::to_string),
            ..Default::default()
        }),
        ..Default::default()
    }
}
