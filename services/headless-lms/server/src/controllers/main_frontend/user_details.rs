use models::{pages::SearchRequest, user_details::UserDetail};

use crate::prelude::*;
use headless_lms_utils::ip_to_country::IpToCountryMapper;
use std::net::IpAddr;

/**
GET `/api/v0/main-frontend/user-details/[id]` - Find user details by user id
*/
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

/**
GET `/api/v0/main-frontend/user-details/get-users-by-course-id` - Get user details of users that are in the course
*/
pub async fn get_users_by_course_id(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<UserDetail>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::user_details::get_users_by_course_id(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(res))
}

pub async fn get_user_country_by_ip(
    req: HttpRequest,
    ip_to_country_mapper: web::Data<IpToCountryMapper>,
) -> ControllerResult<String> {
    let connection_info = req.connection_info();

    let ip: Option<IpAddr> = connection_info
        .realip_remote_addr()
        .and_then(|ip| ip.parse::<IpAddr>().ok());

    let country = ip
        .and_then(|ip| ip_to_country_mapper.map_ip_to_country(&ip))
        .map(|c| c.to_string())
        .unwrap_or_else(|| "".to_string());

    let token = skip_authorize();
    token.authorized_ok(country)
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
        .route("/user/{user_id}", web::get().to(get_user_details))
        .route(
            "/{course_id}/get-users-by-course-id",
            web::get().to(get_users_by_course_id),
        )
        .route("/users-ip-country", web::get().to(get_user_country_by_ip));
}
