use super::*;

/// The exam as the client is told it, when the user has started it and can still answer it.
pub(super) async fn answerable_exam(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
) -> Result<Option<api::Exam>, ControllerError> {
    let Some(enrollment) = models::exams::get_enrollment(conn, exam_id, user_id).await? else {
        return Ok(None);
    };
    if !models::exams::verify_exam_submission_can_be_made(conn, exam_id, user_id).await? {
        return Ok(None);
    }
    let exam = models::exams::get(conn, exam_id).await?;
    let time_ends_at = enrollment.started_at + chrono::Duration::minutes(exam.time_minutes.into());
    Ok(Some(api::Exam {
        id: exam.id,
        name: exam.name,
        started_at: enrollment.started_at,
        answerable_until: exam
            .ends_at
            .map_or(time_ends_at, |ends_at| ends_at.min(time_ends_at)),
    }))
}

/// [`answerable_exam`], answering an exam the user cannot answer now as not found, as the exam view
/// shows nothing of it either.
pub(super) async fn answerable_exam_or_not_found(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
) -> Result<api::Exam, ControllerError> {
    answerable_exam(conn, exam_id, user_id)
        .await?
        .ok_or_else(|| {
            controller_err!(
                NotFound,
                "This exercise belongs to an exam the user has not started or can no longer answer"
                    .to_string()
            )
        })
}

/// The user's slide of an exam exercise, or `None` when the slide has a task this client cannot
/// answer. Exams reveal no model solutions.
pub(super) async fn exam_exercise_slide(
    conn: &mut PgConnection,
    user_id: Uuid,
    exam: &api::Exam,
    exercise: models::exercises::Exercise,
    capable_slugs: &[String],
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> Result<Option<api::ExerciseSlide>, ControllerError> {
    let (slide, _) = models::exercises::get_or_select_exercise_slide(
        conn,
        Some(user_id),
        &exercise,
        models_requests::fetch_service_info,
        file_store,
        app_conf,
    )
    .await?;
    let tasks = client_tasks_from_slide(slide.exercise_tasks, capable_slugs, false);
    if tasks.is_empty() {
        return Ok(None);
    }
    Ok(Some(api::ExerciseSlide {
        slide_id: slide.id,
        exercise_id: exercise.id,
        course_id: Uuid::nil(),
        exam_id: Some(exam.id),
        exercise_name: exercise.name,
        exercise_order_number: exercise.order_number,
        deadline: Some(exam.answerable_until),
        tasks,
        page_url: None,
        chapter: None,
    }))
}

/**
 * GET /api/v0/exercise-services/client/exams
 *
 * Returns the exams the user has started and can still answer that contain exercises this client
 * can be served.
 */
#[utoipa::path(
    get,
    path = "/exams",
    operation_id = "getClientExams",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The user's answerable exams with client-servable exercises", body = Vec<api::Exam>),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
pub(super) async fn get_exams(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::Exam>>> {
    let mut conn = pool.acquire().await?;
    // Only the user's own enrollments are read.
    let token = skip_authorize();
    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    let mut exams = Vec::new();
    for exam_id in
        models::exams::get_unfinished_enrollment_exam_ids_for_user(&mut conn, user.id).await?
    {
        let Some(exam) = answerable_exam(&mut conn, exam_id, user.id).await? else {
            continue;
        };
        let exercise_ids: Vec<Uuid> =
            models::exercises::get_exercises_by_exam_id(&mut conn, exam_id)
                .await?
                .into_iter()
                .map(|exercise| exercise.id)
                .collect();
        if !client_capable_exercise_ids(&mut conn, &exercise_ids, &capable_slugs)
            .await?
            .is_empty()
        {
            exams.push(exam);
        }
    }
    token.authorized_ok(web::Json(exams))
}

/**
 * GET /api/v0/exercise-services/client/exams/:id/exercises
 *
 * Returns the user's slides of the exam's exercises this client can be served, in the order of the
 * exam page. Selects slides for exercises with no slide selected yet.
 */
#[utoipa::path(
    get,
    path = "/exams/{id}/exercises",
    operation_id = "getClientExamExercises",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exam id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The user's client-servable exercise slides of the exam", body = Vec<api::ExerciseSlide>),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No such exam, or the user has not started it or can no longer answer it", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
pub(super) async fn get_exam_exercises(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    exam_id: web::Path<Uuid>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::ExerciseSlide>>> {
    let mut conn = pool.acquire().await?;
    let exam = answerable_exam_or_not_found(&mut conn, *exam_id, user.id).await?;
    // The user has started the exam, which is what lets them see its exercises.
    let token = skip_authorize();
    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    let mut exercises = models::exercises::get_exercises_by_exam_id(&mut conn, exam.id).await?;
    exercises.sort_by_key(|exercise| (exercise.order_number, exercise.id));
    let mut slides = Vec::new();
    for exercise in exercises {
        if let Some(slide) = exam_exercise_slide(
            &mut conn,
            user.id,
            &exam,
            exercise,
            &capable_slugs,
            file_store.as_ref(),
            app_conf.as_ref(),
        )
        .await?
        {
            slides.push(slide);
        }
    }
    token.authorized_ok(web::Json(slides))
}
