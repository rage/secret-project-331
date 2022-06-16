use actix_http::body;
use actix_web::test;
use chrono::{TimeZone, Utc};
use headless_lms_models::{
    course_module_completions::{NewCourseModuleCompletion, StudyRegistryCompletion},
    courses::NewCourse,
};
use sqlx::PgConnection;
use uuid::Uuid;

mod integration_test;

#[tokio::test]
async fn gets_completions_for_a_course() {
    let (actix, pool) = integration_test::init_actix().await;
    let mut conn = pool.acquire().await.unwrap();
    let (_user, _org, course, _module, _completion, _completion_2) = insert_data(&mut conn).await;
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
        "Integration test",
        "integration-test-intentionally-public",
        Some(Uuid::parse_str("9d5aa77c-1c8c-4333-a3d2-1f328b9da87a").unwrap()),
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
}

async fn insert_data(conn: &mut PgConnection) -> (Uuid, Uuid, Uuid, Uuid, Uuid, Uuid) {
    let user = headless_lms_models::users::insert_with_id(
        conn,
        "user@example.com",
        None,
        None,
        Uuid::parse_str("2d9aa7a9-cd01-40ca-b2d1-007e5302226c").unwrap(),
    )
    .await
    .unwrap();
    let org = headless_lms_models::organizations::insert(
        conn,
        "",
        "stream-org",
        "",
        Uuid::parse_str("c0938ae7-9f5d-4646-b3ba-900068f72ba4").unwrap(),
    )
    .await
    .unwrap();
    let (course, ..) = headless_lms_models::courses::insert_course(
        conn,
        Uuid::parse_str("00265705-10fc-4514-b853-ebd4948501ab").unwrap(),
        Uuid::parse_str("8ec070e7-7905-4d4b-97f1-ab3ca0854bc3").unwrap(),
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
        },
        user,
    )
    .await
    .unwrap();
    let course_module =
        headless_lms_models::course_modules::insert_default_for_course(conn, course.id)
            .await
            .unwrap();
    let course_module_completion_id = headless_lms_models::course_module_completions::insert(
        conn,
        &NewCourseModuleCompletion {
            course_id: course.id,
            course_module_id: course_module,
            user_id: user,
            completion_date: Utc.ymd(2022, 06, 13).and_hms(0, 0, 0),
            completion_registration_attempt_date: None,
            completion_language: "en_US".to_string(),
            eligible_for_ects: true,
            email: "student@example.com".to_string(),
            grade: Some(4),
            passed: true,
        },
        None,
    )
    .await
    .unwrap();
    let course_module_completion_2_id = headless_lms_models::course_module_completions::insert(
        conn,
        &NewCourseModuleCompletion {
            course_id: course.id,
            course_module_id: course_module,
            user_id: user,
            completion_date: Utc.ymd(2022, 06, 13).and_hms(0, 0, 0),
            completion_registration_attempt_date: None,
            completion_language: "en_US".to_string(),
            eligible_for_ects: true,
            email: "student@example.com".to_string(),
            grade: Some(3),
            passed: true,
        },
        None,
    )
    .await
    .unwrap();
    (
        user,
        org,
        course.id,
        course_module,
        course_module_completion_id,
        course_module_completion_2_id,
    )
}
