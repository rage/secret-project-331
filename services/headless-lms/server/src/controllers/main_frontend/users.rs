use models::users::User;

use crate::prelude::*;

/**
GET `/api/v0/main-frontend/users/:id`
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_user(
    user_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<User>> {
    let mut conn = pool.acquire().await?;
    let user = models::users::get_by_id(&mut conn, *user_id).await?;

    let token = authorize(&mut conn, Act::Teach, Some(*user_id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(user))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{user_id}", web::get().to(get_user));
}
