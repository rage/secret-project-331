use models::{pages::SearchRequest, user_details::UserDetail};

use crate::prelude::*;

/**
GET `/api/v0/main-frontend/user-details/[id]` - Find user details by user id
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_user_details(
    user: AuthUser,
    pool: web::Data<PgPool>,
    user_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<UserDetail>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::user_details::get_user_details_by_user_id(&mut conn, *user_id).await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/user-details/search-by-email` - Allows to search user by their email
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn search_users_by_email(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<SearchRequest>,
) -> ControllerResult<web::Json<Vec<UserDetail>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res =
        models::user_details::search_for_user_details_by_email(&mut conn, &payload.query).await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/user-details/search-by-other-details` - Allows to search user by their names etc.
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn search_users_by_other_details(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<SearchRequest>,
) -> ControllerResult<web::Json<Vec<UserDetail>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res =
        models::user_details::search_for_user_details_by_other_details(&mut conn, &payload.query)
            .await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/user-details/search-fuzzy-match` - Allows to find the right user details in cases where there is a small typing error in the search query
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn search_users_fuzzy_match(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<SearchRequest>,
) -> ControllerResult<web::Json<Vec<UserDetail>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::user_details::search_for_user_details_fuzzy_match(&mut conn, &payload.query)
        .await?;
    token.authorized_ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/search-by-email", web::post().to(search_users_by_email))
        .route(
            "/search-by-other-details",
            web::post().to(search_users_by_other_details),
        )
        .route(
            "/search-fuzzy-match",
            web::post().to(search_users_fuzzy_match),
        )
        .route("/{user_id}", web::get().to(get_user_details));
}
