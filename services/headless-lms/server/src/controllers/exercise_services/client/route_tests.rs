use super::*;
use crate::test_helper::*;
use actix_web::http::StatusCode;
use actix_web::{App, test};
use chrono::Duration as ChronoDuration;
use chrono::Utc;
use headless_lms_models::library::oauth::pkce::PkceMethod;
use headless_lms_models::library::oauth::{
    EXERCISE_SERVICES_SCOPE, GrantTypeName, generate_access_token, token_digest_sha256,
};
use headless_lms_models::oauth_access_token::{NewAccessTokenParams, OAuthAccessToken, TokenType};
use headless_lms_models::oauth_client::{
    ApplicationType, NewClientParams, OAuthClient, TokenEndpointAuthMethod,
};
use headless_lms_models::oauth_user_client_scopes::OAuthUserClientScopes;
use headless_lms_utils::cache::Cache;
use headless_lms_utils::file_store::FileStore;
use models::exercise_task_gradings::ExerciseTaskGradingResult;
use sqlx::Connection;
use std::sync::{Arc, Mutex};

const BOUNDARY: &str = "clientrouteboundary";

/// Everything a request needs: the ids the routes are called with, and a bearer the
/// `UserFromOAuthToken` extractor accepts.
struct Fixture {
    user: Uuid,
    course: Uuid,
    exercise: Uuid,
    slide: Uuid,
    task: Uuid,
    /// A task, in an exercise of its own, whose exercise service does not declare
    /// `supports_native_client`, so this API cannot serve it.
    unservable_task: Uuid,
    token: String,
}

/// A bearer for `user`, taking the real `oauth_access_tokens` path rather than the test-token
/// shortcut, which only maps to seeded users this crate's tests do not have.
async fn issue_token(conn: &mut PgConnection, user: Uuid) -> String {
    let client = OAuthClient::insert(
        conn,
        NewClientParams {
            client_id: &format!("cli-{}", &generate_access_token()[..12]),
            client_name: "Client API route test client",
            application_type: ApplicationType::Native,
            token_endpoint_auth_method: TokenEndpointAuthMethod::None,
            client_secret: None,
            client_secret_expires_at: None,
            redirect_uris: &["urn:ietf:wg:oauth:2.0:oob".to_string()],
            post_logout_redirect_uris: None,
            allowed_grant_types: &[GrantTypeName::DeviceCode, GrantTypeName::RefreshToken],
            scopes: &[EXERCISE_SERVICES_SCOPE.to_string()],
            require_pkce: true,
            pkce_methods_allowed: &[PkceMethod::S256],
            allowed_origins: None,
            bearer_allowed: true,
        },
    )
    .await
    .expect("oauth client");
    let plaintext = generate_access_token();
    let hmac_key = upload_tests::app_conf()
        .oauth_server_configuration
        .oauth_token_hmac_key
        .clone();
    OAuthAccessToken::insert(
        conn,
        NewAccessTokenParams {
            digest: &token_digest_sha256(&plaintext, &hmac_key),
            user_id: Some(user),
            client_id: client.id,
            scopes: &[EXERCISE_SERVICES_SCOPE.to_string()],
            audience: None,
            token_type: TokenType::Bearer,
            dpop_jkt: None,
            metadata: serde_json::Map::new(),
            expires_at: Utc::now() + ChronoDuration::hours(1),
            refresh_token_family_id: None,
        },
    )
    .await
    .expect("access token");
    OAuthUserClientScopes::insert(
        conn,
        user,
        client.id,
        &[EXERCISE_SERVICES_SCOPE.to_string()],
    )
    .await
    .expect("grant");
    plaintext
}

/// Registers a client-capable exercise service under a slug of its own, and a task of that
/// type. A unique slug keeps these committed rows from being mistaken for anyone else's: the
/// capability query is global, and the other tests that read it assert by membership.
async fn insert_client_capable_task(
    conn: &mut PgConnection,
    slide: Uuid,
    internal_url: Option<String>,
) -> Uuid {
    let slug = format!("client-route-test-{}", Uuid::new_v4());
    let service = models::exercise_services::insert_exercise_service(
        conn,
        &models::exercise_services::ExerciseServiceNewOrUpdate {
            name: slug.clone(),
            slug: slug.clone(),
            public_url: "http://example.com/api/service".to_string(),
            internal_url,
            max_reprocessing_submissions_at_once: 1,
            is_global_admin_only: false,
            is_experimental: false,
        },
    )
    .await
    .expect("exercise service");
    models::exercise_service_info::insert(
        conn,
        &models::exercise_service_info::PathInfo {
            exercise_service_id: service.id,
            user_interface_iframe_path: "/iframe".to_string(),
            grade_endpoint_path: "/grade".to_string(),
            public_spec_endpoint_path: "/public-spec".to_string(),
            model_solution_spec_endpoint_path: "/model-solution".to_string(),
            has_custom_view: false,
            supports_native_client: true,
            produces_file_answers: false,
            declares_spec_files: false,
        },
    )
    .await
    .expect("service info");
    models::exercise_tasks::insert(
        conn,
        models::PKeyPolicy::Generate,
        models::exercise_tasks::NewExerciseTask {
            exercise_slide_id: slide,
            exercise_type: slug,
            assignment: vec![],
            public_spec: Some(serde_json::Value::Null),
            private_spec: Some(serde_json::Value::Null),
            model_solution_spec: Some(serde_json::Value::Null),
            order_number: 1,
        },
    )
    .await
    .expect("exercise task")
}

/// A committed course with one exercise, and a user who is enrolled unless `enrolled` is false.
/// The exercise's task `task` has an exercise service that can serve this client. The fixture
/// macro's task, whose service cannot, is moved to an exercise of its own, since a slide mixing
/// the two would not be served at all.
async fn committed_fixture(enrolled: bool) -> Fixture {
    committed_fixture_with_service(enrolled, None).await
}

async fn committed_fixture_with_service(
    enrolled: bool,
    service_internal_url: Option<String>,
) -> Fixture {
    insert_data!(:tx, user: user, :org, course: course, instance: instance, :course_module, :chapter, :page, exercise: exercise, slide: slide, task: _unservable_task);
    let task = insert_client_capable_task(tx.as_mut(), slide, service_internal_url).await;
    let unservable_exercise = models::exercises::insert(
        tx.as_mut(),
        models::PKeyPolicy::Generate,
        course,
        "unservable",
        page,
        chapter,
        1,
    )
    .await
    .expect("exercise");
    let unservable_slide = models::exercise_slides::insert(
        tx.as_mut(),
        models::PKeyPolicy::Generate,
        unservable_exercise,
        0,
    )
    .await
    .expect("slide");
    sqlx::query("UPDATE exercise_tasks SET exercise_slide_id = $1 WHERE id = $2")
        .bind(unservable_slide)
        .bind(_unservable_task)
        .execute(&mut **tx.as_mut())
        .await
        .expect("moving the unservable task");
    if enrolled {
        models::course_instance_enrollments::insert_enrollment_and_set_as_current(
            tx.as_mut(),
            models::course_instance_enrollments::NewCourseInstanceEnrollment {
                course_id: course,
                user_id: user,
                course_instance_id: instance.id,
            },
        )
        .await
        .expect("enrollment");
    }
    let token = issue_token(tx.as_mut(), user).await;
    tx.commit().await;
    Fixture {
        user,
        course,
        exercise,
        slide,
        task,
        unservable_task: _unservable_task,
        token,
    }
}

/// The routes under a real actix app, with the app data every extractor and handler reads.
macro_rules! client_api_app {
    () => {{
        let file_store: Arc<dyn FileStore> = Arc::new(temp_file_store());
        client_api_app!(file_store)
    }};
    ($file_store:expr) => {{
        let pool = PgPool::connect(&dev_database_url()).await.expect("pool");
        let file_store: Arc<dyn FileStore> = $file_store;
        test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .app_data(web::Data::from(file_store))
                .app_data(web::Data::new(upload_tests::app_conf()))
                .app_data(web::Data::new(
                    Cache::new("redis://127.0.0.1:1").expect("cache"),
                ))
                .app_data(web::Data::new(JwtKey::test_key()))
                .configure(_add_routes),
        )
        .await
    }};
}

fn multipart_body(parts: &[(Uuid, &str, &str)]) -> Vec<u8> {
    let mut body = String::new();
    for (field_name, file_name, contents) in parts {
        body.push_str(&format!("--{BOUNDARY}\r\n"));
        body.push_str(&format!(
            "Content-Disposition: form-data; name=\"{field_name}\"; filename=\"{file_name}\"\r\n"
        ));
        body.push_str("Content-Type: application/octet-stream\r\n\r\n");
        body.push_str(contents);
        body.push_str("\r\n");
    }
    body.push_str(&format!("--{BOUNDARY}--\r\n"));
    body.into_bytes()
}

fn upload_request(exercise: Uuid, token: &str, parts: &[(Uuid, &str, &str)]) -> test::TestRequest {
    test::TestRequest::post()
        .uri(&format!("/exercises/{exercise}/files"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .insert_header((
            "Content-Type",
            format!("multipart/form-data; boundary={BOUNDARY}"),
        ))
        .set_payload(multipart_body(parts))
}

/// A file answer's submit body, which is the only shape a native client sends today.
fn file_submission(
    exercise_slide_id: Uuid,
    exercise_task_id: Uuid,
    data_files: Vec<Uuid>,
) -> api::ExerciseSlideSubmission {
    api::ExerciseSlideSubmission {
        exercise_slide_id,
        exercise_task_id,
        answer_kind: Some(api::AnswerKind::File),
        data_json: None,
        data_files: Some(data_files),
    }
}

fn submit_request(
    exercise: Uuid,
    token: &str,
    body: &api::ExerciseSlideSubmission,
) -> test::TestRequest {
    test::TestRequest::post()
        .uri(&format!("/exercises/{exercise}/submit"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(body)
}

/// The `message_key` a client keys its error handling on.
fn message_key(body: &serde_json::Value) -> &str {
    body["message_key"].as_str().unwrap_or_default()
}

/// Uploads two files through the route and returns their ids, in the order the client sent them.
async fn upload_two(fixture: &Fixture) -> Vec<Uuid> {
    let app = client_api_app!();
    let request = upload_request(
        fixture.exercise,
        &fixture.token,
        &[
            (Uuid::new_v4(), "a.tar.zst", "first"),
            (Uuid::new_v4(), "b.txt", "second"),
        ],
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let body: api::UploadedFiles = test::read_body_json(response).await;
    body.data_files.into_iter().map(|file| file.id).collect()
}

#[actix_web::test]
async fn uploading_files_returns_them_in_the_order_they_were_sent() {
    let fixture = committed_fixture(true).await;
    let app = client_api_app!();
    let request = upload_request(
        fixture.exercise,
        &fixture.token,
        &[
            (Uuid::new_v4(), "a.tar.zst", "first"),
            (Uuid::new_v4(), "b.txt", "second"),
        ],
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let body: api::UploadedFiles = test::read_body_json(response).await;
    let names: Vec<&str> = body
        .data_files
        .iter()
        .map(|file| file.name.as_str())
        .collect();
    assert_eq!(names, vec!["a.tar.zst", "b.txt"]);
    assert!(
        body.data_files
            .iter()
            .all(|file| file.url.contains(&file.id.to_string()) || !file.url.is_empty())
    );

    // The bindings the later submit validates against must exist for this exercise and user.
    let mut conn = Conn::init().await;
    let mut tx = conn.begin().await;
    let ids: Vec<Uuid> = body.data_files.iter().map(|file| file.id).collect();
    let recorded = models::exercise_answer_uploads::get_for_exercise_and_user(
        tx.as_mut(),
        fixture.exercise,
        fixture.user,
        &ids,
    )
    .await
    .expect("bindings");
    assert_eq!(recorded.len(), 2);
    assert!(recorded.iter().all(|upload| !upload.deleted));
    tx.rollback().await;
}

#[actix_web::test]
async fn uploading_without_a_bearer_is_unauthorized() {
    let fixture = committed_fixture(true).await;
    let app = client_api_app!();
    let request = test::TestRequest::post()
        .uri(&format!("/exercises/{}/files", fixture.exercise))
        .insert_header((
            "Content-Type",
            format!("multipart/form-data; boundary={BOUNDARY}"),
        ))
        .set_payload(multipart_body(&[(Uuid::new_v4(), "a.tar.zst", "first")]))
        .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[actix_web::test]
async fn a_user_who_never_enrolled_cannot_upload() {
    let fixture = committed_fixture(false).await;
    let app = client_api_app!();
    let request = upload_request(
        fixture.exercise,
        &fixture.token,
        &[(Uuid::new_v4(), "a.tar.zst", "first")],
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "not_enrolled");
}

/// The native route must refuse what the iframe route refuses: stashing files for a submission
/// the student can no longer make. A passed deadline stands in for the whole gate.
#[actix_web::test]
async fn a_user_past_the_deadline_cannot_upload() {
    let fixture = committed_fixture(true).await;
    expire_deadline(fixture.exercise).await;
    let app = client_api_app!();
    let request = upload_request(
        fixture.exercise,
        &fixture.token,
        &[(Uuid::new_v4(), "a.tar.zst", "first")],
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "deadline_passed");
}

async fn expire_deadline(exercise: Uuid) {
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    models::exercises::set_deadline(
        &mut conn,
        exercise,
        Some(Utc::now() - ChronoDuration::days(1)),
    )
    .await
    .expect("deadline");
}

#[actix_web::test]
async fn uploading_to_an_unknown_exercise_is_not_found() {
    let fixture = committed_fixture(true).await;
    let app = client_api_app!();
    let request = upload_request(
        Uuid::new_v4(),
        &fixture.token,
        &[(Uuid::new_v4(), "a.tar.zst", "first")],
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

/// A part whose field name is not a UUID is refused, and — the point of the test — nothing is
/// recorded and no object is left in the store, since the ids are the client's own handles.
#[actix_web::test]
async fn a_part_named_by_something_other_than_a_uuid_is_refused() {
    let fixture = committed_fixture(true).await;
    let app = client_api_app!();
    let mut body = String::new();
    body.push_str(&format!("--{BOUNDARY}\r\n"));
    body.push_str(
        "Content-Disposition: form-data; name=\"not-a-uuid\"; filename=\"a.tar.zst\"\r\n",
    );
    body.push_str("Content-Type: application/octet-stream\r\n\r\nfirst\r\n");
    body.push_str(&format!("--{BOUNDARY}--\r\n"));
    let request = test::TestRequest::post()
        .uri(&format!("/exercises/{}/files", fixture.exercise))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .insert_header((
            "Content-Type",
            format!("multipart/form-data; boundary={BOUNDARY}"),
        ))
        .set_payload(body.into_bytes())
        .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

/// Every file under `root`, relative to it; the test file store is a directory tree on disk.
fn stored_object_paths(root: &std::path::Path) -> Vec<String> {
    let mut found = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                pending.push(path);
            } else if let Ok(relative) = path.strip_prefix(root) {
                found.push(relative.to_string_lossy().into_owned());
            }
        }
    }
    found
}

/// Parts are streamed to the object store one at a time, so a body whose *second* part is
/// invalid has already put an object there. Nothing points at that object — no `file_uploads`
/// row, so not even the reaper can find it — which is why the route deletes it itself.
#[actix_web::test]
async fn a_part_rejected_after_an_earlier_one_was_stored_leaves_no_object_behind() {
    let fixture = committed_fixture(true).await;
    let store_dir = tempfile::tempdir().expect("temp dir");
    let store_path = store_dir.path().to_path_buf();
    let app = client_api_app!(Arc::new(crate::test_helper::TempFileStore(store_dir)));

    let mut body = String::new();
    body.push_str(&format!("--{BOUNDARY}\r\n"));
    body.push_str(&format!(
        "Content-Disposition: form-data; name=\"{}\"; filename=\"a.tar.zst\"\r\n",
        Uuid::new_v4()
    ));
    body.push_str("Content-Type: application/octet-stream\r\n\r\nfirst\r\n");
    body.push_str(&format!("--{BOUNDARY}\r\n"));
    body.push_str("Content-Disposition: form-data; name=\"not-a-uuid\"; filename=\"b.txt\"\r\n");
    body.push_str("Content-Type: application/octet-stream\r\n\r\nsecond\r\n");
    body.push_str(&format!("--{BOUNDARY}--\r\n"));
    let request = test::TestRequest::post()
        .uri(&format!("/exercises/{}/files", fixture.exercise))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .insert_header((
            "Content-Type",
            format!("multipart/form-data; boundary={BOUNDARY}"),
        ))
        .set_payload(body.into_bytes())
        .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);

    let leftovers = stored_object_paths(&store_path);
    assert!(
        leftovers.is_empty(),
        "objects left in the store: {leftovers:?}"
    );
}

#[actix_web::test]
async fn a_user_who_never_enrolled_cannot_submit() {
    let fixture = committed_fixture(false).await;
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, vec![]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "not_enrolled");
}

#[actix_web::test]
async fn submitting_to_an_unknown_exercise_is_not_found() {
    let fixture = committed_fixture(true).await;
    let app = client_api_app!();
    let request = submit_request(
        Uuid::new_v4(),
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, vec![]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[actix_web::test]
async fn submitting_the_same_upload_twice_is_reported() {
    let fixture = committed_fixture(true).await;
    let ids = upload_two(&fixture).await;
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, vec![ids[0], ids[0]]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "duplicate_upload");
}

#[actix_web::test]
async fn submitting_an_upload_that_was_never_recorded_is_reported() {
    let fixture = committed_fixture(true).await;
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, vec![Uuid::new_v4()]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "unknown_upload");
}

/// Another user's upload must read as unknown rather than as a permission error: the binding is
/// keyed by user, so from this user's side the id simply does not exist.
#[actix_web::test]
async fn submitting_another_users_upload_is_reported_as_unknown() {
    let owner = committed_fixture(true).await;
    let ids = upload_two(&owner).await;
    let other = committed_fixture(true).await;
    let app = client_api_app!();
    let request = submit_request(
        other.exercise,
        &other.token,
        &file_submission(other.slide, other.task, vec![ids[0]]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "unknown_upload");
}

/// A reaped upload is reported distinctly from an unrecognised one, because only this one is
/// recoverable by uploading again.
#[actix_web::test]
async fn submitting_a_reaped_upload_reports_it_as_expired() {
    let fixture = committed_fixture(true).await;
    let ids = upload_two(&fixture).await;

    let mut conn = Conn::init().await;
    let mut tx = conn.begin().await;
    models::exercise_answer_uploads::delete_by_file_upload_id(tx.as_mut(), ids[0])
        .await
        .expect("retire");
    tx.commit().await;

    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, vec![ids[0]]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "upload_expired");
}

/// The slide and task come from the request body while the URL authorizes the exercise, so a
/// body naming another exercise's slide must be refused.
#[actix_web::test]
async fn submitting_another_exercises_slide_is_refused() {
    let fixture = committed_fixture(true).await;
    let other = committed_fixture(true).await;
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(other.slide, other.task, vec![]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "validation_error");
}

/// The exercise service behind the fixture task does not declare `supports_native_client`, so
/// the task is not client-servable and submit must refuse it at the edge rather than let
/// grading fail deep inside a service that will never understand the answer.
#[actix_web::test]
async fn submitting_to_a_task_no_service_can_serve_is_refused() {
    let fixture = committed_fixture(true).await;
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.unservable_task, vec![]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "validation_error");
}

fn stub_grading() -> ExerciseTaskGradingResult {
    ExerciseTaskGradingResult {
        grading_progress: GradingProgress::FullyGraded,
        score_given: 1.0,
        score_maximum: 1,
        feedback_text: Some("graded by the stub".to_string()),
        feedback_json: None,
        set_user_variables: None,
    }
}

/// How the stub answers a grading request.
enum StubGrading {
    Graded(ExerciseTaskGradingResult),
    Unavailable,
}

struct StubState {
    grade_requests: Mutex<Vec<serde_json::Value>>,
    /// Paths a submit asked the stub for that it is not supposed to need. Asserted empty, so a
    /// hop added to the submit path cannot pass unnoticed — notably a live service-info fetch,
    /// which the committed `exercise_service_info` row is there to make unnecessary.
    unexpected: Mutex<Vec<String>>,
    grading: StubGrading,
}

impl StubState {
    fn new(grading: StubGrading) -> Self {
        Self {
            grade_requests: Mutex::new(Vec::new()),
            unexpected: Mutex::new(Vec::new()),
            grading,
        }
    }

    fn calls(&self, requests: &Mutex<Vec<serde_json::Value>>) -> Vec<serde_json::Value> {
        requests.lock().expect("stub lock").clone()
    }

    /// Asserts grading was the only thing a submit asked the exercise service for.
    fn assert_hops(&self, grade_calls: usize) {
        assert!(
            self.unexpected.lock().expect("stub lock").is_empty(),
            "submit called endpoints beyond grade: {:?}",
            self.unexpected.lock().expect("stub lock")
        );
        assert_eq!(self.calls(&self.grade_requests).len(), grade_calls);
    }
}

async fn stub_grade(
    state: web::Data<StubState>,
    body: web::Json<serde_json::Value>,
) -> actix_web::HttpResponse {
    state
        .grade_requests
        .lock()
        .expect("stub lock")
        .push(body.into_inner());
    match &state.grading {
        StubGrading::Graded(result) => actix_web::HttpResponse::Ok().json(result),
        StubGrading::Unavailable => {
            actix_web::HttpResponse::InternalServerError().body("the grader is down")
        }
    }
}

async fn stub_unexpected(
    request: actix_web::HttpRequest,
    state: web::Data<StubState>,
) -> actix_web::HttpResponse {
    state.unexpected.lock().expect("stub lock").push(format!(
        "{} {}",
        request.method(),
        request.path()
    ));
    actix_web::HttpResponse::NotFound().finish()
}

/// Serves the grading endpoint a submit drives, on a real socket, and returns its base URL for
/// the exercise service's `internal_url`. Anything else a submit asks for lands in
/// `unexpected`.
fn start_exercise_service_stub(state: Arc<StubState>) -> String {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().expect("local addr").port();
    let server = actix_web::HttpServer::new(move || {
        App::new()
            .app_data(web::Data::from(state.clone()))
            .route("/grade", web::post().to(stub_grade))
            .default_service(web::to(stub_unexpected))
    })
    .workers(1)
    .disable_signals()
    .listen(listener)
    .expect("listen")
    .run();
    actix_web::rt::spawn(server);
    format!("http://127.0.0.1:{port}")
}

/// The `user_exercise_states` row `process_submission` requires, with the slide the student is
/// answering selected. Both are written when the student opens the exercise, which a native
/// client does before it can submit.
async fn open_exercise(fixture: &Fixture) {
    let mut conn = Conn::init().await;
    let mut tx = conn.begin().await;
    models::user_exercise_states::upsert_selected_exercise_slide_id(
        tx.as_mut(),
        fixture.user,
        fixture.exercise,
        Some(fixture.course),
        None,
        Some(fixture.slide),
    )
    .await
    .expect("exercise state");
    tx.commit().await;
}

/// A fixture whose exercise service is the stub, with the state a submit needs, plus two
/// uploads.
async fn fixture_with_stub(state: Arc<StubState>) -> (Fixture, Vec<Uuid>) {
    let url = start_exercise_service_stub(state);
    let fixture = committed_fixture_with_service(true, Some(url)).await;
    open_exercise(&fixture).await;
    let ids = upload_two(&fixture).await;
    (fixture, ids)
}

/// The names of the files a grading request carries, in the order the service sees them.
fn graded_names(request: &serde_json::Value) -> Vec<String> {
    request["submission_files"]
        .as_array()
        .expect("submission_files")
        .iter()
        .map(|file| file["name"].as_str().expect("name").to_string())
        .collect()
}

async fn slide_submission_count(exercise: Uuid, user: Uuid) -> u32 {
    let mut conn = Conn::init().await;
    let mut tx = conn.begin().await;
    let count = models::exercise_slide_submissions::exercise_slide_submission_count_with_exercise_and_user_ids(tx.as_mut(), exercise, user)
            .await
            .expect("count");
    tx.rollback().await;
    count
}

async fn rejected_submission_count(slide: Uuid, user: Uuid) -> u32 {
    let mut conn = Conn::init().await;
    let mut tx = conn.begin().await;
    let count = models::rejected_exercise_slide_submissions::count_with_slide_and_user_ids(
        tx.as_mut(),
        slide,
        user,
    )
    .await
    .expect("count");
    tx.rollback().await;
    count
}

/// The happy path, end to end: the files the client named are the answer, they are graded
/// through the service in the order the client named them rather than the order it uploaded in,
/// and no answer of the host's own invention is persisted alongside them.
#[actix_web::test]
async fn submitting_records_the_named_uploads_as_the_answer() {
    let state = Arc::new(StubState::new(StubGrading::Graded(stub_grading())));
    let (fixture, ids) = fixture_with_stub(state.clone()).await;
    let named = vec![ids[1], ids[0]];

    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, named.clone()),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let body: api::ExerciseTaskSubmissionResult = test::read_body_json(response).await;

    state.assert_hops(1);
    let grade_request = state.calls(&state.grade_requests).remove(0);
    assert_eq!(graded_names(&grade_request), vec!["b.txt", "a.tar.zst"]);

    let mut conn = Conn::init().await;
    let mut tx = conn.begin().await;
    let submission = models::exercise_task_submissions::get_by_id(
        tx.as_mut(),
        body.task_submission_id,
        &crate::test_helper::init_file_store(),
        &crate::test_helper::init_app_conf().expect("app conf"),
    )
    .await
    .expect("task submission");
    assert_eq!(
        submission.answer_kind,
        AnswerKind::File,
        "a client submission must be recorded as a file answer"
    );
    let files = submission.data_files.expect("a file answer names files");
    assert_eq!(
        files.iter().map(|file| file.id).collect::<Vec<_>>(),
        named,
        "the client's order is the answer, not ours to sort"
    );
    assert_eq!(
        submission.data_json, None,
        "a client names files only, so there is no metadata for the host to invent"
    );
    assert_eq!(
        submission.exercise_slide_submission_id,
        body.slide_submission_id
    );

    let grading = models::exercise_task_gradings::get_by_id(
        tx.as_mut(),
        submission
            .exercise_task_grading_id
            .expect("submission was graded"),
    )
    .await
    .expect("grading");
    assert_eq!(grading.grading_progress, GradingProgress::FullyGraded);
    assert_eq!(grading.unscaled_score_given, Some(1.0));
    assert_eq!(grading.feedback_text.as_deref(), Some("graded by the stub"));

    let files = models::exercise_task_submission_files::get_by_task_submission_ids(
        tx.as_mut(),
        &[body.task_submission_id],
    )
    .await
    .expect("submission files");
    let recorded: Vec<(Uuid, &str, i32)> = files
        .iter()
        .map(|file| (file.file_upload_id, file.name.as_str(), file.order_number))
        .collect();
    assert_eq!(
        recorded,
        vec![(named[0], "b.txt", 0), (named[1], "a.tar.zst", 1)]
    );
    tx.rollback().await;
}

/// A submit naming no files is refused: the named files are the answer, so an empty list is a
/// claim with no content rather than an answer that happens to need no files.
#[actix_web::test]
async fn submitting_no_files_is_refused() {
    let state = Arc::new(StubState::new(StubGrading::Graded(stub_grading())));
    let (fixture, _ids) = fixture_with_stub(state.clone()).await;

    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, vec![]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    state.assert_hops(0);
    assert_eq!(
        slide_submission_count(fixture.exercise, fixture.user).await,
        0
    );
}

/// A grading hop that fails must still leave the rejected-submission audit row behind, which is
/// what submit's commit-then-return-the-error branch exists for. No accepted submission may
/// survive it. A client's answer carries no metadata, so this is also what keeps the rejected
/// copy of a file answer storable at all.
#[actix_web::test]
async fn a_failed_grading_keeps_only_the_rejected_submission() {
    let state = Arc::new(StubState::new(StubGrading::Unavailable));
    let (fixture, ids) = fixture_with_stub(state.clone()).await;

    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, vec![ids[0]]),
    )
    .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

    state.assert_hops(1);
    assert_eq!(
        slide_submission_count(fixture.exercise, fixture.user).await,
        0
    );
    assert_eq!(
        rejected_submission_count(fixture.slide, fixture.user).await,
        1
    );
}

/// The two files a student's work consists of, used for both origins so that the download
/// responses can be compared for equality rather than merely for similarity.
const STUDENT_FILES: [(&str, &str); 2] = [("a.tar.zst", "first"), ("b.txt", "second")];

/// Stores `STUDENT_FILES` the way the course-material upload route does — objects in the file
/// store, `file_uploads` rows, and an IFrame-origin binding to this exercise and user — and
/// returns their ids in order.
async fn upload_from_the_iframe(fixture: &Fixture, store: &dyn FileStore) -> Vec<Uuid> {
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    let mut ids = Vec::new();
    for (name, contents) in STUDENT_FILES {
        let path = format!("exercise-answer-uploads/{}", Uuid::new_v4());
        store
            .upload(
                std::path::Path::new(&path),
                contents.as_bytes().to_vec(),
                "application/octet-stream",
            )
            .await
            .expect("stored object");
        ids.push(
            models::file_uploads::insert(
                &mut conn,
                name,
                &path,
                "application/octet-stream",
                Some(fixture.user),
                Some(contents.len() as i64),
            )
            .await
            .expect("file upload"),
        );
    }
    models::exercise_answer_uploads::insert_many(
        &mut conn,
        fixture.exercise,
        fixture.user,
        &ids,
        models::exercise_answer_uploads::AnswerUploadOrigin::Iframe,
    )
    .await
    .expect("binding");
    ids
}

/// Submits the way the course-material IFrame does — through the same function that route's
/// handler calls — and returns the slide submission's id.
async fn submit_from_the_iframe(
    fixture: &Fixture,
    answer: StudentExerciseTaskSubmission,
    store: &dyn FileStore,
) -> Uuid {
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    let exercise = models::exercises::get_by_id(&mut conn, fixture.exercise)
        .await
        .expect("exercise");
    let result = domain::exercises::process_submission(
        &mut conn,
        fixture.user,
        exercise,
        &StudentExerciseSlideSubmission {
            exercise_slide_id: fixture.slide,
            exercise_task_submissions: vec![answer],
        },
        std::sync::Arc::new(JwtKey::test_key()),
        store,
        &crate::test_helper::init_app_conf().expect("app conf"),
    )
    .await
    .expect("iframe submission");
    result
        .exercise_task_submission_results
        .into_iter()
        .next()
        .expect("one task submission")
        .submission
        .exercise_slide_submission_id
}

async fn download(
    app: &impl actix_web::dev::Service<
        actix_http::Request,
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
    >,
    token: &str,
    submission: Uuid,
) -> serde_json::Value {
    let request = test::TestRequest::get()
        .uri(&format!("/submissions/{submission}/download"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let response = test::call_service(app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    test::read_body_json(response).await
}

/// Replaces the members that name *which stored object* a file is — necessarily a different
/// row and a different object for two different submissions — with placeholders, leaving
/// everything a client can otherwise observe: the response's field set, each file's field set,
/// the names, and their order. Two canonicalised bodies compare equal only if the client cannot
/// tell the two submissions' downloads apart. The bytes behind the URLs are asserted separately.
fn canonicalize_download(body: &serde_json::Value) -> serde_json::Value {
    let files = body["data_files"].as_array().expect("data_files");
    serde_json::json!({
        "data_files": files
            .iter()
            .map(|file| {
                let object = file.as_object().expect("file object");
                let mut canonical = object.clone();
                canonical.insert("id".to_string(), serde_json::json!("<uuid>"));
                let url = object["url"].as_str().expect("url");
                let (served_from, _) = url.split_once("/claimed/").expect("a claimed url");
                canonical.insert(
                    "url".to_string(),
                    serde_json::json!(format!("{served_from}/claimed/<object>")),
                );
                serde_json::Value::Object(canonical)
            })
            .collect::<Vec<_>>(),
    })
}

/// What a client actually gets when it follows every file's `url`, in order.
///
/// The url names the file by id and carries a claim for it, so the object is located the way
/// the claimed-file route locates it rather than by reading a path out of the url.
async fn served_files(store: &dyn FileStore, body: &serde_json::Value) -> Vec<(String, String)> {
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    let mut served = Vec::new();
    for file in body["data_files"].as_array().expect("data_files") {
        let id: Uuid = file["id"].as_str().expect("id").parse().expect("a uuid");
        let stored = models::file_uploads::get_many(&mut conn, &[id])
            .await
            .expect("file upload")
            .pop()
            .expect("a stored file");
        let bytes = store
            .download(std::path::Path::new(&stored.path))
            .await
            .expect("stored object");
        served.push((
            file["name"].as_str().expect("name").to_string(),
            String::from_utf8(bytes).expect("utf-8 contents"),
        ));
    }
    served
}

/// The requirement itself: the same work, submitted once from a native client and once from the
/// exercise service's IFrame, downloads identically. Not "both are non-empty" — byte-equal
/// after only the per-file stored-object identity is canonicalised away.
#[actix_web::test]
async fn an_iframe_submission_downloads_exactly_like_a_native_client_one() {
    let state = Arc::new(StubState::new(StubGrading::Graded(stub_grading())));
    let url = start_exercise_service_stub(state.clone());
    let fixture = committed_fixture_with_service(true, Some(url)).await;
    open_exercise(&fixture).await;

    let store: Arc<dyn FileStore> = Arc::new(crate::test_helper::TempFileStore(
        tempfile::tempdir().expect("temp dir"),
    ));
    let app = client_api_app!(store.clone());
    let upload = upload_request(
        fixture.exercise,
        &fixture.token,
        &[
            (Uuid::new_v4(), STUDENT_FILES[0].0, STUDENT_FILES[0].1),
            (Uuid::new_v4(), STUDENT_FILES[1].0, STUDENT_FILES[1].1),
        ],
    )
    .to_request();
    let response = test::call_service(&app, upload).await;
    assert_eq!(response.status(), StatusCode::OK);
    let uploaded: api::UploadedFiles = test::read_body_json(response).await;
    let named: Vec<Uuid> = uploaded.data_files.iter().map(|file| file.id).collect();

    let submit = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, named),
    )
    .to_request();
    let response = test::call_service(&app, submit).await;
    assert_eq!(response.status(), StatusCode::OK);
    let native: api::ExerciseTaskSubmissionResult = test::read_body_json(response).await;

    let from_iframe_ids = upload_from_the_iframe(&fixture, store.as_ref()).await;
    let from_iframe = submit_from_the_iframe(
        &fixture,
        StudentExerciseTaskSubmission::files(
            fixture.task,
            from_iframe_ids,
            Some(serde_json::json!({ "plugin": "said so" })),
        ),
        store.as_ref(),
    )
    .await;

    let native_body = download(&app, &fixture.token, native.slide_submission_id).await;
    let iframe_body = download(&app, &fixture.token, from_iframe).await;

    assert_eq!(
        serde_json::to_vec(&canonicalize_download(&iframe_body)).expect("json"),
        serde_json::to_vec(&canonicalize_download(&native_body)).expect("json"),
        "iframe {iframe_body} differs in shape from native client {native_body}"
    );
    // Following the URLs must yield the same work, not merely the same field names.
    let expected: Vec<(String, String)> = STUDENT_FILES
        .iter()
        .map(|(name, contents)| (name.to_string(), contents.to_string()))
        .collect();
    assert_eq!(served_files(store.as_ref(), &iframe_body).await, expected);
    assert_eq!(served_files(store.as_ref(), &native_body).await, expected);
}

/// A JSON-typed answer names no files, so its download is empty rather than an error.
#[actix_web::test]
async fn a_json_typed_submission_downloads_empty() {
    let state = Arc::new(StubState::new(StubGrading::Graded(stub_grading())));
    let url = start_exercise_service_stub(state.clone());
    let fixture = committed_fixture_with_service(true, Some(url)).await;
    open_exercise(&fixture).await;

    let from_iframe = submit_from_the_iframe(
        &fixture,
        StudentExerciseTaskSubmission::json(
            fixture.task,
            serde_json::json!({ "opaque": "plugin owned" }),
        ),
        &temp_file_store(),
    )
    .await;

    let app = client_api_app!();
    let body = download(&app, &fixture.token, from_iframe).await;
    assert_eq!(body, serde_json::json!({ "data_files": [] }));
}

/// A committed exercise whose only task is client-servable, so reading it reaches no exercise
/// service. Returned with its page URL under the test `base_url`, and its chapter.
async fn servable_exercise_fixture() -> (Fixture, String, DatabaseChapter) {
    insert_data!(:tx, user: user, org: org, course: course, instance: instance, :course_module, chapter: chapter, page: page, exercise: exercise, slide: slide);
    let task = insert_client_capable_task(tx.as_mut(), slide, None).await;
    models::course_instance_enrollments::insert_enrollment_and_set_as_current(
        tx.as_mut(),
        models::course_instance_enrollments::NewCourseInstanceEnrollment {
            course_id: course,
            user_id: user,
            course_instance_id: instance.id,
        },
    )
    .await
    .expect("enrollment");
    let token = issue_token(tx.as_mut(), user).await;
    let organization = models::organizations::get_organization(tx.as_mut(), org)
        .await
        .expect("organization");
    let course_slug = models::courses::get_course(tx.as_mut(), course)
        .await
        .expect("course")
        .slug;
    let url_path = models::pages::get_page(tx.as_mut(), page)
        .await
        .expect("page")
        .url_path;
    let chapter = models::chapters::get_chapter(tx.as_mut(), chapter)
        .await
        .expect("chapter");
    tx.commit().await;
    let fixture = Fixture {
        user,
        course,
        exercise,
        slide,
        task,
        unservable_task: task,
        token,
    };
    open_exercise(&fixture).await;
    let page_url = format!(
        "http://project-331.local/org/{}/courses/{course_slug}{url_path}",
        organization.slug
    );
    (fixture, page_url, chapter)
}

#[actix_web::test]
async fn an_exercise_names_its_page_and_chapter() {
    let (fixture, expected, chapter) = servable_exercise_fixture().await;
    let app = client_api_app!();

    let request = test::TestRequest::get()
        .uri(&format!("/exercises/{}", fixture.exercise))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let slide: api::ExerciseSlide = test::read_body_json(response).await;
    assert_eq!(slide.page_url.as_deref(), Some(expected.as_str()));
    assert_eq!(slide.chapter.as_ref().map(|c| c.id), Some(chapter.id));

    let request = test::TestRequest::get()
        .uri(&format!("/courses/{}/exercises", fixture.course))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let slides: Vec<api::ExerciseSlide> = test::read_body_json(response).await;
    let listed = slides
        .iter()
        .find(|slide| slide.exercise_id == fixture.exercise)
        .expect("the fixture exercise is listed");
    assert_eq!(listed.page_url.as_deref(), Some(expected.as_str()));
    let listed_chapter = listed
        .chapter
        .as_ref()
        .expect("the exercise is in a chapter");
    assert_eq!(listed_chapter.id, chapter.id);
    assert_eq!(listed_chapter.name, chapter.name);
    assert_eq!(listed_chapter.chapter_number, chapter.chapter_number);
}

#[actix_web::test]
async fn both_course_endpoints_serve_the_courses_ai_policy() {
    let fixture = committed_fixture(true).await;
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    let course = models::courses::get_course(&mut conn, fixture.course)
        .await
        .expect("course");
    models::courses::update_course(
        &mut conn,
        &upload_tests::app_conf(),
        fixture.course,
        models::courses::CourseUpdate {
            ai_policy: models::courses::CourseAiPolicy::FullUse,
            ..models::courses::CourseUpdate::from(&course)
        },
        fixture.user,
        false,
    )
    .await
    .expect("set ai_policy");
    let app = client_api_app!();

    let request = test::TestRequest::get()
        .uri(&format!("/courses/{}", fixture.course))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let course: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(course["ai_policy"], "full_use");

    let request = test::TestRequest::get()
        .uri("/courses")
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let courses: Vec<api::Course> = test::read_body_json(response).await;
    let listed = courses
        .iter()
        .find(|course| course.id == fixture.course)
        .expect("the fixture course is listed");
    assert_eq!(listed.ai_policy, api::CourseAiPolicy::FullUse);
}

#[actix_web::test]
async fn me_names_the_tokens_user() {
    let fixture = committed_fixture(true).await;
    let app = client_api_app!();
    let me: api::CurrentUser = get_json(&app, &fixture.token, "/me".to_string()).await;
    assert_eq!(me.id, fixture.user);
}

async fn get_json<T: serde::de::DeserializeOwned>(
    app: &impl actix_web::dev::Service<
        actix_http::Request,
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
    >,
    token: &str,
    uri: String,
) -> T {
    let request = test::TestRequest::get()
        .uri(&uri)
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let response = test::call_service(app, request).await;
    let status = response.status();
    let body = test::read_body(response).await;
    assert_eq!(
        status,
        StatusCode::OK,
        "GET {uri}: {}",
        String::from_utf8_lossy(&body)
    );
    serde_json::from_slice(&body).expect("JSON body")
}

/// The deadline the single and list views serve for the fixture exercise, in whole seconds.
async fn served_deadlines(
    app: &impl actix_web::dev::Service<
        actix_http::Request,
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
    >,
    fixture: &Fixture,
) -> (Option<i64>, Option<i64>) {
    let single: api::ExerciseSlide = get_json(
        app,
        &fixture.token,
        format!("/exercises/{}", fixture.exercise),
    )
    .await;
    let listed: Vec<api::ExerciseSlide> = get_json(
        app,
        &fixture.token,
        format!("/courses/{}/exercises", fixture.course),
    )
    .await;
    let listed = listed
        .into_iter()
        .find(|slide| slide.exercise_id == fixture.exercise)
        .expect("the fixture exercise is listed");
    (
        single.deadline.map(|d| d.timestamp()),
        listed.deadline.map(|d| d.timestamp()),
    )
}

/// The submit gate applies the chapter's deadline when the exercise has none, so the client
/// must be told it.
#[actix_web::test]
async fn both_exercise_views_serve_the_chapter_deadline_unless_the_exercise_has_its_own() {
    let (fixture, _, chapter) = servable_exercise_fixture().await;
    let chapter_deadline = Utc::now() + ChronoDuration::days(2);
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    models::chapters::update_chapter(
        &mut conn,
        chapter.id,
        models::chapters::ChapterUpdate {
            name: chapter.name.clone(),
            color: chapter.color.clone(),
            front_page_id: chapter.front_page_id,
            deadline: Some(chapter_deadline),
            opens_at: chapter.opens_at,
            course_module_id: Some(chapter.course_module_id),
        },
        fixture.user,
    )
    .await
    .expect("chapter deadline");
    let app = client_api_app!();

    let expected = Some(chapter_deadline.timestamp());
    assert_eq!(served_deadlines(&app, &fixture).await, (expected, expected));

    let exercise_deadline = Utc::now() + ChronoDuration::days(3);
    models::exercises::set_deadline(&mut conn, fixture.exercise, Some(exercise_deadline))
        .await
        .expect("exercise deadline");
    let expected = Some(exercise_deadline.timestamp());
    assert_eq!(served_deadlines(&app, &fixture).await, (expected, expected));
}

/// A closed chapter's exercises leave the listing until it opens, but the progress names them
/// under the chapter, so a client never takes them for removed ones.
#[actix_web::test]
async fn exercises_of_a_closed_chapter_are_reported_closed_not_removed() {
    let (fixture, _, chapter) = servable_exercise_fixture().await;
    let opens_at = Utc::now() + ChronoDuration::days(2);
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    models::chapters::set_opens_at(&mut conn, chapter.id, opens_at)
        .await
        .expect("opens_at");
    let app = client_api_app!();

    let listed: Vec<api::ExerciseSlide> = get_json(
        &app,
        &fixture.token,
        format!("/courses/{}/exercises", fixture.course),
    )
    .await;
    assert!(listed.iter().all(|s| s.exercise_id != fixture.exercise));

    let progress: api::CourseProgress = get_json(
        &app,
        &fixture.token,
        format!("/courses/{}/progress", fixture.course),
    )
    .await;
    assert!(
        progress
            .exercises
            .iter()
            .all(|p| p.exercise_id != fixture.exercise)
    );
    let closed = progress
        .closed_chapters
        .iter()
        .find(|c| c.id == chapter.id)
        .expect("the closed chapter is reported");
    assert_eq!(closed.opens_at.timestamp(), opens_at.timestamp());
    assert_eq!(closed.name, chapter.name);
    assert!(
        closed
            .exercises
            .iter()
            .any(|p| p.exercise_id == fixture.exercise)
    );

    let request = test::TestRequest::get()
        .uri(&format!("/exercises/{}", fixture.exercise))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "chapter_not_open_yet");
}

/// A quiz exercise in the given chapter: its only task belongs to a service that cannot serve
/// this client.
async fn insert_quiz_exercise(
    conn: &mut PgConnection,
    course: Uuid,
    page: Uuid,
    chapter: Uuid,
) -> Uuid {
    let exercise = models::exercises::insert(
        conn,
        models::PKeyPolicy::Generate,
        course,
        "quiz",
        page,
        chapter,
        1,
    )
    .await
    .expect("exercise");
    let slide = models::exercise_slides::insert(conn, models::PKeyPolicy::Generate, exercise, 0)
        .await
        .expect("slide");
    models::exercise_tasks::insert(
        conn,
        models::PKeyPolicy::Generate,
        models::exercise_tasks::NewExerciseTask {
            exercise_slide_id: slide,
            exercise_type: "quizzes".to_string(),
            assignment: vec![],
            public_spec: Some(serde_json::Value::Null),
            private_spec: Some(serde_json::Value::Null),
            model_solution_spec: Some(serde_json::Value::Null),
            order_number: 0,
        },
    )
    .await
    .expect("exercise task");
    exercise
}

/// A chapter after `previous` in the same course module, with its front page.
async fn insert_next_chapter(
    conn: &mut PgConnection,
    fixture: &Fixture,
    previous: &DatabaseChapter,
    name: &str,
) -> (DatabaseChapter, models::pages::Page) {
    models::library::content_management::create_new_chapter(
        conn,
        models::PKeyPolicy::Generate,
        &models::chapters::NewChapter {
            name: name.to_string(),
            color: None,
            course_id: fixture.course,
            chapter_number: previous.chapter_number + 1,
            front_page_id: None,
            deadline: None,
            opens_at: None,
            course_module_id: Some(previous.course_module_id),
        },
        fixture.user,
        |_, _, _, _| unimplemented!(),
        |_| unimplemented!(),
    )
    .await
    .expect("chapter")
}

/// The progress names only the exercises the listing serves, now or once their chapter opens,
/// so the client's points total does not count quizzes or shrink when a chapter opens.
#[actix_web::test]
async fn progress_reports_only_client_capable_exercises() {
    let (fixture, _, chapter) = servable_exercise_fixture().await;
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    let page = chapter.front_page_id.expect("chapter front page");
    let closed_quiz = insert_quiz_exercise(&mut conn, fixture.course, page, chapter.id).await;
    let (quiz_only_chapter, quiz_only_page) =
        insert_next_chapter(&mut conn, &fixture, &chapter, "quizzes only").await;
    insert_quiz_exercise(
        &mut conn,
        fixture.course,
        quiz_only_page.id,
        quiz_only_chapter.id,
    )
    .await;
    let (open_chapter, open_page) =
        insert_next_chapter(&mut conn, &fixture, &quiz_only_chapter, "open").await;
    let open_quiz =
        insert_quiz_exercise(&mut conn, fixture.course, open_page.id, open_chapter.id).await;
    let opens_at = Utc::now() + ChronoDuration::days(2);
    for closed in [chapter.id, quiz_only_chapter.id] {
        models::chapters::set_opens_at(&mut conn, closed, opens_at)
            .await
            .expect("opens_at");
    }
    let app = client_api_app!();

    let progress: api::CourseProgress = get_json(
        &app,
        &fixture.token,
        format!("/courses/{}/progress", fixture.course),
    )
    .await;
    assert!(
        progress
            .exercises
            .iter()
            .all(|p| p.exercise_id != open_quiz),
        "open quiz {open_quiz} must not be reported"
    );
    let reported: Vec<(Uuid, Vec<Uuid>)> = progress
        .closed_chapters
        .iter()
        .map(|c| (c.id, c.exercises.iter().map(|p| p.exercise_id).collect()))
        .collect();
    assert_eq!(
        reported,
        vec![(chapter.id, vec![fixture.exercise])],
        "closed quiz {closed_quiz} must not be reported"
    );
}

/// A chapter the student has locked is marked in the listing, and refusing an answer to it
/// is told apart from a token that lacks the scope.
#[actix_web::test]
async fn a_locked_chapter_is_marked_and_refuses_answers_with_its_own_key() {
    let (fixture, _, chapter) = servable_exercise_fixture().await;
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    let course = models::courses::get_course(&mut conn, fixture.course)
        .await
        .expect("course");
    models::courses::update_course(
        &mut conn,
        &upload_tests::app_conf(),
        fixture.course,
        models::courses::CourseUpdate {
            chapter_locking_enabled: true,
            ..models::courses::CourseUpdate::from(&course)
        },
        fixture.user,
        true,
    )
    .await
    .expect("chapter locking");
    models::user_chapter_locking_statuses::set_chapter_status(
        &mut conn,
        fixture.user,
        chapter.id,
        fixture.course,
        models::user_chapter_locking_statuses::ChapterLockingStatus::CompletedAndLocked,
    )
    .await
    .expect("chapter status");
    let app = client_api_app!();

    let single: api::ExerciseSlide = get_json(
        &app,
        &fixture.token,
        format!("/exercises/{}", fixture.exercise),
    )
    .await;
    let locked = Some(api::ChapterLockingStatus::CompletedAndLocked);
    assert_eq!(single.chapter.and_then(|c| c.locking_status), locked);
    let listed: Vec<api::ExerciseSlide> = get_json(
        &app,
        &fixture.token,
        format!("/courses/{}/exercises", fixture.course),
    )
    .await;
    let listed = listed
        .into_iter()
        .find(|slide| slide.exercise_id == fixture.exercise)
        .expect("the fixture exercise is listed");
    assert_eq!(listed.chapter.and_then(|c| c.locking_status), locked);

    let request = upload_request(
        fixture.exercise,
        &fixture.token,
        &[(Uuid::new_v4(), "a.tar.zst", "first")],
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "chapter_completed_and_locked");
}

#[actix_web::test]
async fn chapter_info_has_no_locking_status_when_the_course_does_not_lock_chapters() {
    let (fixture, _, _) = servable_exercise_fixture().await;
    let app = client_api_app!();
    let single: api::ExerciseSlide = get_json(
        &app,
        &fixture.token,
        format!("/exercises/{}", fixture.exercise),
    )
    .await;
    assert_eq!(single.chapter.and_then(|c| c.locking_status), None);
}

/// Removing the enrollment keeps the course settings, which the shared submit path checks; the
/// client API must refuse graded answers on its own, while the student keeps their own work.
#[actix_web::test]
async fn a_user_whose_enrollment_was_removed_cannot_submit_but_keeps_their_work() {
    let state = Arc::new(StubState::new(StubGrading::Graded(stub_grading())));
    let (fixture, ids) = fixture_with_stub(state).await;
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, ids.clone()),
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let submitted: api::ExerciseTaskSubmissionResult = test::read_body_json(response).await;

    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    models::course_instance_enrollments::delete_for_user_and_course(
        &mut conn,
        fixture.user,
        fixture.course,
    )
    .await
    .expect("enrollment removal");

    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, ids),
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "not_enrolled");

    let request = upload_request(
        fixture.exercise,
        &fixture.token,
        &[(Uuid::new_v4(), "a.tar.zst", "first")],
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "not_enrolled");

    let request = upload_request(
        fixture.exercise,
        &fixture.token,
        &[(Uuid::new_v4(), "a.tar.zst", "backup")],
    )
    .uri(&format!(
        "/exercises/{}/files?for=snapshot",
        fixture.exercise
    ))
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);

    download(&app, &fixture.token, submitted.slide_submission_id).await;
}

/// Grading carries the exercise's own standing, so a client never has to infer it from the
/// score.
#[actix_web::test]
async fn grading_reports_the_exercises_progress() {
    let state = Arc::new(StubState::new(StubGrading::Graded(stub_grading())));
    let (fixture, ids) = fixture_with_stub(state).await;
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, ids),
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let submitted: api::ExerciseTaskSubmissionResult = test::read_body_json(response).await;

    let request = test::TestRequest::get()
        .uri(&format!(
            "/submissions/{}/grading",
            submitted.task_submission_id
        ))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let status: api::ExerciseTaskSubmissionStatus = test::read_body_json(response).await;
    let api::ExerciseTaskSubmissionStatus::Grading {
        exercise_progress: Some(progress),
        ..
    } = status
    else {
        panic!("expected a grading with exercise progress, got {status:?}");
    };
    assert_eq!(progress.exercise_id, fixture.exercise);
    assert!(progress.completed);
    assert!(progress.attempted);
    assert_eq!(progress.score_given, 1.0);
    assert_eq!(progress.standing, Some(api::ExerciseStanding::Passed));
    assert_eq!((progress.max_tries, progress.tries_left), (None, None));
}

/// A graded submission below full points that uses the last try is final, and both the grading
/// and the course progress say so.
#[actix_web::test]
async fn the_last_try_below_full_points_is_out_of_tries() {
    let mut zero_points = stub_grading();
    zero_points.score_given = 0.0;
    let state = Arc::new(StubState::new(StubGrading::Graded(zero_points)));
    let (fixture, ids) = fixture_with_stub(state).await;
    {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        models::exercises::set_try_limit(tx.as_mut(), fixture.exercise, true, Some(1))
            .await
            .expect("try limit");
        tx.commit().await;
    }
    let app = client_api_app!();
    let progress_request = || {
        test::TestRequest::get()
            .uri(&format!("/courses/{}/progress", fixture.course))
            .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
            .to_request()
    };
    let response = test::call_service(&app, progress_request()).await;
    let before: api::CourseProgress = test::read_body_json(response).await;
    let before = before
        .exercises
        .iter()
        .find(|p| p.exercise_id == fixture.exercise)
        .expect("the fixture exercise has progress");
    assert_eq!(before.standing, Some(api::ExerciseStanding::NotAttempted));
    assert_eq!((before.max_tries, before.tries_left), (Some(1), Some(1)));

    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, ids),
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let submitted: api::ExerciseTaskSubmissionResult = test::read_body_json(response).await;

    let request = test::TestRequest::get()
        .uri(&format!(
            "/submissions/{}/grading",
            submitted.task_submission_id
        ))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .to_request();
    let response = test::call_service(&app, request).await;
    let status: api::ExerciseTaskSubmissionStatus = test::read_body_json(response).await;
    let api::ExerciseTaskSubmissionStatus::Grading {
        exercise_progress: Some(progress),
        ..
    } = status
    else {
        panic!("expected a grading with exercise progress, got {status:?}");
    };
    assert_eq!(progress.standing, Some(api::ExerciseStanding::OutOfTries));

    let response = test::call_service(&app, progress_request()).await;
    let after: api::CourseProgress = test::read_body_json(response).await;
    let after = after
        .exercises
        .iter()
        .find(|p| p.exercise_id == fixture.exercise)
        .expect("the fixture exercise has progress");
    assert_eq!(after.standing, Some(api::ExerciseStanding::OutOfTries));
    assert_eq!(after.score_given, 0.0);
    assert_eq!((after.max_tries, after.tries_left), (Some(1), Some(0)));
}

/// The last try is not final while its grading is pending: it may yet award full points.
#[actix_web::test]
async fn a_last_try_still_being_graded_is_attempted() {
    let mut pending = stub_grading();
    pending.grading_progress = GradingProgress::Pending;
    pending.score_given = 0.0;
    let state = Arc::new(StubState::new(StubGrading::Graded(pending)));
    let (fixture, ids) = fixture_with_stub(state).await;
    {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        models::exercises::set_try_limit(tx.as_mut(), fixture.exercise, true, Some(1))
            .await
            .expect("try limit");
        tx.commit().await;
    }
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, ids),
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let request = test::TestRequest::get()
        .uri(&format!("/courses/{}/progress", fixture.course))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .to_request();
    let response = test::call_service(&app, request).await;
    let progress: api::CourseProgress = test::read_body_json(response).await;
    let progress = progress
        .exercises
        .iter()
        .find(|p| p.exercise_id == fixture.exercise)
        .expect("the fixture exercise has progress");
    assert_eq!(progress.standing, Some(api::ExerciseStanding::Attempted));
}

/// A stub-graded fixture in a course that locks chapters, with the exercise's chapter unlocked
/// for the user. The exercise keeps the default of a teacher reviewing its answers once the
/// chapter is locked. Returns the chapter's id.
async fn chapter_locking_fixture() -> (Fixture, Uuid) {
    let fixture = stub_graded_fixture().await;
    let chapter = enable_chapter_locking(&fixture).await;
    (fixture, chapter)
}

/// A fixture whose exercise service stub grades every answer it is sent full points.
async fn stub_graded_fixture() -> Fixture {
    let state = Arc::new(StubState::new(StubGrading::Graded(stub_grading())));
    let url = start_exercise_service_stub(state);
    let fixture = committed_fixture_with_service(true, Some(url)).await;
    open_exercise(&fixture).await;
    fixture
}

/// Turns chapter locking on for the fixture's course and unlocks the exercise's chapter for the
/// user. Returns the chapter's id.
async fn enable_chapter_locking(fixture: &Fixture) -> Uuid {
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    let course = models::courses::get_course(&mut conn, fixture.course)
        .await
        .expect("course");
    models::courses::update_course(
        &mut conn,
        &upload_tests::app_conf(),
        fixture.course,
        models::courses::CourseUpdate {
            chapter_locking_enabled: true,
            ..models::courses::CourseUpdate::from(&course)
        },
        fixture.user,
        true,
    )
    .await
    .expect("chapter locking");
    let exercise = models::exercises::get_by_id(&mut conn, fixture.exercise)
        .await
        .expect("exercise");
    assert!(exercise.teacher_reviews_answer_after_locking);
    let chapter = exercise.chapter_id.expect("the exercise is in a chapter");
    models::user_chapter_locking_statuses::set_chapter_status(
        &mut conn,
        fixture.user,
        chapter,
        fixture.course,
        models::user_chapter_locking_statuses::ChapterLockingStatus::Unlocked,
    )
    .await
    .expect("chapter status");
    chapter
}

/// The fixture exercise's entry in the user's course progress.
async fn fixture_exercise_progress(
    app: &impl actix_web::dev::Service<
        actix_http::Request,
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
    >,
    fixture: &Fixture,
) -> api::ExerciseProgress {
    let progress: api::CourseProgress = get_json(
        app,
        &fixture.token,
        format!("/courses/{}/progress", fixture.course),
    )
    .await;
    progress
        .exercises
        .into_iter()
        .find(|p| p.exercise_id == fixture.exercise)
        .expect("the fixture exercise has progress")
}

/// The student completing and locking the chapter, as the course material's lock route does.
async fn lock_chapter_as_student(fixture: &Fixture, chapter: Uuid) {
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    models::chapters::move_chapter_exercises_to_manual_review(
        &mut conn,
        chapter,
        fixture.user,
        fixture.course,
    )
    .await
    .expect("manual review");
    models::user_chapter_locking_statuses::complete_and_lock_chapter(
        &mut conn,
        fixture.user,
        chapter,
        fixture.course,
    )
    .await
    .expect("chapter lock");
}

/// Under chapter locking a passing answer earns no points until the chapter is locked and a
/// teacher reviews it, as the course material shows; the grading and the progress say what the
/// points wait for instead of reading as a failed answer.
#[actix_web::test]
async fn points_held_for_teacher_review_report_what_they_wait_for() {
    let (fixture, chapter) = chapter_locking_fixture().await;
    let ids = upload_two(&fixture).await;
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, ids),
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let submitted: api::ExerciseTaskSubmissionResult = test::read_body_json(response).await;

    let status: api::ExerciseTaskSubmissionStatus = get_json(
        &app,
        &fixture.token,
        format!("/submissions/{}/grading", submitted.task_submission_id),
    )
    .await;
    let api::ExerciseTaskSubmissionStatus::Grading {
        score_given,
        exercise_progress: Some(progress),
        ..
    } = status
    else {
        panic!("expected a grading with exercise progress, got {status:?}");
    };
    assert!(score_given.is_some_and(|score| score > 0.0));
    assert_eq!(
        progress.pending_teacher_review,
        Some(api::PendingTeacherReview::AwaitsChapterLock)
    );
    assert_eq!(progress.score_given, 0.0);
    assert_eq!(progress.standing, Some(api::ExerciseStanding::Attempted));
    assert!(!progress.exercise_locked);

    lock_chapter_as_student(&fixture, chapter).await;
    let progress = fixture_exercise_progress(&app, &fixture).await;
    assert_eq!(
        progress.pending_teacher_review,
        Some(api::PendingTeacherReview::AwaitsTeacher)
    );
    assert_eq!(progress.score_given, 0.0);
    assert!(progress.exercise_locked);
}

/// Turning chapter locking on leaves points already awarded in place, so the progress reports
/// them rather than a review they no longer wait for.
#[actix_web::test]
async fn points_awarded_before_chapter_locking_await_no_review() {
    let fixture = stub_graded_fixture().await;
    let ids = upload_two(&fixture).await;
    let app = client_api_app!();
    let request = submit_request(
        fixture.exercise,
        &fixture.token,
        &file_submission(fixture.slide, fixture.task, ids),
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let scored = fixture_exercise_progress(&app, &fixture).await;
    assert!(scored.score_given > 0.0);

    let chapter = enable_chapter_locking(&fixture).await;
    let progress = fixture_exercise_progress(&app, &fixture).await;
    assert_eq!(progress.pending_teacher_review, None);
    assert_eq!(progress.score_given, scored.score_given);
    assert_eq!(progress.standing, scored.standing);
    assert!(!progress.exercise_locked);

    lock_chapter_as_student(&fixture, chapter).await;
    let progress = fixture_exercise_progress(&app, &fixture).await;
    assert_eq!(progress.pending_teacher_review, None);
    assert_eq!(progress.score_given, scored.score_given);
    assert_eq!(progress.standing, scored.standing);
    assert!(progress.exercise_locked);
}

/// The client takes a submission exactly when the course material does: not once the student
/// has locked the chapter, not after a teacher merely unlocks the chapter again, and again once
/// the teacher resets the exercise.
#[actix_web::test]
async fn a_locked_exercise_refuses_submissions_until_a_teacher_resets_it() {
    let (fixture, chapter) = chapter_locking_fixture().await;
    let first = upload_two(&fixture).await;
    // Uploaded while the exercise is open, so the refusals below come from the lock rather than
    // from the upload gate.
    let held_back = upload_two(&fixture).await;
    let app = client_api_app!();
    let submit = |ids: Vec<Uuid>| {
        submit_request(
            fixture.exercise,
            &fixture.token,
            &file_submission(fixture.slide, fixture.task, ids),
        )
        .to_request()
    };
    let response = test::call_service(&app, submit(first)).await;
    assert_eq!(response.status(), StatusCode::OK);

    lock_chapter_as_student(&fixture, chapter).await;
    let response = test::call_service(&app, submit(held_back.clone())).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "chapter_completed_and_locked");

    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    models::user_chapter_locking_statuses::unlock_chapter(
        &mut conn,
        fixture.user,
        chapter,
        fixture.course,
    )
    .await
    .expect("teacher unlock");
    let response = test::call_service(&app, submit(held_back)).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "exercise_locked");
    let request = upload_request(
        fixture.exercise,
        &fixture.token,
        &[(Uuid::new_v4(), "a.tar.zst", "first")],
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "exercise_locked");
    let progress = fixture_exercise_progress(&app, &fixture).await;
    assert!(progress.exercise_locked);

    models::exercises::reset_exercises_for_selected_users(
        &mut conn,
        &[(fixture.user, vec![fixture.exercise])],
        None,
        fixture.course,
        None,
    )
    .await
    .expect("reset");
    open_exercise(&fixture).await;
    let progress = fixture_exercise_progress(&app, &fixture).await;
    assert!(!progress.exercise_locked);
    let response = test::call_service(&app, submit(upload_two(&fixture).await)).await;
    assert_eq!(response.status(), StatusCode::OK);
}

fn snapshot_request(
    exercise: Uuid,
    token: &str,
    body: &api::NewAnswerSnapshot,
) -> test::TestRequest {
    test::TestRequest::post()
        .uri(&format!("/exercises/{exercise}/snapshots"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(body)
}

fn share_request(id: Uuid, token: &str) -> test::TestRequest {
    test::TestRequest::post()
        .uri(&format!("/submissions/{id}/share"))
        .insert_header(("Authorization", format!("Bearer {token}")))
}

async fn list_submissions(
    app: &impl actix_web::dev::Service<
        actix_http::Request,
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
    >,
    fixture: &Fixture,
) -> Vec<api::ExerciseSlideSubmissionListItem> {
    let request = test::TestRequest::get()
        .uri(&format!("/exercises/{}/submissions", fixture.exercise))
        .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
        .to_request();
    let response = test::call_service(app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    test::read_body_json(response).await
}

/// A snapshot is the student's own data and is never graded, so neither the deadline nor the
/// try limit stands in its way, and storing one must not use a try.
#[actix_web::test]
async fn a_paste_past_the_deadline_is_stored_listed_downloaded_and_shared_without_using_a_try() {
    let fixture = committed_fixture(true).await;
    expire_deadline(fixture.exercise).await;
    let app = client_api_app!();
    let request = upload_request(
        fixture.exercise,
        &fixture.token,
        &[(Uuid::new_v4(), "a.tar.zst", "pasted")],
    )
    .uri(&format!(
        "/exercises/{}/files?for=snapshot",
        fixture.exercise
    ))
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let uploaded: api::UploadedFiles = test::read_body_json(response).await;
    let file_id = uploaded.data_files[0].id;

    let request = snapshot_request(
        fixture.exercise,
        &fixture.token,
        &paste_of(&fixture, file_id),
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot: api::AnswerSnapshotResult = test::read_body_json(response).await;
    assert_eq!(
        slide_submission_count(fixture.exercise, fixture.user).await,
        0
    );

    let downloaded = download(&app, &fixture.token, snapshot.snapshot_id).await;
    assert_eq!(downloaded["data_files"][0]["id"], file_id.to_string());

    let request = share_request(snapshot.snapshot_id, &fixture.token).to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let listed = list_submissions(&app, &fixture).await;
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, snapshot.snapshot_id);
    assert_eq!(listed[0].kind, api::SubmissionKind::Paste);
    assert!(listed[0].is_shared);
    assert!(listed[0].score_given.is_none());
}

#[actix_web::test]
async fn another_users_snapshot_cannot_be_downloaded_or_shared() {
    let owner = committed_fixture(true).await;
    let other = committed_fixture(true).await;
    let app = client_api_app!();
    let request = upload_request(
        owner.exercise,
        &owner.token,
        &[(Uuid::new_v4(), "a.tar.zst", "mine")],
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    let uploaded: api::UploadedFiles = test::read_body_json(response).await;
    let request = snapshot_request(
        owner.exercise,
        &owner.token,
        &api::NewAnswerSnapshot {
            purpose: api::SnapshotPurpose::Backup,
            ..paste_of(&owner, uploaded.data_files[0].id)
        },
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot: api::AnswerSnapshotResult = test::read_body_json(response).await;

    for request in [
        test::TestRequest::get()
            .uri(&format!("/submissions/{}/download", snapshot.snapshot_id))
            .insert_header(("Authorization", format!("Bearer {}", other.token))),
        share_request(snapshot.snapshot_id, &other.token),
    ] {
        let response = test::call_service(&app, request.to_request()).await;
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }
}

#[actix_web::test]
async fn a_snapshot_naming_another_users_upload_is_reported_as_unknown() {
    let owner = committed_fixture(true).await;
    let thief = committed_fixture(true).await;
    let app = client_api_app!();
    let request = upload_request(
        owner.exercise,
        &owner.token,
        &[(Uuid::new_v4(), "a.tar.zst", "mine")],
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    let uploaded: api::UploadedFiles = test::read_body_json(response).await;

    let request = snapshot_request(
        thief.exercise,
        &thief.token,
        &paste_of(&thief, uploaded.data_files[0].id),
    )
    .to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "unknown_upload");
}

fn paste_of(fixture: &Fixture, file: Uuid) -> api::NewAnswerSnapshot {
    api::NewAnswerSnapshot {
        purpose: api::SnapshotPurpose::Paste,
        exercise_slide_id: fixture.slide,
        exercise_task_id: fixture.task,
        data_json: None,
        data_files: vec![file],
    }
}

#[actix_web::test]
async fn pastes_beyond_the_per_minute_limit_are_refused() {
    let fixture = committed_fixture(true).await;
    let file = upload_two(&fixture).await[0];
    let app = client_api_app!();
    let mut responses = vec![];
    for _ in 0..4 {
        let request = snapshot_request(fixture.exercise, &fixture.token, &paste_of(&fixture, file))
            .to_request();
        responses.push(test::call_service(&app, request).await);
    }
    assert_eq!(
        responses.iter().map(|r| r.status()).collect::<Vec<_>>(),
        vec![
            StatusCode::OK,
            StatusCode::OK,
            StatusCode::OK,
            StatusCode::TOO_MANY_REQUESTS
        ]
    );
    assert!(
        responses[3]
            .headers()
            .contains_key(actix_web::http::header::RETRY_AFTER)
    );

    let backup = api::NewAnswerSnapshot {
        purpose: api::SnapshotPurpose::Backup,
        ..paste_of(&fixture, file)
    };
    let request = snapshot_request(fixture.exercise, &fixture.token, &backup).to_request();
    assert_eq!(
        test::call_service(&app, request).await.status(),
        StatusCode::OK,
        "backups are bounded by their cap, not by the paste limit"
    );
}

#[actix_web::test]
async fn refused_pastes_do_not_use_up_the_limit() {
    let fixture = committed_fixture(true).await;
    let file = upload_two(&fixture).await[0];
    let app = client_api_app!();
    let unknown_upload = paste_of(&fixture, Uuid::new_v4());
    for _ in 0..4 {
        let request =
            snapshot_request(fixture.exercise, &fixture.token, &unknown_upload).to_request();
        assert_eq!(
            test::call_service(&app, request).await.status(),
            StatusCode::UNPROCESSABLE_ENTITY
        );
    }
    let request =
        snapshot_request(fixture.exercise, &fixture.token, &paste_of(&fixture, file)).to_request();
    assert_eq!(
        test::call_service(&app, request).await.status(),
        StatusCode::OK
    );
}

#[actix_web::test]
async fn a_backup_cannot_be_shared() {
    let fixture = committed_fixture(true).await;
    let file = upload_two(&fixture).await[0];
    let app = client_api_app!();
    let backup = api::NewAnswerSnapshot {
        purpose: api::SnapshotPurpose::Backup,
        ..paste_of(&fixture, file)
    };
    let request = snapshot_request(fixture.exercise, &fixture.token, &backup).to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot: api::AnswerSnapshotResult = test::read_body_json(response).await;

    let request = share_request(snapshot.snapshot_id, &fixture.token).to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = test::read_body_json(response).await;
    assert_eq!(message_key(&body), "backup_not_shareable");
}

/// Moves the fixture's exercise into a running exam, which the user has started when
/// `is_started`, and returns the exam's id.
async fn move_fixture_exercise_to_running_exam(fixture: &Fixture, is_started: bool) -> Uuid {
    let mut conn = PgConnection::connect(&dev_database_url())
        .await
        .expect("connection");
    let organization_id = models::courses::get_course(&mut conn, fixture.course)
        .await
        .expect("course")
        .organization_id;
    let exam = models::exams::insert(
        &mut conn,
        models::PKeyPolicy::Generate,
        &models::exams::NewExam {
            name: "Exam".to_string(),
            starts_at: Some(Utc::now() - ChronoDuration::hours(1)),
            ends_at: Some(Utc::now() + ChronoDuration::hours(1)),
            time_minutes: 60,
            organization_id,
            minimum_points_treshold: 0,
            grade_manually: false,
        },
    )
    .await
    .expect("exam");
    models::pages::insert_exam_page(
        &mut conn,
        exam,
        models::pages::NewPage {
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
            content: vec![],
            url_path: String::new(),
            title: "Exam".to_string(),
            course_id: None,
            exam_id: Some(exam),
            chapter_id: None,
            front_page_of_chapter_id: None,
            content_search_language: None,
            hidden: false,
        },
        fixture.user,
    )
    .await
    .expect("exam page");
    models::exercises::move_to_exam_for_tests(&mut conn, fixture.exercise, exam)
        .await
        .expect("move the exercise into the exam");
    if is_started {
        models::exams::enroll(&mut conn, exam, fixture.user, false)
            .await
            .expect("start the exam");
    }
    exam
}

#[actix_web::test]
async fn a_started_exam_and_its_exercises_are_served() {
    let fixture = committed_fixture(true).await;
    let exam = move_fixture_exercise_to_running_exam(&fixture, true).await;
    let app = client_api_app!();

    let exams: Vec<api::Exam> = get_json(&app, &fixture.token, "/exams".to_string()).await;
    assert_eq!(exams.iter().map(|e| e.id).collect::<Vec<_>>(), vec![exam]);
    assert!(exams[0].answerable_until <= Utc::now() + ChronoDuration::minutes(61));

    let slides: Vec<api::ExerciseSlide> =
        get_json(&app, &fixture.token, format!("/exams/{exam}/exercises")).await;
    assert_eq!(
        slides.iter().map(|s| s.exercise_id).collect::<Vec<_>>(),
        vec![fixture.exercise]
    );
    assert_eq!(slides[0].exam_id, Some(exam));
    assert!(
        slides[0]
            .tasks
            .iter()
            .all(|t| t.model_solution_spec.is_none())
    );

    let slide: api::ExerciseSlide = get_json(
        &app,
        &fixture.token,
        format!("/exercises/{}", fixture.exercise),
    )
    .await;
    assert_eq!(slide.exam_id, Some(exam));
}

#[actix_web::test]
async fn an_exam_the_user_has_not_started_is_not_served() {
    let fixture = committed_fixture(true).await;
    let exam = move_fixture_exercise_to_running_exam(&fixture, false).await;
    let app = client_api_app!();

    let exams: Vec<api::Exam> = get_json(&app, &fixture.token, "/exams".to_string()).await;
    assert!(exams.is_empty());
    for uri in [
        format!("/exams/{exam}/exercises"),
        format!("/exercises/{}", fixture.exercise),
    ] {
        let request = test::TestRequest::get()
            .uri(&uri)
            .insert_header(("Authorization", format!("Bearer {}", fixture.token)))
            .to_request();
        let response = test::call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "GET {uri}");
    }
}

#[actix_web::test]
async fn an_exam_exercise_cannot_be_snapshotted() {
    let fixture = committed_fixture(true).await;
    let file = upload_two(&fixture).await[0];
    move_fixture_exercise_to_running_exam(&fixture, true).await;
    let app = client_api_app!();
    let request =
        snapshot_request(fixture.exercise, &fixture.token, &paste_of(&fixture, file)).to_request();
    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
