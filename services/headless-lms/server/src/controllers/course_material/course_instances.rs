//! Controllers for requests starting with `/api/v0/course-material/course-instances`.

use headless_lms_utils::numbers::option_f32_to_f32_two_decimals_with_none_as_zero;
use models::{
    chapters::UserCourseInstanceChapterProgress,
    course_background_question_answers::NewCourseBackgroundQuestionAnswer,
    course_background_questions::CourseBackgroundQuestionsAndAnswers,
    course_instance_enrollments::CourseInstanceEnrollment,
    course_module_completions::CourseModuleCompletion,
    library::progressing::UserModuleCompletionStatus,
    user_exercise_states::{UserCourseChapterExerciseProgress, UserCourseProgress},
};

use crate::{domain::authorization::skip_authorize, prelude::*};

/**
 GET /api/v0/course-material/course-instance/:course_intance_id/progress - returns user progress information.
*/
#[instrument(skip(pool))]
async fn get_user_progress_for_course_instance(
    user: AuthUser,
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<UserCourseProgress>>> {
    let mut conn = pool.acquire().await?;
    let user_course_instance_progress =
        models::user_exercise_states::get_user_course_instance_progress(
            &mut conn,
            *course_instance_id,
            user.id,
        )
        .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(user_course_instance_progress))
}

/**
GET `/api/v0/course-material/course-instance/:course_instance_id/chapters/:chapter_id/progress - Returns user progress for chapter in course instance.
*/
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
    let token = skip_authorize();
    token.authorized_ok(web::Json(user_course_instance_chapter_progress))
}

/**
GET /api/v0/course-material/course-instance/:course_instance_id/chapters/:chapter_id/exercises/progress - Returns user progress for an exercise in given course instance.
*/
#[instrument(skip(pool))]
async fn get_user_progress_for_course_instance_chapter_exercises(
    user: AuthUser,
    params: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<UserCourseChapterExerciseProgress>>> {
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
    let rounded_score_given_instances: Vec<UserCourseChapterExerciseProgress> =
        user_course_instance_exercise_progress
            .into_iter()
            .map(|i| UserCourseChapterExerciseProgress {
                score_given: option_f32_to_f32_two_decimals_with_none_as_zero(i.score_given),
                exercise_id: i.exercise_id,
            })
            .collect();
    let token = skip_authorize();
    token.authorized_ok(web::Json(rounded_score_given_instances))
}

/**
GET `/api/v0/course-material/course-instance/{course_instance_id}/module-completions`
 */
#[instrument(skip(pool))]
async fn get_module_completions_for_course_instance(
    user: AuthUser,
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<UserModuleCompletionStatus>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let mut module_completion_statuses =
        models::library::progressing::get_user_module_completion_statuses_for_course_instance(
            &mut conn,
            user.id,
            *course_instance_id,
        )
        .await?;
    // Override individual completions in modules with insufficient prerequisites
    module_completion_statuses.iter_mut().for_each(|module| {
        if !module.prerequisite_modules_completed {
            module.completed = false;
            module.certificate_configuration_id = None;
        }
    });
    token.authorized_ok(web::Json(module_completion_statuses))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SaveCourseSettingsPayload {
    pub background_question_answers: Vec<NewCourseBackgroundQuestionAnswer>,
}

/**
POST /api/v0/course-material/course-instance/:course_instance_id/save-course-settings - enrolls user to the course instance and save background questions.
*/
#[instrument(skip(pool))]
async fn save_course_settings(
    pool: web::Data<PgPool>,
    course_instance_id: web::Path<Uuid>,
    payload: web::Json<SaveCourseSettingsPayload>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseInstanceEnrollment>> {
    let mut conn = pool.acquire().await?;

    let enrollment = models::library::course_instances::enroll(
        &mut conn,
        user.id,
        *course_instance_id,
        payload.background_question_answers.as_slice(),
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(enrollment))
}

/**
GET /course-instances/:id/course-module-completions/:user_id - Returns a list of all course module completions for a given user for this course instance.
*/
#[instrument(skip(pool))]

async fn get_all_get_all_course_module_completions_for_user_by_course_instance_id(
    params: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseModuleCompletion>>> {
    let (course_instance_id, user_id) = params.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::CourseInstance(course_instance_id),
    )
    .await?;

    let res = models::course_module_completions::get_all_by_course_instance_and_user_id(
        &mut conn,
        course_instance_id,
        user_id,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET /api/v0/course-material/course-instance/:course_instance_id/background-questions-and-answers - Gets background questions and answers for an course instance.
*/
#[instrument(skip(pool))]
async fn get_background_questions_and_answers(
    pool: web::Data<PgPool>,
    course_instance_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseBackgroundQuestionsAndAnswers>> {
    let mut conn = pool.acquire().await?;

    let instance =
        models::course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let res = models::course_background_questions::get_background_questions_and_answers(
        &mut conn, &instance, user.id,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_instance_id}/save-course-settings",
        web::post().to(save_course_settings),
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
    )
    .route(
        "/{course_instance_id}/module-completions",
        web::get().to(get_module_completions_for_course_instance),
    )
    .route(
        "/{course_instance_id}/course-module-completions/{user_id}",
        web::get().to(get_all_get_all_course_module_completions_for_user_by_course_instance_id),
    )
    .route(
        "/{course_instance_id}/background-questions-and-answers",
        web::get().to(get_background_questions_and_answers),
    );
}
