use super::*;
use crate::domain::exercise_services::answer_uploads;
use crate::domain::models_requests::{DOWNLOAD_CLAIM_PARAM, DownloadClaim};
use crate::test_helper::*;
use actix_web::http::header::{CONTENT_TYPE, HeaderMap};
use headless_lms_base::config::{
    ApplicationConfiguration, MoocfiConfiguration, OAuthServerConfiguration, SuotarConfiguration,
};
use headless_lms_base::jwt::DEVELOPMENT_JWT_PASSWORD;
use models::exercise_slide_submissions::NewExerciseSlideSubmission;
use models::exercise_task_gradings::UserPointsUpdateStrategy;
use secrecy::SecretString;

const BOUNDARY: &str = "clientuploadboundary";

fn answer_destination(
    course: Uuid,
    exercise_id: Uuid,
    user_id: Uuid,
) -> file_uploading::AnswerUploadDestination {
    file_uploading::AnswerUploadDestination {
        owner: CourseOrExamId::Course(course),
        exercise_id,
        user_id,
    }
}

pub(super) fn app_conf() -> ApplicationConfiguration {
    ApplicationConfiguration {
        base_url: "http://project-331.local".to_string(),
        test_mode: true,
        test_chatbot: false,
        test_sisu: false,
        test_suotar: false,
        test_moocfi: false,
        disable_embedding_vector_creation_when_seeding: false,
        suotar_configuration: SuotarConfiguration::mock_conf("http://project-331.local")
            .expect("Failed to build the mock Suotar configuration"),
        moocfi_configuration: MoocfiConfiguration::mock_conf("http://project-331.local")
            .expect("Failed to build the mock mooc.fi configuration"),
        development_uuid_login: false,
        enable_email_ownership_verification: false,
        azure_configuration: None,
        tmc_account_creation_origin: None,
        tmc_admin_access_token: SecretString::new("mock".to_string().into()),
        jwt_password: SecretString::new(DEVELOPMENT_JWT_PASSWORD.to_string().into()),
        mcp_configuration: None,
        exercise_services_client_minimum_version: None,
        oauth_server_configuration: OAuthServerConfiguration {
            rsa_public_key: "unused".into(),
            rsa_private_key: SecretString::new("unused".into()),
            oauth_token_hmac_key: SecretString::new("pippuri".into()),
            dpop_nonce_key: std::sync::Arc::new(secrecy::SecretBox::new(Box::new("unused".into()))),
        },
    }
}

/// A multipart body in the shape the client sends: one part per file, each field name a UUID.
fn multipart(parts: &[(Uuid, &str, &str)]) -> Multipart {
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

    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        format!("multipart/form-data; boundary={BOUNDARY}")
            .parse()
            .expect("valid content type"),
    );
    Multipart::new(
        &headers,
        futures::stream::once(async move {
            Ok::<_, actix_web::error::PayloadError>(actix_web::web::Bytes::from(body))
        }),
    )
}

async fn insert_task_submission(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: Uuid,
    exercise_id: Uuid,
    slide_id: Uuid,
    task_id: Uuid,
) -> Uuid {
    let slide_submission = models::exercise_slide_submissions::insert_exercise_slide_submission(
        conn,
        NewExerciseSlideSubmission {
            exercise_slide_id: slide_id,
            course_id: Some(course_id),
            exam_id: None,
            user_id,
            exercise_id,
            user_points_update_strategy: UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
        },
    )
    .await
    .expect("slide submission");
    models::exercise_task_submissions::insert(
        conn,
        models::PKeyPolicy::Generate,
        slide_submission.id,
        slide_id,
        task_id,
        &models::library::grading::SubmittedAnswer::Json {
            data: serde_json::json!({ "opaque": "plugin owned" }),
        },
    )
    .await
    .expect("task submission")
}

/// The upload route's core: parts land in the file store, get `file_uploads` rows, and are
/// bound to the exercise and user so a later submit can name them.
#[actix_web::test]
async fn the_files_route_stores_and_binds_every_part() {
    insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
    let store = temp_file_store();
    let first = Uuid::new_v4();
    let second = Uuid::new_v4();
    let mut uploaded_paths = Vec::new();

    let uploads = store_client_uploads(
        tx.as_mut(),
        &answer_destination(course, exercise, user),
        multipart(&[(first, "a.tar.zst", "first"), (second, "b.txt", "second")]),
        &store,
        &mut uploaded_paths,
        &app_conf(),
    )
    .await
    .expect("the upload succeeds");

    assert_eq!(
        uploads.iter().map(|u| u.name.as_str()).collect::<Vec<_>>(),
        vec!["a.tar.zst", "b.txt"]
    );
    // The ids the client submits with are the host's, not the field names it chose.
    assert!(
        uploads
            .iter()
            .all(|u| u.entry.id != first && u.entry.id != second)
    );
    // The url carries a claim rather than the object path, which names the student.
    assert!(uploads.iter().all(|u| {
        u.entry.url.starts_with(&format!(
            "http://project-331.local/api/v0/files/claimed/{}?{DOWNLOAD_CLAIM_PARAM}=",
            u.entry.id
        ))
    }));

    let ids: Vec<Uuid> = uploads.iter().map(|u| u.entry.id).collect();
    let stored = models::file_uploads::get_many(tx.as_mut(), &ids)
        .await
        .expect("file uploads");
    assert_eq!(stored.len(), 2);
    // Filed under the course, exercise and student and ending in the row's own id, so a
    // retention or takedown rule can find the objects without the database.
    for file in &stored {
        assert_eq!(
            file.path,
            format!(
                "answers/v1/course/{course}/exercise/{exercise}/user/{user}/{}",
                file.id
            )
        );
    }
    assert!(
        answer_uploads::verify_uploads_belong_to_exercise(tx.as_mut(), exercise, user, &ids)
            .await
            .is_ok()
    );
    tx.rollback().await;
}

/// Every object that reached the store is recorded for cleanup, which is what the upload
/// route's error arm — including a commit failure — deletes.
#[actix_web::test]
async fn every_stored_object_is_recorded_for_cleanup() {
    insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
    let store = temp_file_store();
    let mut uploaded_paths = Vec::new();

    let uploads = store_client_uploads(
        tx.as_mut(),
        &answer_destination(course, exercise, user),
        multipart(&[
            (Uuid::new_v4(), "a.tar.zst", "first"),
            (Uuid::new_v4(), "b.txt", "second"),
        ]),
        &store,
        &mut uploaded_paths,
        &app_conf(),
    )
    .await
    .expect("the upload succeeds");

    let recorded: Vec<&str> = uploaded_paths.iter().map(|p| p.path.as_str()).collect();
    assert_eq!(recorded.len(), uploads.len());
    let ids: Vec<Uuid> = uploads.iter().map(|u| u.entry.id).collect();
    for file in models::file_uploads::get_many(tx.as_mut(), &ids)
        .await
        .expect("file uploads")
    {
        assert!(
            recorded.contains(&file.path.as_str()),
            "the object at {} would be leaked on a cleanup",
            file.path
        );
    }
    tx.rollback().await;
}

/// Both the upload and the submit route gate on enrolment before touching anything else.
#[actix_web::test]
async fn only_an_enrolled_user_may_upload_or_submit() {
    insert_data!(:tx, user: user, :org, course: course, instance: instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);

    let err = verify_enrolled(tx.as_mut(), user, course)
        .await
        .expect_err("a user who never enrolled must be refused");
    assert_eq!(message_key_of(&err), "not_enrolled");

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

    verify_enrolled(tx.as_mut(), user, course)
        .await
        .expect("an enrolled user is let through");
    tx.rollback().await;
}

/// The capability gate end to end, from the service-info column to the task filter the routes
/// apply: only a service that declares native-client support is offered to a client.
#[actix_web::test]
async fn only_a_service_declaring_native_client_support_is_visible_to_the_client() {
    insert_data!(:tx);
    let mut slugs_of = Vec::new();
    for declares in [true, false] {
        let slug = format!("gate-test-{}", Uuid::new_v4());
        let service = models::exercise_services::insert_exercise_service(
            tx.as_mut(),
            &models::exercise_services::ExerciseServiceNewOrUpdate {
                name: slug.clone(),
                slug: slug.clone(),
                public_url: "http://example.com/api/service".to_string(),
                internal_url: None,
                max_reprocessing_submissions_at_once: 1,
                is_global_admin_only: false,
                is_experimental: false,
            },
        )
        .await
        .expect("exercise service");
        models::exercise_service_info::insert(
            tx.as_mut(),
            &models::exercise_service_info::PathInfo {
                exercise_service_id: service.id,
                user_interface_iframe_path: "/iframe".to_string(),
                grade_endpoint_path: "/grade".to_string(),
                public_spec_endpoint_path: "/public-spec".to_string(),
                model_solution_spec_endpoint_path: "/model-solution".to_string(),
                has_custom_view: false,
                supports_native_client: declares,
                produces_file_answers: false,
                declares_spec_files: false,
            },
        )
        .await
        .expect("service info");
        slugs_of.push(slug);
    }

    let capable = native_client_capable_slugs(tx.as_mut())
        .await
        .expect("capable slugs");
    let visible = client_tasks_from_slide(vec![tests::task_with(&slugs_of[0])], &capable, false);
    assert_eq!(
        visible
            .iter()
            .map(|task| task.exercise_service_slug.as_str())
            .collect::<Vec<_>>(),
        vec![slugs_of[0].as_str()],
        "the declaring service is offered to a client"
    );
    assert!(
        client_tasks_from_slide(vec![tests::task_with(&slugs_of[1])], &capable, false).is_empty(),
        "a service that does not declare support is not offered"
    );
    tx.rollback().await;
}

/// An upload bound to one exercise must not be usable by another, or a client could replay
/// any of the user's uploads into any exercise's submission.
#[actix_web::test]
async fn a_submit_naming_another_exercises_upload_is_rejected() {
    insert_data!(:tx, user: user, :org, course: course, instance: _instance, :course_module, chapter: chapter, page: page, :exercise, :slide, task: _task);
    let other_exercise = models::exercises::insert(
        tx.as_mut(),
        models::PKeyPolicy::Generate,
        course,
        "Other",
        page,
        chapter,
        1,
    )
    .await
    .expect("other exercise");
    let file_id = models::file_uploads::insert(
        tx.as_mut(),
        "a.tar.zst",
        "exercise-services-client/a",
        "application/octet-stream",
        Some(user),
        None,
    )
    .await
    .expect("file upload");
    models::exercise_answer_uploads::insert_many(
        tx.as_mut(),
        exercise,
        user,
        &[file_id],
        models::exercise_answer_uploads::AnswerUploadOrigin::NativeClient,
    )
    .await
    .expect("binding");

    assert!(
        answer_uploads::verify_uploads_belong_to_exercise(tx.as_mut(), exercise, user, &[file_id])
            .await
            .is_ok()
    );
    let error = answer_uploads::verify_uploads_belong_to_exercise(
        tx.as_mut(),
        other_exercise,
        user,
        &[file_id],
    )
    .await
    .expect_err("another exercise must not be able to name this upload");
    assert_eq!(message_key_of(&error), "unknown_upload");
    tx.rollback().await;
}

#[actix_web::test]
async fn a_submit_naming_an_unrecorded_id_is_rejected_as_unknown() {
    insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
    let error = answer_uploads::verify_uploads_belong_to_exercise(
        tx.as_mut(),
        exercise,
        user,
        &[Uuid::new_v4()],
    )
    .await
    .expect_err("an id the host never issued must be rejected");
    assert_eq!(message_key_of(&error), "unknown_upload");
    tx.rollback().await;
}

/// The reaper soft-deletes so that this stays distinguishable from `unknown_upload`. Assert
/// the whole chain from the row's `deleted_at` to the wire key, not just the pure check.
#[actix_web::test]
async fn a_submit_naming_a_reaped_upload_is_rejected_as_expired() {
    insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
    let file_id = models::file_uploads::insert(
        tx.as_mut(),
        "a.tar.zst",
        "exercise-services-client/a",
        "application/octet-stream",
        Some(user),
        None,
    )
    .await
    .expect("file upload");
    models::exercise_answer_uploads::insert_many(
        tx.as_mut(),
        exercise,
        user,
        &[file_id],
        models::exercise_answer_uploads::AnswerUploadOrigin::NativeClient,
    )
    .await
    .expect("binding");
    models::exercise_answer_uploads::delete_by_file_upload_id(tx.as_mut(), file_id)
        .await
        .expect("soft delete");

    let error =
        answer_uploads::verify_uploads_belong_to_exercise(tx.as_mut(), exercise, user, &[file_id])
            .await
            .expect_err("a reaped upload must be rejected");
    assert_eq!(message_key_of(&error), "upload_expired");
    tx.rollback().await;
}

/// The old contract could only ever expose `files[0]`. Every file of a submission must be
/// reachable, in the order the client uploaded them.
#[actix_web::test]
async fn download_serves_every_file_of_a_multi_file_submission() {
    insert_data!(:tx, user: user, :org, course: course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, :task);
    let submission_id =
        insert_task_submission(tx.as_mut(), course, user, exercise, slide, task).await;
    let mut ids = Vec::new();
    for name in ["first.txt", "second.txt", "third.txt"] {
        ids.push(
            models::file_uploads::insert(
                tx.as_mut(),
                name,
                &format!("exercise-services-client/{name}"),
                "application/octet-stream",
                Some(user),
                None,
            )
            .await
            .expect("file upload"),
        );
    }
    models::exercise_task_submission_files::insert_many(tx.as_mut(), submission_id, &ids)
        .await
        .expect("associations");

    let store = temp_file_store();
    let files = models::exercise_task_submission_files::get_by_task_submission_ids(
        tx.as_mut(),
        &[submission_id],
    )
    .await
    .expect("submission files");
    let response =
        submission_files_response(files, &store, &app_conf()).expect("the response is built");

    assert_eq!(
        response
            .data_files
            .iter()
            .map(|f| (f.id, f.name.as_str()))
            .collect::<Vec<_>>(),
        vec![
            (ids[0], "first.txt"),
            (ids[1], "second.txt"),
            (ids[2], "third.txt"),
        ]
    );
    // The url names the file by its id and carries a claim for it, never the storage path.
    for file in &response.data_files {
        let claim = file
            .url
            .strip_prefix(&format!(
                "http://project-331.local/api/v0/files/claimed/{}?{DOWNLOAD_CLAIM_PARAM}=",
                file.id
            ))
            .expect("a claimed-file url");
        assert_eq!(
            DownloadClaim::validate(claim, &JwtKey::test_key())
                .expect("the claim validates")
                .file_upload_id(),
            file.id
        );
    }
    tx.rollback().await;
}

/// A submission whose answer needed no files is legitimate; download must report an empty
/// list rather than the 404 the single-archive contract had to return.
#[test]
fn download_reports_an_empty_list_rather_than_failing() {
    let store = temp_file_store();
    let response = submission_files_response(Vec::<StoredAnswerFile>::new(), &store, &app_conf())
        .expect("the response is built");
    assert!(response.data_files.is_empty());
}

/// A submission and the record of which files it was made from land in one transaction. This is
/// the property that buys: if the association fails, no submission is left behind for
/// `download_submission` to be unable to serve. (`process_submission` itself needs a live
/// exercise service, so the transaction shape is exercised here rather than the handler.)
#[actix_web::test]
async fn a_failing_file_association_leaves_no_submission() {
    insert_data!(:tx, user: user, :org, course: course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, :task);
    let submission_id;
    {
        let mut submit_tx = tx.begin().await;
        submission_id =
            insert_task_submission(submit_tx.as_mut(), course, user, exercise, slide, task).await;
        models::exercise_task_submission_files::insert_many(
            submit_tx.as_mut(),
            submission_id,
            &[Uuid::new_v4()],
        )
        .await
        .expect_err("an id with no file_uploads row violates the foreign key");
        submit_tx.rollback().await;
    }

    assert!(
        models::exercise_task_submissions::get_by_id(
            tx.as_mut(),
            submission_id,
            &crate::test_helper::init_file_store(),
            &crate::test_helper::init_app_conf().expect("app conf"),
        )
        .await
        .is_err(),
        "the submission must not survive a failed association"
    );
    tx.rollback().await;
}
