//! Controllers for requests starting with `/api/v0/main-frontend/courses/{course_id}/students`.
use crate::prelude::*;

use headless_lms_models::library::students_view::ProgressOverview;

/// GET `/api/v0/main-frontend/courses/{course_id}/students/progress`
#[instrument(skip(pool))]
async fn get_progress(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ProgressOverview>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(*course_id)).await?;
    let res = headless_lms_models::library::students_view::get_progress(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/progress", web::get().to(get_progress));
}
