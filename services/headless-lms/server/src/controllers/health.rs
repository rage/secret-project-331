/*!
Handlers for HTTP requests to `/api/v0/healthz`.
*/

use sqlx::Executor;

use crate::controllers::main_frontend::status::system_health;
use crate::prelude::*;

/**
GET `/api/v0/healthz/connectivity` Tells whether the server is healthy (database connectivity).
*/
pub async fn connectivity(pool: web::Data<PgPool>) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let _res = conn.execute("SELECT 1").await?;
    token.authorized_ok(web::Json(true))
}

/**
GET `/api/v0/healthz/up` Returns true to indicate the service is up.
*/
pub async fn up() -> ControllerResult<web::Json<bool>> {
    let token = skip_authorize();
    token.authorized_ok(web::Json(true))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/connectivity", web::get().to(connectivity))
        .route("/system", web::get().to(system_health))
        .route("/up", web::get().to(up));
}
