use crate::prelude::*;
use actix_web::{HttpResponse, web};
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

// KNOWN GAP: unlike `POST /revoke`, this doesn't evict the exercise-services
// bearer-token cache (`domain::exercise_services::token`), which is keyed by each
// token's plaintext. `revoke_user_client_everything` below only has one-way DB
// digests, which can't be turned back into that plaintext. A real fix means
// re-keying the cache by digest, or a parallel per-(user_id, client_id)
// invalidation marker -- both touch the validation hot path, so left as
// separate, larger work. Until then, a token revoked here can keep
// authenticating from a stale cache entry for up to `MAX_CACHE_TTL` (1h).
#[instrument(skip(pool, auth_user))]
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
