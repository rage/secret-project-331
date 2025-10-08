/*!
Handlers for HTTP requests to `/api/v0/langs`. Contains endpoints for the use of tmc-langs.

*/
use crate::controllers::helpers::file_uploading;
use crate::domain::langs::token::AuthToken;
use crate::domain::models_requests::{self, JwtKey};
use crate::prelude::*;
use actix_multipart::form::MultipartForm;
use actix_multipart::form::json::Json as MultipartJson;
use actix_multipart::form::tempfile::TempFile;
use headless_lms_models::exercises::GradingProgress;
use headless_lms_utils::file_store::file_utils;
use models::CourseOrExamId;
use models::chapters::DatabaseChapter;
use models::library::grading::{StudentExerciseSlideSubmission, StudentExerciseTaskSubmission};
use mooc_langs_api as api;
use std::collections::HashSet;

/**
 * GET /api/v0/langs/courses
 *
 * Returns the courses that the user is currently enrolled on that contain TMC exercises.
 */
#[instrument(skip(pool))]
async fn get_courses(
    pool: web::Data<PgPool>,
    user: AuthToken,
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

    // if the user is enrolled on the course, they should be able to view it regardless of permissions
    let token = skip_authorize();
    token.authorized_ok(web::Json(courses))
}

/**
 * GET /api/v0/langs/courses/:id
 *
 * Returns the course with the given id.
 */
#[instrument(skip(pool))]
async fn get_course(
    pool: web::Data<PgPool>,
    user: AuthToken,
    course: web::Path<Uuid>,
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
 * GET /api/v0/langs/courses/:id/exercises
 *
 * Returns the user's exercise slides for the given course.
 * Does not return anything for chapters which are not open yet.
 * Selects slides for exercises with no slide selected yet.
 * Only returns slides which have tasks that are compatible with langs.
 */
#[instrument(skip(pool))]
async fn get_course_exercises(
    pool: web::Data<PgPool>,
    user: AuthToken,
    course: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<api::ExerciseSlide>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course)).await?;

    let mut slides = Vec::new();
    // process only exercises of open chapters
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
            // filter out all non-tmc tasks
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
        // do not include slides with no tmc tasks
        if !tasks.is_empty() {
            slides.push(api::ExerciseSlide {
                slide_id: slide.id,
                exercise_id: open_exercise.id,
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
 * GET /api/v0/langs/exercises/:id
 *
 * Returns an exercise slide for the user for the given exercise.
 *
 * Only returns slides
 */
#[instrument(skip(pool))]
async fn get_exercise(
    pool: web::Data<PgPool>,
    user: AuthToken,
    exercise_id: web::Path<Uuid>,
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
    match course_or_exam_id {
        Some(CourseOrExamId::Course(_id)) => {}
        _ => {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "User is not enrolled to this exercise's course".to_string(),
                None,
            ));
        }
    }

    token.authorized_ok(web::Json(api::ExerciseSlide {
        slide_id: exercise_slide.id,
        exercise_id: exercise.id,
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
 * POST /api/v0/langs/exercises/:id/submit
 *
 * Accepts an exercise submission from the user.
 */
async fn submit_exercise(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    jwt_key: web::Data<JwtKey>,
    exercise_id: web::Path<Uuid>,
    submission: MultipartForm<SubmissionForm>,
    user: AuthToken,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<api::ExerciseTaskSubmissionResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await?;

    // first get all the relevant data
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

    // upload the exercise file
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

    // send submission to the exercise service
    let download_url = file_store.get_download_url(&upload_path, app_conf.as_ref());
    // `services/tmc/src/util/stateInterfaces.ts/EditorAnswer
    let data_json = serde_json::json!({
        "type": "editor",
        "archive_download_url": download_url
    });
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

    // the input only contains one task submission, so the task results should only contain one result as well
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

async fn get_submission_grading(
    pool: web::Data<PgPool>,
    submission_id: web::Path<Uuid>,
    user: AuthToken,
) -> ControllerResult<web::Json<api::ExerciseTaskSubmissionStatus>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::ExerciseTaskSubmission(*submission_id),
    )
    .await?;

    let grading = models::exercise_task_gradings::get_by_exercise_task_submission_id(
        &mut conn,
        *submission_id,
    )
    .await?;
    let status = match grading {
        Some(grading) => api::ExerciseTaskSubmissionStatus::Grading {
            grading_progress: match grading.grading_progress {
                GradingProgress::Failed => api::GradingProgress::Failed,
                GradingProgress::NotReady => api::GradingProgress::NotReady,
                GradingProgress::PendingManual => api::GradingProgress::PendingManual,
                GradingProgress::Pending => api::GradingProgress::Pending,
                GradingProgress::FullyGraded => api::GradingProgress::FullyGraded,
            },
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
            "/submissions/{id}/grading",
            web::get().to(get_submission_grading),
        );
}
