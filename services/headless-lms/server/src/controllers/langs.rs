use crate::domain::langs::{convert::Convert, token::AuthToken};
use crate::domain::models_requests::{self, JwtKey};
use crate::prelude::*;
use bytes::Bytes;
use models::user_exercise_states::CourseInstanceOrExamId;
use mooc_langs_api as api;

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
 * GET /api/v0/langs/courses/:id/exercises
 *
 * Returns the exercises for the given course.
 */
#[instrument(skip(pool))]
async fn course_exercises(
    pool: web::Data<PgPool>,
    user: AuthToken,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<api::Exercise>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course_id)).await?;
    let exercises = models::exercises::get_exercises_by_course_id(&mut conn, *course_id)
        .await?
        .convert();
    token.authorized_ok(web::Json(exercises))
}

/**
 * GET /api/v0/langs/exercises/:id
 *
 * Returns an exercise slide for the user for the given exercise.
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
        id: exercise_slide.id,
        exercise_id: exercise.id,
        deadline: exercise.deadline,
        tasks: exercise_slide
            .exercise_tasks
            .into_iter()
            .map(Convert::convert)
            .collect(),
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
        .route("/courses/{id}/exercises", web::get().to(course_exercises))
        .route("/exercises/{id}", web::get().to(exercise))
        .route("/exercises/{id}/download", web::get().to(download_exercise))
        .route("/exercises/{id}", web::post().to(submit));
}
