/*!
Handlers for `/api/v0/exercise-services/client`.

A generic native-client API for exercise services: over plain HTTP it plays the role an
exercise service's in-browser IFrame plays on the web (download a stub, edit locally,
submit, poll grading, review old submissions). Specs and answers stay opaque plugin-owned
blobs the host only forwards.

Which services this API serves is not hardcoded: an exercise service is served exactly when it
declares `supports_native_client` in its service info. The course/exercise queries filter on that
capability, and submit rejects a task whose service lacks it.
*/
use crate::controllers::helpers::file_uploading;
use crate::domain::error::{BadRequestReason, bad_request_with_reason};
use crate::domain::exercise_services::token::UserFromOAuthToken;
use crate::domain::models_requests::{self, JwtKey};
use crate::prelude::*;
use actix_web::FromRequest;
use exercise_services_api as api;
use headless_lms_models::exercises::{ActivityProgress, GradingProgress};
use headless_lms_models::user_exercise_states::UserExerciseState;
use models::CourseOrExamId;
use models::chapters::DatabaseChapter;
use models::exercise_task_submissions::AnswerKind;
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
        api::AnswerFile,
        api::AnswerKind,
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

/// Slugs of the exercise services this API can serve: exactly those declaring
/// `supports_native_client`.
///
/// Reads the `exercise_service_info` cache, which `service-info-fetcher` refreshes about once a
/// minute; fetching live would fan every request out to every exercise service. An empty set
/// therefore usually means that fetcher is down or cold, which the client sees only as empty
/// course and exercise lists — hence the warning.
async fn native_client_capable_slugs(conn: &mut PgConnection) -> ModelResult<Vec<String>> {
    let slugs = models::exercise_services::get_native_client_capable_slugs(conn).await?;
    if slugs.is_empty() {
        warn!(
            "No exercise service declares supports_native_client, so the client API can serve nothing. Check that service-info-fetcher is running."
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

/// Ids of the course's currently open chapters. Shared by the exercise list and progress views
/// so their visibility rules cannot drift apart.
async fn open_chapter_ids(conn: &mut PgConnection, course_id: Uuid) -> ModelResult<HashSet<Uuid>> {
    Ok(models::chapters::get_course_chapters(conn, course_id)
        .await?
        .into_iter()
        .filter(DatabaseChapter::has_opened)
        .map(|c| c.id)
        .collect())
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
        (status = 403, description = "The token lacks the `exercise-services` scope", body = crate::domain::error::ApiErrorResponse),
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
        (status = 403, description = "The token lacks the `exercise-services` scope, or the user may not view this course", body = crate::domain::error::ApiErrorResponse),
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
        (status = 403, description = "The token lacks the `exercise-services` scope, or the user may not view this course", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No course with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_course_exercises(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    course: web::Path<Uuid>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::ExerciseSlide>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course)).await?;

    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    let mut slides = Vec::new();
    let open_chapter_ids = open_chapter_ids(&mut conn, *course).await?;

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
            file_store.as_ref(),
            app_conf.as_ref(),
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
        (status = 403, description = "The token lacks the `exercise-services` scope, or the user may not view this course", body = crate::domain::error::ApiErrorResponse),
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
    let open_chapter_ids = open_chapter_ids(&mut conn, course.id).await?;

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
        (status = 403, description = "The token lacks the `exercise-services` scope, or the user may not view this exercise", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists, it belongs to an exam (not served by this API), or no task of it can serve this client", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user is not enrolled to this exercise's course (message_key `not_enrolled`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_exercise(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    exercise_id: web::Path<Uuid>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
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
        file_store.as_ref(),
        app_conf.as_ref(),
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

/// Rejects access to a submission owned by a different user.
fn verify_submission_owner(
    submission_user_id: Uuid,
    user_id: Uuid,
    forbidden_message: String,
) -> Result<(), ControllerError> {
    if submission_user_id != user_id {
        return Err(controller_err!(Forbidden, forbidden_message));
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
 * whole exercise here, because this route is bound to an exercise rather than a slide.
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
        (status = 403, description = "The token lacks the `exercise-services` scope, or the user may not view this exercise", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user is not enrolled to this exercise's course (message_key `not_enrolled`), the exercise can no longer be answered because its deadline has passed or every slide is out of tries, or the multipart body violates the field-name, file-count or size rules", body = crate::domain::error::ApiErrorResponse),
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
    domain::exercises::verify_user_can_answer_exercise(&mut conn, user.id, &exercise).await?;

    let mut cleanup = file_uploading::UploadCleanup::new(file_store.clone());
    let stored = store_client_uploads(
        &mut conn,
        exercise.id,
        user.id,
        payload,
        file_store.as_ref(),
        &mut cleanup.uploaded_paths,
        &app_conf.base_url,
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
    let file_upload_ids: Vec<Uuid> = uploads.iter().map(|u| u.entry.id).collect();
    models::exercise_answer_uploads::insert_many(
        &mut tx,
        exercise_id,
        user_id,
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
        (status = 403, description = "The token lacks the `exercise-services` scope, or the user may not view this exercise", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists, or the referenced slide/task does not exist", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user is not enrolled to this exercise's course (message_key `not_enrolled`), the referenced slide/task belongs to another exercise, the task's exercise service cannot be served to this client, a `file` answer names no files or a `json` one names files, or a named upload was reaped (`upload_expired`), was never uploaded for this exercise by this user (`unknown_upload`) or was named more than once (`duplicate_upload`)", body = crate::domain::error::ApiErrorResponse),
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
#[instrument(skip(pool, file_store, app_conf))]
async fn get_submission_grading(
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
        (status = 403, description = "The token lacks the `exercise-services` scope", body = crate::domain::error::ApiErrorResponse),
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
        (status = 200, description = "The files the submission was made from, in the order they were recorded; the same shape whether the submission came from a native client or the service's IFrame", body = api::SubmissionFiles),
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
    )))
}

/// The client API's answer kind as the model's. Two enums rather than one because the client crate
/// stays free of server-internal dependencies.
fn model_answer_kind(kind: api::AnswerKind) -> AnswerKind {
    match kind {
        api::AnswerKind::Json => AnswerKind::Json,
        api::AnswerKind::File => AnswerKind::File,
    }
}

/// Turns the host's own file records into the download response. Every tracked file is reachable,
/// not just the first, so a multi-file submission is fully restorable.
fn submission_files_response(
    files: Vec<models::exercise_task_submission_files::SubmissionFile>,
    file_store: &dyn FileStore,
    app_conf: &ApplicationConfiguration,
) -> api::SubmissionFiles {
    api::SubmissionFiles {
        data_files: files
            .into_iter()
            .map(|file| api::AnswerFile {
                id: file.file_upload_id,
                name: file.name,
                mime: file.mime,
                size_bytes: file.size_bytes,
                order_number: Some(file.order_number),
                url: file_store.get_download_url(Path::new(&file.path), app_conf),
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
    verify_submission_owner(
        slide_submission.user_id,
        user.id,
        "Cannot share another user's submission".to_string(),
    )?;
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

        let json_answer =
            serde_json::from_value::<api::ExerciseSlideSubmission>(serde_json::json!({
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
    use crate::domain::exercise_services::answer_uploads;
    use crate::test_helper::*;
    use actix_web::http::header::{CONTENT_TYPE, HeaderMap};
    use headless_lms_base::config::{
        ApplicationConfiguration, OAuthServerConfiguration, SuotarConfiguration,
    };
    use models::exercise_slide_submissions::NewExerciseSlideSubmission;
    use models::exercise_task_gradings::UserPointsUpdateStrategy;
    use secrecy::SecretString;

    const BOUNDARY: &str = "clientuploadboundary";

    pub(super) fn app_conf() -> ApplicationConfiguration {
        ApplicationConfiguration {
            base_url: "http://project-331.local".to_string(),
            test_mode: true,
            test_chatbot: false,
            test_sisu: false,
            test_suotar: false,
            disable_embedding_vector_creation_when_seeding: false,
            suotar_configuration: SuotarConfiguration::mock_conf("http://project-331.local")
                .expect("Failed to build the mock Suotar configuration"),
            development_uuid_login: false,
            enable_admin_email_verification: false,
            enable_email_ownership_verification: false,
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
            uploads.iter().map(|u| u.name.as_str()).collect::<Vec<_>>(),
            vec!["a.tar.zst", "b.txt"]
        );
        // The ids the client submits with are the host's, not the field names it chose.
        assert!(
            uploads
                .iter()
                .all(|u| u.entry.id != first && u.entry.id != second)
        );
        assert!(
            uploads
                .iter()
                .all(|u| u.entry.url.contains(CLIENT_UPLOAD_PATH_PREFIX))
        );

        let ids: Vec<Uuid> = uploads.iter().map(|u| u.entry.id).collect();
        assert_eq!(
            models::file_uploads::get_many(tx.as_mut(), &ids)
                .await
                .expect("file uploads")
                .len(),
            2
        );
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
                },
            )
            .await
            .expect("service info");
            slugs_of.push(slug);
        }

        let capable = native_client_capable_slugs(tx.as_mut())
            .await
            .expect("capable slugs");
        let visible = client_tasks_from_slide(
            slugs_of.iter().map(|slug| tests::task_with(slug)).collect(),
            &capable,
            false,
        );
        assert_eq!(
            visible
                .iter()
                .map(|task| task.exercise_service_slug.as_str())
                .collect::<Vec<_>>(),
            vec![slugs_of[0].as_str()],
            "only the declaring service may be offered to a client"
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
            answer_uploads::verify_uploads_belong_to_exercise(
                tx.as_mut(),
                exercise,
                user,
                &[file_id]
            )
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

        let error = answer_uploads::verify_uploads_belong_to_exercise(
            tx.as_mut(),
            exercise,
            user,
            &[file_id],
        )
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
        let response = submission_files_response(files, &store, &app_conf());

        assert_eq!(
            response
                .data_files
                .iter()
                .map(|f| (f.id, f.name.as_str(), f.url.as_str()))
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
        let store = temp_file_store();
        let response = submission_files_response(Vec::new(), &store, &app_conf());
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
}

/// Route-level tests: the two write routes driven through actix, so the extractors, the
/// authorization call, the multipart parsing and the error mapping are all in the picture. The
/// helper-level tests above cover the individual checks; these cover the wiring, which is where a
/// handler stops matching its own OpenAPI annotations.
///
/// Fixtures are committed, because the handlers acquire their own pool connections and cannot see
/// an open transaction. Nothing left behind is reapable (every client upload here is fresh, so it
/// is inside the retention window), which is what keeps the reaper's unfiltered tests unaffected.
#[cfg(test)]
mod route_tests {
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
    use headless_lms_models::oauth_access_token::{
        NewAccessTokenParams, OAuthAccessToken, TokenType,
    };
    use headless_lms_models::oauth_client::{
        ApplicationType, NewClientParams, OAuthClient, TokenEndpointAuthMethod,
    };
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
        /// A task of the fixture exercise whose exercise service does not declare
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
            },
        )
        .await
        .expect("access token");
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
    /// The exercise carries two tasks: the fixture macro's, whose exercise service cannot serve
    /// this client, and `task`, whose service can.
    async fn committed_fixture(enrolled: bool) -> Fixture {
        committed_fixture_with_service(enrolled, None).await
    }

    async fn committed_fixture_with_service(
        enrolled: bool,
        service_internal_url: Option<String>,
    ) -> Fixture {
        insert_data!(:tx, user: user, :org, course: course, instance: instance, :course_module, :chapter, :page, exercise: exercise, slide: slide, task: _unservable_task);
        let task = insert_client_capable_task(tx.as_mut(), slide, service_internal_url).await;
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
            let pool = PgPool::connect(&test_database_url()).await.expect("pool");
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

    fn upload_request(
        exercise: Uuid,
        token: &str,
        parts: &[(Uuid, &str, &str)],
    ) -> test::TestRequest {
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
    }

    async fn expire_deadline(exercise: Uuid) {
        let mut conn = PgConnection::connect(&test_database_url())
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
        body.push_str(
            "Content-Disposition: form-data; name=\"not-a-uuid\"; filename=\"b.txt\"\r\n",
        );
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

        let namespace = store_path.join(CLIENT_UPLOAD_PATH_PREFIX);
        let leftovers: Vec<String> = std::fs::read_dir(&namespace)
            .map(|entries| {
                entries
                    .map(|entry| {
                        entry
                            .expect("dir entry")
                            .file_name()
                            .to_string_lossy()
                            .into_owned()
                    })
                    .collect()
            })
            .unwrap_or_default();
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
        let mut conn = PgConnection::connect(&test_database_url())
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
        let mut conn = PgConnection::connect(&test_database_url())
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

    /// Path of the object a file's `url` names, for reading it back out of the file store.
    fn object_path(url: &str) -> &str {
        url.split_once("/api/v0/files/").expect("a files URL").1
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
                    let served_from = &url[..url.len() - object_path(url).len()];
                    canonical.insert(
                        "url".to_string(),
                        serde_json::json!(format!("{served_from}<object>")),
                    );
                    serde_json::Value::Object(canonical)
                })
                .collect::<Vec<_>>(),
        })
    }

    /// What a client actually gets when it follows every file's `url`, in order.
    async fn served_files(
        store: &dyn FileStore,
        body: &serde_json::Value,
    ) -> Vec<(String, String)> {
        let mut served = Vec::new();
        for file in body["data_files"].as_array().expect("data_files") {
            let url = file["url"].as_str().expect("url");
            let bytes = store
                .download(std::path::Path::new(object_path(url)))
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
}
