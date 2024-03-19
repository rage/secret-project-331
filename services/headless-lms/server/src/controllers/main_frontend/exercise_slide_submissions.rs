use crate::{domain::models_requests, prelude::*};
use headless_lms_models::exercise_slide_submissions::ExerciseSlideSubmissionInfo;
use models::{
    exercises::get_exercise_by_id,
    library::user_exercise_state_updater,
    teacher_grading_decisions::{
        NewTeacherGradingDecision, TeacherDecisionType, TeacherGradingDecision,
    },
    user_exercise_states::UserExerciseState,
};

/**
GET `/api/v0/main-frontend/exercise-slide-submissions/{submission_id}/info"`- Returns data necessary for rendering a submission.
*/
#[instrument(skip(pool))]
async fn get_submission_info(
    submission_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseSlideSubmissionInfo>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::ExerciseSlideSubmission(*submission_id),
    )
    .await?;

    let res = models::exercise_slide_submissions::get_exercise_slide_submission_info(
        &mut conn,
        submission_id.into_inner(),
        user.id,
        models_requests::fetch_service_info,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
PUT `/api/v0/main-frontend/exercise-slide-submissions/update-answer-requiring-attention"` - Given a teacher grading decision, updates an answer by giving it a manual score given.
*/
#[instrument(skip(pool))]
async fn update_answer_requiring_attention(
    payload: web::Json<NewTeacherGradingDecision>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<UserExerciseState>> {
    let action = &payload.action;
    let exercise_id = payload.exercise_id;
    let user_exercise_state_id = payload.user_exercise_state_id;
    let manual_points = payload.manual_points;
    let justification = &payload.justification;
    let hidden = payload.hidden;
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Exercise(exercise_id),
    )
    .await?;
    let points_given;
    if *action == TeacherDecisionType::FullPoints {
        let exercise = get_exercise_by_id(&mut conn, exercise_id).await?;
        points_given = exercise.score_maximum as f32;
    } else if *action == TeacherDecisionType::ZeroPoints {
        points_given = 0.0;
    } else if *action == TeacherDecisionType::CustomPoints {
        points_given = manual_points.unwrap_or(0.0);
    } else if *action == TeacherDecisionType::SuspectedPlagiarism {
        points_given = 0.0;
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Invalid query".to_string(),
            None,
        ));
    }

    info!(
        "Teacher took the following action: {:?}. Points given: {:?}.",
        &action, points_given
    );

    let mut tx = conn.begin().await?;

    let _res = models::teacher_grading_decisions::add_teacher_grading_decision(
        &mut tx,
        user_exercise_state_id,
        *action,
        points_given,
        Some(user.id),
        justification.clone(),
        hidden,
    )
    .await?;

    let new_user_exercise_state =
        user_exercise_state_updater::update_user_exercise_state(&mut tx, user_exercise_state_id)
            .await?;

    if let Some(course_instance_id) = new_user_exercise_state.course_instance_id {
        // Since the teacher just reviewed the submission we should mark possible peer review queue entries so that they won't be given to others to review. Receiving peer reviews for this answer now would not make much sense.
        models::peer_review_queue_entries::remove_queue_entries_for_unusual_reason(
            &mut tx,
            new_user_exercise_state.user_id,
            new_user_exercise_state.exercise_id,
            course_instance_id,
        )
        .await?;
    }

    tx.commit().await?;

    token.authorized_ok(web::Json(new_user_exercise_state))
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseStateIds {
    exercise_id: Uuid,
    user_id: Uuid,
}
/**
GET `/api/v0/main-frontend/exercise-slide-submissions/{exam_id}/{exercise_id}/{user_id}/user-exercise-state-info`-
*/
#[instrument(skip(pool))]
async fn get_user_exercise_state_info(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    query_ids: web::Query<ExerciseStateIds>,
    user: AuthUser,
) -> ControllerResult<web::Json<UserExerciseState>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let res = models::user_exercise_states::get_or_create_user_exercise_state(
        &mut conn,
        query_ids.user_id,
        query_ids.exercise_id,
        None,
        Some(*exam_id),
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/**
PUT `/api/v0/main-frontend/exercise-slide-submissions/add_teacher_grading"` - Given a teacher grading decision, updates an answer by giving it a manual score given.
*/
#[instrument(skip(pool))]
async fn add_teacher_grading(
    payload: web::Json<NewTeacherGradingDecision>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<TeacherGradingDecision>> {
    let action = &payload.action;
    let exercise_id = payload.exercise_id;
    let user_exercise_state_id = payload.user_exercise_state_id;
    let manual_points = payload.manual_points;
    let justification = &payload.justification;
    let hidden = payload.hidden;
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Exercise(exercise_id),
    )
    .await?;
    let points_given;
    if *action == TeacherDecisionType::FullPoints {
        let exercise = get_exercise_by_id(&mut conn, exercise_id).await?;
        points_given = exercise.score_maximum as f32;
    } else if *action == TeacherDecisionType::ZeroPoints {
        points_given = 0.0;
    } else if *action == TeacherDecisionType::CustomPoints {
        points_given = manual_points.unwrap_or(0.0);
    } else if *action == TeacherDecisionType::SuspectedPlagiarism {
        points_given = 0.0;
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Invalid query".to_string(),
            None,
        ));
    }

    info!(
        "Teacher took the following action: {:?}. Points given: {:?}.",
        &action, points_given
    );

    let mut tx = conn.begin().await?;

    let _res = models::teacher_grading_decisions::add_teacher_grading_decision(
        &mut tx,
        user_exercise_state_id,
        *action,
        points_given,
        Some(user.id),
        justification.clone(),
        hidden,
    )
    .await?;

    if !hidden {
        user_exercise_state_updater::update_user_exercise_state(&mut tx, user_exercise_state_id)
            .await?;
    }

    tx.commit().await?;

    token.authorized_ok(web::Json(_res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{submission_id}/info", web::get().to(get_submission_info))
        .route(
            "/update-answer-requiring-attention",
            web::put().to(update_answer_requiring_attention),
        )
        .route(
            "/{exam_id}/user-exercise-state-info",
            web::get().to(get_user_exercise_state_info),
        )
        .route("/add-teacher-grading", web::put().to(add_teacher_grading));
}
