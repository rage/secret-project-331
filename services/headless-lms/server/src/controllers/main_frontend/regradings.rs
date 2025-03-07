//! Controllers for requests starting with `/api/v0/main-frontend/regradings/`.

use models::regradings::{NewRegrading, Regrading, RegradingInfo};

use crate::prelude::*;

/**
GET `/api/v0/main-frontend/regradings` - Returns a paginated list of all the regradings.
*/

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

#[instrument(skip(pool, user))]
async fn create(
    pool: web::Data<PgPool>,
    user: AuthUser,
    new_regrading: web::Json<NewRegrading>,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut **&mut conn,
        Act::Edit,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::regradings::insert_and_create_regradings(&mut conn, new_regrading.0, user.id)
        .await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/regradings/{id}` - Returns relevant information about a regrading.
*/

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
