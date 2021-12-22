use crate::{controllers::ControllerResult, models::users::User};
use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

#[instrument(skip(pool))]
pub async fn get_user(
    request_user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<User>> {
    let mut conn = pool.acquire().await?;
    let user = crate::models::users::get_by_id(&mut conn, request_user_id.into_inner()).await?;
    Ok(Json(user))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{user_id}", web::get().to(get_user));
}
