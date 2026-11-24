use super::*;

/**
 * POST /api/v0/exercise-services/client/exercises/:id/files
 *
 * Stores files for a later submission to this exercise. Every multipart field name must be a
 * UUID the client picks; the host assigns the ids a submit request then names. Uploads are
 * bound to this exercise and user, and unreferenced ones are reaped, so a client should upload
 * immediately before submitting.
 *
 * Gated on the caller being able to answer the exercise at all, so stored objects cannot be
 * accumulated past a deadline or a closed exam. The per-slide try limit is only checked across the
 * whole exercise here, because this route is bound to an exercise rather than a slide. Files for a
 * snapshot (`?for=snapshot`) skip the deadline, try-limit and chapter-lock checks, as the
 * snapshot route does.
 */
#[utoipa::path(
    post,
    path = "/exercises/{id}/files",
    operation_id = "uploadClientExerciseFiles",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise id"),
        UploadQuery,
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    request_body(
        content = String,
        content_type = "multipart/form-data",
        description = "One file part per file, each field name a distinct client-chosen UUID and each part carrying a file name"
    ),
    responses(
        (status = 200, description = "The stored files, in the order the parts were sent", body = api::UploadedFiles),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`), the user may not view this exercise (`no_access`), its chapter has not opened yet (`chapter_not_open_yet`), chapter locking keeps it closed (`chapter_not_unlocked_yet`, `chapter_completed_and_locked`), or the exercise is locked for the user (`exercise_locked`); neither lock is checked for `?for=snapshot`", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user is not enrolled to this exercise's course, or for `?for=snapshot` never was (message_key `not_enrolled`), the exercise can no longer be answered because its deadline has passed (`deadline_passed`) or every slide is out of tries (`out_of_tries`) (neither checked for `?for=snapshot`), or the multipart body violates the field-name, file-count or size rules", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse),
        (status = 429, description = "The user has uploaded too many files recently (message_key `rate_limited`)", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[allow(clippy::too_many_arguments)]
#[instrument(skip(pool, file_store, payload, app_conf))]
pub(super) async fn upload_exercise_files(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    exercise_id: web::Path<Uuid>,
    query: web::Query<UploadQuery>,
    payload: Multipart,
    user: UserFromOAuthToken,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::UploadedFiles>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await
    .map_err(keyed_no_access)?;

    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let is_for_snapshot = query.r#for == Some(UploadFor::Snapshot);
    let owner = verify_can_answer(&mut conn, user.id, &exercise, is_for_snapshot).await?;
    if !is_for_snapshot {
        domain::exercises::verify_user_can_answer_exercise(&mut conn, user.id, &exercise).await?;
    }
    check_user_quota(&UPLOAD_LIMITS, user.id)?;

    let mut cleanup = file_uploading::UploadCleanup::new(file_store.clone());
    let stored = store_client_uploads(
        &mut conn,
        &file_uploading::AnswerUploadDestination {
            owner,
            exercise_id: exercise.id,
            user_id: user.id,
        },
        payload,
        file_store.as_ref(),
        &mut cleanup.uploaded_paths,
        &app_conf,
    )
    .await;
    let uploads = match stored {
        Ok(uploads) => uploads,
        Err(error) => {
            // A commit failure inside `store_client_uploads` surfaces here too: up to 100 MiB is
            // already in the store with no `file_uploads` row, so nothing the reaper can find.
            cleanup.clean_up().await;
            return Err(error);
        }
    };
    cleanup.disarm();

    let data_files = uploads
        .into_iter()
        .map(|upload| api::AnswerFile {
            id: upload.entry.id,
            name: upload.name,
            mime: upload.mime,
            size_bytes: Some(upload.size_bytes),
            // These files are not part of an answer yet; a submit decides their order.
            order_number: None,
            url: upload.entry.url,
        })
        .collect();
    token.authorized_ok(web::Json(api::UploadedFiles { data_files }))
}

/// What the uploaded files will be named in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub(super) enum UploadFor {
    Submission,
    Snapshot,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub(super) struct UploadQuery {
    /// `snapshot` for files a `snapshots` request will name; absent means a submission's.
    #[param(inline)]
    r#for: Option<UploadFor>,
}

/// Stores the multipart parts and binds them to the exercise and user, so that a failure to
/// record the binding cannot leave uploads the reaper is unable to find.
///
/// The transaction opens only after the last byte has been streamed: the multipart body has no
/// time limit, so opening it first would pin a pool connection `idle in transaction` for the whole
/// upload.
pub(super) async fn store_client_uploads(
    conn: &mut PgConnection,
    destination: &file_uploading::AnswerUploadDestination,
    payload: Multipart,
    file_store: &dyn FileStore,
    uploaded_paths: &mut Vec<file_uploading::ExerciseServiceUploadCleanup>,
    app_conf: &ApplicationConfiguration,
) -> Result<Vec<file_uploading::ExerciseServiceUpload>, ControllerError> {
    let streamed = file_uploading::stream_exercise_service_upload(
        file_uploading::UploadPathScheme::Answer(destination),
        payload,
        file_store,
        uploaded_paths,
        app_conf,
    )
    .await?;

    let mut tx = conn.begin().await?;
    let uploads = file_uploading::record_exercise_service_upload(
        &mut tx,
        streamed,
        Some(destination.user_id),
    )
    .await?;
    let file_upload_ids: Vec<Uuid> = uploads.iter().map(|u| u.entry.id).collect();
    models::exercise_answer_uploads::insert_many(
        &mut tx,
        destination.exercise_id,
        destination.user_id,
        &file_upload_ids,
        models::exercise_answer_uploads::AnswerUploadOrigin::NativeClient,
    )
    .await?;
    tx.commit().await?;
    Ok(uploads)
}

/**
 * POST /api/v0/exercise-services/client/exercises/:id/submit
 *
 * Accepts an exercise submission from the user. A `file` answer names files previously stored
 * through this exercise's `files` endpoint, in the order they are to be graded; those files are the
 * answer. An answer that names no files is a JSON answer, carried in `data_json`.
 */
#[utoipa::path(
    post,
    path = "/exercises/{id}/submit",
    operation_id = "submitClientExercise",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    request_body(content = api::ExerciseSlideSubmission, description = "The slide and task being answered, and the answer: its JSON, the ids of the files it consists of, or both"),
    responses(
        (status = 200, description = "The created submission, identified by both its task and slide submission ids", body = api::ExerciseTaskSubmissionResult),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`), the user may not view this exercise (`no_access`), its chapter has not opened yet (`chapter_not_open_yet`), chapter locking keeps it closed (`chapter_not_unlocked_yet`, `chapter_completed_and_locked`), or the exercise is locked for the user (`exercise_locked`, see `ExerciseProgress.exercise_locked`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists, or the referenced slide/task does not exist", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user is not enrolled to this exercise's course (message_key `not_enrolled`), its deadline has passed (`deadline_passed`), the slide is out of tries (`out_of_tries`), the referenced slide/task belongs to another exercise, the task's exercise service or another task's on the slide cannot be served to this client, a `file` answer names no files or a `json` one names files, or a named upload was reaped (`upload_expired`), was never uploaded for this exercise by this user (`unknown_upload`) or was named more than once (`duplicate_upload`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse),
        (status = 429, description = "The user has submitted too many times recently (message_key `rate_limited`)", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[allow(clippy::too_many_arguments)]
pub(super) async fn submit_exercise(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    jwt_key: web::Data<JwtKey>,
    exercise_id: web::Path<Uuid>,
    submission: web::Json<api::ExerciseSlideSubmission>,
    user: UserFromOAuthToken,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::ExerciseTaskSubmissionResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await
    .map_err(keyed_no_access)?;

    let submission = submission.into_inner();
    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    verify_can_answer(&mut conn, user.id, &exercise, false).await?;
    let exercise_slide =
        models::exercise_slides::get_exercise_slide(&mut conn, submission.exercise_slide_id)
            .await?;
    let exercise_task =
        models::exercise_tasks::get_exercise_task_by_id(&mut conn, submission.exercise_task_id)
            .await?;

    verify_slide_and_task_belong(
        exercise.id,
        exercise_slide.id,
        exercise_slide.exercise_id,
        exercise_task.id,
        exercise_task.exercise_slide_id,
    )?;
    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    verify_task_is_client_capable(
        exercise_task.id,
        &exercise_task.exercise_type,
        &capable_slugs,
    )?;
    verify_slide_is_client_answerable(&mut conn, exercise_slide.id, &capable_slugs).await?;
    check_user_quota(&SUBMIT_LIMITS, user.id)?;

    let result = domain::exercises::process_submission(
        &mut conn,
        user.id,
        exercise,
        &StudentExerciseSlideSubmission {
            exercise_slide_id: submission.exercise_slide_id,
            exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                exercise_task_id: submission.exercise_task_id,
                answer_kind: submission.answer_kind.map(model_answer_kind),
                data_json: submission.data_json,
                data_files: submission.data_files,
            }],
        },
        jwt_key.into_inner(),
        file_store.as_ref(),
        app_conf.as_ref(),
    )
    .await?;

    // one task submission in, so exactly one result out
    let task_submission = result
        .exercise_task_submission_results
        .into_iter()
        .next()
        .ok_or_else(|| {
            controller_err!(
                InternalServerError,
                "Failed to find exercise task submission id".to_string()
            )
        })?;

    token.authorized_ok(web::Json(api::ExerciseTaskSubmissionResult {
        task_submission_id: task_submission.submission.id,
        slide_submission_id: task_submission.submission.exercise_slide_submission_id,
    }))
}

/**
 * POST /api/v0/exercise-services/client/exercises/:id/snapshots
 *
 * Stores an ungraded copy of an answer: a paste to share, or a backup kept before local changes are
 * discarded. A snapshot uses no try, awards no points and is never graded, so it is accepted after
 * the deadline and when out of tries. Its files come from this exercise's `files` endpoint,
 * uploaded with `?for=snapshot`.
 */
#[utoipa::path(
    post,
    path = "/exercises/{id}/snapshots",
    operation_id = "createClientAnswerSnapshot",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    request_body(content = api::NewAnswerSnapshot, description = "Why the snapshot is stored, the slide and task it is for, and the files it consists of"),
    responses(
        (status = 200, description = "The stored snapshot's id", body = api::AnswerSnapshotResult),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`), the user may not view this exercise (`no_access`), or its chapter has not opened yet (`chapter_not_open_yet`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists, the exercise belongs to an exam, or the referenced slide/task does not exist", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user never enrolled on this exercise's course (message_key `not_enrolled`), the referenced slide/task belongs to another exercise, the task's exercise service cannot be served to this client, no files are named, or a named upload was reaped (`upload_expired`), was never uploaded for this exercise by this user (`unknown_upload`) or was named more than once (`duplicate_upload`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse),
        (status = 429, description = "Too many pastes of this exercise by this user recently", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, snapshot))]
pub(super) async fn create_answer_snapshot(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    snapshot: web::Json<api::NewAnswerSnapshot>,
    user: UserFromOAuthToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::AnswerSnapshotResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await
    .map_err(keyed_no_access)?;

    let snapshot = snapshot.into_inner();
    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let Some(course_id) = exercise.course_id else {
        return Err(controller_err!(
            NotFound,
            "This exercise belongs to an exam, which the client API does not serve".to_string()
        ));
    };
    verify_was_enrolled(&mut conn, user.id, course_id).await?;
    authorize_access_to_exercise_chapter(&mut conn, user.id, course_id, exercise.chapter_id)
        .await?;
    let exercise_slide =
        models::exercise_slides::get_exercise_slide(&mut conn, snapshot.exercise_slide_id).await?;
    let exercise_task =
        models::exercise_tasks::get_exercise_task_by_id(&mut conn, snapshot.exercise_task_id)
            .await?;
    verify_slide_and_task_belong(
        exercise.id,
        exercise_slide.id,
        exercise_slide.exercise_id,
        exercise_task.id,
        exercise_task.exercise_slide_id,
    )?;
    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    verify_task_is_client_capable(
        exercise_task.id,
        &exercise_task.exercise_type,
        &capable_slugs,
    )?;

    let stored = domain::exercise_services::answer_snapshots::store_snapshot(
        &mut conn,
        domain::exercise_services::answer_snapshots::SnapshotAnswer {
            user_id: user.id,
            course_id,
            exercise_id: exercise.id,
            exercise_slide_id: exercise_slide.id,
            exercise_task_id: exercise_task.id,
            purpose: model_snapshot_purpose(snapshot.purpose),
            data_json: snapshot.data_json,
            file_upload_ids: snapshot.data_files,
        },
    )
    .await?;

    token.authorized_ok(web::Json(api::AnswerSnapshotResult {
        snapshot_id: stored.id,
    }))
}

/// The client API's snapshot purpose as the models crate stores it.
pub(super) fn model_snapshot_purpose(purpose: api::SnapshotPurpose) -> SnapshotPurpose {
    match purpose {
        api::SnapshotPurpose::Paste => SnapshotPurpose::Paste,
        api::SnapshotPurpose::Backup => SnapshotPurpose::Backup,
    }
}

/**
 * GET /api/v0/exercise-services/client/submissions/:id/grading
 *
 * Returns the grading status of the given submission.
 */
#[utoipa::path(
    get,
    path = "/submissions/{id}/grading",
    operation_id = "getClientSubmissionGrading",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Submission id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The grading status of the submission; `GradingHidden` while the submission's exam can still be answered, and always in a manually graded exam", body = api::ExerciseTaskSubmissionStatus),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "Cannot view another user's submission grading (message_key `no_access`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No submission with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
pub(super) async fn get_submission_grading(
    pool: web::Data<PgPool>,
    submission_id: web::Path<Uuid>,
    user: UserFromOAuthToken,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::ExerciseTaskSubmissionStatus>> {
    let mut conn = pool.acquire().await?;
    let submission = models::exercise_task_submissions::get_by_id(
        &mut conn,
        *submission_id,
        file_store.as_ref(),
        app_conf.as_ref(),
    )
    .await?;
    let slide_submission = models::exercise_slide_submissions::get_by_id(
        &mut conn,
        submission.exercise_slide_submission_id,
    )
    .await?;
    verify_submission_owner(
        slide_submission.user_id,
        user.id,
        "Cannot view another user's submission grading".to_string(),
    )?;
    let token = skip_authorize();
    if let Some(exam_id) = slide_submission.exam_id
        && exam_hides_gradings(&mut conn, exam_id, user.id).await?
    {
        return token.authorized_ok(web::Json(api::ExerciseTaskSubmissionStatus::GradingHidden));
    }

    let grading = models::exercise_task_gradings::get_by_exercise_task_submission_id(
        &mut conn,
        *submission_id,
    )
    .await?;
    let Some(grading) = grading else {
        return token.authorized_ok(web::Json(api::ExerciseTaskSubmissionStatus::NoGradingYet));
    };
    let (exercise_progress, submission_page_url) = match slide_submission.course_id {
        Some(course_id) => {
            let exercise =
                models::exercises::get_by_id(&mut conn, slide_submission.exercise_id).await?;
            let course = models::courses::get_course(&mut conn, course_id).await?;
            let state = models::user_exercise_states::get_user_exercise_state_if_exists(
                &mut conn,
                user.id,
                exercise.id,
                CourseOrExamId::Course(course_id),
            )
            .await?;
            let organization =
                models::organizations::get_organization(&mut conn, course.organization_id).await?;
            let page = models::pages::get_page(&mut conn, exercise.page_id).await?;
            // The course material scrolls to the element named by the exercise id.
            let submission_page_url = course_page_url(
                &app_conf.base_url,
                &organization.slug,
                &course.slug,
                &page.url_path,
            )
            .map(|url| format!("{url}#{}", exercise.id));
            (
                Some(Box::new(
                    exercise_progress(&mut conn, user.id, &exercise, &course, state.as_ref())
                        .await?,
                )),
                submission_page_url,
            )
        }
        None => (None, None),
    };
    token.authorized_ok(web::Json(api::ExerciseTaskSubmissionStatus::Grading {
        grading_progress: map_grading_progress(grading.grading_progress),
        score_given: grading.score_given,
        grading_started_at: grading.grading_started_at,
        grading_completed_at: grading.grading_completed_at,
        feedback_json: grading.feedback_json,
        feedback_text: grading.feedback_text,
        exercise_progress,
        submission_page_url,
    }))
}

/// Maps the internal grading-progress enum to the exercise-services-api one.
pub(super) fn map_grading_progress(progress: GradingProgress) -> api::GradingProgress {
    match progress {
        GradingProgress::Failed => api::GradingProgress::Failed,
        GradingProgress::NotReady => api::GradingProgress::NotReady,
        GradingProgress::PendingManual => api::GradingProgress::PendingManual,
        GradingProgress::Pending => api::GradingProgress::Pending,
        GradingProgress::FullyGraded => api::GradingProgress::FullyGraded,
    }
}

/**
 * GET /api/v0/exercise-services/client/exercises/:id/submissions
 *
 * Returns the current user's past submissions and snapshots of the given exercise, newest first,
 * each annotated with what it is, its grading score and progress if graded, and whether it has a
 * live share link.
 */
#[utoipa::path(
    get,
    path = "/exercises/{id}/submissions",
    operation_id = "getClientExerciseSubmissions",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The current user's submissions and snapshots of the exercise, newest first; without scores while the exercise's exam can still be answered, and always in a manually graded exam", body = Vec<api::ExerciseSlideSubmissionListItem>),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
pub(super) async fn get_exercise_submissions(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: UserFromOAuthToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::ExerciseSlideSubmissionListItem>>> {
    let mut conn = pool.acquire().await?;
    // The query is scoped to the current user, so no further authorization is needed.
    let token = skip_authorize();
    let grading_is_hidden = match models::exercises::get_by_id(&mut conn, *exercise_id)
        .await?
        .exam_id
    {
        Some(exam_id) => exam_hides_gradings(&mut conn, exam_id, user.id).await?,
        None => false,
    };

    // One query for the whole listing, gradings joined in: an editor slide has a single task, so
    // its grading is the slide's grading.
    let submissions =
        models::exercise_slide_submissions::get_users_submissions_for_exercise_with_gradings(
            &mut conn,
            user.id,
            *exercise_id,
        )
        .await?;

    let snapshots = models::exercise_answer_snapshots::get_by_user_and_exercise(
        &mut conn,
        user.id,
        *exercise_id,
    )
    .await?;

    let listed_ids: Vec<Uuid> = submissions
        .iter()
        .map(|submission| submission.id)
        .chain(snapshots.iter().map(|snapshot| snapshot.id))
        .collect();
    let shared_ids =
        models::exercise_slide_submission_shares::shared_among(&mut conn, user.id, &listed_ids)
            .await?;

    let mut items = submission_list_items(submissions, snapshots, &shared_ids);
    if grading_is_hidden {
        for item in &mut items {
            item.score_given = None;
            item.grading_progress = None;
        }
    }
    token.authorized_ok(web::Json(items))
}

/// Submissions and snapshots in one list, newest first.
pub(super) fn submission_list_items(
    submissions: Vec<UserExerciseSlideSubmissionWithGrading>,
    snapshots: Vec<ExerciseAnswerSnapshot>,
    shared_ids: &HashSet<Uuid>,
) -> Vec<api::ExerciseSlideSubmissionListItem> {
    let submissions =
        submissions
            .into_iter()
            .map(|submission| api::ExerciseSlideSubmissionListItem {
                id: submission.id,
                exercise_id: submission.exercise_id,
                created_at: submission.created_at,
                score_given: submission.score_given,
                grading_progress: submission.grading_progress.map(map_grading_progress),
                kind: api::SubmissionKind::Submission,
                is_shared: shared_ids.contains(&submission.id),
            });
    let snapshots = snapshots
        .into_iter()
        .map(|snapshot| api::ExerciseSlideSubmissionListItem {
            id: snapshot.id,
            exercise_id: snapshot.exercise_id,
            created_at: snapshot.created_at,
            score_given: None,
            grading_progress: None,
            kind: match snapshot.purpose {
                SnapshotPurpose::Paste => api::SubmissionKind::Paste,
                SnapshotPurpose::Backup => api::SubmissionKind::Backup,
            },
            is_shared: shared_ids.contains(&snapshot.id),
        });
    let mut items: Vec<_> = submissions.chain(snapshots).collect();
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at).then(b.id.cmp(&a.id)));
    items
}

/**
 * GET /api/v0/exercise-services/client/submissions/:id/download
 *
 * Resolves an exercise-slide submission (by the id returned from the submissions list, or by
 * a submit's `slide_submission_id`) or a snapshot (by its `snapshot_id`) to the files it was made
 * from, so the client can restore it.
 */
#[utoipa::path(
    get,
    path = "/submissions/{id}/download",
    operation_id = "downloadClientSubmission",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise-slide-submission or snapshot id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The files the submission or snapshot was made from, in the order they were recorded; the same shape whether the submission came from a native client or the service's IFrame", body = api::SubmissionFiles),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "Cannot download another user's submission (message_key `no_access`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No submission with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
pub(super) async fn download_submission(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    submission_id: web::Path<Uuid>,
    user: UserFromOAuthToken,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::SubmissionFiles>> {
    let mut conn = pool.acquire().await?;
    if let Some(snapshot) =
        models::exercise_answer_snapshots::try_get_by_id(&mut conn, *submission_id).await?
    {
        verify_submission_owner(
            snapshot.user_id,
            user.id,
            "Cannot download another user's submission".to_string(),
        )?;
        let token = skip_authorize();
        let files = models::exercise_answer_snapshots::get_files(&mut conn, snapshot.id).await?;
        return token.authorized_ok(web::Json(submission_files_response(
            files,
            file_store.as_ref(),
            app_conf.as_ref(),
        )?));
    }
    let slide_submission =
        models::exercise_slide_submissions::get_by_id(&mut conn, *submission_id).await?;
    verify_submission_owner(
        slide_submission.user_id,
        user.id,
        "Cannot download another user's submission".to_string(),
    )?;
    let token = skip_authorize();

    let task_submissions = models::exercise_task_submissions::get_by_exercise_slide_submission_id(
        &mut conn,
        *submission_id,
        file_store.as_ref(),
        app_conf.as_ref(),
    )
    .await?;
    // Resolved from the host's own file records, never from the exercise service's answer: the
    // answer is an opaque plugin-owned blob and reading it would tie this endpoint to one plugin's
    // shape. Both native-client and IFrame-made file answers are recorded here at submit time, so
    // both origins are served by this one read.
    let task_submission_ids: Vec<Uuid> = task_submissions.iter().map(|ts| ts.id).collect();
    let files = models::exercise_task_submission_files::get_by_task_submission_ids(
        &mut conn,
        &task_submission_ids,
    )
    .await?;

    token.authorized_ok(web::Json(submission_files_response(
        files,
        file_store.as_ref(),
        app_conf.as_ref(),
    )?))
}

/// The client API's answer kind as the model's. Two enums rather than one because the client crate
/// stays free of server-internal dependencies.
pub(super) fn model_answer_kind(kind: api::AnswerKind) -> AnswerKind {
    match kind {
        api::AnswerKind::Json => AnswerKind::Json,
        api::AnswerKind::File => AnswerKind::File,
    }
}

/// One host-recorded file of a submission or snapshot.
pub(super) struct StoredAnswerFile {
    file_upload_id: Uuid,
    name: String,
    mime: String,
    size_bytes: Option<i64>,
    order_number: i32,
}

impl From<models::exercise_task_submission_files::SubmissionFile> for StoredAnswerFile {
    fn from(file: models::exercise_task_submission_files::SubmissionFile) -> Self {
        Self {
            file_upload_id: file.file_upload_id,
            name: file.name,
            mime: file.mime,
            size_bytes: file.size_bytes,
            order_number: file.order_number,
        }
    }
}

impl From<models::exercise_answer_snapshots::SnapshotFile> for StoredAnswerFile {
    fn from(file: models::exercise_answer_snapshots::SnapshotFile) -> Self {
        Self {
            file_upload_id: file.file_upload_id,
            name: file.name,
            mime: file.mime,
            size_bytes: file.size_bytes,
            order_number: file.order_number,
        }
    }
}

/// Turns the host's own file records into the download response. Every tracked file is reachable,
/// not just the first, so a multi-file submission is fully restorable.
pub(super) fn submission_files_response(
    files: Vec<impl Into<StoredAnswerFile>>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> UtilResult<api::SubmissionFiles> {
    Ok(api::SubmissionFiles {
        data_files: files
            .into_iter()
            .map(Into::into)
            .map(|file: StoredAnswerFile| {
                Ok(api::AnswerFile {
                    id: file.file_upload_id,
                    name: file.name,
                    mime: file.mime,
                    size_bytes: file.size_bytes,
                    order_number: Some(file.order_number),
                    url: file_store.get_claimed_download_url(file.file_upload_id, app_conf)?,
                })
            })
            .collect::<UtilResult<_>>()?,
    })
}

/**
 * POST /api/v0/exercise-services/client/submissions/:id/share
 *
 * Mints a shareable link to an existing submission or paste of the current user and returns
 * its URL. A paste is a share of a `paste` snapshot.
 */
#[utoipa::path(
    post,
    path = "/submissions/{id}/share",
    operation_id = "shareClientSubmission",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise-slide-submission or paste snapshot id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The shareable URL for the submission or paste", body = api::PasteResult),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "Cannot share another user's submission (message_key `no_access`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No submission with the given id exists, or it belongs to an exam", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The id is a backup, which cannot be shared (message_key `backup_not_shareable`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, app_conf))]
pub(super) async fn share_submission(
    pool: web::Data<PgPool>,
    submission_id: web::Path<Uuid>,
    user: UserFromOAuthToken,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::PasteResult>> {
    let mut conn = pool.acquire().await?;
    let share = if let Some(snapshot) =
        models::exercise_answer_snapshots::try_get_by_id(&mut conn, *submission_id).await?
    {
        verify_submission_owner(
            snapshot.user_id,
            user.id,
            "Cannot share another user's submission".to_string(),
        )?;
        // Backups are pruned past the cap, which would break their links, and are not rate limited.
        if snapshot.purpose != SnapshotPurpose::Paste {
            return Err(bad_request_with_reason(
                BadRequestReason::BackupNotShareable,
                "Only a paste can be shared, not a backup.".to_string(),
            ));
        }
        domain::exercise_services::submission_sharing::share_snapshot(
            &mut conn,
            snapshot.id,
            user.id,
        )
        .await?
    } else {
        let slide_submission =
            models::exercise_slide_submissions::get_by_id(&mut conn, *submission_id).await?;
        verify_submission_owner(
            slide_submission.user_id,
            user.id,
            "Cannot share another user's submission".to_string(),
        )?;
        verify_not_exam_submission(&slide_submission)?;
        domain::exercise_services::submission_sharing::share_submission(
            &mut conn,
            *submission_id,
            user.id,
        )
        .await?
    };
    let token = skip_authorize();
    let paste_url = format!(
        "{}/shared-submissions/{}",
        app_conf.base_url.trim_end_matches('/'),
        share.id
    );

    token.authorized_ok(web::Json(api::PasteResult { paste_url }))
}
