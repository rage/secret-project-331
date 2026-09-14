use crate::prelude::*;
use headless_lms_models::{
    teacher_grading_decisions::{NewTeacherGradingDecision, TeacherDecisionType},
    user_exercise_states::UserExerciseState,
};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(create_teacher_grading_decision))]
pub(crate) struct MainFrontendTeacherGradingDecisionsApiDoc;

/**
POST `/api/v0/main-frontend/teacher-grading-decisions` - Creates a new teacher grading decision, overriding the points a user has received from an exercise.
*/
#[utoipa::path(
    post,
    path = "",
    operation_id = "createTeacherGradingDecision",
    tag = "teacher_grading_decisions",
    request_body = NewTeacherGradingDecision,
    responses(
        (status = 200, description = "Teacher grading decision created", body = Option<UserExerciseState>)
    )
)]
#[instrument(skip(pool))]
async fn create_teacher_grading_decision(
    payload: web::Json<NewTeacherGradingDecision>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<UserExerciseState>>> {
    let action = &payload.action;
    let exercise_id = payload.exercise_id;
    let user_exercise_state_id = payload.user_exercise_state_id;
    let manual_points = payload.manual_points;
    let justification = &payload.justification;
    let hidden = payload.hidden;
    let mut conn = pool.acquire().await?;

    let student_state =
        models::user_exercise_states::get_by_id(&mut conn, user_exercise_state_id).await?;
    if student_state.exercise_id != exercise_id {
        return Err(controller_err!(
            Forbidden,
            "User exercise state does not belong to the requested exercise".to_string()
        ));
    }
    let exercise =
        models::exercises::get_non_deleted_by_id(&mut conn, student_state.exercise_id).await?;
    if exercise.course_id != student_state.course_id || exercise.exam_id != student_state.exam_id {
        return Err(controller_err!(
            Forbidden,
            "User exercise state does not match the requested exercise context".to_string()
        ));
    }

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Exercise(student_state.exercise_id),
    )
    .await?;
    // A match rather than an if/else chain: a new decision type must be given points here
    // deliberately instead of silently falling through to "Invalid query".
    let points_given = match *action {
        TeacherDecisionType::FullPoints => exercise.score_maximum as f32,
        TeacherDecisionType::ZeroPoints
        | TeacherDecisionType::SuspectedPlagiarism
        | TeacherDecisionType::UnauthorizedAiUse
        | TeacherDecisionType::RejectAndReset
        | TeacherDecisionType::BadAnswer
        | TeacherDecisionType::Other => 0.0,
        TeacherDecisionType::CustomPoints => {
            let points = manual_points.unwrap_or(0.0);
            if points < 0.0 || points > exercise.score_maximum as f32 {
                return Err(controller_err!(
                    BadRequest,
                    "manual_points must be between 0 and the exercise's maximum points".to_string()
                ));
            }
            points
        }
    };

    info!(
        "Teacher took the following action: {:?}. Points given: {:?}.",
        &action, points_given
    );

    // RejectAndReset is the older single-action spelling of the same request.
    if payload.reset_exercise || *action == TeacherDecisionType::RejectAndReset {
        let course_id = student_state.course_id.ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                "Resetting the exercise requires it to belong to a course".to_string(),
                None,
            )
        })?;

        let _reset = models::exercises::reset_progress_by_course_id_user_ids_and_exercise_ids(
            &mut conn,
            course_id,
            &[student_state.user_id],
            &[student_state.exercise_id],
            Some(user.id),
            Some("reset-by-staff".to_string()),
        )
        .await?;

        // Recorded after the reset, with the plain insert since the reset soft-deleted the state
        // the upsert validates against. A decision predating its own reset reads as superseded.
        let _res = models::teacher_grading_decisions::add_teacher_grading_decision(
            &mut conn,
            user_exercise_state_id,
            *action,
            points_given,
            Some(user.id),
            justification.clone(),
            hidden,
        )
        .await?;

        return token.authorized_ok(web::Json(None));
    }

    let _res = models::teacher_grading_decisions::upsert_by_state_id_and_exercise_id(
        &mut conn,
        user_exercise_state_id,
        student_state.exercise_id,
        *action,
        points_given,
        Some(user.id),
        justification.clone(),
        hidden,
    )
    .await?;

    let new_user_exercise_state = models::user_exercise_states::recalculate_by_id_and_exercise_id(
        &mut conn,
        user_exercise_state_id,
        student_state.exercise_id,
    )
    .await?;

    if let Some(course_id) = new_user_exercise_state.course_id {
        // Since the teacher just reviewed the submission we should mark possible peer review queue entries so that they won't be given to others to review. Receiving peer reviews for this answer now would not make much sense.
        models::peer_review_queue_entries::remove_queue_entries_for_unusual_reason(
            &mut conn,
            new_user_exercise_state.user_id,
            new_user_exercise_state.exercise_id,
            course_id,
        )
        .await?;
    }

    token.authorized_ok(web::Json(Some(new_user_exercise_state)))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(create_teacher_grading_decision));
}
