use crate::{
    controllers::ControllerResult,
    domain::authorization::AuthUser,
    models::exams::{self, ExamEnrollment},
};
use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn enrollment(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<Option<ExamEnrollment>>> {
    let mut conn = pool.acquire().await?;
    let enrollment = exams::get_enrollment(&mut conn, id.into_inner(), user.id).await?;
    Ok(Json(enrollment))
}

pub async fn enroll(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<()>> {
    let mut conn = pool.acquire().await?;
    exams::enroll(&mut conn, id.into_inner(), user.id).await?;
    Ok(Json(()))
}

pub async fn start(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<()>> {
    let mut conn = pool.acquire().await?;
    exams::start(&mut conn, id.into_inner(), user.id).await?;
    Ok(Json(()))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_exams_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}/enrollment", web::get().to(enrollment))
        .route("/{id}/enroll", web::post().to(enroll))
        .route("/{id}/start", web::post().to(start));
}
