use std::sync::Arc;

use crate::{
    domain::exercise_services::answer_uploads,
    domain::models_requests::{self, JwtKey},
    prelude::*,
};
use chrono::{Duration, Utc};
use futures_util::future::OptionFuture;
use models::{
    exercises::Exercise,
    library::grading::{
        GradingPolicy, StudentExerciseSlideSubmission, StudentExerciseSlideSubmissionResult,
        SubmittedAnswer,
    },
    user_exercise_states::ExerciseWithUserState,
};

/// Records and grades one slide submission, having established that its answers may claim the
/// uploads they name.
///
/// Owns the transaction the ownership checks need: the unlocked check runs first, so a submit that
/// may not name its uploads costs no grading hop, and the locked re-check runs inside the
/// transaction that records the submission, before anything is written to it.
pub async fn process_submission(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: Exercise,
    submission: &StudentExerciseSlideSubmission,
    jwt_key: Arc<JwtKey>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> Result<StudentExerciseSlideSubmissionResult, ControllerError> {
    verify_named_uploads(conn, exercise.id, user_id, submission).await?;

    let mut tx = conn.begin().await?;
    if let Err(error) =
        lock_and_verify_named_uploads(&mut tx, exercise.id, user_id, submission).await
    {
        tx.rollback().await?;
        return Err(error);
    }
    let result = grade_submission(
        &mut tx, user_id, exercise, submission, jwt_key, file_store, app_conf,
    )
    .await;
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            // A failed grading hop discards its own writes and records a rejected submission
            // instead; committing is what keeps that audit row rather than rolling it back too.
            if let Err(commit_error) = tx.commit().await {
                error!("Failed to commit after a failed submission: {commit_error}");
            }
            return Err(error);
        }
    };
    tx.commit().await?;
    Ok(result)
}

/// Rejects a file-typed answer naming uploads this user did not make for this exercise, or naming
/// none at all.
///
/// Unlocked, so [`lock_and_verify_named_uploads`] must repeat it inside the submission transaction.
async fn verify_named_uploads(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    user_id: Uuid,
    submission: &StudentExerciseSlideSubmission,
) -> Result<(), ControllerError> {
    for task_submission in &submission.exercise_task_submissions {
        let SubmittedAnswer::File {
            file_upload_ids, ..
        } = &task_submission.answer
        else {
            continue;
        };
        answer_uploads::verify_answer_names_uploads(file_upload_ids)?;
        answer_uploads::verify_uploads_belong_to_exercise(
            conn,
            exercise_id,
            user_id,
            file_upload_ids,
        )
        .await?;
    }
    Ok(())
}

/// Re-checks the named uploads under the reaper's row lock, inside the transaction that records the
/// submission and before anything is written to it.
async fn lock_and_verify_named_uploads(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    exercise_id: Uuid,
    user_id: Uuid,
    submission: &StudentExerciseSlideSubmission,
) -> Result<(), ControllerError> {
    for task_submission in &submission.exercise_task_submissions {
        let SubmittedAnswer::File {
            file_upload_ids, ..
        } = &task_submission.answer
        else {
            continue;
        };
        answer_uploads::lock_and_verify_uploads_are_usable(
            tx,
            exercise_id,
            user_id,
            file_upload_ids,
        )
        .await?;
    }
    Ok(())
}

/// Grades one slide submission and trims the result down to what the submitter may see. Runs inside
/// [`process_submission`]'s transaction.
async fn grade_submission(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: Exercise,
    submission: &StudentExerciseSlideSubmission,
    jwt_key: Arc<JwtKey>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> Result<StudentExerciseSlideSubmissionResult, ControllerError> {
    enforce_deadline(conn, &exercise).await?;

    let (course_or_exam_id, last_try) = resolve_course_or_exam_id_and_verify_that_user_can_submit(
        conn,
        user_id,
        &exercise,
        submission.exercise_slide_id,
    )
    .await?;

    // TODO: Should this be an upsert?
    let user_exercise_state = models::user_exercise_states::get_user_exercise_state_if_exists(
        conn,
        user_id,
        exercise.id,
        course_or_exam_id,
    )
    .await?
    .ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::Unauthorized,
            "Missing exercise state.".to_string(),
            None,
        )
    })?;

    let mut exercise_with_user_state = ExerciseWithUserState::new(exercise, user_exercise_state)?;
    let mut result = models::library::grading::grade_user_submission(
        conn,
        &mut exercise_with_user_state,
        submission,
        GradingPolicy::Default,
        models_requests::fetch_service_info,
        models_requests::make_grading_request_sender(jwt_key, app_conf.base_url.clone()),
        file_store,
        app_conf,
    )
    .await?;

    if exercise_with_user_state.is_exam_exercise() {
        // If exam, we don't want to expose model any grading details.
        result.clear_grading_information();
    }

    let score_given = if let Some(exercise_status) = &result.exercise_status {
        exercise_status.score_given.unwrap_or(0.0)
    } else {
        0.0
    };

    // Model solution spec should only be shown when this is the last try for the current slide or they have gotten full points from the current slide.
    // TODO: this uses points for the whole exercise, change this to slide points when slide grading finalized
    let has_received_full_points = score_given
        >= exercise_with_user_state.exercise().score_maximum as f32
        || (score_given - exercise_with_user_state.exercise().score_maximum as f32).abs() < 0.0001;
    if !has_received_full_points && !last_try {
        result.clear_model_solution_specs();
    }
    Ok(result)
}

/// Returns an error if the chapter's or exercise's deadline has passed.
async fn enforce_deadline(
    conn: &mut PgConnection,
    exercise: &Exercise,
) -> Result<(), ControllerError> {
    let chapter_option_future: OptionFuture<_> = exercise
        .chapter_id
        .map(|id| models::chapters::get_chapter(conn, id))
        .into();
    let chapter = chapter_option_future.await.transpose()?;

    // Exercise deadlines takes precedence to chapter deadlines
    if let Some(deadline) = exercise
        .deadline
        .or_else(|| chapter.and_then(|c| c.deadline))
        && Utc::now() + Duration::seconds(1) >= deadline
    {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Exercise deadline passed.".to_string(),
            None,
        ));
    }

    Ok(())
}

/// Submissions for exams are posted from course instances or from exams. Make respective validations
/// while figuring out which.
async fn resolve_course_or_exam_id_and_verify_that_user_can_submit(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: &Exercise,
    slide_id: Uuid,
) -> Result<(CourseOrExamId, bool), ControllerError> {
    let mut last_try = false;
    let course_id_or_exam_id: CourseOrExamId = if let Some(course_id) = exercise.course_id {
        // If submitting for a course, there should be existing course settings that dictate which
        // instance the user is on.
        let settings = models::user_course_settings::get_user_course_settings_by_course_id(
            conn, user_id, course_id,
        )
        .await?;
        if let Some(settings) = settings {
            let token = authorize(conn, Act::View, Some(user_id), Res::Course(course_id)).await?;
            token.authorized_ok(CourseOrExamId::Course(settings.current_course_id))
        } else {
            Err(ControllerError::new(
                ControllerErrorType::Unauthorized,
                "User is not enrolled on this course.".to_string(),
                None,
            ))
        }
    } else if let Some(exam_id) = exercise.exam_id {
        // If submitting for an exam, make sure that user's time is not up.
        if models::exams::verify_exam_submission_can_be_made(conn, exam_id, user_id).await? {
            let token = authorize(conn, Act::View, Some(user_id), Res::Exam(exam_id)).await?;
            token.authorized_ok(CourseOrExamId::Exam(exam_id))
        } else {
            Err(ControllerError::new(
                ControllerErrorType::Unauthorized,
                "Submissions for this exam are no longer accepted.".to_string(),
                None,
            ))
        }
    } else {
        // On database level this scenario is impossible.
        Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Exam doesn't belong to either a course nor exam.".to_string(),
            None,
        ))
    }?
    .data;
    if exercise.limit_number_of_tries
        && let Some(max_tries_per_slide) = exercise.max_tries_per_slide
    {
        // check if the user has attempts remaining
        let slide_id_to_submissions_count =
                models::exercise_slide_submissions::get_exercise_slide_submission_counts_for_exercise_user(
                    conn,
                    exercise.id,
                    course_id_or_exam_id,
                    user_id,
                )
                .await?;

        let count = slide_id_to_submissions_count.get(&slide_id).unwrap_or(&0);
        if count >= &(max_tries_per_slide as i64) {
            tracing::error!(
                user_id = %user_id,
                exercise_id = %exercise.id,
                slide_id = %slide_id,
                course_or_exam_id = ?course_id_or_exam_id,
                current_try_count = %count,
                max_tries_per_slide = %max_tries_per_slide,
                limit_number_of_tries = %exercise.limit_number_of_tries,
                "User has run out of tries for exercise slide submission"
            );
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "You've ran out of tries.".to_string(),
                None,
            ));
        }
        if count + 1 >= (max_tries_per_slide as i64) {
            last_try = true;
        }
    }
    Ok((course_id_or_exam_id, last_try))
}

/// A submit with a file-typed answer: the checks that decide whether a student may claim the
/// uploads they name, and the rows a claim that passes leaves behind.
#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;
    use models::exercise_answer_uploads::AnswerUploadOrigin;
    use models::exercise_task_gradings::ExerciseTaskGradingResult;
    use models::exercise_task_submissions::{AnswerData, AnswerFile};
    use models::exercises::GradingProgress;
    use models::library::grading::StudentExerciseTaskSubmission;
    use sqlx::Connection;
    use std::sync::{Arc, Mutex};

    /// The ids one fixture course's submits are made against.
    struct Fixture {
        user: Uuid,
        course: Uuid,
        chapter: Uuid,
        page: Uuid,
        exercise: Uuid,
        slide: Uuid,
        task: Uuid,
    }

    /// Registers an exercise service under a slug of its own and a task of that type, so the
    /// grading hop lands on `internal_url` rather than on whatever another test registered.
    async fn insert_graded_task(
        conn: &mut PgConnection,
        slide: Uuid,
        internal_url: String,
    ) -> Uuid {
        let slug = format!("submit-test-{}", Uuid::new_v4());
        let service = models::exercise_services::insert_exercise_service(
            conn,
            &models::exercise_services::ExerciseServiceNewOrUpdate {
                name: slug.clone(),
                slug: slug.clone(),
                public_url: "http://example.com/api/service".to_string(),
                internal_url: Some(internal_url),
                max_reprocessing_submissions_at_once: 1,
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
                supports_native_client: false,
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

    /// Everything a submit needs beyond the ids: the enrollment and the `user_exercise_states` row
    /// with the answered slide selected, both written when a student opens the exercise.
    async fn enroll_and_open(
        conn: &mut PgConnection,
        user: Uuid,
        course: Uuid,
        instance: Uuid,
        exercise: Uuid,
        slide: Uuid,
    ) {
        models::course_instance_enrollments::insert_enrollment_and_set_as_current(
            conn,
            models::course_instance_enrollments::NewCourseInstanceEnrollment {
                course_id: course,
                user_id: user,
                course_instance_id: instance,
            },
        )
        .await
        .expect("enrollment");
        models::user_exercise_states::upsert_selected_exercise_slide_id(
            conn,
            user,
            exercise,
            Some(course),
            None,
            Some(slide),
        )
        .await
        .expect("exercise state");
    }

    /// A file the student uploaded for `exercise`, bound to them the way the IFrame upload route
    /// binds it.
    async fn bind_upload(conn: &mut PgConnection, exercise: Uuid, user: Uuid, name: &str) -> Uuid {
        let file_id = models::file_uploads::insert(
            conn,
            name,
            &format!("exercise-answer-uploads/{}", Uuid::new_v4()),
            "application/octet-stream",
            Some(user),
            Some(3),
        )
        .await
        .expect("file upload");
        models::exercise_answer_uploads::insert_many(
            conn,
            exercise,
            user,
            &[file_id],
            AnswerUploadOrigin::Iframe,
        )
        .await
        .expect("binding");
        file_id
    }

    fn file_answer(file_upload_ids: Vec<Uuid>) -> SubmittedAnswer {
        SubmittedAnswer::File {
            file_upload_ids,
            metadata: Some(serde_json::json!({ "plugin": "said so" })),
        }
    }

    async fn submit(
        conn: &mut PgConnection,
        fixture: &Fixture,
        answer: SubmittedAnswer,
        file_store: &dyn FileStore,
    ) -> Result<models::library::grading::StudentExerciseSlideSubmissionResult, ControllerError>
    {
        let exercise = models::exercises::get_by_id(conn, fixture.exercise)
            .await
            .expect("exercise");
        process_submission(
            conn,
            fixture.user,
            exercise,
            &StudentExerciseSlideSubmission {
                exercise_slide_id: fixture.slide,
                exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                    exercise_task_id: fixture.task,
                    answer,
                }],
            },
            Arc::new(crate::domain::models_requests::JwtKey::test_key()),
            file_store,
            &init_app_conf().expect("app conf"),
        )
        .await
    }

    /// Not a `query!`: `cargo sqlx prepare -- --lib` does not cache test-only queries.
    async fn slide_submission_count(conn: &mut PgConnection, exercise: Uuid, user: Uuid) -> i64 {
        sqlx::query_scalar(
            "SELECT count(*) FROM exercise_slide_submissions WHERE exercise_id = $1 AND user_id = $2 AND deleted_at IS NULL",
        )
        .bind(exercise)
        .bind(user)
        .fetch_one(conn)
        .await
        .expect("count")
    }

    async fn answer_kind_of(conn: &mut PgConnection, submission: Uuid) -> String {
        sqlx::query_scalar("SELECT answer_kind::text FROM exercise_task_submissions WHERE id = $1")
            .bind(submission)
            .fetch_one(conn)
            .await
            .expect("answer kind")
    }

    async fn recorded_files(conn: &mut PgConnection, submission: Uuid) -> Vec<(Uuid, i32)> {
        sqlx::query_as(
            "SELECT file_upload_id, order_number FROM exercise_task_submission_files WHERE exercise_task_submission_id = $1 AND deleted_at IS NULL ORDER BY order_number",
        )
        .bind(submission)
        .fetch_all(conn)
        .await
        .expect("submission files")
    }

    async fn binding_id_of(conn: &mut PgConnection, file_upload_id: Uuid) -> Uuid {
        sqlx::query_scalar("SELECT id FROM exercise_answer_uploads WHERE file_upload_id = $1")
            .bind(file_upload_id)
            .fetch_one(conn)
            .await
            .expect("binding id")
    }

    async fn reap(conn: &mut PgConnection, file_upload_id: Uuid) {
        sqlx::query(
            "UPDATE exercise_answer_uploads SET deleted_at = now() WHERE file_upload_id = $1",
        )
        .bind(file_upload_id)
        .execute(conn)
        .await
        .expect("reap");
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

    struct StubState {
        grade_requests: Mutex<Vec<serde_json::Value>>,
        /// When set, the grading hop waits for a permit before answering, holding the submission
        /// transaction — and therefore the upload's row lock — open for as long as the test wants.
        hold_grading: Option<Arc<tokio::sync::Semaphore>>,
    }

    async fn stub_grade(
        state: web::Data<StubState>,
        body: web::Json<serde_json::Value>,
    ) -> HttpResponse {
        state
            .grade_requests
            .lock()
            .expect("stub lock")
            .push(body.into_inner());
        if let Some(hold) = &state.hold_grading {
            hold.acquire().await.expect("hold permit").forget();
        }
        HttpResponse::Ok().json(stub_grading())
    }

    /// Serves the grading endpoint on a real socket and returns its base URL. HTTP rather than an
    /// in-process shortcut because the hop happens inside the submission transaction, which is what
    /// the reap race turns on.
    fn start_exercise_service_stub(state: Arc<StubState>) -> String {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().expect("local addr").port();
        let server = actix_web::HttpServer::new(move || {
            actix_web::App::new()
                .app_data(web::Data::from(state.clone()))
                .route("/grade", web::post().to(stub_grade))
        })
        .workers(1)
        .disable_signals()
        .listen(listener)
        .expect("listen")
        .run();
        actix_web::rt::spawn(server);
        format!("http://127.0.0.1:{port}")
    }

    /// A rejected submit must leave nothing behind: a check that ran after the insert would pass a
    /// status-only assertion while persisting the answer anyway.
    async fn assert_rejected_without_a_submission(
        conn: &mut PgConnection,
        fixture: &Fixture,
        answer: SubmittedAnswer,
        expected_message_key: &str,
    ) {
        let store = temp_file_store();
        let error = submit(conn, fixture, answer, &store)
            .await
            .expect_err("the submit must be rejected");
        assert_eq!(message_key_of(&error), expected_message_key);
        assert_eq!(
            slide_submission_count(conn, fixture.exercise, fixture.user).await,
            0
        );
    }

    macro_rules! fixture {
        ($tx:ident, $fixture:ident) => {
            fixture!($tx, $fixture, _state);
        };
        ($tx:ident, $fixture:ident, $state:ident) => {
            let $state = Arc::new(StubState {
                grade_requests: Mutex::new(Vec::new()),
                hold_grading: None,
            });
            let url = start_exercise_service_stub($state.clone());
            insert_data!(:$tx, user: user, :org, course: course, instance: instance, :course_module, chapter: chapter, page: page, exercise: exercise, slide: slide, task: _unservable);
            let task = insert_graded_task($tx.as_mut(), slide, url).await;
            enroll_and_open($tx.as_mut(), user, course, instance.id, exercise, slide).await;
            let $fixture = Fixture {
                user,
                course,
                chapter,
                page,
                exercise,
                slide,
                task,
            };
        };
    }

    #[actix_web::test]
    async fn naming_another_users_upload_is_rejected_and_creates_no_submission() {
        fixture!(tx, fixture);
        let stranger = models::users::insert(
            tx.as_mut(),
            models::PKeyPolicy::Generate,
            &format!("{}@example.com", Uuid::new_v4()),
            None,
            None,
        )
        .await
        .expect("stranger");
        let theirs = bind_upload(tx.as_mut(), fixture.exercise, stranger, "theirs.txt").await;

        assert_rejected_without_a_submission(
            tx.as_mut(),
            &fixture,
            file_answer(vec![theirs]),
            "unknown_upload",
        )
        .await;
        tx.rollback().await;
    }

    #[actix_web::test]
    async fn naming_another_exercises_upload_is_rejected_and_creates_no_submission() {
        fixture!(tx, fixture);
        let other_exercise = models::exercises::insert(
            tx.as_mut(),
            models::PKeyPolicy::Generate,
            fixture.course,
            "other",
            fixture.page,
            fixture.chapter,
            1,
        )
        .await
        .expect("second exercise");
        let elsewhere =
            bind_upload(tx.as_mut(), other_exercise, fixture.user, "elsewhere.txt").await;

        assert_rejected_without_a_submission(
            tx.as_mut(),
            &fixture,
            file_answer(vec![elsewhere]),
            "unknown_upload",
        )
        .await;
        tx.rollback().await;
    }

    #[actix_web::test]
    async fn naming_the_same_upload_twice_is_rejected() {
        fixture!(tx, fixture);
        let file = bind_upload(tx.as_mut(), fixture.exercise, fixture.user, "once.txt").await;

        assert_rejected_without_a_submission(
            tx.as_mut(),
            &fixture,
            file_answer(vec![file, file]),
            "duplicate_upload",
        )
        .await;
        tx.rollback().await;
    }

    /// A file answer naming nothing is malformed rather than empty: presence of the field is the
    /// discriminator, so the degenerate case has to be an error and not an ambiguity.
    #[actix_web::test]
    async fn a_file_answer_naming_no_files_is_refused() {
        use actix_web::ResponseError;
        use actix_web::http::StatusCode;
        fixture!(tx, fixture, state);
        let store = temp_file_store();

        let error = submit(tx.as_mut(), &fixture, file_answer(vec![]), &store)
            .await
            .expect_err("a file answer naming nothing must be refused");
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(
            slide_submission_count(tx.as_mut(), fixture.exercise, fixture.user).await,
            0
        );
        assert!(
            state.grade_requests.lock().expect("stub lock").is_empty(),
            "the answer must be refused at the edge, before the exercise service is asked anything"
        );
        tx.rollback().await;
    }

    #[actix_web::test]
    async fn naming_a_reaped_upload_is_rejected_as_expired() {
        fixture!(tx, fixture);
        let file = bind_upload(tx.as_mut(), fixture.exercise, fixture.user, "gone.txt").await;
        reap(tx.as_mut(), file).await;

        assert_rejected_without_a_submission(
            tx.as_mut(),
            &fixture,
            file_answer(vec![file]),
            "upload_expired",
        )
        .await;
        tx.rollback().await;
    }

    /// The happy path: the answer lands file-typed, the files land in the order the plugin named
    /// them rather than the order they were uploaded in, the plugin's metadata lands in `data_json`,
    /// and the result hands all of it back as `AnswerData::File`.
    #[actix_web::test]
    async fn a_legitimate_file_answer_lands_ordered_with_its_metadata() {
        fixture!(tx, fixture);
        let first = bind_upload(tx.as_mut(), fixture.exercise, fixture.user, "first.txt").await;
        let second = bind_upload(tx.as_mut(), fixture.exercise, fixture.user, "second.txt").await;
        let named = vec![second, first];
        let store = temp_file_store();

        let result = submit(tx.as_mut(), &fixture, file_answer(named.clone()), &store)
            .await
            .expect("the submit must be accepted");

        let submission = result
            .exercise_task_submission_results
            .into_iter()
            .next()
            .expect("one task submission")
            .submission;
        assert_eq!(answer_kind_of(tx.as_mut(), submission.id).await, "file");
        assert_eq!(
            recorded_files(tx.as_mut(), submission.id).await,
            vec![(second, 0), (first, 1)]
        );
        let AnswerData::File { files, metadata } =
            submission.answer.expect("the answer must be resolved")
        else {
            panic!("a file answer must come back as AnswerData::File");
        };
        assert_eq!(
            files.iter().map(|file| file.id).collect::<Vec<_>>(),
            named,
            "the plugin's order is the answer, not ours to sort"
        );
        assert_eq!(
            files
                .iter()
                .map(|file: &AnswerFile| file.name.as_str())
                .collect::<Vec<_>>(),
            vec!["second.txt", "first.txt"]
        );
        assert_eq!(metadata, Some(serde_json::json!({ "plugin": "said so" })));
        tx.rollback().await;
    }

    /// The reap-vs-submit race through this path, with two real connections. The reaper must block
    /// on the row lock the submit takes rather than deciding without it, and must then observe the
    /// association the submit committed while it waited.
    ///
    /// The grading hop is what holds the transaction open here: it runs inside it, so a stub that
    /// answers only when told reproduces the window without any sleeping.
    #[actix_web::test]
    async fn a_concurrent_reaper_blocks_on_the_submit_lock_and_then_declines_to_reap() {
        let hold = Arc::new(tokio::sync::Semaphore::new(0));
        let state = Arc::new(StubState {
            grade_requests: Mutex::new(Vec::new()),
            hold_grading: Some(hold.clone()),
        });
        let url = start_exercise_service_stub(state.clone());

        // Committed so the reaper's connection can see them. An IFrame upload's retention window is
        // seven days, so nothing this leaves behind is visible to `get_reapable`.
        insert_data!(:tx, user: user, :org, course: course, instance: instance, :course_module, chapter: chapter, page: page, exercise: exercise, slide: slide, task: _unservable);
        let task = insert_graded_task(tx.as_mut(), slide, url).await;
        enroll_and_open(tx.as_mut(), user, course, instance.id, exercise, slide).await;
        let file = bind_upload(tx.as_mut(), exercise, user, "raced.txt").await;
        let binding = binding_id_of(tx.as_mut(), file).await;
        tx.commit().await;

        let fixture = Fixture {
            user,
            course,
            chapter,
            page,
            exercise,
            slide,
            task,
        };
        let submitting = actix_web::rt::spawn(async move {
            let mut conn = PgConnection::connect(&test_database_url())
                .await
                .expect("submit connection");
            let store = temp_file_store();
            submit(&mut conn, &fixture, file_answer(vec![file]), &store)
                .await
                .map(|result| {
                    result
                        .exercise_task_submission_results
                        .into_iter()
                        .next()
                        .expect("one task submission")
                        .submission
                        .id
                })
        });

        // The grading request proves the submit is inside its transaction, past the lock.
        for _ in 0..100 {
            if !state.grade_requests.lock().expect("stub lock").is_empty() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        assert_eq!(
            state.grade_requests.lock().expect("stub lock").len(),
            1,
            "the submit must reach the grading hop, which is what holds its transaction open"
        );

        let mut reaper_conn = PgConnection::connect(&test_database_url())
            .await
            .expect("reaper connection");
        // Scoped so the pinned future releases its borrow before the connection is dropped.
        let outcome = {
            let mut reaping = std::pin::pin!(models::exercise_answer_uploads::mark_reaped(
                &mut reaper_conn,
                binding
            ));
            assert!(
                tokio::time::timeout(std::time::Duration::from_millis(500), &mut reaping)
                    .await
                    .is_err(),
                "the reaper must block on the row lock the submit holds, not decide without it"
            );

            hold.add_permits(1);
            let submission = submitting
                .await
                .expect("the submit task must not panic")
                .expect("the submit must be accepted");

            let reaped = tokio::time::timeout(std::time::Duration::from_secs(10), &mut reaping)
                .await
                .expect("the reaper must unblock once the submit commits")
                .expect("mark_reaped");
            (reaped, submission)
        };
        let (reaped, submission) = outcome;
        assert!(
            !reaped,
            "the reaper must decline an upload the submit referenced while it waited"
        );

        let mut check_conn = Conn::init().await;
        let mut check_tx = check_conn.begin().await;
        assert_eq!(
            recorded_files(check_tx.as_mut(), submission).await,
            vec![(file, 0)],
            "the submission must keep the file the reaper tried to take"
        );
        assert_eq!(
            models::exercise_answer_uploads::get_for_exercise_and_user(
                check_tx.as_mut(),
                exercise,
                user,
                &[file]
            )
            .await
            .expect("binding lookup"),
            vec![models::exercise_answer_uploads::AnswerUpload {
                file_upload_id: file,
                deleted: false
            }],
            "the upload must stay usable, so a download can still serve it"
        );
        check_tx.rollback().await;
    }
}
