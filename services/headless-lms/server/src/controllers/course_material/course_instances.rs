//! Controllers for requests starting with `/api/v0/course-material/course-instances`.

use headless_lms_utils::numbers::option_f32_to_f32_two_decimals;
use models::{
    chapters::UserCourseInstanceChapterProgress,
    course_instance_enrollments::{CourseInstanceEnrollment, NewCourseInstanceEnrollment},
    user_exercise_states::{UserCourseInstanceChapterExerciseProgress, UserCourseInstanceProgress},
};

use crate::controllers::prelude::*;

/**
 GET /api/v0/course-material/course-instance/:course_intance_id/progress - returns user progress information.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_user_progress_for_course_instance(
    user: AuthUser,
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<UserCourseInstanceProgress>> {
    let mut conn = pool.acquire().await?;
    let user_course_instance_progress =
        models::user_exercise_states::get_user_course_instance_progress(
            &mut conn,
            *course_instance_id,
            user.id,
        )
        .await?;
    Ok(web::Json(user_course_instance_progress))
}

/**
GET `/api/v0/course-material/course-instance/:course_instance_id/chapters/:chapter_id/progress - Returns user progress for chapter in course instance.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_user_progress_for_course_instance_chapter(
    user: AuthUser,
    params: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<UserCourseInstanceChapterProgress>> {
    let mut conn = pool.acquire().await?;
    let (course_instance_id, chapter_id) = params.into_inner();
    let user_course_instance_chapter_progress =
        models::chapters::get_user_course_instance_chapter_progress(
            &mut conn,
            course_instance_id,
            chapter_id,
            user.id,
        )
        .await?;
    Ok(web::Json(user_course_instance_chapter_progress))
}

/**
GET /api/v0/course-material/course-instance/:course_instance_id/chapters/:chapter_id/exercises/progress - Returns user progress for an exercise in given course instance.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_user_progress_for_course_instance_chapter_exercises(
    user: AuthUser,
    params: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<UserCourseInstanceChapterExerciseProgress>>> {
    let mut conn = pool.acquire().await?;
    let (course_instance_id, chapter_id) = params.into_inner();
    let chapter_exercises =
        models::exercises::get_exercises_by_chapter_id(&mut conn, chapter_id).await?;
    let exercise_ids: Vec<Uuid> = chapter_exercises.into_iter().map(|e| e.id).collect();

    let user_course_instance_exercise_progress =
        models::user_exercise_states::get_user_course_instance_chapter_exercises_progress(
            &mut conn,
            course_instance_id,
            &exercise_ids,
            user.id,
        )
        .await?;
    let rounded_score_given_instances: Vec<UserCourseInstanceChapterExerciseProgress> =
        user_course_instance_exercise_progress
            .into_iter()
            .map(|i| UserCourseInstanceChapterExerciseProgress {
                score_given: option_f32_to_f32_two_decimals(i.score_given),
                exercise_id: i.exercise_id,
            })
            .collect();
    Ok(web::Json(rounded_score_given_instances))
}

/**
POST /api/v0/course-material/course-instance/:course_instance_id/enroll - enrolls user to the course instance.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn add_user_enrollment(
    pool: web::Data<PgPool>,
    course_instance_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseInstanceEnrollment>> {
    let mut conn = pool.acquire().await?;

    let instance =
        models::course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let enrollment = models::course_instance_enrollments::insert_enrollment_and_set_as_current(
        &mut conn,
        NewCourseInstanceEnrollment {
            course_id: instance.course_id,
            course_instance_id: instance.id,
            user_id: user.id,
        },
    )
    .await?;

    Ok(web::Json(enrollment))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_instance_id}/enroll",
        web::post().to(add_user_enrollment),
    )
    .route(
        "/{course_instance_id}/progress",
        web::get().to(get_user_progress_for_course_instance),
    )
    .route(
        "/{course_instance_id}/chapters/{chapter_id}/exercises/progress",
        web::get().to(get_user_progress_for_course_instance_chapter_exercises),
    )
    .route(
        "/{course_instance_id}/chapters/{chapter_id}/progress",
        web::get().to(get_user_progress_for_course_instance_chapter),
    );
}
