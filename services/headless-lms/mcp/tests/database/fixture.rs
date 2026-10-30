use std::sync::Arc;

use futures::future::BoxFuture;
use headless_lms_base::{config::ApplicationConfiguration, jwt::JwtKey};
use headless_lms_mcp::{
    http::McpEndpoint,
    protocol::{dispatch, headers::RequestHeaders},
    state::{ExerciseServiceClients, McpState},
    test_support::{
        CURRENT_SKILL_VERSION, StubValidator, call_body, request_headers, request_meta,
    },
};
use headless_lms_models::{
    ModelResult, PKeyPolicy,
    agent_changeset_calls::CallActor,
    agent_changesets,
    chapters::NewChapter,
    courses::{self, NewCourse},
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_slides,
    exercise_tasks::{self, NewExerciseTask},
    exercises,
    library::{
        agent_changesets::{PublishOptions, PublishOutcome, course_state, publish},
        content_management::{create_new_chapter, create_new_course},
        copying,
        oauth::mcp::{McpPrincipal, McpScope},
    },
    oauth_client::{MetadataDocumentClient, OAuthClient},
    oauth_user_client_scopes::OAuthUserClientScopes,
    organizations,
    pages::{self, NewPage, PageDetailsUpdate},
    peer_or_self_review_configs,
    roles::{self, RoleDomain, UserRole},
    test_helper::{init_file_store, test_database_url},
    users,
};
use headless_lms_utils::{
    document_schema_processor::GutenbergBlock, file_store::local_file_store::LocalFileStore,
};
use serde_json::{Value, json};
use sqlx::{
    Connection, PgConnection, PgPool, Postgres, migrate::MigrateDatabase, postgres::PgPoolOptions,
};
use tokio::sync::OnceCell;
use url::Url;
use uuid::Uuid;

pub(crate) const TEST_CLIENT_NAME: &str = "Test agent";

static DATABASE_URL: OnceCell<String> = OnceCell::const_new();

/// The tests' own database, recreated once per run. The tools commit through their own pool, so
/// the rows can't be rolled back and would otherwise pile up in the database bin/test serves.
async fn database_url() -> String {
    DATABASE_URL
        .get_or_init(|| async {
            let mut url = Url::parse(&test_database_url()).expect("a valid test database url");
            let name = format!("{}_mcp", url.path().trim_start_matches('/'));
            url.set_path(&name);
            let url = url.to_string();
            if Postgres::database_exists(&url).await.unwrap() {
                Postgres::drop_database(&url).await.unwrap();
            }
            Postgres::create_database(&url).await.unwrap();
            let mut conn = PgConnection::connect(&url).await.unwrap();
            sqlx::migrate!("../migrations")
                .run(&mut conn)
                .await
                .unwrap();
            url
        })
        .await
        .clone()
}

pub(crate) fn no_spec<'a>(
    _: Url,
    _: &'a str,
    _: Option<&'a Value>,
) -> BoxFuture<'a, ModelResult<Value>> {
    Box::pin(async { panic!("the test pages have no exercises") })
}

pub(crate) fn no_service_info(_: Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>> {
    Box::pin(async { panic!("the test pages have no exercises") })
}

fn exercise_services() -> ExerciseServiceClients {
    ExerciseServiceClients {
        spec_fetcher: Arc::new(|| Box::new(no_spec)),
        fetch_service_info: Arc::new(no_service_info),
    }
}

pub(crate) struct Fixture {
    pub(crate) pool: PgPool,
    pub(crate) app_conf: ApplicationConfiguration,
    pub(crate) endpoint: Arc<McpEndpoint>,
    pub(crate) user_id: Uuid,
    /// The agent's metadata document client, with a grant of every MCP scope.
    pub(crate) oauth_client_id: Uuid,
    pub(crate) grant_id: Uuid,
    pub(crate) course_id: Uuid,
    pub(crate) module_id: Uuid,
    pub(crate) page_id: Uuid,
    pub(crate) chapter_id: Uuid,
    pub(crate) paragraph_id: Uuid,
}

/// An exercise [`Fixture::add_exercise`] put on the fixture's page.
pub(crate) struct TestExercise {
    pub(crate) id: Uuid,
    pub(crate) task_id: Uuid,
    /// The paragraph of the task's instructions.
    pub(crate) instructions_paragraph_id: Uuid,
}

impl Fixture {
    /// A live course with one chapter whose second page has one paragraph, and a teacher.
    pub(crate) async fn new() -> Self {
        let pool = PgPoolOptions::new()
            .max_connections(4)
            .connect(&database_url().await)
            .await
            .expect("the test database is reachable");
        let mut conn = pool.acquire().await.unwrap();
        let app_conf = ApplicationConfiguration::mock_conf().unwrap();
        let suffix = Uuid::new_v4().simple().to_string()[..12].to_string();
        let user_id = users::insert(
            &mut conn,
            PKeyPolicy::Generate,
            &format!("mcp-{suffix}@example.com"),
            None,
            None,
        )
        .await
        .unwrap();
        let organization_id = organizations::insert(
            &mut conn,
            PKeyPolicy::Generate,
            "MCP tests",
            &format!("mcp-{suffix}"),
            None,
            false,
        )
        .await
        .unwrap();
        let (course, _, _, module) = create_new_course(
            &mut conn,
            &app_conf,
            PKeyPolicy::Generate,
            NewCourse {
                name: format!("MCP {suffix}"),
                slug: format!("mcp-{suffix}"),
                organization_id,
                language_code: "en".to_string(),
                teacher_in_charge_name: "Teacher".to_string(),
                teacher_in_charge_email: format!("mcp-{suffix}@example.com"),
                description: "description".to_string(),
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
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap();
        roles::insert(
            &mut conn,
            user_id,
            UserRole::Teacher,
            RoleDomain::Course(course.id),
        )
        .await
        .unwrap();
        let (chapter, _) = create_new_chapter(
            &mut conn,
            PKeyPolicy::Generate,
            &NewChapter {
                name: "Basics".to_string(),
                color: None,
                course_id: course.id,
                chapter_number: 1,
                front_page_id: None,
                opens_at: None,
                deadline: None,
                course_module_id: Some(module.id),
            },
            user_id,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap();
        let paragraph = GutenbergBlock::paragraph("Loops repeat things.");
        let paragraph_id = paragraph.client_id;
        let page = pages::insert_page(
            &mut conn,
            NewPage {
                exercises: vec![],
                exercise_slides: vec![],
                exercise_tasks: vec![],
                content: vec![GutenbergBlock::hero_section("Loops", ""), paragraph],
                url_path: "/chapter-1/loops".to_string(),
                title: "Loops".to_string(),
                course_id: Some(course.id),
                exam_id: None,
                chapter_id: Some(chapter.id),
                front_page_of_chapter_id: None,
                content_search_language: None,
                hidden: false,
            },
            user_id,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap();
        let client = OAuthClient::upsert_metadata_document_client(
            &mut conn,
            MetadataDocumentClient {
                client_id: &format!("https://agent.example.com/{suffix}/client.json"),
                client_name: TEST_CLIENT_NAME,
                redirect_uris: &["http://127.0.0.1/callback".to_string()],
                client_uri: None,
                scopes: &McpScope::all_strs().map(str::to_string),
            },
        )
        .await
        .unwrap();
        OAuthUserClientScopes::insert(
            &mut conn,
            user_id,
            client.id,
            &McpScope::all_strs().map(str::to_string),
        )
        .await
        .unwrap();
        let grant = OAuthUserClientScopes::find_grant(&mut conn, user_id, client.id)
            .await
            .unwrap()
            .unwrap();
        drop(conn);

        let state = McpState::new(
            pool.clone(),
            app_conf.clone(),
            Arc::new(JwtKey::new(&app_conf.jwt_password).unwrap()),
            Arc::new(LocalFileStore {
                base_path: std::env::temp_dir().join("mcp-test-uploads"),
                ..init_file_store()
            }),
            Arc::new(StubValidator::default()),
            exercise_services(),
        );
        let endpoint = McpEndpoint::new(state);
        Self {
            pool,
            app_conf,
            endpoint: Arc::new(endpoint),
            user_id,
            oauth_client_id: client.id,
            grant_id: grant.id,
            course_id: course.id,
            module_id: module.id,
            page_id: page.id,
            chapter_id: chapter.id,
            paragraph_id,
        }
    }

    /// Adds a peer-reviewed exercise with one task to the page, live, using the course default
    /// review config or, with `has_own_review_config`, a config of its own.
    pub(crate) async fn add_exercise(&self, has_own_review_config: bool) -> TestExercise {
        let mut conn = self.pool.acquire().await.unwrap();
        let exercise_id = exercises::insert(
            &mut conn,
            PKeyPolicy::Generate,
            self.course_id,
            "Write a loop",
            self.page_id,
            self.chapter_id,
            1,
        )
        .await
        .unwrap();
        exercises::set_exercise_to_use_exercise_specific_peer_or_self_review_config(
            &mut conn,
            exercise_id,
            true,
            false,
            !has_own_review_config,
        )
        .await
        .unwrap();
        if has_own_review_config {
            peer_or_self_review_configs::insert(
                &mut conn,
                PKeyPolicy::Generate,
                self.course_id,
                Some(exercise_id),
            )
            .await
            .unwrap();
        }
        let slide_id = exercise_slides::insert(&mut conn, PKeyPolicy::Generate, exercise_id, 0)
            .await
            .unwrap();
        let paragraph = GutenbergBlock::paragraph("Write a loop that counts to ten.");
        let instructions_paragraph_id = paragraph.client_id;
        let task_id = exercise_tasks::insert(
            &mut conn,
            PKeyPolicy::Generate,
            NewExerciseTask {
                exercise_slide_id: slide_id,
                exercise_type: "mcp-test-exercise".to_string(),
                assignment: vec![paragraph],
                public_spec: None,
                private_spec: Some(json!({})),
                model_solution_spec: None,
                order_number: 0,
            },
        )
        .await
        .unwrap();
        let page = pages::get_page(&mut conn, self.page_id).await.unwrap();
        let mut content: Vec<GutenbergBlock> = serde_json::from_value(page.content).unwrap();
        content.push(GutenbergBlock::block_with_name_and_attributes(
            "moocfi/exercise",
            serde_json::Map::from_iter([("id".to_string(), json!(exercise_id))]),
        ));
        pages::update_page_content(&mut conn, self.page_id, &json!(content))
            .await
            .unwrap();
        TestExercise {
            id: exercise_id,
            task_id,
            instructions_paragraph_id,
        }
    }

    /// Adds a live page with one paragraph after the fixture's page in its chapter.
    pub(crate) async fn add_page(&self, title: &str, url_path: &str) -> Uuid {
        self.add_page_in(Some(self.chapter_id), title, url_path)
            .await
    }

    /// Adds a published page in `chapter_id`, or at the top level with `None`.
    pub(crate) async fn add_page_in(
        &self,
        chapter_id: Option<Uuid>,
        title: &str,
        url_path: &str,
    ) -> Uuid {
        let mut conn = self.pool.acquire().await.unwrap();
        pages::insert_page(
            &mut conn,
            NewPage {
                exercises: vec![],
                exercise_slides: vec![],
                exercise_tasks: vec![],
                content: vec![
                    GutenbergBlock::hero_section(title, ""),
                    GutenbergBlock::paragraph("Another page."),
                ],
                url_path: url_path.to_string(),
                title: title.to_string(),
                course_id: Some(self.course_id),
                exam_id: None,
                chapter_id,
                front_page_of_chapter_id: None,
                content_search_language: None,
                hidden: false,
            },
            self.user_id,
            |_, _, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap()
        .id
    }

    /// Copies the course as the web UI does: as a language version in `translation_language`
    /// into the course's language group, or with `None` as a new run in a group of its own. Makes
    /// the user a teacher of the copy when `is_teacher`.
    pub(crate) async fn copy_course(
        &self,
        translation_language: Option<&str>,
        is_teacher: bool,
    ) -> Uuid {
        let mut conn = self.pool.acquire().await.unwrap();
        let source = courses::get_course(&mut conn, self.course_id)
            .await
            .unwrap();
        let suffix = Uuid::new_v4().simple().to_string()[..12].to_string();
        let copy = copying::copy_course(
            &mut conn,
            self.course_id,
            &NewCourse {
                name: format!("Copy {suffix}"),
                slug: format!("copy-{suffix}"),
                organization_id: source.organization_id,
                language_code: translation_language.unwrap_or("en").to_string(),
                teacher_in_charge_name: "Teacher".to_string(),
                teacher_in_charge_email: format!("copy-{suffix}@example.com"),
                description: "description".to_string(),
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
            translation_language.is_some(),
            self.user_id,
        )
        .await
        .unwrap()
        .id;
        if is_teacher {
            roles::insert(
                &mut conn,
                self.user_id,
                UserRole::Teacher,
                RoleDomain::Course(copy),
            )
            .await
            .unwrap();
        }
        copy
    }

    /// Moves the exercise's block from the fixture's page to the end of `page_id`, staged.
    pub(crate) async fn move_exercise_to(&self, exercise: &TestExercise, page_id: Uuid) -> Value {
        let outline = self
            .call(
                "get_page_content",
                json!({"course": self.course_id, "page": self.page_id}),
            )
            .await;
        let block = outline["reads"][0]["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["exercise_id"] == json!(exercise.id))
            .unwrap()["path"]
            .clone();
        self.call(
            "patch_page_content",
            json!({"course": self.course_id, "page": self.page_id, "ops": [
                {"op": "move", "from": block, "to_page": page_id, "path": "", "position": "end"},
            ]}),
        )
        .await
    }

    pub(crate) fn principal(&self, scopes: &[McpScope]) -> McpPrincipal {
        McpPrincipal {
            actor: self.actor(),
            scopes: scopes.to_vec(),
        }
    }

    /// The HTTP response to a tool call made with a token holding `scopes`.
    pub(crate) async fn respond(
        &self,
        scopes: &[McpScope],
        tool: &str,
        arguments: Value,
        client_capabilities: Value,
    ) -> dispatch::HttpResponse {
        let mut arguments = arguments;
        arguments["skill_version"] = json!(CURRENT_SKILL_VERSION.to_string());
        let body = call_body(
            tool,
            arguments,
            request_meta("test-client", client_capabilities),
        );
        self.endpoint
            .server
            .handle(
                &self.endpoint.state,
                &self.principal(scopes),
                dispatch::HttpRequest {
                    method: "POST".into(),
                    headers: RequestHeaders::new(request_headers(&body)),
                    body: Ok(body),
                },
                None,
            )
            .await
    }

    /// The whole JSON-RPC result of a tool call; `client_capabilities` as the client declares them.
    pub(crate) async fn call_with(
        &self,
        tool: &str,
        arguments: Value,
        client_capabilities: Value,
    ) -> Value {
        let response = self
            .respond(&McpScope::ALL, tool, arguments, client_capabilities)
            .await;
        let body = response.body.expect("a response body");
        assert!(body.get("error").is_none(), "{tool} failed: {body}");
        body["result"].clone()
    }

    /// The whole JSON-RPC result of a tool call that may fail.
    pub(crate) async fn call_result(&self, tool: &str, arguments: Value) -> Value {
        self.call_with(tool, arguments, json!({})).await
    }

    /// The structured result of a tool call that must succeed.
    pub(crate) async fn call(&self, tool: &str, arguments: Value) -> Value {
        let result = self.call_result(tool, arguments).await;
        assert_eq!(result["isError"], json!(false), "{tool}: {result}");
        result["structuredContent"].clone()
    }

    /// Publishes the changeset of `staged`, a write call's result, which must succeed.
    pub(crate) async fn publish(&self, staged: &Value) {
        let published = self
            .call(
                "publish_changeset",
                json!({"course": self.course_id, "changeset": staged["changeset"]}),
            )
            .await;
        assert_eq!(published["published"], json!(true), "{published}");
    }

    /// Renames the page through the web UI's save path, keeping its path.
    pub(crate) async fn rename_page_live(&self, conn: &mut PgConnection) {
        pages::update_page_details(
            conn,
            self.page_id,
            &PageDetailsUpdate {
                title: "Renamed in the web UI".into(),
                url_path: "/chapter-1/loops".into(),
            },
        )
        .await
        .unwrap();
    }

    pub(crate) async fn paragraph_text(&self, state: &str) -> Value {
        let read = self
            .call(
                "get_page_content",
                json!({
                    "course": self.course_id,
                    "page": self.page_id,
                    "selectors": [{"path": format!("/{}/attributes/content", self.paragraph_id), "state": state}],
                }),
            )
            .await;
        read["reads"][0]["value"].clone()
    }

    pub(crate) async fn edit_paragraph(&self, text: &str) -> Value {
        self.call(
            "patch_page_content",
            json!({
                "course": self.course_id,
                "page": self.page_id,
                "ops": [{"op": "replace", "path": format!("/{}/attributes/content", self.paragraph_id), "value": text}],
            }),
        )
        .await
    }

    /// Publishes the changeset as the teacher does on the review page.
    pub(crate) async fn publish_reviewed(
        &self,
        changeset_id: Uuid,
        reviewed_revision: i32,
    ) -> PublishOutcome {
        let mut conn = self.pool.acquire().await.unwrap();
        publish(
            &mut conn,
            changeset_id,
            PublishOptions {
                can_add_global_admin_only_exercise_services: false,
                reviewed_revision: Some(reviewed_revision),
            },
            &self.app_conf,
            no_spec,
            no_service_info,
        )
        .await
        .unwrap()
    }

    pub(crate) async fn changeset_revision(&self, changeset_id: Uuid) -> i32 {
        let mut conn = self.pool.acquire().await.unwrap();
        agent_changesets::get_by_id(&mut conn, changeset_id)
            .await
            .unwrap()
            .revision
    }

    pub(crate) async fn live_state(&self) -> course_state::CourseState {
        let mut conn = self.pool.acquire().await.unwrap();
        let course = courses::get_course(&mut conn, self.course_id)
            .await
            .unwrap();
        course_state::load_live_course(&mut conn, &course, course_state::CourseParts::All)
            .await
            .unwrap()
    }

    /// Makes the course a draft or live through the web UI's save path.
    pub(crate) async fn set_draft(&self, is_draft: bool) {
        self.update_course(|update| update.is_draft = is_draft)
            .await;
    }

    /// Saves the course with `change` applied to its current settings.
    pub(crate) async fn update_course(&self, change: impl FnOnce(&mut courses::CourseUpdate)) {
        let mut conn = self.pool.acquire().await.unwrap();
        let course = courses::get_course(&mut conn, self.course_id)
            .await
            .unwrap();
        let mut update = courses::CourseUpdate::from(&course);
        change(&mut update);
        courses::update_course(
            &mut conn,
            &self.app_conf,
            self.course_id,
            update,
            self.user_id,
            false,
        )
        .await
        .unwrap();
    }

    pub(crate) fn actor(&self) -> CallActor {
        CallActor {
            user_id: self.user_id,
            oauth_client_id: self.oauth_client_id,
            oauth_grant_id: self.grant_id,
            client_name: TEST_CLIENT_NAME.into(),
        }
    }
}

pub(crate) fn changeset_id(result: &Value) -> Uuid {
    result["changeset"].as_str().unwrap().parse().unwrap()
}
