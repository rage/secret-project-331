use models::{
    roles::{self, RoleDomain, RoleUser, UserRole},
    users,
};

use crate::controllers::prelude::*;

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct RoleInfo {
    pub email: String,
    pub role: UserRole,
    pub domain: RoleDomain,
}

async fn authorize_role_management(
    conn: &mut PgConnection,
    domain: RoleDomain,
    action: Act,
    user_id: Uuid,
) -> ControllerResult<()> {
    match domain {
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
        RoleDomain::Exam(id) => authorize(conn, Act::Edit, Some(user_id), Res::Exam(id)).await?,
    }
    Ok(())
}

/**
 * POST /api/v0/main-frontend/roles/set - Give a role to a user.
 */
#[instrument(skip(pool))]
pub async fn set(
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

    let user = users::get_by_email(&mut conn, &role_info.email).await?;
    roles::insert(&mut conn, user.id, role_info.role, role_info.domain).await?;
    Ok(HttpResponse::Ok().finish())
}

/**
 * POST /api/v0/main-frontend/roles/unset - Remove a role from a user.
 */
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

    let user = users::get_by_email(&mut conn, &role_info.email).await?;
    roles::remove(&mut conn, user.id, role_info.role, role_info.domain).await?;
    Ok(HttpResponse::Ok().finish())
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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
            return Err(ControllerError::BadRequest("Invalid query".to_string()));
        };
        Ok(domain)
    }
}

/**
 * GET /api/v0/main-frontend/roles - Get all roles for the given domain.
 */
#[instrument(skip(pool))]
pub async fn fetch(
    pool: web::Data<PgPool>,
    query: web::Query<RoleQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<RoleUser>>> {
    let mut conn = pool.acquire().await?;
    let domain = query.into_inner().try_into()?;
    authorize_role_management(&mut conn, domain, Act::Edit, user.id).await?;

    let roles = roles::get(&mut conn, domain).await?;
    Ok(web::Json(roles))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/add", web::post().to(set))
        .route("/remove", web::post().to(unset))
        .route("", web::get().to(fetch));
}
