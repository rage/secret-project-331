use crate::domain::langs::{
    convert::{Convert, TryConvert},
    token::AuthToken,
};
use crate::domain::models_requests::{self, JwtKey};
use crate::prelude::*;
use bytes::Bytes;
use models::chapters::DatabaseChapter;
use models::user_exercise_states::CourseInstanceOrExamId;
use mooc_langs_api as api;
use std::collections::HashSet;

/**
 * GET /api/v0/langs/course-instances
 *
 * Returns the course instances that the user is currently enrolled on.
 */
#[instrument(skip(pool))]
async fn course_instances(
    pool: web::Data<PgPool>,
    user: AuthToken,
) -> ControllerResult<web::Json<Vec<api::CourseInstance>>> {
    let mut conn = pool.acquire().await?;

    let course_instances =
        models::course_instances::get_enrolled_course_instances_for_user(&mut conn, user.id)
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
async fn course_instance_exercises(
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
    for exercise in open_chapter_exercises {
        let (slide, _) = models::exercises::get_or_select_exercise_slide(
            &mut conn,
            Some(user.id),
            &exercise,
            models_requests::fetch_service_info,
        )
        .await?;
        let tasks = slide
            .exercise_tasks
            .into_iter()
            .map(TryConvert::try_convert)
            .filter_map(Result::transpose)
            .collect::<Result<Vec<_>, _>>()?;
        if !tasks.is_empty() {
            // do not return slides which have no compatible tasks
            slides.push(api::ExerciseSlide {
                slide_id: slide.id,
                exercise_id: exercise.id,
                exercise_name: exercise.name,
                exercise_order_number: exercise.order_number,
                deadline: exercise.deadline,
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
async fn exercise(
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
            .map(TryConvert::try_convert)
            .filter_map(Result::transpose)
            .collect::<Result<Vec<_>, _>>()?,
    }))
}

/**
 * GET /api/v0/langs/exercises/:id/download
 *
 * Downloads an exercise.
 */
#[instrument(skip(pool))]
async fn download_exercise(
    pool: web::Data<PgPool>,
    user: AuthToken,
    exercise_id: web::Path<Uuid>,
) -> ControllerResult<Bytes> {
    todo!()
}

async fn submit(
    pool: web::Data<PgPool>,
    jwt_key: web::Data<JwtKey>,
    exercise_id: web::Path<Uuid>,
    submission: web::Json<api::ExerciseSlideSubmission>,
    user: AuthToken,
) -> ControllerResult<web::Json<api::ExerciseSlideSubmissionResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await?;

    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let result = domain::exercises::process_submission(
        &mut conn,
        user.id,
        exercise,
        submission.into_inner().convert(),
        jwt_key.into_inner(),
    )
    .await?;
    token.authorized_ok(web::Json(result.convert()))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/course-instances", web::get().to(course_instances))
        .route(
            "/course-instances/{id}/exercises",
            web::get().to(course_instance_exercises),
        )
        .route("/exercises/{id}", web::get().to(exercise))
        .route("/exercises/{id}/download", web::get().to(download_exercise))
        .route("/exercises/{id}", web::post().to(submit));
}
