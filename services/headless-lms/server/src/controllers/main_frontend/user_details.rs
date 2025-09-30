use models::{pages::SearchRequest, user_details::UserDetail};

use crate::{controllers, prelude::*};
use headless_lms_utils::{ip_to_country::IpToCountryMapper, tmc::TmcClient};
use std::net::IpAddr;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct BulkUserDetailsRequest {
    pub user_ids: Vec<Uuid>,
    pub course_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserDetailsRequest {
    pub user_id: Uuid,
    pub course_ids: Vec<Uuid>,
}

/**
GET `/api/v0/main-frontend/user-details/{course_id}/user/{user_id}` - Find user details by user id with course permission check
Only returns user details if the user is enrolled in the specified course
*/
#[instrument(skip(pool))]
pub async fn get_user_details(
    user: AuthUser,
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> ControllerResult<web::Json<UserDetail>> {
    let (course_id, user_id) = path.into_inner();
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;
    let res =
        models::user_details::get_user_details_by_user_id_for_course(&mut conn, user_id, course_id)
            .await?;
    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/user-details/user-by-courses` - Find user details by user id with multi-course permission check
Returns user details if the user has permission to view user details through any of the specified courses
*/
#[instrument(skip(pool))]
pub async fn get_user_details_by_courses(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<UserDetailsRequest>,
) -> ControllerResult<web::Json<UserDetail>> {
    let mut conn = pool.acquire().await?;

    // Check if the user has permission to view user details through any of the provided courses
    let mut token = None;

    if payload.course_ids.is_empty() {
        // One can view the details though global permissions even though they have not started any course yet
        token = Some(
            authorize(
                &mut conn,
                Act::ViewUserProgressOrDetails,
                Some(user.id),
                Res::GlobalPermissions,
            )
            .await?,
        );
    } else {
        for course_id in &payload.course_ids {
            if let Ok(auth_token) = authorize(
                &mut conn,
                Act::ViewUserProgressOrDetails,
                Some(user.id),
                Res::Course(*course_id),
            )
            .await
            {
                token = Some(auth_token);
                break;
            }
        }
    }

    let token = token.ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::Forbidden,
            "No permission to view user details through any of the provided courses".to_string(),
            None,
        )
    })?;

    // If we have permission, get the user details without course restriction
    let res = models::user_details::get_user_details_by_user_id(&mut conn, payload.user_id).await?;
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
POST `/api/v0/main-frontend/user-details/bulk-user-details` - Get user details for a list of user IDs with course permission check
Only returns user details for users who are actually enrolled in the specified course
*/
#[instrument(skip(pool))]
pub async fn get_bulk_user_details(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<BulkUserDetailsRequest>,
) -> ControllerResult<web::Json<Vec<UserDetail>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::Course(payload.course_id),
    )
    .await?;
    let res = models::user_details::get_user_details_by_user_ids_for_course(
        &mut conn,
        &payload.user_ids,
        payload.course_id,
    )
    .await?;
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
#[instrument(skip(pool, app_conf, tmc_client))]
pub async fn update_user_info(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<UserInfoPayload>,
    tmc_client: web::Data<TmcClient>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<UserDetail>> {
    let mut tx = pool.begin().await?;

    let existing_user = models::user_details::get_user_details_by_user_id(&mut tx, user.id)
        .await
        .context("Failed to fetch existing user data")?;

    let user = models::users::get_by_id(&mut tx, user.id)
        .await
        .context("Failed to fetch user")?;

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

    let email_changed = existing_user.email != payload.email;
    let first_name_changed = existing_user.first_name != Some(payload.first_name.clone());
    let last_name_changed = existing_user.last_name != Some(payload.last_name.clone());

    if !app_conf.test_mode && (email_changed || first_name_changed || last_name_changed) {
        let email_opt = if email_changed {
            Some(payload.email.clone())
        } else {
            None
        };

        let upstream_id = user
            .upstream_id
            .ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Missing upstream_id".to_string(),
                    None,
                )
            })?
            .to_string();

        controllers::auth::update_user_information_to_tmc(
            payload.first_name.clone(),
            payload.last_name.clone(),
            email_opt,
            upstream_id,
            tmc_client.clone(),
            app_conf,
        )
        .await
        .map_err(|e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to update user info to tmc",
                e,
            )
        })?;
    } else {
        info!("User info unchanged, skipping update to TMC.");
    }

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
        .route(
            "/{course_id}/user/{user_id}",
            web::get().to(get_user_details),
        )
        .route(
            "/user-by-courses",
            web::post().to(get_user_details_by_courses),
        )
        .route("/users-ip-country", web::get().to(get_user_country_by_ip))
        .route(
            "/user-details-for-user",
            web::get().to(get_user_details_for_user),
        )
        .route("/update-user-info", web::post().to(update_user_info))
        .route(
            "/{course_id}/get-users-by-course-id",
            web::get().to(get_users_by_course_id),
        )
        .route("/bulk-user-details", web::post().to(get_bulk_user_details));
}
