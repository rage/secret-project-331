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
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "User exercise state does not belong to the requested exercise".to_string(),
            None,
        ));
    }
    let exercise =
        models::exercises::get_non_deleted_by_id(&mut conn, student_state.exercise_id).await?;
    if exercise.course_id != student_state.course_id || exercise.exam_id != student_state.exam_id {
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "User exercise state does not match the requested exercise context".to_string(),
            None,
        ));
    }

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Exercise(student_state.exercise_id),
    )
    .await?;
    let points_given;
    if *action == TeacherDecisionType::FullPoints {
        points_given = exercise.score_maximum as f32;
    } else if *action == TeacherDecisionType::ZeroPoints {
        points_given = 0.0;
    } else if *action == TeacherDecisionType::CustomPoints {
        points_given = manual_points.unwrap_or(0.0);
    } else if *action == TeacherDecisionType::SuspectedPlagiarism {
        points_given = 0.0;
    } else if *action == TeacherDecisionType::RejectAndReset {
        points_given = 0.0;

        models::teacher_grading_decisions::upsert_by_state_id_and_exercise_id(
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

        let course_id = student_state.course_id.ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                "RejectAndReset requires course_id".to_string(),
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

        info!("Teacher took the following action: RejectAndReset.",);

        return token.authorized_ok(web::Json(None));
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
