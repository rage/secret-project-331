use crate::domain::exercise_services::token::invalidate_cached_users;
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::cache::Cache;
use models::oauth_user_client_scopes::{OAuthGrant, OAuthUserClientScopes};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/main-frontend/oauth/grants` - The signed-in user's OAuth grants, including AI agent
clients, with their scopes and when they were last used.
*/
#[instrument(skip(pool, auth_user))]
#[utoipa::path(
    get,
    path = "/grants",
    operation_id = "getOauthGrants",
    tag = "oauth",
    responses(
        (status = 200, description = "The user's grants", body = [OAuthGrant])
    )
)]
pub async fn get_grants(
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<web::Json<Vec<OAuthGrant>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let grants = OAuthUserClientScopes::get_grants_for_user(&mut conn, auth_user.id).await?;
    token.authorized_ok(web::Json(grants))
}

/**
DELETE `/api/v0/main-frontend/oauth/grants/{grant_id}` - Revokes one of the signed-in user's grants
and every token issued from it. The client has to ask for consent again.
*/
#[instrument(skip(pool, auth_user, app_conf, cache))]
#[utoipa::path(
    delete,
    path = "/grants/{grant_id}",
    operation_id = "revokeOauthGrant",
    tag = "oauth",
    params(
        ("grant_id" = Uuid, Path, description = "Grant id")
    ),
    responses(
        (status = 204, description = "Grant revoked")
    )
)]
pub async fn revoke_grant(
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
    grant_id: web::Path<Uuid>,
    app_conf: web::Data<ApplicationConfiguration>,
    cache: web::Data<Cache>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let revoked_digests =
        OAuthUserClientScopes::revoke_grant_by_id(&mut conn, auth_user.id, *grant_id).await?;
    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
    invalidate_cached_users(&cache, &revoked_digests, token_hmac_key).await;
    token.authorized_ok(HttpResponse::NoContent().finish())
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/grants", web::get().to(get_grants))
        .route("/grants/{grant_id}", web::delete().to(revoke_grant));
}
