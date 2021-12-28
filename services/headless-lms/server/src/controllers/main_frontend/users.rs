use crate::controllers::prelude::*;
use models::users::User;

#[instrument(skip(pool))]
pub async fn get_user(
    request_user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<User>> {
    let mut conn = pool.acquire().await?;
    let user = models::users::get_by_id(&mut conn, request_user_id.into_inner()).await?;
    Ok(web::Json(user))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{user_id}", web::get().to(get_user));
}
