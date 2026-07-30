/*!
Handlers for `/api/v0/exercise-services/client`.

A generic native-client API for exercise services: over plain HTTP it plays the role an
exercise service's in-browser IFrame plays on the web (download a stub, edit locally,
submit, poll grading, review old submissions). Specs and answers stay opaque plugin-owned
blobs the host only forwards.

Which services this API serves is not hardcoded: an exercise service is served exactly when
it declares a `build_user_answer_endpoint_path` in its service info, since that endpoint is
what turns the client's uploaded files into the service's own answer. The course/exercise
queries filter on that capability, and submit rejects a task whose service lacks it.
*/
use crate::controllers::helpers::file_uploading;
use crate::domain::error::BadRequestReason;
use crate::domain::exercise_services::token::UserFromOAuthToken;
use crate::domain::models_requests::{self, JwtKey};
use crate::prelude::*;
use actix_web::FromRequest;
use exercise_services_api as api;
use headless_lms_models::exercise_service_client_uploads::ClientUpload;
use headless_lms_models::exercises::{ActivityProgress, GradingProgress};
use headless_lms_models::user_exercise_states::UserExerciseState;
use models::CourseOrExamId;
use models::chapters::DatabaseChapter;
use models::library::grading::{StudentExerciseSlideSubmission, StudentExerciseTaskSubmission};
use std::collections::HashSet;
use std::future::{Ready, ready};
use std::path::Path;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        get_courses,
        get_course,
        get_course_exercises,
        get_course_progress,
        get_exercise,
        upload_exercise_files,
        submit_exercise,
        get_submission_grading,
        get_exercise_submissions,
        download_submission,
        share_submission
    ),
    components(schemas(
        api::ExerciseSlideSubmission,
        api::ExerciseSlideSubmissionListItem,
        api::UploadedFile,
        api::UploadedFiles,
        api::SubmissionFiles,
        api::CourseProgress,
        api::ExerciseProgress,
        api::PasteResult,
        crate::domain::error::ApiErrorResponse
    ))
)]
pub(crate) struct ExerciseServicesClientRoutesApiDoc;

/// Header a client sends to advertise its version, e.g. `0.39.4`.
const CLIENT_VERSION_HEADER: &str = "X-Client-Version";

/// Object-store namespace for files uploaded through this API. Not a service slug: at upload time
/// no task is chosen yet, and the prefix carries no authorization meaning.
const CLIENT_UPLOAD_PATH_PREFIX: &str = "exercise-services-client";

/// Minimum client version the backend accepts. `None` disables the check; a
/// `"major.minor.patch"` string rejects older clients with `426 Upgrade Required`.
const MINIMUM_CLIENT_VERSION: Option<&str> = None;

/// Parses a `major.minor.patch` version string into a comparable tuple. Missing
/// minor/patch components default to `0`; a malformed string returns `None`.
fn parse_version(version: &str) -> Option<(u64, u64, u64)> {
    let mut parts = version.trim().split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next().unwrap_or("0").parse().ok()?;
    let patch = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

/// Rejects clients older than `minimum` with `426 Upgrade Required`; a `None` minimum
/// passes everything. When a minimum is set, a missing or unparseable client version
/// counts as obsolete.
fn check_client_version(
    client_version: Option<&str>,
    minimum: Option<&str>,
) -> Result<(), ControllerError> {
    let Some(minimum) = minimum else {
        return Ok(());
    };
    let minimum_parsed = parse_version(minimum);
    if let (Some(client), Some(minimum_parsed)) =
        (client_version.and_then(parse_version), minimum_parsed)
        && client >= minimum_parsed
    {
        return Ok(());
    }
    Err(controller_err!(
        UpgradeRequired,
        format!("This client is obsolete; the minimum supported version is {minimum}.")
    ))
}

/// Slugs of the exercise services this API can serve: exactly those declaring a
/// `build_user_answer_endpoint_path`.
///
/// Reads the `exercise_service_info` cache, which `service-info-fetcher` refreshes about once a
/// minute; fetching live would fan every request out to every exercise service. An empty set
/// therefore usually means that fetcher is down or cold, which the client sees only as empty
/// course and exercise lists — hence the warning.
async fn native_client_capable_slugs(conn: &mut PgConnection) -> ModelResult<Vec<String>> {
    let slugs = models::exercise_services::get_native_client_capable_slugs(conn).await?;
    if slugs.is_empty() {
        warn!(
            "No exercise service declares a build_user_answer_endpoint_path, so the client API can serve nothing. Check that service-info-fetcher is running."
        );
    }
    Ok(slugs)
}

/// Filters a slide's tasks down to the ones whose exercise service can serve this client and
/// converts them to the client shape. Shared by the list and single-exercise views so their
/// visibility rules cannot drift apart. Model solutions are stripped unless
/// `reveal_model_solution`; the list view never reveals them.
fn client_tasks_from_slide(
    tasks: Vec<models::exercise_tasks::CourseMaterialExerciseTask>,
    capable_slugs: &[String],
    reveal_model_solution: bool,
) -> Vec<api::ExerciseTask> {
    tasks
        .into_iter()
        .filter(|et| capable_slugs.contains(&et.exercise_service_slug))
        .map(|et| api::ExerciseTask {
            task_id: et.id,
            order_number: et.order_number,
            assignment: et.assignment,
            public_spec: et.public_spec,
            model_solution_spec: if reveal_model_solution {
                et.model_solution_spec
            } else {
                None
            },
            exercise_service_slug: et.exercise_service_slug,
        })
        .collect()
}

/// Extractor guarding every client route: reads `X-Client-Version` and rejects obsolete
/// clients before the handler runs. Yields no data; its presence applies the check.
#[derive(Debug)]
pub struct SupportedClient;

impl FromRequest for SupportedClient {
    type Error = ControllerError;
    type Future = Ready<Result<Self, ControllerError>>;

    fn from_request(req: &HttpRequest, _payload: &mut actix_http::Payload) -> Self::Future {
        let client_version = req
            .headers()
            .get(CLIENT_VERSION_HEADER)
            .and_then(|value| value.to_str().ok())
            .map(str::to_string);
        ready(
            check_client_version(client_version.as_deref(), MINIMUM_CLIENT_VERSION).map(|()| Self),
        )
    }
}

/**
 * GET /api/v0/exercise-services/client/courses
 *
 * Returns the courses that the user is currently enrolled on that contain exercises this
 * client can be served.
 */
#[utoipa::path(
    get,
    path = "/courses",
    operation_id = "getClientCourses",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The courses the user is enrolled on that contain client-servable exercises", body = Vec<api::Course>),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_courses(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::Course>>> {
    let mut conn = pool.acquire().await?;

    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    let courses =
        models::course_instances::get_enrolled_course_instances_for_user_with_exercise_types(
            &mut conn,
            user.id,
            &capable_slugs,
        )
        .await?
        .into_iter()
        .map(|ci| api::Course {
            id: ci.course_id,
            slug: ci.course_slug,
            name: ci.course_name,
            description: ci.course_description,
            organization_name: ci.organization_name,
        })
        .collect();

    // enrolled users may view their courses regardless of role permissions
    let token = skip_authorize();
    token.authorized_ok(web::Json(courses))
}

/**
 * GET /api/v0/exercise-services/client/courses/:id
 *
 * Returns the course with the given id.
 */
#[utoipa::path(
    get,
    path = "/courses/{id}",
    operation_id = "getClientCourse",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Course id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The requested course", body = api::Course),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No course with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_course(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    course: web::Path<Uuid>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::Course>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course)).await?;

    let course = models::courses::get_course(&mut conn, *course).await?;
    let org = models::organizations::get_organization(&mut conn, course.organization_id).await?;
    let course = api::Course {
        id: course.id,
        slug: course.slug,
        name: course.name,
        description: course.description,
        organization_name: org.name,
    };

    token.authorized_ok(web::Json(course))
}

/**
 * GET /api/v0/exercise-services/client/courses/:id/exercises
 *
 * Returns the user's exercise slides for the given course.
 * Does not return anything for chapters which are not open yet.
 * Selects slides for exercises with no slide selected yet.
 * Only returns slides which have tasks whose exercise service can serve this client.
 */
#[utoipa::path(
    get,
    path = "/courses/{id}/exercises",
    operation_id = "getClientCourseExercises",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Course id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The user's client-servable exercise slides for open chapters", body = Vec<api::ExerciseSlide>),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No course with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_course_exercises(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    course: web::Path<Uuid>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::ExerciseSlide>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course)).await?;

    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    let mut slides = Vec::new();
    let open_chapter_ids = models::chapters::course_chapters(&mut conn, *course)
        .await?
        .into_iter()
        .filter(DatabaseChapter::has_opened)
        .map(|c| c.id)
        .collect::<HashSet<_>>();

    let course = models::courses::get_course(&mut conn, *course).await?;
    let open_chapter_exercises =
        models::exercises::get_exercises_by_course_id(&mut conn, course.id)
            .await?
            .into_iter()
            .filter(|e| {
                e.chapter_id
                    .map(|ci| open_chapter_ids.contains(&ci))
                    .unwrap_or_default()
            });
    for open_exercise in open_chapter_exercises {
        let (slide, _) = models::exercises::get_or_select_exercise_slide(
            &mut conn,
            Some(user.id),
            &open_exercise,
            models_requests::fetch_service_info,
        )
        .await?;
        // The per-user "reveal once solved" gate lives in `get_exercise`, so this list view
        // never reveals model solutions.
        let tasks = client_tasks_from_slide(slide.exercise_tasks, &capable_slugs, false);
        if !tasks.is_empty() {
            slides.push(api::ExerciseSlide {
                slide_id: slide.id,
                exercise_id: open_exercise.id,
                course_id: course.id,
                exercise_name: open_exercise.name,
                exercise_order_number: open_exercise.order_number,
                deadline: open_exercise.deadline,
                tasks,
            });
        }
    }

    token.authorized_ok(web::Json(slides))
}

/// Derives the client-facing per-exercise progress from an exercise's maximum score and
/// the user's exercise state (absent when the user has never touched the exercise).
fn derive_exercise_progress(
    exercise_id: Uuid,
    score_maximum: i32,
    state: Option<&UserExerciseState>,
) -> api::ExerciseProgress {
    let score_given = state.and_then(|s| s.score_given).unwrap_or(0.0);
    let activity_progress = state.map(|s| s.activity_progress).unwrap_or_default();
    api::ExerciseProgress {
        exercise_id,
        score_given,
        score_maximum,
        completed: activity_progress == ActivityProgress::Completed,
        attempted: activity_progress != ActivityProgress::Initialized,
    }
}

/// Mirrors the project-wide "solved" reveal rule (`controllers/course_material/exercises.rs`,
/// `domain/exercises.rs`): full points, or the per-slide attempt limit exhausted.
fn model_solution_should_be_revealed(
    exercise: &models::exercises::Exercise,
    score_given: f32,
    slide_submission_count: i64,
) -> bool {
    let has_received_full_points = score_given >= exercise.score_maximum as f32
        || (score_given - exercise.score_maximum as f32).abs() < 0.0001;
    let out_of_tries = exercise.limit_number_of_tries
        && slide_submission_count >= exercise.max_tries_per_slide.unwrap_or(i32::MAX) as i64;
    has_received_full_points || out_of_tries
}

/**
 * GET /api/v0/exercise-services/client/courses/:id/progress
 *
 * Returns the current user's progress on every exercise of the course that lives in an
 * open chapter (the same visibility as `courses/:id/exercises`): its awarded and maximum
 * points and completed/attempted signals. One round-trip; course totals are derivable by
 * summing the returned entries.
 */
#[utoipa::path(
    get,
    path = "/courses/{id}/progress",
    operation_id = "getClientCourseProgress",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Course id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The user's per-exercise progress for the course's open chapters", body = api::CourseProgress),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No course with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_course_progress(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    course: web::Path<Uuid>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::CourseProgress>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course)).await?;

    let course = models::courses::get_course(&mut conn, *course).await?;
    let open_chapter_ids = models::chapters::course_chapters(&mut conn, course.id)
        .await?
        .into_iter()
        .filter(DatabaseChapter::has_opened)
        .map(|c| c.id)
        .collect::<HashSet<_>>();

    // One read for the whole course instead of a query per exercise.
    let states = models::user_exercise_states::get_all_for_user_and_course_or_exam(
        &mut conn,
        user.id,
        CourseOrExamId::Course(course.id),
    )
    .await?;
    let mut state_by_exercise = std::collections::HashMap::new();
    for state in &states {
        state_by_exercise.insert(state.exercise_id, state);
    }

    let exercises = models::exercises::get_exercises_by_course_id(&mut conn, course.id)
        .await?
        .into_iter()
        .filter(|e| {
            e.chapter_id
                .map(|ci| open_chapter_ids.contains(&ci))
                .unwrap_or_default()
        })
        .map(|e| {
            derive_exercise_progress(e.id, e.score_maximum, state_by_exercise.get(&e.id).copied())
        })
        .collect();

    token.authorized_ok(web::Json(api::CourseProgress {
        course_id: course.id,
        exercises,
    }))
}

/**
 * GET /api/v0/exercise-services/client/exercises/:id
 *
 * Returns an exercise slide for the user for the given exercise.
 */
#[utoipa::path(
    get,
    path = "/exercises/{id}",
    operation_id = "getClientExercise",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "An exercise slide for the user, carrying only the tasks whose exercise service can serve this client", body = api::ExerciseSlide),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists, it belongs to an exam (not served by this API), or no task of it can serve this client", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user is not enrolled to this exercise's course (message_key `not_enrolled`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_exercise(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    exercise_id: web::Path<Uuid>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::ExerciseSlide>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await?;

    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let (exercise_slide, course_or_exam_id) = models::exercises::get_or_select_exercise_slide(
        &mut conn,
        Some(user.id),
        &exercise,
        models_requests::fetch_service_info,
    )
    .await?;
    let course_id = match course_or_exam_id {
        Some(CourseOrExamId::Course(course_id)) => course_id,
        Some(CourseOrExamId::Exam(_)) => {
            // Exam exercises are out of scope for this API; report not found rather than
            // misdescribing it as an enrollment problem.
            return Err(controller_err!(
                NotFound,
                "This exercise belongs to an exam, which the client API does not serve".to_string()
            ));
        }
        None => {
            return Err(bad_request_with_reason(
                BadRequestReason::NotEnrolled,
                "User is not enrolled to this exercise's course".to_string(),
            ));
        }
    };

    let user_exercise_state = models::user_exercise_states::get_user_exercise_state_if_exists(
        &mut conn,
        user.id,
        exercise.id,
        CourseOrExamId::Course(course_id),
    )
    .await?;
    let score_given = user_exercise_state
        .and_then(|s| s.score_given)
        .unwrap_or(0.0);
    let slide_submission_counts =
        models::exercise_slide_submissions::get_exercise_slide_submission_counts_for_exercise_user(
            &mut conn,
            exercise.id,
            CourseOrExamId::Course(course_id),
            user.id,
        )
        .await?;
    let slide_submission_count = slide_submission_counts
        .get(&exercise_slide.id)
        .copied()
        .unwrap_or(0);
    let reveal_model_solution =
        model_solution_should_be_revealed(&exercise, score_given, slide_submission_count);

    // Without the capability filter this endpoint would hand out task ids belonging to services
    // that cannot serve a native client, which submit would then have to reject.
    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    let tasks = client_tasks_from_slide(
        exercise_slide.exercise_tasks,
        &capable_slugs,
        reveal_model_solution,
    );
    if tasks.is_empty() {
        return Err(controller_err!(
            NotFound,
            "No task of this exercise can be served to this client".to_string()
        ));
    }

    token.authorized_ok(web::Json(api::ExerciseSlide {
        slide_id: exercise_slide.id,
        exercise_id: exercise.id,
        course_id,
        exercise_name: exercise.name,
        exercise_order_number: exercise.order_number,
        deadline: exercise.deadline,
        tasks,
    }))
}

/// Builds a 422 whose `message_key` the client keys its error handling on.
fn bad_request_with_reason(reason: BadRequestReason, message: String) -> ControllerError {
    ControllerError::new(
        ControllerErrorType::BadRequestWithReason(reason),
        message,
        None,
    )
}

/// Rejects a user who is not enrolled on the exercise's course.
///
/// The shared submit domain fn reports a not-enrolled user as 401 Unauthorized, but the editor
/// client treats 401 as an invalid token and deletes the stored credentials, logging the student
/// out on their first submit. 422 `not_enrolled` lets the client prompt for enrollment instead.
async fn verify_enrolled(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<(), ControllerError> {
    if models::user_course_settings::get_user_course_settings_by_course_id(conn, user_id, course_id)
        .await?
        .is_some()
    {
        return Ok(());
    }
    Err(bad_request_with_reason(
        BadRequestReason::NotEnrolled,
        "User is not enrolled to this exercise's course".to_string(),
    ))
}

/// The URL path authorizes `exercise_id`; the slide/task ids come from the request body,
/// so without this check a caller could submit into an unrelated exercise's slide/task.
fn verify_slide_and_task_belong(
    exercise_id: Uuid,
    slide_id: Uuid,
    slide_exercise_id: Uuid,
    task_id: Uuid,
    task_slide_id: Uuid,
) -> Result<(), ControllerError> {
    if slide_exercise_id != exercise_id {
        return Err(controller_err!(
            BadRequest,
            format!("Exercise slide {slide_id} does not belong to exercise {exercise_id}")
        ));
    }
    if task_slide_id != slide_id {
        return Err(controller_err!(
            BadRequest,
            format!("Exercise task {task_id} does not belong to exercise slide {slide_id}")
        ));
    }
    Ok(())
}

/// Rejects a submission to a task whose exercise service cannot serve a native client.
///
/// The slide/task ids come from the request body, so without this a caller holding any task id
/// could persist an answer to a service that will never understand it, and grading would fail
/// deep inside that service instead of at the edge.
fn verify_task_is_client_capable(
    task_id: Uuid,
    exercise_type: &str,
    capable_slugs: &[String],
) -> Result<(), ControllerError> {
    if capable_slugs.iter().any(|slug| slug == exercise_type) {
        return Ok(());
    }
    Err(controller_err!(
        BadRequest,
        format!(
            "Exercise task {task_id} belongs to the exercise service '{exercise_type}', which cannot be served to this client"
        )
    ))
}

/// Asks the task's exercise service to turn host-stored files into its own answer.
///
/// The host must never build the answer itself: its shape is the service's business, and
/// hardcoding one shape is what tied this API to a single plugin. There is deliberately no
/// fallback — a fallback would reinstate exactly that coupling.
async fn build_user_answer(
    conn: &mut PgConnection,
    exercise_task: &models::exercise_tasks::ExerciseTask,
    uploaded_files: Vec<models_requests::UploadedFileRef>,
) -> Result<serde_json::Value, ControllerError> {
    let exercise_service = models::exercise_services::get_exercise_service_by_exercise_type(
        conn,
        &exercise_task.exercise_type,
    )
    .await?;
    let service_info =
        models::exercise_service_info::get_service_info(conn, exercise_service.id).await?;
    // The capability check already passed, so reaching this only means the service stopped
    // declaring the endpoint between the two reads.
    let url = models::exercise_services::get_internal_build_user_answer_url(
        &exercise_service,
        &service_info,
    )?
    .ok_or_else(|| {
        controller_err!(
            BadRequest,
            format!(
                "The exercise service '{}' no longer declares a build-user-answer endpoint",
                exercise_task.exercise_type
            )
        )
    })?;
    let answer = models_requests::post_build_user_answer_request(
        url,
        exercise_task.public_spec.as_ref(),
        uploaded_files,
    )
    .await?;
    Ok(answer)
}

/// Rejects a submit naming a file the host has no usable upload record of.
///
/// Ownership alone would not be enough: without the exercise binding, any of the user's uploads
/// could be replayed into any other exercise's submission. A reaped upload is reported distinctly
/// from an unrecognised one, because only the former is a race a client can recover from by
/// uploading again.
fn verify_uploads_are_usable(
    requested: &[Uuid],
    found: &[ClientUpload],
) -> Result<(), ControllerError> {
    for id in requested {
        match found.iter().find(|upload| &upload.file_upload_id == id) {
            Some(upload) if upload.deleted => {
                return Err(bad_request_with_reason(
                    BadRequestReason::UploadExpired,
                    format!("Uploaded file {id} is no longer available; upload it again"),
                ));
            }
            Some(_) => {}
            None => {
                return Err(bad_request_with_reason(
                    BadRequestReason::UnknownUpload,
                    format!("Uploaded file {id} was not uploaded for this exercise by this user"),
                ));
            }
        }
    }
    Ok(())
}

/// Rejects a submit naming the same upload twice.
///
/// Deduplicating instead would record the file twice under one submission and list it twice in a
/// download, and would hide a client defect while doing so. There is no answer a duplicate could
/// sensibly mean, so it is reported rather than repaired.
fn verify_uploads_are_distinct(requested: &[Uuid]) -> Result<(), ControllerError> {
    let mut seen = HashSet::with_capacity(requested.len());
    for id in requested {
        if !seen.insert(id) {
            return Err(bad_request_with_reason(
                BadRequestReason::DuplicateUpload,
                format!("Uploaded file {id} was named more than once"),
            ));
        }
    }
    Ok(())
}

/// Checks every id a submit names against the uploads recorded for this exercise and user.
async fn verify_uploads_belong_to_exercise(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    user_id: Uuid,
    requested: &[Uuid],
) -> Result<(), ControllerError> {
    verify_uploads_are_distinct(requested)?;
    let recorded = models::exercise_service_client_uploads::get_for_exercise_and_user(
        conn,
        exercise_id,
        user_id,
        requested,
    )
    .await?;
    verify_uploads_are_usable(requested, &recorded)
}

/// Resolves the client's upload ids to the references the exercise service is given, preserving
/// the order the client asked for: that order is part of the client's answer, not ours to sort.
///
/// A missing `file_uploads` row despite a live binding is the same reaped condition, since the
/// reaper deletes the file before the binding.
fn uploaded_file_refs(
    requested: &[Uuid],
    files: &[models::file_uploads::FileUploadRef],
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> Result<Vec<models_requests::UploadedFileRef>, ControllerError> {
    requested
        .iter()
        .map(|id| {
            let file = files.iter().find(|file| &file.id == id).ok_or_else(|| {
                bad_request_with_reason(
                    BadRequestReason::UploadExpired,
                    format!("Uploaded file {id} is no longer available; upload it again"),
                )
            })?;
            Ok(models_requests::UploadedFileRef {
                id: file.id,
                name: file.name.clone(),
                url: file_store.get_download_url(Path::new(&file.path), app_conf),
            })
        })
        .collect()
}

/**
 * POST /api/v0/exercise-services/client/exercises/:id/files
 *
 * Stores files for a later submission to this exercise. Every multipart field name must be a
 * UUID the client picks; the host assigns the ids a submit request then names. Uploads are
 * bound to this exercise and user, and unreferenced ones are reaped, so a client should upload
 * immediately before submitting.
 */
#[utoipa::path(
    post,
    path = "/exercises/{id}/files",
    operation_id = "uploadClientExerciseFiles",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise id"),
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
        (status = 404, description = "No exercise with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user is not enrolled to this exercise's course (message_key `not_enrolled`), or the multipart body violates the field-name, file-count or size rules", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, file_store, payload, app_conf))]
async fn upload_exercise_files(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    exercise_id: web::Path<Uuid>,
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
    .await?;

    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let course_id = exercise
        .course_id
        .ok_or_else(|| anyhow::anyhow!("Cannot upload files for non-course exercises"))?;
    verify_enrolled(&mut conn, user.id, course_id).await?;

    let mut uploaded_paths = Vec::new();
    let stored = store_client_uploads(
        &mut conn,
        exercise.id,
        user.id,
        payload,
        file_store.as_ref(),
        &mut uploaded_paths,
        &app_conf.base_url,
    )
    .await;
    let uploads = match stored {
        Ok(uploads) => uploads,
        Err(error) => {
            // Objects reach the store before their rows are committed, so a rollback alone
            // would leave objects behind that no record points at and the reaper cannot see.
            // This covers the commit failure too: an early return there would leak up to
            // 100 MiB with no `file_uploads` row, and so no binding for the reaper to find.
            for uploaded in uploaded_paths {
                if let Err(delete_error) = file_store.delete(Path::new(&uploaded.path)).await {
                    error!(
                        "Failed to delete file '{}' during cleanup: {delete_error}",
                        uploaded.path
                    );
                }
            }
            return Err(error);
        }
    };

    let files = uploads
        .into_iter()
        .map(|upload| api::UploadedFile {
            id: upload.file_upload_id,
            name: upload.name,
            download_url: upload.entry.url,
        })
        .collect();
    token.authorized_ok(web::Json(api::UploadedFiles { files }))
}

/// Stores the multipart parts and binds them to the exercise and user, so that a failure to
/// record the binding cannot leave uploads the reaper is unable to find.
///
/// The transaction opens only after the last byte has been streamed: the multipart body has no
/// time limit, so opening it first would pin a pool connection `idle in transaction` for the whole
/// upload.
async fn store_client_uploads(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    user_id: Uuid,
    payload: Multipart,
    file_store: &dyn FileStore,
    uploaded_paths: &mut Vec<file_uploading::ExerciseServiceUploadCleanup>,
    base_url: &str,
) -> Result<Vec<file_uploading::ExerciseServiceUpload>, ControllerError> {
    let streamed = file_uploading::stream_exercise_service_upload(
        CLIENT_UPLOAD_PATH_PREFIX,
        payload,
        file_store,
        uploaded_paths,
        base_url,
    )
    .await?;

    let mut tx = conn.begin().await?;
    let uploads =
        file_uploading::record_exercise_service_upload(&mut tx, streamed, Some(user_id)).await?;
    let file_upload_ids: Vec<Uuid> = uploads.iter().map(|u| u.file_upload_id).collect();
    models::exercise_service_client_uploads::insert_many(
        &mut tx,
        exercise_id,
        user_id,
        &file_upload_ids,
    )
    .await?;
    tx.commit().await?;
    Ok(uploads)
}

/**
 * POST /api/v0/exercise-services/client/exercises/:id/submit
 *
 * Accepts an exercise submission from the user. The body names files previously stored through
 * this exercise's `files` endpoint; the exercise service turns them into its own answer.
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
    request_body(content = api::ExerciseSlideSubmission, description = "The slide and task being answered, and the ids of the files the answer is built from"),
    responses(
        (status = 200, description = "The created submission, identified by both its task and slide submission ids", body = api::ExerciseTaskSubmissionResult),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists, or the referenced slide/task does not exist", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user is not enrolled to this exercise's course (message_key `not_enrolled`), the referenced slide/task belongs to another exercise, the task's exercise service cannot be served to this client, a named upload was reaped (`upload_expired`), was never uploaded for this exercise by this user (`unknown_upload`) or was named more than once (`duplicate_upload`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[allow(clippy::too_many_arguments)]
async fn submit_exercise(
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
    .await?;

    let submission = submission.into_inner();
    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let course_id = exercise
        .course_id
        .ok_or_else(|| anyhow::anyhow!("Cannot answer non-course exercises"))?;
    verify_enrolled(&mut conn, user.id, course_id).await?;
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

    verify_uploads_belong_to_exercise(
        &mut conn,
        exercise.id,
        user.id,
        &submission.uploaded_file_ids,
    )
    .await?;
    let files = models::file_uploads::get_many(&mut conn, &submission.uploaded_file_ids).await?;
    let uploaded_files = uploaded_file_refs(
        &submission.uploaded_file_ids,
        &files,
        file_store.as_ref(),
        app_conf.as_ref(),
    )?;

    let data_json = build_user_answer(&mut conn, &exercise_task, uploaded_files).await?;

    // The submission and the record of which files it was made from must land together: a
    // submission without that record is one `download_submission` can never serve.
    let mut tx = conn.begin().await?;

    // The validation above ran unlocked and the exercise-service hop took real time, so the
    // reaper may have retired an upload in the meantime. Re-check under a row lock the reaper
    // honours, inside the transaction that records the association, so no interleaving can
    // produce a 200 for a submission whose files are gone.
    let locked = models::exercise_service_client_uploads::lock_for_exercise_and_user(
        &mut tx,
        exercise.id,
        user.id,
        &submission.uploaded_file_ids,
    )
    .await?;
    verify_uploads_are_usable(&submission.uploaded_file_ids, &locked)?;

    let result = domain::exercises::process_submission(
        &mut tx,
        user.id,
        exercise,
        &StudentExerciseSlideSubmission {
            exercise_slide_id: submission.exercise_slide_id,
            exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                exercise_task_id: submission.exercise_task_id,
                data_json,
            }],
        },
        jwt_key.into_inner(),
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

    // one task submission in, so exactly one result out
    let task_submission = result
        .exercise_task_submission_results
        .into_iter()
        .next()
        .ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to find exercise task submission id".to_string(),
                None,
            )
        })?;

    models::exercise_task_submission_files::insert_many(
        &mut tx,
        task_submission.submission.id,
        &submission.uploaded_file_ids,
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(api::ExerciseTaskSubmissionResult {
        task_submission_id: task_submission.submission.id,
        slide_submission_id: task_submission.submission.exercise_slide_submission_id,
    }))
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
        (status = 200, description = "The grading status of the submission", body = api::ExerciseTaskSubmissionStatus),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "Cannot view another user's submission grading", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No submission with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_submission_grading(
    pool: web::Data<PgPool>,
    submission_id: web::Path<Uuid>,
    user: UserFromOAuthToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::ExerciseTaskSubmissionStatus>> {
    let mut conn = pool.acquire().await?;
    let submission =
        models::exercise_task_submissions::get_by_id(&mut conn, *submission_id).await?;
    let slide_submission = models::exercise_slide_submissions::get_by_id(
        &mut conn,
        submission.exercise_slide_submission_id,
    )
    .await?;
    if slide_submission.user_id != user.id {
        return Err(controller_err!(
            Forbidden,
            "Cannot view another user's submission grading".to_string()
        ));
    }
    let token = skip_authorize();

    let grading = models::exercise_task_gradings::get_by_exercise_task_submission_id(
        &mut conn,
        *submission_id,
    )
    .await?;
    let status = match grading {
        Some(grading) => api::ExerciseTaskSubmissionStatus::Grading {
            grading_progress: map_grading_progress(grading.grading_progress),
            score_given: grading.score_given,
            grading_started_at: grading.grading_started_at,
            grading_completed_at: grading.grading_completed_at,
            feedback_json: grading.feedback_json,
            feedback_text: grading.feedback_text,
        },
        None => api::ExerciseTaskSubmissionStatus::NoGradingYet,
    };
    token.authorized_ok(web::Json(status))
}

/// Maps the internal grading-progress enum to the exercise-services-api one.
fn map_grading_progress(progress: GradingProgress) -> api::GradingProgress {
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
 * Returns the current user's past submissions to the given exercise, newest
 * first, each annotated with its grading score and progress if graded.
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
        (status = 200, description = "The current user's submissions to the exercise, newest first", body = Vec<api::ExerciseSlideSubmissionListItem>),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_exercise_submissions(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: UserFromOAuthToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::ExerciseSlideSubmissionListItem>>> {
    let mut conn = pool.acquire().await?;
    // The query is scoped to the current user, so no further authorization is needed.
    let token = skip_authorize();

    // One query for the whole listing, gradings joined in: an editor slide has a single task, so
    // its grading is the slide's grading.
    let submissions =
        models::exercise_slide_submissions::get_users_submissions_for_exercise_with_gradings(
            &mut conn,
            user.id,
            *exercise_id,
        )
        .await?;

    let items = submissions
        .into_iter()
        .map(|submission| api::ExerciseSlideSubmissionListItem {
            id: submission.id,
            exercise_id: submission.exercise_id,
            created_at: submission.created_at,
            score_given: submission.score_given,
            grading_progress: submission.grading_progress.map(map_grading_progress),
        })
        .collect();

    token.authorized_ok(web::Json(items))
}

/**
 * GET /api/v0/exercise-services/client/submissions/:id/download
 *
 * Resolves an exercise-slide submission (by the id returned from the submissions list, or by
 * a submit's `slide_submission_id`) to the files it was made from, so the client can restore
 * an old submission.
 */
#[utoipa::path(
    get,
    path = "/submissions/{id}/download",
    operation_id = "downloadClientSubmission",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise-slide-submission id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The files the submission was made from, in the order the client uploaded them; empty when it was made from none", body = api::SubmissionFiles),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "Cannot download another user's submission", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No submission with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
async fn download_submission(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    submission_id: web::Path<Uuid>,
    user: UserFromOAuthToken,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::SubmissionFiles>> {
    let mut conn = pool.acquire().await?;
    let slide_submission =
        models::exercise_slide_submissions::get_by_id(&mut conn, *submission_id).await?;
    if slide_submission.user_id != user.id {
        return Err(controller_err!(
            Forbidden,
            "Cannot download another user's submission".to_string()
        ));
    }
    let token = skip_authorize();

    let task_submissions = models::exercise_task_submissions::get_by_exercise_slide_submission_id(
        &mut conn,
        *submission_id,
    )
    .await?;
    // Resolved from the host's own upload records, never from the exercise service's answer:
    // the answer is an opaque plugin-owned blob and reading it would tie this endpoint to one
    // plugin's shape.
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
    )))
}

/// Turns the host's own upload records into the download response. Every tracked file is
/// reachable, not just the first, so a multi-file submission is fully restorable.
fn submission_files_response(
    files: Vec<models::exercise_task_submission_files::SubmissionFile>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> api::SubmissionFiles {
    api::SubmissionFiles {
        files: files
            .into_iter()
            .map(|file| api::UploadedFile {
                id: file.file_upload_id,
                name: file.name,
                download_url: file_store.get_download_url(Path::new(&file.path), app_conf),
            })
            .collect(),
    }
}

/**
 * POST /api/v0/exercise-services/client/submissions/:id/share
 *
 * Mints a shareable link to an existing submission of the current user and returns
 * its URL.
 */
#[utoipa::path(
    post,
    path = "/submissions/{id}/share",
    operation_id = "shareClientSubmission",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Exercise-slide-submission id"),
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The shareable URL for the submission", body = api::PasteResult),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "Cannot share another user's submission", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No submission with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, app_conf))]
async fn share_submission(
    pool: web::Data<PgPool>,
    submission_id: web::Path<Uuid>,
    user: UserFromOAuthToken,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::PasteResult>> {
    let mut conn = pool.acquire().await?;
    let slide_submission =
        models::exercise_slide_submissions::get_by_id(&mut conn, *submission_id).await?;
    if slide_submission.user_id != user.id {
        return Err(controller_err!(
            Forbidden,
            "Cannot share another user's submission".to_string()
        ));
    }
    let token = skip_authorize();

    let share = domain::exercise_services::submission_sharing::share_submission(
        &mut conn,
        *submission_id,
        user.id,
    )
    .await?;
    let paste_url = format!(
        "{}/shared-submissions/{}",
        app_conf.base_url.trim_end_matches('/'),
        share.id
    );

    token.authorized_ok(web::Json(api::PasteResult { paste_url }))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/courses", web::get().to(get_courses))
        .route("/courses/{id}", web::get().to(get_course))
        .route(
            "/courses/{id}/exercises",
            web::get().to(get_course_exercises),
        )
        .route("/courses/{id}/progress", web::get().to(get_course_progress))
        .route("/exercises/{id}", web::get().to(get_exercise))
        .route(
            "/exercises/{id}/files",
            web::post().to(upload_exercise_files),
        )
        .route("/exercises/{id}/submit", web::post().to(submit_exercise))
        .route(
            "/exercises/{id}/submissions",
            web::get().to(get_exercise_submissions),
        )
        .route(
            "/submissions/{id}/grading",
            web::get().to(get_submission_grading),
        )
        .route(
            "/submissions/{id}/download",
            web::get().to(download_submission),
        )
        .route("/submissions/{id}/share", web::post().to(share_submission));
}

#[cfg(test)]
mod tests {
    use super::*;

    use chrono::Utc;
    use headless_lms_models::user_exercise_states::ReviewingStage;

    fn state_with(
        score_given: Option<f32>,
        activity_progress: ActivityProgress,
    ) -> UserExerciseState {
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
    fn progress_without_state_is_zero_and_untouched() {
        let p = derive_exercise_progress(Uuid::nil(), 5, None);
        assert_eq!(p.score_given, 0.0);
        assert_eq!(p.score_maximum, 5);
        assert!(!p.completed);
        assert!(!p.attempted);
    }

    #[test]
    fn progress_started_is_attempted_not_completed() {
        let state = state_with(Some(0.0), ActivityProgress::Started);
        let p = derive_exercise_progress(Uuid::nil(), 5, Some(&state));
        assert!(p.attempted);
        assert!(!p.completed);
    }

    #[test]
    fn progress_completed_reports_points_and_flags() {
        let state = state_with(Some(5.0), ActivityProgress::Completed);
        let p = derive_exercise_progress(Uuid::nil(), 5, Some(&state));
        assert_eq!(p.score_given, 5.0);
        assert!(p.completed);
        assert!(p.attempted);
    }

    #[test]
    fn progress_initialized_state_is_not_attempted() {
        let state = state_with(None, ActivityProgress::Initialized);
        let p = derive_exercise_progress(Uuid::nil(), 5, Some(&state));
        assert_eq!(p.score_given, 0.0);
        assert!(!p.attempted);
        assert!(!p.completed);
    }

    #[test]
    fn version_check_is_disabled_when_no_minimum() {
        assert!(check_client_version(None, None).is_ok());
        assert!(check_client_version(Some("0.1.0"), None).is_ok());
        assert!(check_client_version(Some("garbage"), None).is_ok());
    }

    #[test]
    fn version_check_accepts_equal_and_newer_clients() {
        assert!(check_client_version(Some("0.39.4"), Some("0.39.4")).is_ok());
        assert!(check_client_version(Some("0.39.5"), Some("0.39.4")).is_ok());
        assert!(check_client_version(Some("1.0.0"), Some("0.39.4")).is_ok());
    }

    #[test]
    fn version_check_rejects_older_missing_or_malformed_clients() {
        assert!(check_client_version(Some("0.39.3"), Some("0.39.4")).is_err());
        assert!(check_client_version(None, Some("0.39.4")).is_err());
        assert!(check_client_version(Some("not-a-version"), Some("0.39.4")).is_err());
    }

    #[test]
    fn parse_version_defaults_missing_components_to_zero() {
        assert_eq!(parse_version("1"), Some((1, 0, 0)));
        assert_eq!(parse_version("1.2"), Some((1, 2, 0)));
        assert_eq!(parse_version("1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("x"), None);
    }

    // submit_exercise builds this exact error for a not-enrolled user; assert it produces the
    // same 422 `not_enrolled` shape get_exercise returns, so the client never sees a 401 here.
    #[test]
    fn not_enrolled_submit_error_maps_to_422_not_enrolled() {
        use actix_web::ResponseError;
        use actix_web::http::StatusCode;
        use futures_util::FutureExt;

        let err = ControllerError::new(
            ControllerErrorType::BadRequestWithReason(BadRequestReason::NotEnrolled),
            "User is not enrolled to this exercise's course".to_string(),
            None,
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

    fn exercise_with(
        score_maximum: i32,
        limit_number_of_tries: bool,
        max_tries_per_slide: Option<i32>,
    ) -> models::exercises::Exercise {
        let now = Utc::now();
        models::exercises::Exercise {
            id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            name: "Test exercise".to_string(),
            course_id: Some(Uuid::new_v4()),
            exam_id: None,
            page_id: Uuid::new_v4(),
            chapter_id: None,
            deadline: None,
            deleted_at: None,
            score_maximum,
            order_number: 0,
            copied_from: None,
            max_tries_per_slide,
            limit_number_of_tries,
            needs_peer_review: false,
            needs_self_review: false,
            use_course_default_peer_or_self_review_config: false,
            exercise_language_group_id: None,
            teacher_reviews_answer_after_locking: false,
        }
    }

    #[test]
    fn model_solution_hidden_until_full_points() {
        // Unlimited tries; the only route to "solved" is full points.
        let ex = exercise_with(5, false, None);
        assert!(!model_solution_should_be_revealed(&ex, 0.0, 3));
        assert!(!model_solution_should_be_revealed(&ex, 4.0, 99));
        // Full points -> reveal, even with tries remaining.
        assert!(model_solution_should_be_revealed(&ex, 5.0, 0));
        // Floating-point full points still count via the epsilon comparison.
        assert!(model_solution_should_be_revealed(&ex, 4.99995, 0));
    }

    #[test]
    fn model_solution_revealed_when_out_of_tries() {
        // Limited to 3 tries per slide.
        let ex = exercise_with(5, true, Some(3));
        // Fewer submissions than the limit and no points -> still hidden.
        assert!(!model_solution_should_be_revealed(&ex, 0.0, 2));
        // Attempt limit reached with no points -> solved by exhaustion, reveal.
        assert!(model_solution_should_be_revealed(&ex, 0.0, 3));
        assert!(model_solution_should_be_revealed(&ex, 0.0, 4));
    }

    #[test]
    fn out_of_tries_ignored_when_limit_disabled() {
        // limit_number_of_tries = false: the attempt count must never mark it solved.
        let ex = exercise_with(5, false, Some(3));
        assert!(!model_solution_should_be_revealed(&ex, 0.0, 100));
    }

    /// The submit body is deserialized by `web::Json`, so a malformed one fails at the serde
    /// boundary before the handler runs. Pin that contract: both ids are required and must be
    /// UUIDs, and the file list is required rather than defaulted, so a client cannot omit it and
    /// silently submit an answer built from nothing.
    #[test]
    fn malformed_submission_body_fails_to_deserialize() {
        serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
            "exercise_slide_id": Uuid::new_v4(),
            "exercise_task_id": Uuid::new_v4(),
            "uploaded_file_ids": [Uuid::new_v4()],
        }))
        .expect("a well-formed submission body deserializes");

        // Missing exercise_task_id.
        assert!(
            serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
                "exercise_slide_id": Uuid::new_v4(),
                "uploaded_file_ids": [],
            }))
            .is_err()
        );
        // Missing uploaded_file_ids.
        assert!(
            serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
                "exercise_slide_id": Uuid::new_v4(),
                "exercise_task_id": Uuid::new_v4(),
            }))
            .is_err()
        );
        // Ids must be UUIDs, not arbitrary strings or numbers.
        assert!(
            serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
                "exercise_slide_id": "not-a-uuid",
                "exercise_task_id": Uuid::new_v4(),
                "uploaded_file_ids": [],
            }))
            .is_err()
        );
        assert!(
            serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
                "exercise_slide_id": Uuid::new_v4(),
                "exercise_task_id": Uuid::new_v4(),
                "uploaded_file_ids": ["not-a-uuid"],
            }))
            .is_err()
        );
        // A completely unrelated body.
        assert!(
            serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!("nonsense"))
                .is_err()
        );
    }

    fn message_key_of(error: &ControllerError) -> String {
        use actix_web::ResponseError;
        use futures_util::FutureExt;
        let response = error.error_response();
        let bytes = actix_web::body::to_bytes(response.into_body())
            .now_or_never()
            .expect("response should resolve immediately")
            .expect("body bytes");
        let value: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
        value["message_key"]
            .as_str()
            .unwrap_or_default()
            .to_string()
    }

    #[test]
    fn a_submission_naming_no_files_is_accepted() {
        assert!(verify_uploads_are_usable(&[], &[]).is_ok());
    }

    #[test]
    fn a_submission_naming_its_own_uploads_is_accepted() {
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let found = vec![
            ClientUpload {
                file_upload_id: second,
                deleted: false,
            },
            ClientUpload {
                file_upload_id: first,
                deleted: false,
            },
        ];
        // Lookup order must not matter; the client's order is what the caller preserves.
        assert!(verify_uploads_are_usable(&[first, second], &found).is_ok());
    }

    /// An upload bound to another exercise, or to another user, is not returned by the lookup at
    /// all, so it must be indistinguishable from an id that was never uploaded.
    #[test]
    fn a_submission_naming_a_foreign_upload_is_rejected_as_unknown() {
        use actix_web::ResponseError;
        use actix_web::http::StatusCode;
        let foreign = Uuid::new_v4();
        let error = verify_uploads_are_usable(&[foreign], &[])
            .expect_err("an upload not bound to this exercise and user must be rejected");
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(message_key_of(&error), "unknown_upload");
    }

    /// The reaper soft-deletes precisely so this stays distinguishable from `unknown_upload`: only
    /// this case is a race a client can recover from by uploading again.
    #[test]
    fn a_submission_naming_a_reaped_upload_is_rejected_as_expired() {
        use actix_web::ResponseError;
        use actix_web::http::StatusCode;
        let reaped = Uuid::new_v4();
        let error = verify_uploads_are_usable(
            &[reaped],
            &[ClientUpload {
                file_upload_id: reaped,
                deleted: true,
            }],
        )
        .expect_err("a reaped upload must be rejected");
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(message_key_of(&error), "upload_expired");
    }

    /// One bad id among good ones must fail the whole submit rather than being dropped, or the
    /// exercise service would silently grade a partial answer.
    #[test]
    fn one_unusable_upload_rejects_the_whole_submission() {
        let good = Uuid::new_v4();
        let reaped = Uuid::new_v4();
        let found = vec![
            ClientUpload {
                file_upload_id: good,
                deleted: false,
            },
            ClientUpload {
                file_upload_id: reaped,
                deleted: true,
            },
        ];
        let error = verify_uploads_are_usable(&[good, reaped], &found).expect_err("must reject");
        assert_eq!(message_key_of(&error), "upload_expired");
    }

    #[test]
    fn a_submission_naming_distinct_uploads_is_accepted() {
        assert!(verify_uploads_are_distinct(&[]).is_ok());
        assert!(verify_uploads_are_distinct(&[Uuid::new_v4(), Uuid::new_v4()]).is_ok());
    }

    /// Deduplicating would record one file twice under a submission and list it twice in a
    /// download, so a duplicate is reported as the client bug it is.
    #[test]
    fn a_submission_naming_the_same_upload_twice_is_rejected() {
        use actix_web::ResponseError;
        use actix_web::http::StatusCode;
        let repeated = Uuid::new_v4();
        let error = verify_uploads_are_distinct(&[repeated, Uuid::new_v4(), repeated])
            .expect_err("a repeated upload id must be rejected");
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(message_key_of(&error), "duplicate_upload");
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

    fn task_with(slug: &str) -> models::exercise_tasks::CourseMaterialExerciseTask {
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
    fn only_capable_tasks_are_visible_to_the_client() {
        let tasks = vec![
            task_with("tmc"),
            task_with("quizzes"),
            task_with("other-native"),
        ];
        let visible = client_tasks_from_slide(tasks, &capable_slugs(), false);
        let slugs: Vec<&str> = visible
            .iter()
            .map(|t| t.exercise_service_slug.as_str())
            .collect();
        assert_eq!(slugs, vec!["tmc", "other-native"]);
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
            verify_slide_and_task_belong(exercise_id, slide_id, exercise_id, task_id, slide_id)
                .is_ok()
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
}

#[cfg(test)]
mod upload_tests {
    use super::*;
    use crate::test_helper::*;
    use actix_web::http::header::{CONTENT_TYPE, HeaderMap};
    use headless_lms_base::config::{ApplicationConfiguration, OAuthServerConfiguration};
    use headless_lms_utils::prelude::UtilResult;
    use models::exercise_slide_submissions::NewExerciseSlideSubmission;
    use models::exercise_task_gradings::UserPointsUpdateStrategy;
    use secrecy::SecretString;

    const BOUNDARY: &str = "clientuploadboundary";

    fn app_conf() -> ApplicationConfiguration {
        ApplicationConfiguration {
            base_url: "http://project-331.local".to_string(),
            test_mode: true,
            test_chatbot: false,
            test_sisu: false,
            development_uuid_login: false,
            enable_admin_email_verification: false,
            azure_configuration: None,
            tmc_account_creation_origin: None,
            tmc_admin_access_token: SecretString::new("mock".to_string().into()),
            oauth_server_configuration: OAuthServerConfiguration {
                rsa_public_key: "unused".into(),
                rsa_private_key: SecretString::new("unused".into()),
                oauth_token_hmac_key: SecretString::new("pippuri".into()),
                dpop_nonce_key: std::sync::Arc::new(secrecy::SecretBox::new(Box::new(
                    "unused".into(),
                ))),
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

    /// Writes into a temp dir. `LocalFileStore` is unusable here because it demands the
    /// `HEADLESS_LMS_CACHE_FILES_PATH` env var, and mutating the environment from a test that runs
    /// alongside others is worse than implementing the three methods these tests reach.
    struct TempFileStore(tempfile::TempDir);

    #[async_trait::async_trait(?Send)]
    impl FileStore for TempFileStore {
        async fn upload(
            &self,
            path: &std::path::Path,
            contents: Vec<u8>,
            _mime_type: &str,
        ) -> UtilResult<()> {
            let full = self.0.path().join(path);
            if let Some(parent) = full.parent() {
                tokio::fs::create_dir_all(parent).await?;
            }
            tokio::fs::write(full, contents).await?;
            Ok(())
        }

        async fn upload_stream(
            &self,
            path: &std::path::Path,
            mut contents: headless_lms_utils::file_store::GenericPayload,
            mime_type: &str,
        ) -> UtilResult<()> {
            use futures::StreamExt;
            let mut bytes = Vec::new();
            while let Some(chunk) = contents.next().await {
                bytes.extend_from_slice(&chunk?);
            }
            self.upload(path, bytes, mime_type).await
        }

        async fn download(&self, path: &std::path::Path) -> UtilResult<Vec<u8>> {
            Ok(tokio::fs::read(self.0.path().join(path)).await?)
        }

        async fn download_stream(
            &self,
            _path: &std::path::Path,
        ) -> UtilResult<Box<dyn futures::Stream<Item = std::io::Result<bytes::Bytes>>>> {
            unimplemented!("not reached by these tests")
        }

        async fn get_direct_download_url(&self, _path: &std::path::Path) -> UtilResult<String> {
            unimplemented!("not reached by these tests")
        }

        async fn delete(&self, path: &std::path::Path) -> UtilResult<()> {
            Ok(tokio::fs::remove_file(self.0.path().join(path)).await?)
        }

        fn get_cache_files_folder_path(&self) -> UtilResult<&std::path::Path> {
            Ok(self.0.path())
        }
    }

    fn file_store() -> TempFileStore {
        TempFileStore(tempfile::tempdir().expect("temp dir"))
    }

    async fn insert_task_submission(
        conn: &mut PgConnection,
        course_id: Uuid,
        user_id: Uuid,
        exercise_id: Uuid,
        slide_id: Uuid,
        task_id: Uuid,
    ) -> Uuid {
        let slide_submission =
            models::exercise_slide_submissions::insert_exercise_slide_submission(
                conn,
                NewExerciseSlideSubmission {
                    exercise_slide_id: slide_id,
                    course_id: Some(course_id),
                    exam_id: None,
                    user_id,
                    exercise_id,
                    user_points_update_strategy:
                        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
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
            &serde_json::json!({ "opaque": "plugin owned" }),
        )
        .await
        .expect("task submission")
    }

    /// The upload route's core: parts land in the file store, get `file_uploads` rows, and are
    /// bound to the exercise and user so a later submit can name them.
    #[actix_web::test]
    async fn the_files_route_stores_and_binds_every_part() {
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let store = file_store();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let mut uploaded_paths = Vec::new();

        let uploads = store_client_uploads(
            tx.as_mut(),
            exercise,
            user,
            multipart(&[(first, "a.tar.zst", "first"), (second, "b.txt", "second")]),
            &store,
            &mut uploaded_paths,
            "http://project-331.local",
        )
        .await
        .expect("the upload succeeds");

        assert_eq!(
            uploads
                .iter()
                .map(|u| (u.entry.id.as_str(), u.name.as_str()))
                .collect::<Vec<_>>(),
            vec![
                (first.to_string().as_str(), "a.tar.zst"),
                (second.to_string().as_str(), "b.txt")
            ]
        );
        // The ids the client submits with are the host's, not the field names it chose.
        assert!(
            uploads
                .iter()
                .all(|u| u.file_upload_id.to_string() != u.entry.id)
        );
        assert!(
            uploads
                .iter()
                .all(|u| u.entry.url.contains(CLIENT_UPLOAD_PATH_PREFIX))
        );

        let ids: Vec<Uuid> = uploads.iter().map(|u| u.file_upload_id).collect();
        assert_eq!(
            models::file_uploads::get_many(tx.as_mut(), &ids)
                .await
                .expect("file uploads")
                .len(),
            2
        );
        assert!(
            verify_uploads_belong_to_exercise(tx.as_mut(), exercise, user, &ids)
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
        let store = file_store();
        let mut uploaded_paths = Vec::new();

        let uploads = store_client_uploads(
            tx.as_mut(),
            exercise,
            user,
            multipart(&[
                (Uuid::new_v4(), "a.tar.zst", "first"),
                (Uuid::new_v4(), "b.txt", "second"),
            ]),
            &store,
            &mut uploaded_paths,
            "http://project-331.local",
        )
        .await
        .expect("the upload succeeds");

        let recorded: Vec<&str> = uploaded_paths.iter().map(|p| p.path.as_str()).collect();
        assert_eq!(recorded.len(), uploads.len());
        let ids: Vec<Uuid> = uploads.iter().map(|u| u.file_upload_id).collect();
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
        )
        .await
        .expect("file upload");
        models::exercise_service_client_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
        .await
        .expect("binding");

        assert!(
            verify_uploads_belong_to_exercise(tx.as_mut(), exercise, user, &[file_id])
                .await
                .is_ok()
        );
        let error =
            verify_uploads_belong_to_exercise(tx.as_mut(), other_exercise, user, &[file_id])
                .await
                .expect_err("another exercise must not be able to name this upload");
        assert_eq!(message_key_of(&error), "unknown_upload");
        tx.rollback().await;
    }

    #[actix_web::test]
    async fn a_submit_naming_an_unrecorded_id_is_rejected_as_unknown() {
        insert_data!(:tx, user: user, :org, :course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, task: _task);
        let error =
            verify_uploads_belong_to_exercise(tx.as_mut(), exercise, user, &[Uuid::new_v4()])
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
        )
        .await
        .expect("file upload");
        models::exercise_service_client_uploads::insert_many(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
        .await
        .expect("binding");
        sqlx::query("UPDATE exercise_service_client_uploads SET deleted_at = now() WHERE file_upload_id = $1")
            .bind(file_id)
            .execute(&mut **tx.as_mut())
        .await
        .expect("soft delete");

        let error = verify_uploads_belong_to_exercise(tx.as_mut(), exercise, user, &[file_id])
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
                )
                .await
                .expect("file upload"),
            );
        }
        models::exercise_task_submission_files::insert_many(tx.as_mut(), submission_id, &ids)
            .await
            .expect("associations");

        let store = file_store();
        let files = models::exercise_task_submission_files::get_by_task_submission_ids(
            tx.as_mut(),
            &[submission_id],
        )
        .await
        .expect("submission files");
        let response = submission_files_response(files, &store, &app_conf());

        assert_eq!(
            response
                .files
                .iter()
                .map(|f| (f.id, f.name.as_str(), f.download_url.as_str()))
                .collect::<Vec<_>>(),
            vec![
                (
                    ids[0],
                    "first.txt",
                    "http://project-331.local/api/v0/files/exercise-services-client/first.txt"
                ),
                (
                    ids[1],
                    "second.txt",
                    "http://project-331.local/api/v0/files/exercise-services-client/second.txt"
                ),
                (
                    ids[2],
                    "third.txt",
                    "http://project-331.local/api/v0/files/exercise-services-client/third.txt"
                ),
            ]
        );
        tx.rollback().await;
    }

    /// A submission whose answer needed no files is legitimate; download must report an empty
    /// list rather than the 404 the single-archive contract had to return.
    #[test]
    fn download_reports_an_empty_list_rather_than_failing() {
        let store = file_store();
        let response = submission_files_response(Vec::new(), &store, &app_conf());
        assert!(response.files.is_empty());
    }

    /// `submit_exercise` runs `process_submission` and the file association in one transaction.
    /// This is the property that buys: if the association fails, no submission is left behind for
    /// `download_submission` to be unable to serve. (`process_submission` itself needs a live
    /// exercise service, so the transaction shape is exercised here rather than the handler.)
    #[actix_web::test]
    async fn a_failing_file_association_leaves_no_submission() {
        insert_data!(:tx, user: user, :org, course: course, instance: _instance, :course_module, :chapter, :page, :exercise, :slide, :task);
        let submission_id;
        {
            let mut submit_tx = tx.begin().await;
            submission_id =
                insert_task_submission(submit_tx.as_mut(), course, user, exercise, slide, task)
                    .await;
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
            models::exercise_task_submissions::get_by_id(tx.as_mut(), submission_id)
                .await
                .is_err(),
            "the submission must not survive a failed association"
        );
        tx.rollback().await;
    }

    fn message_key_of(error: &ControllerError) -> String {
        use actix_web::ResponseError;
        use futures_util::FutureExt;
        let response = error.error_response();
        let bytes = actix_web::body::to_bytes(response.into_body())
            .now_or_never()
            .expect("response should resolve immediately")
            .expect("body bytes");
        let value: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
        value["message_key"]
            .as_str()
            .unwrap_or_default()
            .to_string()
    }
}
