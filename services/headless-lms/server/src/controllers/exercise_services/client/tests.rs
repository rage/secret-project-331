use super::*;

use chrono::Utc;

fn state_with(score_given: Option<f32>, activity_progress: ActivityProgress) -> UserExerciseState {
    let now = Utc::now();
    UserExerciseState {
        id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        exercise_id: Uuid::new_v4(),
        course_id: Some(Uuid::new_v4()),
        exam_id: None,
        created_at: now,
        updated_at: now,
        deleted_at: None,
        score_given,
        grading_progress: GradingProgress::FullyGraded,
        activity_progress,
        reviewing_stage: ReviewingStage::NotStarted,
        selected_exercise_slide_id: None,
    }
}

#[test]
fn submission_list_items_mark_shared_submissions() {
    let submission = |id| UserExerciseSlideSubmissionWithGrading {
        id,
        exercise_id: Uuid::nil(),
        created_at: Utc::now(),
        score_given: Some(0.0),
        grading_progress: Some(GradingProgress::FullyGraded),
    };
    let pasted = Uuid::new_v4();
    let submitted = Uuid::new_v4();

    let items = submission_list_items(
        vec![submission(pasted), submission(submitted)],
        vec![],
        &HashSet::from([pasted]),
    );

    let mut shared: Vec<_> = items.iter().map(|item| (item.id, item.is_shared)).collect();
    shared.sort();
    let mut expected = vec![(pasted, true), (submitted, false)];
    expected.sort();
    assert_eq!(shared, expected);
}

#[test]
fn submission_list_items_interleave_ungraded_snapshots_newest_first() {
    let now = Utc::now();
    let submission = UserExerciseSlideSubmissionWithGrading {
        id: Uuid::new_v4(),
        exercise_id: Uuid::nil(),
        created_at: now - chrono::Duration::minutes(1),
        score_given: Some(1.0),
        grading_progress: Some(GradingProgress::FullyGraded),
    };
    let snapshot = |purpose, created_at| ExerciseAnswerSnapshot {
        id: Uuid::new_v4(),
        created_at,
        updated_at: created_at,
        deleted_at: None,
        user_id: Uuid::nil(),
        course_id: Uuid::nil(),
        exercise_id: Uuid::nil(),
        exercise_slide_id: Uuid::nil(),
        exercise_task_id: Uuid::nil(),
        purpose,
        data_json: None,
    };
    let paste = snapshot(SnapshotPurpose::Paste, now);
    let backup = snapshot(SnapshotPurpose::Backup, now - chrono::Duration::minutes(2));
    let paste_id = paste.id;

    let items = submission_list_items(
        vec![submission],
        vec![backup, paste],
        &HashSet::from([paste_id]),
    );

    assert_eq!(
        items
            .iter()
            .map(|item| (item.kind, item.is_shared, item.score_given))
            .collect::<Vec<_>>(),
        vec![
            (api::SubmissionKind::Paste, true, None),
            (api::SubmissionKind::Submission, false, Some(1.0)),
            (api::SubmissionKind::Backup, false, None),
        ]
    );
}

#[test]
fn progress_without_state_is_zero_and_untouched() {
    let p = derive_exercise_progress(Uuid::nil(), 5, None, false, None, None);
    assert_eq!(p.score_given, 0.0);
    assert_eq!(p.score_maximum, 5);
    assert!(!p.completed);
    assert!(!p.attempted);
}

#[test]
fn progress_started_is_attempted_not_completed() {
    let state = state_with(Some(0.0), ActivityProgress::Started);
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&state), false, None, None);
    assert!(p.attempted);
    assert!(!p.completed);
}

#[test]
fn progress_completed_reports_points_and_flags() {
    let state = state_with(Some(5.0), ActivityProgress::Completed);
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&state), false, None, None);
    assert_eq!(p.score_given, 5.0);
    assert!(p.completed);
    assert!(p.attempted);
}

#[test]
fn standing_passes_only_at_full_points() {
    let partial = state_with(Some(4.0), ActivityProgress::Completed);
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&partial), false, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::Attempted));

    let full = state_with(Some(4.99995), ActivityProgress::Completed);
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&full), false, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::Passed));

    let p = derive_exercise_progress(Uuid::nil(), 5, None, false, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::NotAttempted));
}

#[test]
fn standing_is_out_of_tries_below_full_points_only() {
    let zero = state_with(Some(0.0), ActivityProgress::Completed);
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&zero), true, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::OutOfTries));

    let full = state_with(Some(5.0), ActivityProgress::Completed);
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&full), true, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::Passed));
}

#[test]
fn standing_stays_attempted_while_the_last_try_is_graded() {
    let mut pending = state_with(Some(0.0), ActivityProgress::Completed);
    pending.grading_progress = GradingProgress::Pending;
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&pending), true, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::Attempted));

    let mut failed = state_with(Some(0.0), ActivityProgress::Completed);
    failed.grading_progress = GradingProgress::Failed;
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&failed), true, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::OutOfTries));
}

#[test]
fn standing_stays_attempted_while_peer_or_self_review_is_pending() {
    for stage in [
        ReviewingStage::PeerReview,
        ReviewingStage::SelfReview,
        ReviewingStage::WaitingForPeerReviews,
    ] {
        let mut reviewing = state_with(None, ActivityProgress::Completed);
        reviewing.reviewing_stage = stage;
        let p = derive_exercise_progress(Uuid::nil(), 5, Some(&reviewing), true, None, None);
        assert_eq!(
            p.standing,
            Some(api::ExerciseStanding::Attempted),
            "{stage:?}"
        );
    }
}

#[test]
fn a_zero_point_exercise_passes_once_graded() {
    let p = derive_exercise_progress(Uuid::nil(), 0, None, false, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::NotAttempted));

    let graded = state_with(Some(0.0), ActivityProgress::Completed);
    let p = derive_exercise_progress(Uuid::nil(), 0, Some(&graded), false, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::Passed));
}

#[test]
fn progress_initialized_state_is_not_attempted() {
    let state = state_with(None, ActivityProgress::Initialized);
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&state), false, None, None);
    assert_eq!(p.score_given, 0.0);
    assert!(!p.attempted);
    assert!(!p.completed);
}

#[test]
fn an_answer_held_until_the_chapter_is_locked_awaits_the_lock() {
    let held = state_with(None, ActivityProgress::Completed);
    assert_eq!(
        pending_teacher_review(true, Some(&held)),
        Some(api::PendingTeacherReview::AwaitsChapterLock)
    );
    assert_eq!(pending_teacher_review(false, Some(&held)), None);

    let unanswered = state_with(None, ActivityProgress::Initialized);
    assert_eq!(pending_teacher_review(true, Some(&unanswered)), None);
    assert_eq!(pending_teacher_review(true, None), None);
}

#[test]
fn an_answer_in_manual_review_awaits_the_teacher_and_locks_the_exercise() {
    let mut waiting = state_with(None, ActivityProgress::Completed);
    waiting.reviewing_stage = ReviewingStage::WaitingForManualGrading;
    let review = pending_teacher_review(false, Some(&waiting));
    assert_eq!(review, Some(api::PendingTeacherReview::AwaitsTeacher));

    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&waiting), true, None, review);
    assert_eq!(p.score_given, 0.0);
    assert_eq!(p.standing, Some(api::ExerciseStanding::Attempted));
    assert!(p.exercise_locked);
}

#[test]
fn points_awarded_before_chapter_locking_await_no_review() {
    for stage in [
        ReviewingStage::NotStarted,
        ReviewingStage::WaitingForManualGrading,
    ] {
        let mut scored = state_with(Some(5.0), ActivityProgress::Completed);
        scored.reviewing_stage = stage;
        let review = pending_teacher_review(true, Some(&scored));
        assert_eq!(review, None, "{stage:?}");
        let p = derive_exercise_progress(Uuid::nil(), 5, Some(&scored), false, None, review);
        assert_eq!(p.score_given, 5.0);
        assert_eq!(p.standing, Some(api::ExerciseStanding::Passed));
        assert_eq!(
            p.exercise_locked,
            stage == ReviewingStage::WaitingForManualGrading
        );
    }
}

#[test]
fn a_failed_answer_out_of_tries_before_chapter_locking_awaits_no_review() {
    for stage in [
        ReviewingStage::NotStarted,
        ReviewingStage::WaitingForManualGrading,
    ] {
        let mut failed = state_with(Some(0.0), ActivityProgress::Completed);
        failed.reviewing_stage = stage;
        let review = pending_teacher_review(true, Some(&failed));
        assert_eq!(review, None, "{stage:?}");
        let p = derive_exercise_progress(Uuid::nil(), 5, Some(&failed), true, None, review);
        assert_eq!(p.score_given, 0.0);
        assert_eq!(p.standing, Some(api::ExerciseStanding::OutOfTries));
        assert_eq!(
            p.exercise_locked,
            stage == ReviewingStage::WaitingForManualGrading
        );
    }
}

#[test]
fn a_reviewed_answer_awaits_nothing_but_stays_locked() {
    let mut reviewed = state_with(Some(5.0), ActivityProgress::Completed);
    reviewed.reviewing_stage = ReviewingStage::ReviewedAndLocked;
    assert_eq!(pending_teacher_review(true, Some(&reviewed)), None);
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&reviewed), false, None, None);
    assert_eq!(p.standing, Some(api::ExerciseStanding::Passed));
    assert!(p.exercise_locked);

    let open = state_with(Some(5.0), ActivityProgress::Completed);
    let p = derive_exercise_progress(Uuid::nil(), 5, Some(&open), false, None, None);
    assert!(!p.exercise_locked);
}

const MINIMUM: Option<Version> = Some(Version(0, 39, 4));

#[test]
fn version_check_is_disabled_when_no_minimum() {
    assert!(check_client_version(None, None).is_ok());
    assert!(check_client_version(Some("0.1.0"), None).is_ok());
    assert!(check_client_version(Some("garbage"), None).is_ok());
}

#[test]
fn version_check_accepts_equal_and_newer_clients() {
    assert!(check_client_version(Some("0.39.4"), MINIMUM).is_ok());
    assert!(check_client_version(Some("0.39.5"), MINIMUM).is_ok());
    assert!(check_client_version(Some("1.0.0"), MINIMUM).is_ok());
}

#[test]
fn version_check_rejects_older_missing_or_malformed_clients() {
    assert!(check_client_version(Some("0.39.3"), MINIMUM).is_err());
    assert!(check_client_version(None, MINIMUM).is_err());
    assert!(check_client_version(Some("not-a-version"), MINIMUM).is_err());
}

#[actix_web::test]
async fn supported_client_reads_the_minimum_from_app_conf() {
    let app_conf = web::Data::new(ApplicationConfiguration {
        exercise_services_client_minimum_version: MINIMUM,
        ..ApplicationConfiguration::mock_conf()
            .expect("the mock configuration is built from constants")
    });
    let extract = |version: &str| {
        let req = actix_web::test::TestRequest::default()
            .app_data(app_conf.clone())
            .insert_header((CLIENT_VERSION_HEADER, version))
            .to_http_request();
        SupportedClient::extract(&req).into_inner()
    };
    assert!(extract("0.39.4").is_ok());
    let rejected = extract("0.39.3").expect_err("an older client is rejected");
    assert_eq!(
        actix_web::ResponseError::status_code(&rejected),
        actix_web::http::StatusCode::UPGRADE_REQUIRED
    );
}

// submit_exercise builds this exact error for a not-enrolled user; assert it produces the
// same 422 `not_enrolled` shape get_exercise returns, so the client never sees a 401 here.
#[test]
fn not_enrolled_submit_error_maps_to_422_not_enrolled() {
    use actix_web::ResponseError;
    use actix_web::http::StatusCode;
    use futures_util::FutureExt;

    let err = controller_err!(
        BadRequestWithReason(BadRequestReason::NotEnrolled),
        "User is not enrolled to this exercise's course".to_string()
    );
    let response = err.error_response();
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);

    let bytes = actix_web::body::to_bytes(response.into_body())
        .now_or_never()
        .expect("response should resolve immediately")
        .expect("body bytes");
    let value: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
    assert_eq!(value["type"], "validation_error");
    assert_eq!(value["message_key"], "not_enrolled");
}

/// The submit body is deserialized by `web::Json`, so a malformed one fails at the serde
/// boundary before the handler runs. Pin that contract: both ids are required and must be
/// UUIDs. The answer fields are all optional -- a body naming no files is a JSON answer, and a
/// `file` answer naming none is rejected by the submit path, not by serde.
#[test]
fn malformed_submission_body_fails_to_deserialize() {
    serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
        "exercise_slide_id": Uuid::new_v4(),
        "exercise_task_id": Uuid::new_v4(),
        "answer_kind": "file",
        "data_files": [Uuid::new_v4()],
    }))
    .expect("a well-formed submission body deserializes");

    let json_answer = serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
        "exercise_slide_id": Uuid::new_v4(),
        "exercise_task_id": Uuid::new_v4(),
    }))
    .expect("a body without answer fields deserializes as a json answer");
    assert!(json_answer.answer_kind.is_none());
    assert!(json_answer.data_files.is_none());

    // Missing exercise_task_id.
    assert!(
        serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
            "exercise_slide_id": Uuid::new_v4(),
            "data_files": [],
        }))
        .is_err()
    );
    // Ids must be UUIDs, not arbitrary strings or numbers.
    assert!(
        serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
            "exercise_slide_id": "not-a-uuid",
            "exercise_task_id": Uuid::new_v4(),
            "data_files": [],
        }))
        .is_err()
    );
    assert!(
        serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
            "exercise_slide_id": Uuid::new_v4(),
            "exercise_task_id": Uuid::new_v4(),
            "data_files": ["not-a-uuid"],
        }))
        .is_err()
    );
    // A completely unrelated body.
    assert!(
        serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!("nonsense"))
            .is_err()
    );
}

fn capable_slugs() -> Vec<String> {
    vec!["tmc".to_string(), "other-native".to_string()]
}

#[test]
fn submit_accepts_a_task_whose_service_is_capable() {
    let slugs = capable_slugs();
    assert!(verify_task_is_client_capable(Uuid::new_v4(), "tmc", &slugs).is_ok());
    // Genericity: capability is not the `tmc` slug, so any declaring service passes.
    assert!(verify_task_is_client_capable(Uuid::new_v4(), "other-native", &slugs).is_ok());
}

/// Closes a real hole: before this check a caller holding any task id could submit to a
/// service that would never understand the resulting answer, and the junk submission was
/// persisted before grading failed inside that service.
#[test]
fn submit_rejects_a_task_whose_service_is_not_capable() {
    use actix_web::ResponseError;
    use actix_web::http::StatusCode;
    let task_id = Uuid::new_v4();
    let err = verify_task_is_client_capable(task_id, "quizzes", &capable_slugs())
        .expect_err("a non-capable exercise service must be rejected");
    assert_eq!(err.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
    assert!(err.to_string().contains("quizzes"), "{err}");
}

/// A cold or failing `service-info-fetcher` leaves the capable set empty; nothing may be
/// submittable then, rather than everything.
#[test]
fn submit_rejects_every_task_when_nothing_is_capable() {
    assert!(verify_task_is_client_capable(Uuid::new_v4(), "tmc", &[]).is_err());
}

pub(super) fn task_with(slug: &str) -> models::exercise_tasks::CourseMaterialExerciseTask {
    models::exercise_tasks::CourseMaterialExerciseTask {
        id: Uuid::new_v4(),
        exercise_service_slug: slug.to_string(),
        exercise_slide_id: Uuid::new_v4(),
        exercise_iframe_url: None,
        pseudonumous_user_id: None,
        assignment: serde_json::json!([]),
        public_spec: Some(serde_json::json!({ "spec": slug })),
        model_solution_spec: Some(serde_json::json!({ "solution": slug })),
        previous_submission: None,
        previous_submission_grading: None,
        order_number: 0,
        deleted_at: None,
    }
}

#[test]
fn a_slide_of_capable_tasks_is_visible_to_the_client() {
    let tasks = vec![task_with("tmc"), task_with("other-native")];
    let visible = client_tasks_from_slide(tasks, &capable_slugs(), false);
    let slugs: Vec<&str> = visible
        .iter()
        .map(|t| t.exercise_service_slug.as_str())
        .collect();
    assert_eq!(slugs, vec!["tmc", "other-native"]);
}

/// The client could answer only the tmc task, so the slide could never reach full points.
#[test]
fn a_slide_mixing_in_a_task_the_client_cannot_answer_is_not_visible() {
    let tasks = vec![task_with("tmc"), task_with("quizzes")];
    assert!(client_tasks_from_slide(tasks, &capable_slugs(), false).is_empty());
}

#[test]
fn no_task_is_visible_when_nothing_is_capable() {
    let visible = client_tasks_from_slide(vec![task_with("tmc")], &[], false);
    assert!(visible.is_empty());
}

#[test]
fn model_solutions_are_stripped_unless_revealed() {
    let hidden = client_tasks_from_slide(vec![task_with("tmc")], &capable_slugs(), false);
    assert!(hidden[0].model_solution_spec.is_none());
    let revealed = client_tasks_from_slide(vec![task_with("tmc")], &capable_slugs(), true);
    assert!(revealed[0].model_solution_spec.is_some());
    // The public spec is unaffected by the reveal gate.
    assert!(hidden[0].public_spec.is_some());
}

#[test]
fn verify_slide_and_task_belong_accepts_matching_ids() {
    let exercise_id = Uuid::new_v4();
    let slide_id = Uuid::new_v4();
    let task_id = Uuid::new_v4();
    assert!(
        verify_slide_and_task_belong(exercise_id, slide_id, exercise_id, task_id, slide_id).is_ok()
    );
}

#[test]
fn verify_slide_and_task_belong_rejects_foreign_slide() {
    use actix_web::ResponseError;
    use actix_web::http::StatusCode;
    let exercise_id = Uuid::new_v4();
    let slide_id = Uuid::new_v4();
    let task_id = Uuid::new_v4();
    // Slide claims to belong to a different exercise than the one in the URL path.
    let other_exercise = Uuid::new_v4();
    let err =
        verify_slide_and_task_belong(exercise_id, slide_id, other_exercise, task_id, slide_id)
            .expect_err("a slide from another exercise must be rejected");
    assert_eq!(err.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[test]
fn verify_slide_and_task_belong_rejects_foreign_task() {
    let exercise_id = Uuid::new_v4();
    let slide_id = Uuid::new_v4();
    let task_id = Uuid::new_v4();
    // Task belongs to a slide other than the submitted one.
    let other_slide = Uuid::new_v4();
    assert!(
        verify_slide_and_task_belong(exercise_id, slide_id, exercise_id, task_id, other_slide)
            .is_err()
    );
}
