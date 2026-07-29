use crate::domain::exercise_services::token::invalidate_cached_user;
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::cache::Cache;
use models::oauth_user_client_scopes::{AuthorizedClientInfo, OAuthUserClientScopes};
use sqlx::PgPool;
use utoipa::OpenApi;
use uuid::Uuid;

#[derive(OpenApi)]
#[openapi(paths(get_authorized_clients, delete_authorized_client))]
#[allow(dead_code)]
pub(crate) struct MainFrontendOauthAuthorizedClientsApiDoc;

#[instrument(skip(pool, auth_user))]
#[utoipa::path(
    get,
    path = "/authorized-clients",
    operation_id = "getOauthAuthorizedClients",
    tag = "oauth",
    responses(
        (status = 200, description = "Authorized OAuth clients", body = [AuthorizedClientInfo])
    )
)]
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

#[instrument(skip(pool, auth_user, app_conf, cache))]
#[utoipa::path(
    delete,
    path = "/authorized-clients/{client_id}",
    operation_id = "deleteOauthAuthorizedClient",
    tag = "oauth",
    params(
        ("client_id" = Uuid, Path, description = "OAuth client id")
    ),
    responses(
        (status = 204, description = "Authorized client revoked")
    )
)]
pub async fn delete_authorized_client(
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
    path: web::Path<Uuid>, // client_id (DB uuid)
    app_conf: web::Data<ApplicationConfiguration>,
    cache: web::Data<Cache>,
) -> ControllerResult<HttpResponse> {
    let client_id = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let revoked_digests =
        OAuthUserClientScopes::revoke_user_client_everything(&mut conn, auth_user.id, client_id)
            .await?;

    // Without this the deleted tokens keep authenticating from cache for the rest of their TTL.
    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
    for digest in &revoked_digests {
        invalidate_cached_user(&cache, digest, token_hmac_key).await;
    }

    token.authorized_ok(HttpResponse::NoContent().finish())
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/authorized-clients", web::get().to(get_authorized_clients))
        .route(
            "/authorized-clients/{client_id}",
            web::delete().to(delete_authorized_client),
        );
}
