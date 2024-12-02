use std::collections::HashMap;

use futures::future;

use chrono::Utc;
use headless_lms_models::user_exercise_states::UserExerciseState;
use models::{
    course_exams,
    exams::{self, Exam, NewExam},
    exercise_slide_submissions::{
        ExerciseSlideSubmissionAndUserExerciseState,
        ExerciseSlideSubmissionAndUserExerciseStateList,
    },
    exercises::Exercise,
    library::user_exercise_state_updater,
    teacher_grading_decisions,
};

use crate::{
    domain::csv_export::{
        general_export, points::ExamPointExportOperation,
        submissions::ExamSubmissionExportOperation,
    },
    prelude::*,
};

/**
GET `/api/v0/main-frontend/exams/:id
*/
#[instrument(skip(pool))]
pub async fn get_exam(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Exam>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let exam = exams::get(&mut conn, *exam_id).await?;

    token.authorized_ok(web::Json(exam))
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExamCourseInfo {
    course_id: Uuid,
}

/**
POST `/api/v0/main-frontend/exams/:id/set`
*/
#[instrument(skip(pool))]
pub async fn set_course(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    exam: web::Json<ExamCourseInfo>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;

    course_exams::upsert(&mut conn, *exam_id, exam.course_id).await?;

    token.authorized_ok(web::Json(()))
}

/**
POST `/api/v0/main-frontend/exams/:id/unset`
*/
#[instrument(skip(pool))]
pub async fn unset_course(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    exam: web::Json<ExamCourseInfo>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;

    course_exams::delete(&mut conn, *exam_id, exam.course_id).await?;

    token.authorized_ok(web::Json(()))
}

/**
GET `/api/v0/main-frontend/exams/:id/export-points`
*/
#[instrument(skip(pool))]
pub async fn export_points(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let exam = exams::get(&mut conn, *exam_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"Exam: {} - Point export {}.csv\"",
            exam.name,
            Utc::now().format("%Y-%m-%d")
        ),
        ExamPointExportOperation { exam_id: *exam_id },
        token,
    )
    .await
}

/**
GET `/api/v0/main-frontend/exams/:id/export-submissions`
*/
#[instrument(skip(pool))]
pub async fn export_submissions(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let exam = exams::get(&mut conn, *exam_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"Exam: {} - Submissions {}.csv\"",
            exam.name,
            Utc::now().format("%Y-%m-%d")
        ),
        ExamSubmissionExportOperation { exam_id: *exam_id },
        token,
    )
    .await
}

/**
 * POST `/api/v0/cms/exams/:exam_id/duplicate` - duplicates existing exam.
 */
#[instrument(skip(pool))]
async fn duplicate_exam(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    new_exam: web::Json<NewExam>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let organization_id = models::exams::get_organization_id(&mut conn, *exam_id).await?;
    let token = authorize(
        &mut conn,
        Act::CreateCoursesOrExams,
        Some(user.id),
        Res::Organization(organization_id),
    )
    .await?;

    let mut tx = conn.begin().await?;
    let new_exam = models::library::copying::copy_exam(&mut tx, &exam_id, &new_exam).await?;

    models::roles::insert(
        &mut tx,
        user.id,
        models::roles::UserRole::Teacher,
        models::roles::RoleDomain::Exam(new_exam.id),
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(true))
}

/**
POST `/api/v0/main-frontend/organizations/{organization_id}/edit-exam` - edits an exam.
*/
#[instrument(skip(pool))]
async fn edit_exam(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    payload: web::Json<NewExam>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;

    let exam = payload.0;
    let token = authorize(&mut tx, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;

    models::exams::edit(&mut tx, *exam_id, exam).await?;

    tx.commit().await?;

    token.authorized_ok(web::Json(()))
}

/**
GET `/api/v0/main-frontend/exam/:exercise_id/submissions-with-exercise_id` - Returns all the exercise submissions and user exercise states with exercise_id.
 */
#[instrument(skip(pool))]
async fn get_exercise_slide_submissions_and_user_exercise_states_with_exercise_id(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseSlideSubmissionAndUserExerciseStateList>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await?;

    let submission_count =
        models::exercise_slide_submissions::exercise_slide_submission_count_with_exercise_id(
            &mut conn,
            *exercise_id,
        );
    let mut conn = pool.acquire().await?;
    let submissions = models::exercise_slide_submissions::get_latest_exercise_slide_submissions_and_user_exercise_state_list_with_exercise_id(
        &mut conn,
        *exercise_id,
        *pagination,
    );
    let (submission_count, submissions) = future::try_join(submission_count, submissions).await?;
    let total_pages = pagination.total_pages(submission_count);

    token.authorized_ok(web::Json(ExerciseSlideSubmissionAndUserExerciseStateList {
        data: submissions,
        total_pages,
    }))
}

/**
GET `/api/v0/main-frontend/exam/:exam_id/submissions-with-exam-id` - Returns all the exercise submissions and user exercise states with exam_id.
 */
#[instrument(skip(pool))]
async fn get_exercise_slide_submissions_and_user_exercise_states_with_exam_id(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Vec<ExerciseSlideSubmissionAndUserExerciseState>>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let mut submissions_and_user_exercise_states: Vec<
        Vec<ExerciseSlideSubmissionAndUserExerciseState>,
    > = Vec::new();

    let exercises = models::exercises::get_exercises_by_exam_id(&mut conn, *exam_id).await?;

    let mut conn = pool.acquire().await?;
    for exercise in exercises.iter() {
        let submissions = models::exercise_slide_submissions::get_latest_exercise_slide_submissions_and_user_exercise_state_list_with_exercise_id(
        &mut conn,
        exercise.id,
        *pagination,
    ).await?;
        submissions_and_user_exercise_states.push(submissions)
    }

    token.authorized_ok(web::Json(submissions_and_user_exercise_states))
}

/**
GET `/api/v0/main-frontend/exam/:exam_id/exam-exercises` - Returns all the exercises with exam_id.
 */
#[instrument(skip(pool))]
async fn get_exercises_with_exam_id(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Exercise>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let exercises = models::exercises::get_exercises_by_exam_id(&mut conn, *exam_id).await?;

    token.authorized_ok(web::Json(exercises))
}

/**
POST `/api/v0/main-frontend/exam/:exam_id/release-grades` - Publishes grading results of an exam by updating user_exercise_states according to teacher_grading_decisons and changes teacher_grading_decisions hidden field to false. Takes teacher grading decision ids as input.
 */
#[instrument(skip(pool))]
async fn release_grades(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
    payload: web::Json<Vec<Uuid>>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let teacher_grading_decision_ids = payload.0;

    let teacher_grading_decisions =
        models::teacher_grading_decisions::get_by_ids(&mut conn, &teacher_grading_decision_ids)
            .await?;

    let user_exercise_state_mapping = models::user_exercise_states::get_by_ids(
        &mut conn,
        &teacher_grading_decisions
            .iter()
            .map(|x| x.user_exercise_state_id)
            .collect::<Vec<Uuid>>(),
    )
    .await?
    .into_iter()
    .map(|x| (x.id, x))
    .collect::<HashMap<Uuid, UserExerciseState>>();

    let mut tx = conn.begin().await?;
    for teacher_grading_decision in teacher_grading_decisions.iter() {
        let user_exercise_state = user_exercise_state_mapping
            .get(&teacher_grading_decision.user_exercise_state_id)
            .ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "User exercise state not found for a teacher grading decision",
                    None,
                )
            })?;

        teacher_grading_decisions::update_teacher_grading_decision_hidden_field(
            &mut tx,
            teacher_grading_decision.id,
            false,
        )
        .await?;
        user_exercise_state_updater::update_user_exercise_state(&mut tx, user_exercise_state.id)
            .await?;
    }

    tx.commit().await?;

    token.authorized_ok(web::Json(()))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}", web::get().to(get_exam))
        .route("/{id}/set", web::post().to(set_course))
        .route("/{id}/unset", web::post().to(unset_course))
        .route("/{id}/export-points", web::get().to(export_points))
        .route(
            "/{id}/export-submissions",
            web::get().to(export_submissions),
        )
        .route("/{id}/edit-exam", web::post().to(edit_exam))
        .route("/{id}/duplicate", web::post().to(duplicate_exam))
        .route(
            "/{exercise_id}/submissions-with-exercise-id",
            web::get().to(get_exercise_slide_submissions_and_user_exercise_states_with_exercise_id),
        )
        .route(
            "/{exam_id}/submissions-with-exam-id",
            web::get().to(get_exercise_slide_submissions_and_user_exercise_states_with_exam_id),
        )
        .route("/{exam_id}/release-grades", web::post().to(release_grades))
        .route(
            "/{exam_id}/exam-exercises",
            web::get().to(get_exercises_with_exam_id),
        );
}
