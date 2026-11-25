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
use crate::domain::error::{BadRequestReason, ForbiddenReason, bad_request_with_reason};
use crate::domain::exercise_services::token::UserFromOAuthToken;
use crate::domain::models_requests::{self, JwtKey};
use crate::domain::rate_limit_middleware_builder::{EndpointLimiters, RateLimitConfig};
use crate::prelude::*;
use actix_web::FromRequest;
use exercise_services_api as api;
use headless_lms_base::version::Version;
use headless_lms_models::exercises::{ActivityProgress, GradingProgress};
use headless_lms_models::user_exercise_states::{ReviewingStage, UserExerciseState};
use headless_lms_utils::course_url::course_page_url;
use models::CourseOrExamId;
use models::chapters::DatabaseChapter;
use models::exercise_answer_snapshots::{ExerciseAnswerSnapshot, SnapshotPurpose};
use models::exercise_slide_submissions::UserExerciseSlideSubmissionWithGrading;
use models::exercise_task_submissions::AnswerKind;
use models::library::grading::{StudentExerciseSlideSubmission, StudentExerciseTaskSubmission};
use std::collections::{HashMap, HashSet};
use std::future::{Ready, ready};
use std::sync::LazyLock;
use utoipa::{IntoParams, OpenApi};

mod access;
mod exams;
mod progress;
mod submissions;

use access::*;
use exams::*;
use progress::*;
use submissions::*;

#[derive(OpenApi)]
#[openapi(
    paths(
        get_current_user,
        get_courses,
        get_course,
        get_course_exercises,
        get_course_progress,
        get_exams,
        get_exam_exercises,
        get_exercise,
        upload_exercise_files,
        submit_exercise,
        create_answer_snapshot,
        get_submission_grading,
        get_exercise_submissions,
        download_submission,
        share_submission
    ),
    components(schemas(
        api::ExerciseSlideSubmission,
        api::ExerciseSlideSubmissionListItem,
        api::SubmissionKind,
        api::NewAnswerSnapshot,
        api::AnswerSnapshotResult,
        api::SnapshotPurpose,
        api::AnswerFile,
        api::AnswerKind,
        api::UploadedFiles,
        api::SubmissionFiles,
        api::CourseProgress,
        api::ExerciseProgress,
        api::ClosedChapter,
        api::ExerciseStanding,
        api::Exam,
        api::ReviewingStage,
        api::TeacherReview,
        api::TeacherDecision,
        api::PasteResult,
        crate::domain::error::ApiErrorResponse
    ))
)]
pub(crate) struct ExerciseServicesClientRoutesApiDoc;

/// Graded submits per user: each starts a grading run in a sandbox.
static SUBMIT_LIMITS: LazyLock<EndpointLimiters> = LazyLock::new(|| {
    EndpointLimiters::from_config(&RateLimitConfig {
        per_minute: Some(10),
        per_hour: Some(200),
        ..Default::default()
    })
});

/// File uploads per user, each up to the upload size limit.
static UPLOAD_LIMITS: LazyLock<EndpointLimiters> = LazyLock::new(|| {
    EndpointLimiters::from_config(&RateLimitConfig {
        per_minute: Some(20),
        per_hour: Some(400),
        ..Default::default()
    })
});

/// Refuses a request over the user's quota with 429 `rate_limited`. The quota is counted per server
/// process, so with several replicas a user gets that many times the quota at most.
fn check_user_quota(limits: &EndpointLimiters, user_id: Uuid) -> Result<(), ControllerError> {
    limits
        .check_key(user_id.to_string())
        .map_err(|retry_after| {
            controller_err!(
                TooManyRequests(Some(retry_after)),
                "Too many requests; try again later.".to_string()
            )
        })
}

/// Header a client sends to advertise its version, e.g. `0.39.4`.
const CLIENT_VERSION_HEADER: &str = "X-Client-Version";

/// Rejects clients older than `minimum` with `426 Upgrade Required`; a `None` minimum
/// passes everything. When a minimum is set, a missing or unparseable client version
/// counts as obsolete.
fn check_client_version(
    client_version: Option<&str>,
    minimum: Option<Version>,
) -> Result<(), ControllerError> {
    let Some(minimum) = minimum else {
        return Ok(());
    };
    if client_version
        .and_then(Version::parse)
        .is_some_and(|client| client >= minimum)
    {
        return Ok(());
    }
    Err(controller_err!(
        UpgradeRequired,
        format!("This client is obsolete; the minimum supported version is {minimum}.")
    ))
}

/// Extractor guarding every client route: reads `X-Client-Version` and rejects clients older than
/// [`ApplicationConfiguration::exercise_services_client_minimum_version`] before the handler runs.
/// Yields no data; its presence applies the check.
#[derive(Debug)]
pub struct SupportedClient;

impl FromRequest for SupportedClient {
    type Error = ControllerError;
    type Future = Ready<Result<Self, ControllerError>>;

    fn from_request(req: &HttpRequest, _payload: &mut actix_http::Payload) -> Self::Future {
        let Some(app_conf) = req.app_data::<web::Data<ApplicationConfiguration>>() else {
            return ready(Err(controller_err!(
                InternalServerError,
                "Missing application configuration".to_string()
            )));
        };
        let client_version = req
            .headers()
            .get(CLIENT_VERSION_HEADER)
            .and_then(|value| value.to_str().ok());
        ready(
            check_client_version(
                client_version,
                app_conf.exercise_services_client_minimum_version,
            )
            .map(|()| Self),
        )
    }
}

/**
 * GET /api/v0/exercise-services/client/me
 *
 * Returns the user the bearer token acts for.
 */
#[utoipa::path(
    get,
    path = "/me",
    operation_id = "getClientCurrentUser",
    tag = "exercise-services-client",
    security(("bearer_auth" = [])),
    params(
        ("X-Client-Version" = Option<String>, Header, description = "Optional client version; obsolete clients get 426")
    ),
    responses(
        (status = 200, description = "The user the token acts for", body = api::CurrentUser),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_current_user(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::CurrentUser>> {
    let mut conn = pool.acquire().await?;
    // Every token may name its own user.
    let token = skip_authorize();
    let details = models::user_details::get_user_details_by_user_id(&mut conn, user.id)
        .await
        .optional()?;
    let name = details.as_ref().and_then(|d| {
        models::user_details::full_name(d.first_name.as_deref(), d.last_name.as_deref())
    });
    token.authorized_ok(web::Json(api::CurrentUser {
        id: user.id,
        name,
        email: details.map(|d| d.email),
    }))
}

/**
 * GET /api/v0/exercise-services/client/courses
 *
 * Returns the courses that the user is currently enrolled on, or teaches or assists on, that contain
 * exercises this client can be served.
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
        (status = 200, description = "The courses the user is enrolled on or teaches that contain client-servable exercises", body = Vec<api::Course>),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, app_conf))]
async fn get_courses(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::Course>>> {
    let mut conn = pool.acquire().await?;

    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    let courses =
        models::courses::get_client_courses_with_exercise_types(&mut conn, user.id, &capable_slugs)
            .await?
            .into_iter()
            .map(|course| to_api_course(course, &app_conf.base_url))
            .collect();

    // The query lists only courses the user is enrolled on or teaches.
    let token = skip_authorize();
    token.authorized_ok(web::Json(courses))
}

/// The client form of a course the user is enrolled on or teaches.
fn to_api_course(course: models::courses::ClientCourse, base_url: &str) -> api::Course {
    api::Course {
        url: course_page_url(base_url, &course.organization_slug, &course.slug, ""),
        moved_to_course_id: course
            .current_course_id
            .filter(|current| *current != course.id),
        id: course.id,
        slug: course.slug,
        name: course.name,
        description: course.description,
        organization_name: course.organization_name,
        ai_policy: to_api_ai_policy(course.ai_policy),
        language_code: Some(course.language_code),
        language_group_id: Some(course.course_language_group_id),
        closed_at: course.closed_at,
        successor_course_id: course.closed_course_successor_id,
        is_enrolled: Some(course.is_enrolled),
        is_staff: course.is_staff,
    }
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
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`), or the user may not view this course (`no_access`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No course with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool, app_conf))]
async fn get_course(
    pool: web::Data<PgPool>,
    user: UserFromOAuthToken,
    course: web::Path<Uuid>,
    app_conf: web::Data<ApplicationConfiguration>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::Course>> {
    let mut conn = pool.acquire().await?;
    let course = models::courses::get_course(&mut conn, *course).await?;
    let token = authorize_course_access(&mut conn, user.id, course.id).await?;

    let org = models::organizations::get_organization(&mut conn, course.organization_id).await?;
    let current_course_id = models::user_course_settings::get_user_course_settings_by_course_id(
        &mut conn, user.id, course.id,
    )
    .await?
    .map(|settings| settings.current_course_id);
    let is_enrolled = !models::course_instance_enrollments::get_by_user_id_and_course_ids(
        &mut conn,
        user.id,
        &[course.id],
    )
    .await?
    .is_empty();
    let is_staff = is_course_staff(&mut conn, user.id, course.id).await?;
    let course = to_api_course(
        models::courses::ClientCourse {
            id: course.id,
            slug: course.slug,
            name: course.name,
            description: course.description,
            ai_policy: course.ai_policy,
            language_code: course.language_code,
            course_language_group_id: course.course_language_group_id,
            closed_at: course.closed_at,
            closed_course_successor_id: course.closed_course_successor_id,
            organization_name: org.name,
            organization_slug: org.slug,
            current_course_id,
            is_enrolled,
            is_staff,
        },
        &app_conf.base_url,
    );

    token.authorized_ok(web::Json(course))
}

fn to_api_ai_policy(policy: models::courses::CourseAiPolicy) -> api::CourseAiPolicy {
    use models::courses::CourseAiPolicy as Db;
    match policy {
        Db::NotSet => api::CourseAiPolicy::NotSet,
        Db::NoAi => api::CourseAiPolicy::NoAi,
        Db::PlanningOnly => api::CourseAiPolicy::PlanningOnly,
        Db::Limited => api::CourseAiPolicy::Limited,
        Db::FullUse => api::CourseAiPolicy::FullUse,
        Db::Required => api::CourseAiPolicy::Required,
    }
}

/**
 * GET /api/v0/exercise-services/client/courses/:id/exercises
 *
 * Returns the user's exercise slides for the given course, in the order of the course material:
 * by chapter, then by page, then by position on the page.
 * Does not return anything for chapters which are not open yet, unless the user may view them
 * before they open.
 * Selects slides for exercises with no slide selected yet.
 * Only returns slides all of whose tasks' exercise services can serve this client.
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
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`), or the user may not view this course (`no_access`)", body = crate::domain::error::ApiErrorResponse),
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
    let token = authorize_course_access(&mut conn, user.id, *course).await?;

    let capable_slugs = native_client_capable_slugs(&mut conn).await?;
    let mut slides = Vec::new();
    let open_chapters = course_chapters(&mut conn, user.id, *course).await?.open;

    let course = models::courses::get_course(&mut conn, *course).await?;
    let locking_statuses = chapter_locking_statuses(&mut conn, user.id, &course).await?;
    let organization =
        models::organizations::get_organization(&mut conn, course.organization_id).await?;
    let pages = models::pages::get_pages_by_course_id(&mut conn, course.id).await?;
    let page_order_numbers: HashMap<Uuid, i32> = pages
        .iter()
        .map(|page| (page.id, page.order_number))
        .collect();
    let page_url_paths: HashMap<Uuid, String> = pages
        .into_iter()
        .map(|page| (page.id, page.url_path))
        .collect();
    let mut open_chapter_exercises: Vec<_> =
        models::exercises::get_exercises_by_course_id(&mut conn, course.id)
            .await?
            .into_iter()
            .filter(|e| {
                e.chapter_id
                    .map(|ci| open_chapters.contains_key(&ci))
                    .unwrap_or_default()
            })
            .collect();
    sort_in_material_order(
        &mut open_chapter_exercises,
        &open_chapters,
        &page_order_numbers,
    );
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
            let chapter = open_exercise
                .chapter_id
                .and_then(|id| open_chapters.get(&id));
            let deadline = open_exercise.effective_deadline(chapter.and_then(|c| c.deadline));
            slides.push(api::ExerciseSlide {
                slide_id: slide.id,
                exercise_id: open_exercise.id,
                course_id: course.id,
                exam_id: None,
                exercise_name: open_exercise.name,
                exercise_order_number: open_exercise.order_number,
                deadline,
                tasks,
                page_url: page_url_paths
                    .get(&open_exercise.page_id)
                    .and_then(|url_path| {
                        course_page_url(
                            &app_conf.base_url,
                            &organization.slug,
                            &course.slug,
                            url_path,
                        )
                    }),
                chapter: chapter.map(|c| exercise_chapter(c, &locking_statuses)),
            });
        }
    }

    token.authorized_ok(web::Json(slides))
}

/// Sorts a course's exercises as its material lists them: by chapter, then page, then position on
/// the page. `chapters` holds the chapters of the exercises being sorted.
fn sort_in_material_order(
    exercises: &mut [models::exercises::Exercise],
    chapters: &HashMap<Uuid, DatabaseChapter>,
    page_order_numbers: &HashMap<Uuid, i32>,
) {
    exercises.sort_by_key(|exercise| {
        (
            exercise
                .chapter_id
                .and_then(|id| chapters.get(&id))
                .map(|chapter| chapter.chapter_number),
            page_order_numbers.get(&exercise.page_id).copied(),
            exercise.order_number,
            exercise.id,
        )
    });
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
        (status = 403, description = "The token lacks the `exercise-services` scope (message_key `insufficient_scope`), the user may not view this exercise (`no_access`), or the exercise's chapter has not opened yet (`chapter_not_open_yet`)", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists, it belongs to an exam the user has not started or can no longer answer, or a task of its slide cannot be served to this client", body = crate::domain::error::ApiErrorResponse),
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
    .await
    .map_err(keyed_no_access)?;

    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    if let Some(exam_id) = exercise.exam_id {
        // Checked before selecting a slide, which would be stored for the user.
        let exam = answerable_exam_or_not_found(&mut conn, exam_id, user.id).await?;
        let capable_slugs = native_client_capable_slugs(&mut conn).await?;
        let slide = exam_exercise_slide(
            &mut conn,
            user.id,
            &exam,
            exercise,
            &capable_slugs,
            file_store.as_ref(),
            app_conf.as_ref(),
        )
        .await?
        .ok_or_else(|| {
            controller_err!(
                NotFound,
                "This exercise has a task this client cannot answer, so it must be answered in the exam".to_string()
            )
        })?;
        return token.authorized_ok(web::Json(slide));
    }
    if let Some(course_id) = exercise.course_id {
        authorize_access_to_exercise_chapter(&mut conn, user.id, course_id, exercise.chapter_id)
            .await?;
    }
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
            return Err(not_enrolled_error());
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
    let chapter = match exercise.chapter_id {
        Some(chapter_id) => Some(models::chapters::get_chapter(&mut conn, chapter_id).await?),
        None => None,
    };
    let deadline = exercise.effective_deadline(chapter.as_ref().and_then(|c| c.deadline));
    let reveal_model_solution = crate::domain::exercises::reveals_model_solution(
        &mut conn,
        &exercise,
        deadline,
        score_given,
        slide_submission_count,
    )
    .await?
        || is_course_staff(&mut conn, user.id, course_id).await?;

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
            "This exercise has a task this client cannot answer, so it must be answered in the course material".to_string()
        ));
    }

    let course = models::courses::get_course(&mut conn, course_id).await?;
    let organization =
        models::organizations::get_organization(&mut conn, course.organization_id).await?;
    let page = models::pages::get_page(&mut conn, exercise.page_id).await?;
    let locking_statuses = chapter_locking_statuses(&mut conn, user.id, &course).await?;
    token.authorized_ok(web::Json(api::ExerciseSlide {
        slide_id: exercise_slide.id,
        exercise_id: exercise.id,
        course_id,
        exam_id: None,
        exercise_name: exercise.name,
        exercise_order_number: exercise.order_number,
        deadline,
        tasks,
        page_url: course_page_url(
            &app_conf.base_url,
            &organization.slug,
            &course.slug,
            &page.url_path,
        ),
        chapter: chapter
            .as_ref()
            .map(|c| exercise_chapter(c, &locking_statuses)),
    }))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/me", web::get().to(get_current_user))
        .route("/courses", web::get().to(get_courses))
        .route("/courses/{id}", web::get().to(get_course))
        .route(
            "/courses/{id}/exercises",
            web::get().to(get_course_exercises),
        )
        .route("/courses/{id}/progress", web::get().to(get_course_progress))
        .route("/exams", web::get().to(get_exams))
        .route("/exams/{id}/exercises", web::get().to(get_exam_exercises))
        .route("/exercises/{id}", web::get().to(get_exercise))
        .route(
            "/exercises/{id}/files",
            web::post().to(upload_exercise_files),
        )
        .route("/exercises/{id}/submit", web::post().to(submit_exercise))
        .route(
            "/exercises/{id}/snapshots",
            web::post().to(create_answer_snapshot),
        )
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
mod tests;

#[cfg(test)]
mod upload_tests;

/// Route-level tests: the two write routes driven through actix, so the extractors, the
/// authorization call, the multipart parsing and the error mapping are all in the picture. The
/// helper-level tests above cover the individual checks; these cover the wiring, which is where a
/// handler stops matching its own OpenAPI annotations.
///
/// Fixtures are committed, because the handlers acquire their own pool connections and cannot see
/// an open transaction. Nothing left behind is reapable (every client upload here is fresh, so it
/// is inside the retention window), which is what keeps the reaper's unfiltered tests unaffected.
#[cfg(test)]
mod route_tests;
