use models::{pages::SearchRequest, user_details::UserDetail};

use crate::{controllers, prelude::*};
use headless_lms_utils::{ip_to_country::IpToCountryMapper, tmc::TmcClient};
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
        Res::Course(*course_id),
    )
    .await?;
    let res = models::user_details::get_users_by_course_id(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/user-details/user-details-for-user` - Get authenticated user's own details
*/
#[instrument(skip(pool))]
pub async fn get_user_details_for_user(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<UserDetail>> {
    let mut conn = pool.acquire().await?;

    let token = skip_authorize();
    let user_id = user.id;
    let res = models::user_details::get_user_details_by_user_id(&mut conn, user_id).await?;
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
        .unwrap_or_default();

    let token = skip_authorize();
    token.authorized_ok(country)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserInfoPayload {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub country: String,
    pub email_communication_consent: bool,
}

/**
POST `/api/v0/main-frontend/user-details/update-user-info` - Updates the users information such as email, name, country and email communication consent
*/
#[instrument(skip(pool, app_conf))]
pub async fn update_user_info(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<UserInfoPayload>,
    tmc_client: web::Data<TmcClient>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<UserDetail>> {
    let mut tx = pool.begin().await?;
    let updated_user = models::user_details::update_user_info(
        &mut tx,
        user.id,
        &payload.email,
        &payload.first_name,
        &payload.last_name,
        &payload.country,
        payload.email_communication_consent,
    )
    .await
    .context("Failed to update database")?;

    controllers::auth::update_user_information_to_tmc(
        payload.first_name.clone(),
        payload.last_name.clone(),
        payload.email.clone(),
        tmc_client.clone(),
        app_conf,
    )
    .await
    .context("Failed to update user info to tmc")?;

    tx.commit().await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(updated_user))
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
        .route("/users-ip-country", web::get().to(get_user_country_by_ip))
        .route(
            "/user-details-for-user",
            web::get().to(get_user_details_for_user),
        )
        .route("/update-user-info", web::post().to(update_user_info))
        .route(
            "/{course_id}/get-users-by-course-id",
            web::get().to(get_users_by_course_id),
        );
}
