//! Controllers for requests starting with `/api/v0/cms/exercise-services`.

use models::exercise_services::ExerciseServiceIframeRenderingInfo;
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_all_exercise_services))]
pub(crate) struct CmsExerciseServicesApiDoc;

/**
GET `/api/v0/cms/exercise-services` - List all exercise services configured in the system.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "",
    operation_id = "getCmsExerciseServices",
    tag = "cms_exercise_services",
    responses(
        (status = 200, description = "Exercise services", body = Vec<ExerciseServiceIframeRenderingInfo>)
    )
)]
async fn get_all_exercise_services(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseServiceIframeRenderingInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    let res =
        models::exercise_services::get_all_exercise_services_iframe_rendering_infos(&mut conn)
            .await?;

    token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_all_exercise_services));
}
