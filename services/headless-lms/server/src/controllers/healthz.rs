/*!
Handlers for HTTP requests to `/api/v0/healthz`.
*/

use sqlx::Executor;

use crate::controllers::main_frontend::status::{check_system_health, get_namespace};
use crate::domain::authorization::{Action, Resource, authorize};

use crate::prelude::*;

/**
GET `/api/v0/healthz` Tells whether the server is healthy (database connectivity).
*/
pub async fn healthz(pool: web::Data<PgPool>) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let _res = conn.execute("SELECT 1").await?;
    token.authorized_ok(web::Json(true))
}

/**
GET `/api/v0/healthz/system` Returns a boolean indicating whether the system is healthy.
*/
pub async fn system_health(
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let ns = get_namespace();

    let db_check = conn.execute("SELECT 1").await;
    let kubernetes_check = check_system_health(&ns).await;

    let is_healthy = db_check.is_ok() && matches!(kubernetes_check, Ok(true));

    if is_healthy {
        let token = skip_authorize();
        return token.authorized_ok(web::Json(true));
    }

    if let Some(user) = user {
        authorize(
            &mut conn,
            Action::Administrate,
            Some(user.id),
            Resource::GlobalPermissions,
        )
        .await?;

        let error_msg = match (db_check, kubernetes_check) {
            (Err(e), _) => format!("Database connectivity check failed: {}", e),
            (_, Err(e)) => format!("System health check failed: {}", e),
            _ => "System is unhealthy".to_string(),
        };

        Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            error_msg,
            None,
        ))
    } else {
        let token = skip_authorize();
        token.authorized_ok(web::Json(false))
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(healthz))
        .route("/system", web::get().to(system_health));
}
