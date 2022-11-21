//! Controllers for requests starting with `/api/v0/cms/exercise-services`.

use models::exercise_services::ExerciseServiceIframeRenderingInfo;

use crate::{domain::models_requests, prelude::*};

/**
GET `/api/v0/cms/exercise-services` - List all exercise services configured in the system.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_all_exercise_services(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseServiceIframeRenderingInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    let res = models::exercise_services::get_all_exercise_services_iframe_rendering_infos(
        &mut conn,
        models_requests::fetch_service_info,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_all_exercise_services));
}
