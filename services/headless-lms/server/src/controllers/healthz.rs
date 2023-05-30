/*!
Handlers for HTTP requests to `/api/v0/healthz`.
*/

use sqlx::Executor;

use crate::prelude::*;

/**
POST `/api/v0/healthz` Tells whether the server is healthy.
*/
pub async fn healthz(pool: web::Data<PgPool>) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize()?;
    let _res = conn.execute("SELECT 1").await?;
    token.authorized_ok(web::Json(true))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(healthz));
}
