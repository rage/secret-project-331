use crate::controllers::helpers::file_uploading;
use crate::domain::langs::{convert::Convert, token::AuthToken};
use crate::domain::models_requests::{self, JwtKey};
use crate::prelude::*;
use actix_multipart::form::json::Json as MultipartJson;
use actix_multipart::form::tempfile::TempFile;
use actix_multipart::form::MultipartForm;
use headless_lms_utils::file_store::file_utils;
use models::chapters::DatabaseChapter;
use models::library::grading::{StudentExerciseSlideSubmission, StudentExerciseTaskSubmission};
use models::user_exercise_states::CourseInstanceOrExamId;
use mooc_langs_api as api;
use std::collections::HashSet;

/**
 * GET /api/v0/langs/course-instances
 *
 * Returns the course instances that the user is currently enrolled on that contain TMC exercises.
 */
#[instrument(skip(pool))]
async fn get_course_instances(
    pool: web::Data<PgPool>,
    user: AuthToken,
) -> ControllerResult<web::Json<Vec<api::CourseInstance>>> {
    let mut conn = pool.acquire().await?;

    let course_instances =
        models::course_instances::get_enrolled_course_instances_for_user_with_exercise_type(
            &mut conn, user.id, "tmc",
        )
        .await?
        .convert();

    // if the user is enrolled on the course, they should be able to view it regardless of permissions
    let token = skip_authorize();
    token.authorized_ok(web::Json(course_instances))
}

/**
 * GET /api/v0/langs/course-instances/:id/exercises
 *
 * Returns the user's exercise slides for the given course instance.
 * Does not return anything for chapters which are not open yet.
 * Selects slides for exercises with no slide selected yet.
 * Only returns slides which have tasks that are compatible with langs.
 */
#[instrument(skip(pool))]
async fn get_course_instance_exercises(
    pool: web::Data<PgPool>,
    user: AuthToken,
    course_instance: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<api::ExerciseSlide>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::CourseInstance(*course_instance),
    )
    .await?;

    let mut slides = Vec::new();
    // process only exercises of open chapters
    let open_chapter_ids = models::chapters::course_instance_chapters(&mut conn, *course_instance)
        .await?
        .into_iter()
        .filter(DatabaseChapter::has_opened)
        .map(|c| c.id)
        .collect::<HashSet<_>>();
    let open_chapter_exercises =
        models::exercises::get_exercises_by_course_instance_id(&mut conn, *course_instance)
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
            .map(Convert::convert)
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
    let (exercise_slide, instance_or_exam_id) = models::exercises::get_or_select_exercise_slide(
        &mut conn,
        Some(user.id),
        &exercise,
        models_requests::fetch_service_info,
    )
    .await?;
    match instance_or_exam_id {
        Some(CourseInstanceOrExamId::Instance(_id)) => {}
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
            .map(Convert::convert)
            .collect(),
    }))
}

#[derive(MultipartForm)]
struct UploadForm {
    metadata: MultipartJson<api::UploadMetadata>,
    file: TempFile,
}

async fn upload_exercise(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    exercise_id: web::Path<Uuid>,
    upload: MultipartForm<UploadForm>,
    user: AuthToken,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<api::UploadResult>> {
    let mut conn = pool.acquire().await?;
    // if the user can view an exercise, they should be able to upload their attempt
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
        .ok_or_else(|| anyhow::anyhow!("Cannot upload non-course exercises"))?;
    let exercise_slide =
        models::exercise_slides::get_exercise_slide(&mut conn, upload.metadata.slide_id).await?;
    let exercise_task =
        models::exercise_tasks::get_exercise_task_by_id(&mut conn, upload.metadata.task_id).await?;

    let upload = upload.into_inner();
    let (file, _temp_path) = upload.file.file.into_parts();
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
        user.id,
    )
    .await?;

    let download_url = file_store.get_download_url(&upload_path, &app_conf);
    let upload_result = api::UploadResult { download_url };
    token.authorized_ok(web::Json(upload_result))
}

async fn submit_exercise(
    pool: web::Data<PgPool>,
    jwt_key: web::Data<JwtKey>,
    exercise_id: web::Path<Uuid>,
    submission: web::Json<api::ExerciseSlideSubmission>,
    user: AuthToken,
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
    let result = domain::exercises::process_submission(
        &mut conn,
        user.id,
        exercise,
        &StudentExerciseSlideSubmission {
            exercise_slide_id: submission.exercise_slide_id,
            exercise_task_submissions: vec![StudentExerciseTaskSubmission {
                exercise_task_id: submission.exercise_task_id,
                data_json: submission.data_json,
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
            grading_progress: grading.grading_progress.convert(),
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
    cfg.route("/course-instances", web::get().to(get_course_instances))
        .route(
            "/course-instances/{id}/exercises",
            web::get().to(get_course_instance_exercises),
        )
        .route("/exercises/{id}", web::get().to(get_exercise))
        .route("/exercises/{id}/upload", web::post().to(upload_exercise))
        .route("/exercises/{id}/submit", web::post().to(submit_exercise))
        .route(
            "/submissions/{id}/grading",
            web::get().to(get_submission_grading),
        );
}
