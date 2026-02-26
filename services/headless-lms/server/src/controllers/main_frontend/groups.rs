use crate::controllers::main_frontend::roles::RoleQuery;
use crate::prelude::*;
use models::{
    group_memberships, group_roles, groups as group_models,
    roles::{RoleDomain, UserRole},
    users,
};

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GroupListQuery {
    pub organization_id: Uuid,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GroupListResponse {
    pub groups: Vec<group_models::Group>,
    pub can_create_groups: bool,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CreateGroupRequest {
    pub organization_id: Uuid,
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct RenameGroupRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AddGroupMemberRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GroupRoleMutationRequest {
    pub role: UserRole,
    pub domain: RoleDomain,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GroupCapabilities {
    pub is_member: bool,
    pub can_manage_group: bool,
    pub can_manage_members: bool,
    pub can_manage_group_roles: bool,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GroupDetailResponse {
    pub group: group_models::Group,
    pub capabilities: GroupCapabilities,
}

fn normalize_group_name(name: &str) -> Result<String, ControllerError> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Group name cannot be empty.".to_string(),
            None,
        ));
    }
    Ok(trimmed)
}

async fn has_org_group_management_permission(
    conn: &mut PgConnection,
    user_id: Uuid,
    organization_id: Uuid,
) -> Result<bool, ControllerError> {
    match authorize(
        conn,
        Act::Edit,
        Some(user_id),
        Res::Organization(organization_id),
    )
    .await
    {
        Ok(_) => Ok(true),
        Err(err) if matches!(err.error_type(), &ControllerErrorType::Forbidden) => Ok(false),
        Err(err) => Err(err),
    }
}

async fn get_group_and_capabilities(
    conn: &mut PgConnection,
    group_id: Uuid,
    user_id: Uuid,
) -> Result<GroupDetailResponse, ControllerError> {
    let group = group_models::get_active_by_id(conn, group_id).await?;
    let can_manage_org =
        has_org_group_management_permission(conn, user_id, group.organization_id).await?;
    let is_member = group_models::is_member(conn, group.id, user_id).await?;

    if !can_manage_org && !is_member {
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "You do not have access to this group.".to_string(),
            None,
        ));
    }

    let capabilities = GroupCapabilities {
        is_member,
        can_manage_group: can_manage_org || is_member,
        can_manage_members: can_manage_org || is_member,
        can_manage_group_roles: can_manage_org,
    };

    Ok(GroupDetailResponse {
        group,
        capabilities,
    })
}

async fn authorize_group_member_management(
    conn: &mut PgConnection,
    group: &group_models::Group,
    user_id: Uuid,
) -> Result<(), ControllerError> {
    let can_manage_org =
        has_org_group_management_permission(conn, user_id, group.organization_id).await?;
    if can_manage_org || group_models::is_member(conn, group.id, user_id).await? {
        return Ok(());
    }
    Err(ControllerError::new(
        ControllerErrorType::Forbidden,
        "You are not allowed to manage this group.".to_string(),
        None,
    ))
}

async fn authorize_role_management(
    conn: &mut PgConnection,
    domain: RoleDomain,
    action: Act,
    user_id: Uuid,
) -> Result<(), ControllerError> {
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
        RoleDomain::Exam(id) => authorize(conn, Act::Edit, Some(user_id), Res::Exam(id)).await?,
    };

    let _ = token;
    Ok(())
}

async fn validate_group_role_domain_belongs_to_group_org(
    conn: &mut PgConnection,
    group: &group_models::Group,
    domain: RoleDomain,
) -> Result<(), ControllerError> {
    let target_org_id = match domain {
        RoleDomain::Global => {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Group roles cannot be assigned in the global scope.".to_string(),
                None,
            ));
        }
        RoleDomain::Organization(id) => id,
        RoleDomain::Course(id) => models::courses::get_organization_id(conn, id).await?,
        RoleDomain::CourseInstance(id) => {
            models::course_instances::get_organization_id(conn, id).await?
        }
        RoleDomain::Exam(id) => models::exams::get_organization_id(conn, id).await?,
    };

    if target_org_id != group.organization_id {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "The selected scope must belong to the same organization as the group.".to_string(),
            None,
        ));
    }

    Ok(())
}

#[instrument(skip(pool))]
pub async fn list_groups(
    pool: web::Data<PgPool>,
    query: web::Query<GroupListQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<GroupListResponse>> {
    let mut conn = pool.acquire().await?;
    let organization_id = query.organization_id;
    let _organization = models::organizations::get_organization(&mut conn, organization_id).await?;
    let can_create_groups =
        has_org_group_management_permission(&mut conn, user.id, organization_id).await?;

    let groups = if can_create_groups {
        group_models::list_by_organization(&mut conn, organization_id).await?
    } else {
        group_models::list_by_organization_for_member(&mut conn, organization_id, user.id).await?
    };

    let token = skip_authorize();
    token.authorized_ok(web::Json(GroupListResponse {
        groups,
        can_create_groups,
    }))
}

#[instrument(skip(pool, payload))]
pub async fn create_group(
    pool: web::Data<PgPool>,
    payload: web::Json<CreateGroupRequest>,
    user: AuthUser,
) -> ControllerResult<web::Json<group_models::Group>> {
    let mut conn = pool.acquire().await?;
    let payload = payload.into_inner();
    let name = normalize_group_name(&payload.name)?;

    authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Organization(payload.organization_id),
    )
    .await?;

    let group = group_models::create(&mut conn, payload.organization_id, &name).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(group))
}

#[instrument(skip(pool))]
pub async fn get_group(
    pool: web::Data<PgPool>,
    group_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<GroupDetailResponse>> {
    let mut conn = pool.acquire().await?;
    let detail = get_group_and_capabilities(&mut conn, *group_id, user.id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(detail))
}

#[instrument(skip(pool, payload))]
pub async fn rename_group(
    pool: web::Data<PgPool>,
    group_id: web::Path<Uuid>,
    payload: web::Json<RenameGroupRequest>,
    user: AuthUser,
) -> ControllerResult<web::Json<group_models::Group>> {
    let mut conn = pool.acquire().await?;
    let group = group_models::get_active_by_id(&mut conn, *group_id).await?;
    authorize_group_member_management(&mut conn, &group, user.id).await?;
    let name = normalize_group_name(&payload.name)?;
    let updated_group = group_models::rename(&mut conn, group.id, &name).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(updated_group))
}

#[instrument(skip(pool))]
pub async fn delete_group(
    pool: web::Data<PgPool>,
    group_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let group = group_models::get_active_by_id(&mut conn, *group_id).await?;
    authorize_group_member_management(&mut conn, &group, user.id).await?;
    group_models::soft_delete_with_dependents(&mut conn, group.id).await?;
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::Ok().finish())
}

#[instrument(skip(pool))]
pub async fn list_group_members(
    pool: web::Data<PgPool>,
    group_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<group_memberships::GroupMember>>> {
    let mut conn = pool.acquire().await?;
    let detail = get_group_and_capabilities(&mut conn, *group_id, user.id).await?;
    let members = group_memberships::list_members(&mut conn, detail.group.id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(members))
}

#[instrument(skip(pool, payload))]
pub async fn add_group_member(
    pool: web::Data<PgPool>,
    group_id: web::Path<Uuid>,
    payload: web::Json<AddGroupMemberRequest>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let group = group_models::get_active_by_id(&mut conn, *group_id).await?;
    authorize_group_member_management(&mut conn, &group, user.id).await?;

    let target_user = users::try_get_by_email(&mut conn, payload.email.trim()).await?;
    let Some(target_user) = target_user else {
        return Err(ControllerError::new(
            ControllerErrorType::NotFound,
            "The user either does not exist or has not logged in to this website previously."
                .to_string(),
            None,
        ));
    };

    group_memberships::add_member(&mut conn, group.id, target_user.id).await?;
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::Ok().finish())
}

#[instrument(skip(pool))]
pub async fn remove_group_member(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let (group_id, member_user_id) = path.into_inner();
    let group = group_models::get_active_by_id(&mut conn, group_id).await?;
    authorize_group_member_management(&mut conn, &group, user.id).await?;
    group_memberships::remove_member(&mut conn, group.id, member_user_id).await?;
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::Ok().finish())
}

#[instrument(skip(pool))]
pub async fn list_group_roles(
    pool: web::Data<PgPool>,
    group_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<group_roles::GroupRoleAssignment>>> {
    let mut conn = pool.acquire().await?;
    let detail = get_group_and_capabilities(&mut conn, *group_id, user.id).await?;
    let roles = group_roles::list_by_group(&mut conn, detail.group.id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(roles))
}

#[instrument(skip(pool, payload))]
pub async fn add_group_role(
    pool: web::Data<PgPool>,
    group_id: web::Path<Uuid>,
    payload: web::Json<GroupRoleMutationRequest>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let group = group_models::get_active_by_id(&mut conn, *group_id).await?;
    let payload = payload.into_inner();
    validate_group_role_domain_belongs_to_group_org(&mut conn, &group, payload.domain).await?;
    authorize_role_management(
        &mut conn,
        payload.domain,
        Act::EditRole(payload.role),
        user.id,
    )
    .await?;
    group_roles::insert(&mut conn, group.id, payload.role, payload.domain).await?;
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::Ok().finish())
}

#[instrument(skip(pool, payload))]
pub async fn remove_group_role(
    pool: web::Data<PgPool>,
    group_id: web::Path<Uuid>,
    payload: web::Json<GroupRoleMutationRequest>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let group = group_models::get_active_by_id(&mut conn, *group_id).await?;
    let payload = payload.into_inner();
    validate_group_role_domain_belongs_to_group_org(&mut conn, &group, payload.domain).await?;
    authorize_role_management(
        &mut conn,
        payload.domain,
        Act::EditRole(payload.role),
        user.id,
    )
    .await?;
    group_roles::remove(&mut conn, group.id, payload.role, payload.domain).await?;
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::Ok().finish())
}

#[instrument(skip(pool))]
pub async fn list_groups_with_access_for_domain(
    pool: web::Data<PgPool>,
    query: web::Query<RoleQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<group_roles::GroupAccessRow>>> {
    let mut conn = pool.acquire().await?;
    let domain = query.into_inner().try_into()?;
    if matches!(domain, RoleDomain::Global) {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Group access is not available for the global permission page.".to_string(),
            None,
        ));
    }

    authorize_role_management(&mut conn, domain, Act::Edit, user.id).await?;
    let rows = group_roles::list_groups_with_access_for_domain(&mut conn, domain).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(rows))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(list_groups))
        .route("", web::post().to(create_group))
        .route(
            "/domain-access",
            web::get().to(list_groups_with_access_for_domain),
        )
        .route("/{group_id}", web::get().to(get_group))
        .route("/{group_id}", web::patch().to(rename_group))
        .route("/{group_id}", web::delete().to(delete_group))
        .route("/{group_id}/members", web::get().to(list_group_members))
        .route("/{group_id}/members", web::post().to(add_group_member))
        .route(
            "/{group_id}/members/{user_id}",
            web::delete().to(remove_group_member),
        )
        .route("/{group_id}/roles", web::get().to(list_group_roles))
        .route("/{group_id}/roles/add", web::post().to(add_group_role))
        .route(
            "/{group_id}/roles/remove",
            web::post().to(remove_group_role),
        );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::Conn;
    use chrono::Utc;
    use models::{exams, groups as group_models, organizations};

    fn unique_text(prefix: &str) -> String {
        format!("{prefix}-{}", Uuid::new_v4())
    }

    #[test]
    fn normalize_group_name_trims_and_rejects_empty() {
        assert_eq!(normalize_group_name("  Team A  ").unwrap(), "Team A");

        let err = normalize_group_name("   ").unwrap_err();
        assert_eq!(err.error_type(), &ControllerErrorType::BadRequest);
    }

    #[actix_web::test]
    async fn validate_group_role_domain_rejects_global_scope() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let org_id = organizations::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &unique_text("org"),
            &unique_text("slug"),
            None,
            false,
        )
        .await
        .unwrap();
        let group = group_models::create(tx.as_mut(), org_id, "Group")
            .await
            .unwrap();

        let err = validate_group_role_domain_belongs_to_group_org(
            tx.as_mut(),
            &group,
            RoleDomain::Global,
        )
        .await
        .unwrap_err();
        assert_eq!(err.error_type(), &ControllerErrorType::BadRequest);
    }

    #[actix_web::test]
    async fn validate_group_role_domain_allows_and_rejects_organization_scope() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let org_a = organizations::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &unique_text("org"),
            &unique_text("slug"),
            None,
            false,
        )
        .await
        .unwrap();
        let org_b = organizations::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &unique_text("org"),
            &unique_text("slug"),
            None,
            false,
        )
        .await
        .unwrap();
        let group = group_models::create(tx.as_mut(), org_a, "Group")
            .await
            .unwrap();

        validate_group_role_domain_belongs_to_group_org(
            tx.as_mut(),
            &group,
            RoleDomain::Organization(org_a),
        )
        .await
        .unwrap();

        let err = validate_group_role_domain_belongs_to_group_org(
            tx.as_mut(),
            &group,
            RoleDomain::Organization(org_b),
        )
        .await
        .unwrap_err();
        assert_eq!(err.error_type(), &ControllerErrorType::BadRequest);
    }

    #[actix_web::test]
    async fn validate_group_role_domain_allows_and_rejects_course_and_instance_scopes() {
        crate::insert_data!(:tx, :user, org: org1, course: course1, instance: instance1);
        crate::insert_data!(tx: tx, user: user; org: org2, course: course2, instance: instance2);

        let group = group_models::create(tx.as_mut(), org1, "Course Group")
            .await
            .unwrap();

        validate_group_role_domain_belongs_to_group_org(
            tx.as_mut(),
            &group,
            RoleDomain::Course(course1),
        )
        .await
        .unwrap();
        validate_group_role_domain_belongs_to_group_org(
            tx.as_mut(),
            &group,
            RoleDomain::CourseInstance(instance1.id),
        )
        .await
        .unwrap();

        let err = validate_group_role_domain_belongs_to_group_org(
            tx.as_mut(),
            &group,
            RoleDomain::Course(course2),
        )
        .await
        .unwrap_err();
        assert_eq!(err.error_type(), &ControllerErrorType::BadRequest);

        let err = validate_group_role_domain_belongs_to_group_org(
            tx.as_mut(),
            &group,
            RoleDomain::CourseInstance(instance2.id),
        )
        .await
        .unwrap_err();
        assert_eq!(err.error_type(), &ControllerErrorType::BadRequest);
    }

    #[actix_web::test]
    async fn validate_group_role_domain_allows_and_rejects_exam_scope() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let org_a = organizations::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &unique_text("org"),
            &unique_text("slug"),
            None,
            false,
        )
        .await
        .unwrap();
        let org_b = organizations::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &unique_text("org"),
            &unique_text("slug"),
            None,
            false,
        )
        .await
        .unwrap();

        let group = group_models::create(tx.as_mut(), org_a, "Exam Group")
            .await
            .unwrap();

        let exam_a = exams::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &exams::NewExam {
                name: unique_text("exam"),
                starts_at: None,
                ends_at: None,
                time_minutes: 60,
                organization_id: org_a,
                minimum_points_treshold: 0,
                grade_manually: false,
            },
        )
        .await
        .unwrap();
        let exam_b = exams::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &exams::NewExam {
                name: unique_text("exam"),
                starts_at: Some(Utc::now()),
                ends_at: None,
                time_minutes: 60,
                organization_id: org_b,
                minimum_points_treshold: 0,
                grade_manually: false,
            },
        )
        .await
        .unwrap();

        validate_group_role_domain_belongs_to_group_org(
            tx.as_mut(),
            &group,
            RoleDomain::Exam(exam_a),
        )
        .await
        .unwrap();

        let err = validate_group_role_domain_belongs_to_group_org(
            tx.as_mut(),
            &group,
            RoleDomain::Exam(exam_b),
        )
        .await
        .unwrap_err();
        assert_eq!(err.error_type(), &ControllerErrorType::BadRequest);
    }
}
