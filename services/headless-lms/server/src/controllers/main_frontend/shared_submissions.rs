use crate::{domain::models_requests, prelude::*};
use headless_lms_models::exercise_slide_submissions::ExerciseSlideSubmissionInfo;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(get_shared_submission_info))]
pub(crate) struct MainFrontendSharedSubmissionsApiDoc;

/**
GET `/api/v0/main-frontend/shared-submissions/{token}` - Returns the data needed
to render a shared submission.

The `token` is the unguessable share id minted by the exercise-services client
share endpoint. Login is required, but any authenticated user who holds the token
may view the submission — no teacher or course role is needed. Rendering reuses
the ordinary submission-info payload and `view-submission` iframe contract; for
editor (native-client) submissions that currently means a download link rather
than inline code.
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
    // Login is required (the `AuthUser` extractor), but possession of the share
    // token is the capability — any authenticated user may view it.
    let auth_token = skip_authorize();

    let share = models::exercise_slide_submission_shares::get_by_id(&mut conn, *token).await?;
    let submission = models::exercise_slide_submissions::get_by_id(
        &mut conn,
        share.exercise_slide_submission_id,
    )
    .await?;
    let res = models::exercise_slide_submissions::get_exercise_slide_submission_info(
        &mut conn,
        share.exercise_slide_submission_id,
        submission.user_id,
        models_requests::fetch_service_info,
        true,
    )
    .await?;

    auth_token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{token}", web::get().to(get_shared_submission_info));
}
