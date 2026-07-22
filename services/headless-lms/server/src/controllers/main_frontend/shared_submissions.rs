use crate::{domain::models_requests, prelude::*};
use headless_lms_models::exercise_slide_submissions::ExerciseSlideSubmissionInfo;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(get_shared_submission_info))]
pub(crate) struct MainFrontendSharedSubmissionsApiDoc;

/**
GET `/api/v0/main-frontend/shared-submissions/{token}` - Returns the data needed to
render a shared submission.

The `token` is the unguessable share id minted by the client share endpoint. Login is
required, but holding the token is the only capability needed to view the submission —
no teacher or course role.
*/
#[utoipa::path(
    get,
    path = "/{token}",
    operation_id = "getSharedSubmissionInfo",
    tag = "shared_submissions",
    params(
        ("token" = Uuid, Path, description = "Submission share token")
    ),
    responses(
        (status = 200, description = "Data needed to render the shared submission", body = ExerciseSlideSubmissionInfo)
    )
)]
#[instrument(skip(pool))]
async fn get_shared_submission_info(
    token: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    _user: AuthUser,
) -> ControllerResult<web::Json<ExerciseSlideSubmissionInfo>> {
    let mut conn = pool.acquire().await?;
    // Possession of the share token is the capability; any logged-in user may view it.
    let auth_token = skip_authorize();

    let share = models::exercise_slide_submission_shares::get_by_id(&mut conn, *token).await?;
    let submission = models::exercise_slide_submissions::get_by_id(
        &mut conn,
        share.exercise_slide_submission_id,
    )
    .await?;
    let mut res = models::exercise_slide_submissions::get_exercise_slide_submission_info(
        &mut conn,
        share.exercise_slide_submission_id,
        submission.user_id,
        models_requests::fetch_service_info,
        true,
    )
    .await?;

    // A forwardable share link must never leak the model solution or the submitter's
    // user id; see `strip_for_shared_view`.
    res.strip_for_shared_view();

    auth_token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{token}", web::get().to(get_shared_submission_info));
}
