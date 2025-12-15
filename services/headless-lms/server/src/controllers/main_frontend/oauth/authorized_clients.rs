use crate::prelude::*;
use actix_web::{HttpResponse, web};
use models::oauth_user_client_scopes::{AuthorizedClientInfo, OAuthUserClientScopes};
use sqlx::PgPool;
use uuid::Uuid;

#[instrument(skip(pool, auth_user))]
pub async fn get_authorized_clients(
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let rows: Vec<AuthorizedClientInfo> =
        OAuthUserClientScopes::list_authorized_clients_for_user(&mut conn, auth_user.id).await?;

    token.authorized_ok(HttpResponse::Ok().json(rows))
}

#[instrument(skip(pool, auth_user))]
pub async fn delete_authorized_client(
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
    path: web::Path<Uuid>, // client_id (DB uuid)
) -> ControllerResult<HttpResponse> {
    let client_id = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    OAuthUserClientScopes::revoke_user_client_everything(&mut conn, auth_user.id, client_id)
        .await?;

    token.authorized_ok(HttpResponse::NoContent().finish())
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/authorized-clients", web::get().to(get_authorized_clients))
        .route(
            "/authorized-clients/{client_id}",
            web::delete().to(delete_authorized_client),
        );
}
