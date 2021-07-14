use crate::{controllers::ControllerResult, models::gradings::Grading};
use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/main-frontend/gradings/{grading_id}"` - Returns a single grading.
 */
#[instrument(skip(pool))]
async fn get_grading(
    grading_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Grading>> {
    let mut conn = pool.acquire().await?;
    let grading = crate::models::gradings::get_by_id(&mut conn, *grading_id).await?;
    Ok(Json(grading))
}

pub fn _add_gradings_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{grading_id}", web::get().to(get_grading));
}
