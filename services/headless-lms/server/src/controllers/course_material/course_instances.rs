//! Controllers for requests starting with `/api/v0/course-material/course-instances`.

use headless_lms_utils::numbers::option_f32_to_f32_two_decimals_with_none_as_zero;
use models::{
    chapters::UserCourseInstanceChapterProgress,
    course_background_question_answers::NewCourseBackgroundQuestionAnswer,
    course_background_questions::CourseBackgroundQuestionsAndAnswers,
    course_instance_enrollments::{CourseInstanceEnrollment, NewCourseInstanceEnrollment},
    library::progressing::UserModuleCompletionStatus,
    user_exercise_states::{UserCourseInstanceChapterExerciseProgress, UserCourseInstanceProgress},
};

use crate::{domain::authorization::skip_authorize, prelude::*};

/**
 GET /api/v0/course-material/course-instance/:course_intance_id/progress - returns user progress information.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_user_progress_for_course_instance(
    user: AuthUser,
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<UserCourseInstanceProgress>>> {
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
    let token = skip_authorize();
    token.authorized_ok(web::Json(user_course_instance_chapter_progress))
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
#[generated_doc]
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
#[generated_doc]
#[instrument(skip(pool))]
async fn save_course_settings(
    pool: web::Data<PgPool>,
    course_instance_id: web::Path<Uuid>,
    payload: web::Json<SaveCourseSettingsPayload>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseInstanceEnrollment>> {
    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;

    let instance =
        models::course_instances::get_course_instance(&mut tx, *course_instance_id).await?;
    let enrollment = models::course_instance_enrollments::insert_enrollment_and_set_as_current(
        &mut tx,
        NewCourseInstanceEnrollment {
            course_id: instance.course_id,
            course_instance_id: instance.id,
            user_id: user.id,
        },
    )
    .await?;

    let background_question_answers = &payload.background_question_answers;
    if !background_question_answers.is_empty() {
        models::course_background_question_answers::upsert_backround_question_answers(
            &mut tx,
            user.id,
            background_question_answers,
        )
        .await?;
    }
    tx.commit().await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(enrollment))
}

/**
GET /api/v0/course-material/course-instance/:course_instance_id/background-questions-and-answers - Gets background questions and answers for an course instance.
*/
#[generated_doc]
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
        "/{course_instance_id}/background-questions-and-answers",
        web::get().to(get_background_questions_and_answers),
    );
}
