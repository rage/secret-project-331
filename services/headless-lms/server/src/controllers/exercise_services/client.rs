/*!
Handlers for `/api/v0/exercise-services/client`.

A generic native-client API for exercise services: over plain HTTP it plays the role an
exercise service's in-browser IFrame plays on the web (download a stub, edit locally,
submit, poll grading, review old submissions). Specs and answers stay opaque plugin-owned
blobs the host only forwards.

The surface is service-neutral, but the only service served today is `tmc`: the
course/exercise queries filter to `exercise_service_slug == "tmc"`, since the
download→edit→submit archive loop is intrinsic to the programming-exercise type.
*/
use crate::controllers::helpers::file_uploading;
use crate::domain::error::BadRequestReason;
use crate::domain::exercise_services::tmc_editor_answer::EditorAnswer;
use crate::domain::exercise_services::token::UserFromTMCAccessToken;
use crate::domain::models_requests::{self, JwtKey};
use crate::prelude::*;
use actix_multipart::form::MultipartForm;
use actix_multipart::form::json::Json as MultipartJson;
use actix_multipart::form::tempfile::TempFile;
use actix_web::FromRequest;
use exercise_services_api as api;
use headless_lms_models::exercises::GradingProgress;
use headless_lms_utils::file_store::file_utils;
use models::CourseOrExamId;
use models::chapters::DatabaseChapter;
use models::library::grading::{StudentExerciseSlideSubmission, StudentExerciseTaskSubmission};
use std::collections::HashSet;
use std::future::{Ready, ready};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        get_courses,
        get_course,
        get_course_exercises,
        get_exercise,
        submit_exercise,
        get_submission_grading,
        get_exercise_submissions,
        download_submission,
        share_submission
    ),
    components(schemas(
        api::ExerciseSlideSubmission,
        api::ExerciseSlideSubmissionListItem,
        api::SubmissionArchiveDownloadUrl,
        api::PasteResult,
        crate::domain::error::ApiErrorResponse
    ))
)]
pub(crate) struct ExerciseServicesClientRoutesApiDoc;

/// Header a client sends to advertise its version, e.g. `0.39.4`.
const CLIENT_VERSION_HEADER: &str = "X-Client-Version";

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
 * Returns the courses that the user is currently enrolled on that contain TMC exercises.
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
        (status = 200, description = "The courses the user is enrolled on that contain TMC exercises", body = Vec<api::Course>),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_courses(
    pool: web::Data<PgPool>,
    user: UserFromTMCAccessToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::Course>>> {
    let mut conn = pool.acquire().await?;

    let courses =
        models::course_instances::get_enrolled_course_instances_for_user_with_exercise_type(
            &mut conn, user.id, "tmc",
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
    user: UserFromTMCAccessToken,
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
 * Only returns slides which have tasks that are compatible with the client (tmc).
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
        (status = 200, description = "The user's TMC-compatible exercise slides for open chapters", body = Vec<api::ExerciseSlide>),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No course with the given id exists", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_course_exercises(
    pool: web::Data<PgPool>,
    user: UserFromTMCAccessToken,
    course: web::Path<Uuid>,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::ExerciseSlide>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course)).await?;

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
        let tasks: Vec<api::ExerciseTask> = slide
            .exercise_tasks
            .into_iter()
            .filter(|et| et.exercise_service_slug == "tmc")
            // TODO: hide model solutions for unsolved tasks
            .map(|mut et| {
                et.model_solution_spec = None;
                et
            })
            .map(|et| api::ExerciseTask {
                task_id: et.id,
                order_number: et.order_number,
                assignment: et.assignment,
                public_spec: et.public_spec,
                model_solution_spec: et.model_solution_spec,
                exercise_service_slug: et.exercise_service_slug,
            })
            .collect();
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
        (status = 200, description = "An exercise slide for the user", body = api::ExerciseSlide),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists, or it belongs to an exam (not served by this API)", body = crate::domain::error::ApiErrorResponse),
        (status = 422, description = "The user is not enrolled to this exercise's course (message_key `not_enrolled`)", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn get_exercise(
    pool: web::Data<PgPool>,
    user: UserFromTMCAccessToken,
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
    // `get_by_id` above already 404s an unknown id, so the exercise exists here.
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
            // No resolvable course context for this signed-in user: not enrolled.
            return Err(ControllerError::new(
                ControllerErrorType::BadRequestWithReason(BadRequestReason::NotEnrolled),
                "User is not enrolled to this exercise's course".to_string(),
                None,
            ));
        }
    };

    token.authorized_ok(web::Json(api::ExerciseSlide {
        slide_id: exercise_slide.id,
        exercise_id: exercise.id,
        course_id,
        exercise_name: exercise.name,
        exercise_order_number: exercise.order_number,
        deadline: exercise.deadline,
        tasks: exercise_slide
            .exercise_tasks
            .into_iter()
            .map(|et| api::ExerciseTask {
                task_id: et.id,
                order_number: et.order_number,
                assignment: et.assignment,
                public_spec: et.public_spec,
                model_solution_spec: et.model_solution_spec,
                exercise_service_slug: et.exercise_service_slug,
            })
            .collect(),
    }))
}

#[derive(MultipartForm)]
struct SubmissionForm {
    submission: MultipartJson<api::ExerciseSlideSubmission>,
    file: TempFile,
}

/**
 * POST /api/v0/exercise-services/client/exercises/:id/submit
 *
 * Accepts an exercise submission from the user.
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
    request_body(
        content = String,
        content_type = "multipart/form-data",
        description = "Multipart form with a `submission` part containing a JSON `ExerciseSlideSubmission` and a `file` part containing the exercise archive"
    ),
    responses(
        (status = 200, description = "The created submission", body = api::ExerciseTaskSubmissionResult),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No exercise with the given id exists, or the referenced slide/task does not exist", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[allow(clippy::too_many_arguments)]
async fn submit_exercise(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    jwt_key: web::Data<JwtKey>,
    exercise_id: web::Path<Uuid>,
    submission: MultipartForm<SubmissionForm>,
    user: UserFromTMCAccessToken,
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

    let submission_form = submission.into_inner();
    let submission = submission_form.submission.into_inner();
    let temp_file = submission_form.file;
    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let course_id = exercise
        .course_id
        .ok_or_else(|| anyhow::anyhow!("Cannot answer non-course exercises"))?;
    let exercise_slide =
        models::exercise_slides::get_exercise_slide(&mut conn, submission.exercise_slide_id)
            .await?;
    let exercise_task =
        models::exercise_tasks::get_exercise_task_by_id(&mut conn, submission.exercise_task_id)
            .await?;

    let file = temp_file.file.into_file();
    let mime = temp_file
        .content_type
        .ok_or_else(|| anyhow::anyhow!("Missing content-type header"))?;
    let contents = file_utils::file_to_payload(file);
    let (_upload_id, upload_path) = file_uploading::upload_exercise_archive(
        &mut conn,
        contents,
        file_store.as_ref(),
        file_uploading::ExerciseTaskInfo {
            course_id,
            exercise: &exercise,
            exercise_slide: &exercise_slide,
            exercise_task: &exercise_task,
        },
        mime,
        user.id,
    )
    .await?;

    // wrap the uploaded archive URL in the editor answer the tmc service expects
    let download_url = file_store.get_download_url(&upload_path, app_conf.as_ref());
    let data_json = serde_json::to_value(EditorAnswer::new(download_url))?;
    let result = domain::exercises::process_submission(
        &mut conn,
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
    .await?;

    // one task submission in, so exactly one result out
    let submission = result
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
    let result = api::ExerciseTaskSubmissionResult {
        submission_id: submission.submission.id,
    };
    token.authorized_ok(web::Json(result))
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
    user: UserFromTMCAccessToken,
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
    user: UserFromTMCAccessToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<Vec<api::ExerciseSlideSubmissionListItem>>> {
    let mut conn = pool.acquire().await?;
    // The query is scoped to the current user, so no further authorization is needed.
    let token = skip_authorize();

    let submissions = models::exercise_slide_submissions::get_users_submissions_for_exercise(
        &mut conn,
        user.id,
        *exercise_id,
    )
    .await?;

    let mut items = Vec::with_capacity(submissions.len());
    for submission in submissions {
        // an editor slide has a single task, so its grading is the slide's grading
        let task_submissions =
            models::exercise_task_submissions::get_by_exercise_slide_submission_id(
                &mut conn,
                submission.id,
            )
            .await?;
        let grading = match task_submissions.first() {
            Some(task_submission) => {
                models::exercise_task_gradings::get_by_exercise_task_submission_id(
                    &mut conn,
                    task_submission.id,
                )
                .await?
            }
            None => None,
        };
        items.push(api::ExerciseSlideSubmissionListItem {
            id: submission.id,
            exercise_id: submission.exercise_id,
            created_at: submission.created_at,
            score_given: grading.as_ref().and_then(|g| g.score_given),
            grading_progress: grading.map(|g| map_grading_progress(g.grading_progress)),
        });
    }

    token.authorized_ok(web::Json(items))
}

/**
 * GET /api/v0/exercise-services/client/submissions/:id/download
 *
 * Resolves an exercise-slide submission (by the id returned from the submissions
 * list) to the file-store URL of the archive that was submitted, so the client
 * can re-download an old submission.
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
        (status = 200, description = "The download URL of the submitted archive", body = api::SubmissionArchiveDownloadUrl),
        (status = 401, description = "The bearer token is missing or was rejected", body = crate::domain::error::ApiErrorResponse),
        (status = 403, description = "Cannot download another user's submission", body = crate::domain::error::ApiErrorResponse),
        (status = 404, description = "No submission with the given id exists, or it has no downloadable archive", body = crate::domain::error::ApiErrorResponse),
        (status = 426, description = "The client is obsolete and must be upgraded", body = crate::domain::error::ApiErrorResponse)
    )
)]
#[instrument(skip(pool))]
async fn download_submission(
    pool: web::Data<PgPool>,
    submission_id: web::Path<Uuid>,
    user: UserFromTMCAccessToken,
    _client: SupportedClient,
) -> ControllerResult<web::Json<api::SubmissionArchiveDownloadUrl>> {
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
    // the archive URL lives in the task submission's `data_json` as the editor answer
    // written by `submit_exercise`
    let archive_download_url = task_submissions
        .into_iter()
        .find_map(|task_submission| {
            task_submission
                .data_json
                .and_then(|data| serde_json::from_value::<EditorAnswer>(data).ok())
                .map(|answer| answer.archive_download_url)
        })
        .ok_or_else(|| {
            controller_err!(
                NotFound,
                "Submission has no downloadable archive".to_string()
            )
        })?;

    token.authorized_ok(web::Json(api::SubmissionArchiveDownloadUrl {
        archive_download_url,
    }))
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
    user: UserFromTMCAccessToken,
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
        .route("/exercises/{id}", web::get().to(get_exercise))
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
}
