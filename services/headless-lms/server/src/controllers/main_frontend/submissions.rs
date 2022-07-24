use crate::controllers::prelude::*;
use headless_lms_models::exercise_slide_submissions::ExerciseSlideSubmissionInfo;
use models::{exercises::get_exercise_by_id, user_exercise_states::UserExerciseState};

/**
GET `/api/v0/main-frontend/submissions/{submission_id}/info"`- Returns data necessary for rendering a submission.
*/
#[generated_doc]
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
    )
    .await?;

    token.authorized_ok(web::Json(res))
}
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserExerciseStateUpdate {
    pub user_exercise_state_id: Uuid,
    pub exercise_id: Uuid,
    pub action: String,
    pub manual_points: Option<f32>,
}
/**
GET `/api/v0/main-frontend/submissions/update-answer-requiring-attention"` - Updates data for submission
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn update_submission(
    payload: web::Json<UserExerciseStateUpdate>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<UserExerciseState>> {
    let action = &payload.action;
    let exercise_id = payload.exercise_id;
    let user_exercise_state_id = payload.user_exercise_state_id;
    let manual_points = payload.manual_points;
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Exercise(exercise_id),
    )
    .await?;
    let points_given;
    let mut suspected_of_plagiarism = false;
    if action == "accept" {
        let exercise = get_exercise_by_id(&mut conn, exercise_id).await?;
        points_given = exercise.score_maximum as f32;
    } else if action == "reject" {
        points_given = 0.0;
    } else if action == "manual-points" {
        points_given = manual_points.unwrap_or(0.0);
    } else if action == "flag-as-plagiarism" {
        points_given = 0.0;
        suspected_of_plagiarism = true;
    } else {
        return Err(ControllerError::BadRequest("Invalid query".to_string()));
    }
    let updated_user_exercise_state =
        models::exercise_slide_submissions::update_user_exercise_state(
            &mut conn,
            user_exercise_state_id,
            points_given,
        )
        .await?;

    models::exercise_slide_submissions::add_teacher_grading_decision(
        &mut conn,
        user_exercise_state_id,
        suspected_of_plagiarism,
    )
    .await?;

    token.authorized_ok(web::Json(updated_user_exercise_state))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{submission_id}/info", web::get().to(get_submission_info))
        .route(
            "/update-answer-requiring-attention",
            web::put().to(update_submission),
        );
}
