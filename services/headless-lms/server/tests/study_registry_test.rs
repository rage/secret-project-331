use std::sync::Arc;

use actix_http::{body, Method};
use actix_web::test;
use chrono::{TimeZone, Utc};
use headless_lms_models::{
    course_module_completion_registered_to_study_registries::RegisteredCompletion,
    course_module_completions::{
        CourseModuleCompletionGranter, NewCourseModuleCompletion, StudyRegistryCompletion,
    },
    courses::NewCourse,
    library::content_management::CreateNewCourseFixedIds,
    PKeyPolicy,
};
use headless_lms_server::domain::models_requests::{self, JwtKey};
use sqlx::PgConnection;
use uuid::Uuid;

mod integration_test;

#[actix_web::test]
async fn gets_and_registers_completions() {
    let base_url =
        std::env::var("BASE_URL").unwrap_or_else(|_| "http://project-331.local".to_string());
    let (actix, pool) = integration_test::init_actix().await;
    let mut conn = pool.acquire().await.unwrap();
    let jwt_key = Arc::new(integration_test::make_jwt_key());
    let (_user, _org, course, module, _completion, _completion_2) =
        insert_data(&mut conn, base_url, jwt_key).await;
    let path = format!("/api/v0/study-registry/completions/{}", course);

    // Without header nor database entry
    let req = test::TestRequest::with_uri(&path).to_request();
    let res = test::call_service(&actix, req).await;
    assert!(res.status().is_client_error());

    // With header but no database entry
    let req = test::TestRequest::with_uri(&path)
        .append_header((
            "Authorization",
            "Basic integration-test-intentionally-public",
        ))
        .to_request();
    let res = test::call_service(&actix, req).await;
    assert!(res.status().is_client_error());

    // With header and database entry
    headless_lms_models::study_registry_registrars::insert(
        &mut conn,
        PKeyPolicy::Fixed(Uuid::parse_str("9d5aa77c-1c8c-4333-a3d2-1f328b9da87a").unwrap()),
        "Integration test",
        "integration-test-intentionally-public",
    )
    .await
    .unwrap();
    let req = test::TestRequest::with_uri(&path)
        .append_header((
            "Authorization",
            "Basic integration-test-intentionally-public",
        ))
        .to_request();
    let res = test::call_service(&actix, req).await;
    assert!(res.status().is_success());
    let body = res.into_body();
    let bytes = body::to_bytes(body).await.unwrap();
    let res: Vec<StudyRegistryCompletion> = serde_json::from_slice(&bytes[..]).unwrap();
    assert_eq!(res.len(), 2);

    // Another endpoint
    let alt_path = format!("/api/v0/study-registry/completions/{}/{}", course, module);
    let req = test::TestRequest::with_uri(&alt_path)
        .append_header((
            "Authorization",
            "Basic integration-test-intentionally-public",
        ))
        .to_request();
    let res = test::call_service(&actix, req).await;
    assert!(res.status().is_success());
    let body = res.into_body();
    let bytes = body::to_bytes(body).await.unwrap();
    let res: Vec<StudyRegistryCompletion> = serde_json::from_slice(&bytes[..]).unwrap();
    assert_eq!(res.len(), 2);

    // Trying to register without authenticating
    let post_path = "/api/v0/study-registry/completion-registered-to-study-registry";
    let completions: Vec<RegisteredCompletion> = res
        .into_iter()
        .map(|x| RegisteredCompletion {
            completion_id: x.id,
            student_number: "ABC123".to_string(),
            registration_date: Utc.with_ymd_and_hms(2022, 6, 17, 0, 0, 0).unwrap(),
        })
        .collect();
    let req = test::TestRequest::with_uri(post_path)
        .set_json(completions.clone())
        .to_request();
    let res = test::call_service(&actix, req).await;
    assert!(res.status().is_client_error());

    // Register with authenticating
    let req = test::TestRequest::with_uri(post_path)
        .method(Method::POST)
        .append_header((
            "Authorization",
            "Basic integration-test-intentionally-public",
        ))
        .set_json(completions)
        .to_request();
    let res = test::call_service(&actix, req).await;
    assert!(res.status().is_success());
}

async fn insert_data(
    conn: &mut PgConnection,
    base_url: String,
    jwt_key: Arc<JwtKey>,
) -> (Uuid, Uuid, Uuid, Uuid, Uuid, Uuid) {
    let user_1 = headless_lms_models::users::insert(
        conn,
        PKeyPolicy::Fixed(Uuid::parse_str("2d9aa7a9-cd01-40ca-b2d1-007e5302226c").unwrap()),
        "user@example.com",
        None,
        None,
    )
    .await
    .unwrap();
    let user_2 = headless_lms_models::users::insert(
        conn,
        PKeyPolicy::Fixed(Uuid::parse_str("934c6121-6e60-472f-b806-d0af058b8ce9").unwrap()),
        "user2@example.com",
        None,
        None,
    )
    .await
    .unwrap();
    let org = headless_lms_models::organizations::insert(
        conn,
        PKeyPolicy::Fixed(Uuid::parse_str("c0938ae7-9f5d-4646-b3ba-900068f72ba4").unwrap()),
        "",
        "stream-org",
        "",
    )
    .await
    .unwrap();
    let (course, _, instance, course_module) =
        headless_lms_models::library::content_management::create_new_course(
            conn,
            PKeyPolicy::Fixed(CreateNewCourseFixedIds {
                course_id: Uuid::parse_str("00265705-10fc-4514-b853-ebd4948501ab").unwrap(),
                default_course_instance_id: Uuid::parse_str("8ec070e7-7905-4d4b-97f1-ab3ca0854bc3")
                    .unwrap(),
            }),
            NewCourse {
                name: "course".to_string(),
                slug: "slug".to_string(),
                organization_id: org,
                language_code: "en-US".to_string(),
                teacher_in_charge_name: "Teacher".to_string(),
                teacher_in_charge_email: "teacher@email.com".to_string(),
                description: "".to_string(),
                is_draft: false,
                is_test_mode: false,
                is_unlisted: false,
                copy_user_permissions: false,
                is_joinable_by_code_only: false,
                join_code: None,
                ask_marketing_consent: false,
                flagged_answers_threshold: Some(3),
            },
            user_1,
            models_requests::make_spec_fetcher(
                base_url.clone(),
                Uuid::new_v4(),
                Arc::clone(&jwt_key),
            ),
            models_requests::fetch_service_info,
        )
        .await
        .unwrap();
    let course_module_completion = headless_lms_models::course_module_completions::insert(
        conn,
        PKeyPolicy::Generate,
        &NewCourseModuleCompletion {
            course_id: course.id,
            course_instance_id: instance.id,
            course_module_id: course_module.id,
            user_id: user_1,
            completion_date: Utc.with_ymd_and_hms(2022, 6, 13, 0, 0, 0).unwrap(),
            completion_registration_attempt_date: None,
            completion_language: "en-US".to_string(),
            eligible_for_ects: true,
            email: "student@example.com".to_string(),
            grade: Some(4),
            passed: true,
        },
        CourseModuleCompletionGranter::Automatic,
    )
    .await
    .unwrap();
    headless_lms_models::course_module_completions::update_prerequisite_modules_completed(
        conn,
        course_module_completion.id,
        true,
    )
    .await
    .unwrap();
    let course_module_completion_2 = headless_lms_models::course_module_completions::insert(
        conn,
        PKeyPolicy::Generate,
        &NewCourseModuleCompletion {
            course_id: course.id,
            course_instance_id: instance.id,
            course_module_id: course_module.id,
            user_id: user_2,
            completion_date: Utc.with_ymd_and_hms(2022, 6, 13, 0, 0, 0).unwrap(),
            completion_registration_attempt_date: None,
            completion_language: "en-US".to_string(),
            eligible_for_ects: true,
            email: "student@example.com".to_string(),
            grade: Some(3),
            passed: true,
        },
        CourseModuleCompletionGranter::Automatic,
    )
    .await
    .unwrap();
    headless_lms_models::course_module_completions::update_prerequisite_modules_completed(
        conn,
        course_module_completion_2.id,
        true,
    )
    .await
    .unwrap();
    (
        user_1,
        org,
        course.id,
        course_module.id,
        course_module_completion.id,
        course_module_completion_2.id,
    )
}
