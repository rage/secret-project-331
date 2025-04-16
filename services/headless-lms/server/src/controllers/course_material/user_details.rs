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

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let res = models::user_details::get_user_details_by_user_id(&mut conn, user.id).await?;
    token.authorized_ok(web::Json(res))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserCountryPayload {
    pub country: String,
}

/**
POST `/api/v0/course-material/update-user-country` - Updates the users country to what they have selected
*/
#[instrument(skip(pool))]
pub async fn update_user_country(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<UserCountryPayload>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    models::user_details::update_user_country(&mut conn, user.id, &payload.country).await?;

    let token = skip_authorize();
    token.authorized_ok(web::Json(true))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/user", web::get().to(get_user_details))
        .route("/update-user-country", web::post().to(update_user_country));
}
