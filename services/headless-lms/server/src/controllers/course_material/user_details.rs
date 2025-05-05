use std::net::IpAddr;

use headless_lms_utils::ip_to_country::IpToCountryMapper;
use models::user_details::UserDetail;

use crate::prelude::*;

/**
GET `/api/v0/course-material/user]` - Find user details by user id
*/
#[instrument(skip(pool))]
pub async fn get_user_details(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<UserDetail>> {
    let mut conn = pool.acquire().await?;

    let token = skip_authorize();

    let res = models::user_details::get_user_details_by_user_id(&mut conn, user.id).await?;
    token.authorized_ok(web::Json(res))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]

pub struct UserInfoPayload {
    pub first_name: String,
    pub last_name: String,
    pub country: String,
}

/**
POST `/api/v0/course-material/update-user-info` - Updates the users first and last name and country to what they have selected
*/
#[instrument(skip(pool))]
pub async fn update_user_info(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<UserInfoPayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    models::user_details::update_user_info(
        &mut conn,
        user.id,
        &payload.first_name,
        &payload.last_name,
        &payload.country,
    )
    .await?;

    let token = skip_authorize();
    token.authorized_ok(web::Json(true))
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
    token.authorized_ok(country.to_string())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/user", web::get().to(get_user_details))
        .route("/update-user-info", web::post().to(update_user_info))
        .route("/users-ip-country", web::get().to(get_user_country_by_ip));
}
