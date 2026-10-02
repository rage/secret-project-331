//! Controllers for requests starting with `/api/v0/main-frontend/regradings/`.

use models::regradings::{NewRegrading, Regrading, RegradingInfo};
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_regradings, get_regradings_count, create, get_regrading_info_by_id))]
pub(crate) struct MainFrontendRegradingsApiDoc;

/**
GET `/api/v0/main-frontend/regradings` - Returns a paginated list of all the regradings.
*/

#[utoipa::path(
    get,
    path = "",
    operation_id = "getRegradings",
    tag = "regradings",
    params(
        ("page" = Option<i64>, Query, description = "Page number"),
        ("limit" = Option<i64>, Query, description = "Page size")
    ),
    responses(
        (status = 200, description = "Regradings", body = [Regrading])
    )
)]
#[instrument(skip(pool, user))]
async fn get_regradings(
    pool: web::Data<PgPool>,
    user: AuthUser,
    pagination: web::Query<Pagination>,
) -> ControllerResult<web::Json<Vec<Regrading>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    let res = models::regradings::get_all_paginated(&mut conn, *pagination).await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/regradings/count` - Counts regradings
*/

#[utoipa::path(
    get,
    path = "/count",
    operation_id = "getRegradingsCount",
    tag = "regradings",
    responses(
        (status = 200, description = "Regradings count", body = i64)
    )
)]
#[instrument(skip(pool, user))]
async fn get_regradings_count(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<i64>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    let res = models::regradings::get_all_count(&mut conn).await?;
    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/regradings` - Creates a new regrading for the supplied exercise task submission ids and returns the new regrading id.
*/

#[utoipa::path(
    post,
    path = "",
    operation_id = "createRegrading",
    tag = "regradings",
    request_body = NewRegrading,
    responses(
        (status = 200, description = "Created regrading id", body = String)
    )
)]
#[instrument(skip(pool, user))]
async fn create(
    pool: web::Data<PgPool>,
    user: AuthUser,
    new_regrading: web::Json<NewRegrading>,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    let res = models::regradings::insert_and_create_regradings(&mut conn, new_regrading.0, user.id)
        .await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/regradings/{id}` - Returns relevant information about a regrading.
*/

#[utoipa::path(
    get,
    path = "/{regrading_id}",
    operation_id = "getRegradingInfo",
    tag = "regradings",
    params(
        ("regrading_id" = Uuid, Path, description = "Regrading id")
    ),
    responses(
        (status = 200, description = "Regrading info", body = RegradingInfo)
    )
)]
#[instrument(skip(pool, user))]
async fn get_regrading_info_by_id(
    pool: web::Data<PgPool>,
    user: AuthUser,
    regrading_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<RegradingInfo>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    let res = models::regradings::get_regrading_info_by_id(&mut conn, *regrading_id).await?;
    token.authorized_ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_regradings))
        .route("/count", web::get().to(get_regradings_count))
        .route("", web::post().to(create))
        .route("/{regrading_id}", web::get().to(get_regrading_info_by_id));
}
