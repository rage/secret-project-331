use crate::prelude::*;
use models::{
    error::TryToOptional,
    pending_roles::{self, PendingRole},
    roles::{self, RoleDomain, RoleInfo, RoleUser},
    user_details, users,
};
use utoipa::{OpenApi, ToSchema};

use crate::domain::authorization::skip_authorize;

#[derive(OpenApi)]
#[openapi(paths(set, unset, fetch, fetch_pending, fetch_waiting_for_me))]
pub(crate) struct MainFrontendRolesApiDoc;

async fn authorize_role_management(
    conn: &mut PgConnection,
    domain: RoleDomain,
    action: Act,
    user_id: Uuid,
) -> ControllerResult<()> {
    let token = match domain {
        RoleDomain::Global => {
            authorize(conn, action, Some(user_id), Res::GlobalPermissions).await?
        }
        RoleDomain::Organization(id) => {
            authorize(conn, action, Some(user_id), Res::Organization(id)).await?
        }
        RoleDomain::Course(id) => authorize(conn, action, Some(user_id), Res::Course(id)).await?,
        RoleDomain::CourseInstance(id) => {
            authorize(conn, action, Some(user_id), Res::CourseInstance(id)).await?
        }
        RoleDomain::Exam(id) => authorize(conn, action, Some(user_id), Res::Exam(id)).await?,
    };

    token.authorized_ok(())
}

/**
 * POST /api/v0/main-frontend/roles/add - Give a role to a user.
 */
#[utoipa::path(
    post,
    path = "/add",
    operation_id = "addRole",
    tag = "roles",
    request_body = RoleInfo,
    responses(
        (status = 200, description = "Role added")
    )
)]
#[instrument(skip(pool, app_conf))]
pub async fn set(
    pool: web::Data<PgPool>,
    role_info: web::Json<RoleInfo>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    authorize_role_management(
        &mut conn,
        role_info.domain,
        Act::EditRole(role_info.role),
        user.id,
    )
    .await?;

    let target_user = users::get_by_email(&mut conn, &role_info.email)
        .await
        .optional()?;
    let email_verified = match &target_user {
        Some(target_user) => user_details::get_user_details_by_user_id(&mut conn, target_user.id)
            .await?
            .email_verified_at
            .is_some(),
        None => false,
    };
    let token = skip_authorize();
    match target_user {
        Some(target_user) if email_verified || !app_conf.enable_email_ownership_verification => {
            roles::insert(&mut conn, target_user.id, role_info.role, role_info.domain).await?;
            token.authorized_ok(HttpResponse::Ok().finish())
        }
        // Anyone can type any unclaimed address into their profile, so a role granted by email
        // waits until the address is proven to be theirs.
        _ if app_conf.enable_email_ownership_verification => {
            pending_roles::insert(
                &mut conn,
                &role_info.email,
                role_info.role,
                role_info.domain,
            )
            .await?;
            token.authorized_ok(HttpResponse::Ok().finish())
        }
        _ => Err(ControllerError::new(
            ControllerErrorType::NotFound,
            "The user either does not exist or has not logged in to this website previously."
                .to_string(),
            None,
        )),
    }
}

/**
 * POST /api/v0/main-frontend/roles/remove - Remove a role from a user.
 */
#[utoipa::path(
    post,
    path = "/remove",
    operation_id = "removeRole",
    tag = "roles",
    request_body = RoleInfo,
    responses(
        (status = 200, description = "Role removed")
    )
)]
#[instrument(skip(pool))]
pub async fn unset(
    pool: web::Data<PgPool>,
    role_info: web::Json<RoleInfo>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    authorize_role_management(
        &mut conn,
        role_info.domain,
        Act::EditRole(role_info.role),
        user.id,
    )
    .await?;
    let withdrawn_pending = pending_roles::delete(
        &mut conn,
        &role_info.email,
        role_info.role,
        role_info.domain,
    )
    .await?;
    let target_user = users::get_by_email(&mut conn, &role_info.email)
        .await
        .optional()?;
    match target_user {
        Some(target_user) => {
            roles::remove(&mut conn, target_user.id, role_info.role, role_info.domain).await?;
        }
        None if withdrawn_pending > 0 => {}
        None => {
            return Err(ControllerError::new(
                ControllerErrorType::NotFound,
                "No user or pending role with this email was found.".to_string(),
                None,
            ));
        }
    }

    let token = skip_authorize();
    token.authorized_ok(HttpResponse::Ok().finish())
}

#[derive(Debug, Deserialize, ToSchema)]

pub struct RoleQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    global: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    organization_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    course_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    course_instance_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    exam_id: Option<Uuid>,
}

impl TryFrom<RoleQuery> for RoleDomain {
    type Error = ControllerError;

    fn try_from(
        RoleQuery {
            global,
            organization_id,
            course_id,
            course_instance_id,
            exam_id,
        }: RoleQuery,
    ) -> Result<Self, Self::Error> {
        let domain = if global.unwrap_or_default() {
            RoleDomain::Global
        } else if let Some(id) = organization_id {
            RoleDomain::Organization(id)
        } else if let Some(id) = course_id {
            RoleDomain::Course(id)
        } else if let Some(id) = course_instance_id {
            RoleDomain::CourseInstance(id)
        } else if let Some(id) = exam_id {
            RoleDomain::Exam(id)
        } else {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Invalid query".to_string(),
                None,
            ));
        };
        Ok(domain)
    }
}

/**
 * GET /api/v0/main-frontend/roles - Get all roles for the given domain.
 */
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "",
    operation_id = "getRoles",
    tag = "roles",
    params(
        ("global" = Option<bool>, Query, description = "Global domain"),
        ("organization_id" = Option<Uuid>, Query, description = "Organization id"),
        ("course_id" = Option<Uuid>, Query, description = "Course id"),
        ("course_instance_id" = Option<Uuid>, Query, description = "Course instance id"),
        ("exam_id" = Option<Uuid>, Query, description = "Exam id")
    ),
    responses(
        (status = 200, description = "Roles", body = [RoleUser])
    )
)]
pub async fn fetch(
    pool: web::Data<PgPool>,
    query: web::Query<RoleQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<RoleUser>>> {
    let mut conn = pool.acquire().await?;
    let domain = query.into_inner().try_into()?;
    authorize_role_management(&mut conn, domain, Act::Edit, user.id).await?;

    let roles = roles::get(&mut conn, domain).await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(roles))
}

/**
 * GET /api/v0/main-frontend/roles - Get all pending roles for the given domain.
 */
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/pending",
    operation_id = "getPendingRoles",
    tag = "roles",
    params(
        ("global" = Option<bool>, Query, description = "Global domain"),
        ("organization_id" = Option<Uuid>, Query, description = "Organization id"),
        ("course_id" = Option<Uuid>, Query, description = "Course id"),
        ("course_instance_id" = Option<Uuid>, Query, description = "Course instance id"),
        ("exam_id" = Option<Uuid>, Query, description = "Exam id")
    ),
    responses(
        (status = 200, description = "Pending roles", body = [PendingRole])
    )
)]
pub async fn fetch_pending(
    pool: web::Data<PgPool>,
    query: web::Query<RoleQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PendingRole>>> {
    let mut conn = pool.acquire().await?;
    let domain = query.into_inner().try_into()?;
    authorize_role_management(&mut conn, domain, Act::Edit, user.id).await?;

    let roles = pending_roles::get_all(&mut conn, domain).await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(roles))
}

/**
GET `/api/v0/main-frontend/roles/pending/waiting-for-me` - How many roles granted to the signed-in
user's email wait for them to verify it.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/pending/waiting-for-me",
    operation_id = "getPendingRoleCountWaitingForMe",
    tag = "roles",
    responses(
        (status = 200, description = "Number of pending roles waiting for email verification", body = i64)
    )
)]
pub async fn fetch_waiting_for_me(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<i64>> {
    let mut conn = pool.acquire().await?;
    let count = pending_roles::count_waiting_for_user(&mut conn, user.id).await?;
    // Only ever about the caller's own address.
    let token = skip_authorize();
    token.authorized_ok(web::Json(count))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/add", web::post().to(set))
        .route("/remove", web::post().to(unset))
        .route("", web::get().to(fetch))
        .route("/pending", web::get().to(fetch_pending))
        .route(
            "/pending/waiting-for-me",
            web::get().to(fetch_waiting_for_me),
        );
}
