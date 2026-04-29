//! Controllers for requests starting with `/api/v0/main-frontend/organizations`.

use std::{path::PathBuf, str::FromStr};

use models::{
    courses::{Course, CourseCount},
    exams::{CourseExam, NewExam, OrgExam},
    organizations::Organization,
    pages::{self, NewPage},
};

use crate::controllers::auth::is_user_global_admin;
use crate::domain::authorization::{Action as Act, Resource as Res};
use crate::{
    controllers::helpers::file_uploading::upload_image_for_organization,
    domain::authorization::{
        Action, Resource, authorize, authorize_with_fetched_list_of_roles, skip_authorize,
    },
    prelude::*,
};

use actix_web::web::{self, Json};
use utoipa::{OpenApi, ToSchema};

#[derive(OpenApi)]
#[openapi(paths(
    get_all_organizations,
    create_organization,
    get_organization,
    update_organization,
    soft_delete_organization,
    get_organization_courses,
    get_organization_duplicatable_courses,
    get_organization_course_count,
    get_organization_active_courses,
    get_organization_active_courses_count,
    set_organization_image,
    remove_organization_image,
    get_course_exams,
    get_org_exams,
    get_org_exam_with_exam_id,
    create_exam
))]
pub(crate) struct MainFrontendOrganizationsApiDoc;

#[allow(dead_code)]
#[derive(Debug, ToSchema)]
struct OrganizationImageUploadPayload {
    #[schema(content_media_type = "application/octet-stream", value_type = String, format = Binary)]
    file: Vec<u8>,
}

/**
GET `/api/v0/main-frontend/organizations` - Returns a list of all organizations.
*/
#[utoipa::path(
    get,
    path = "",
    operation_id = "getOrganizations",
    tag = "organizations",
    responses(
        (status = 200, description = "Organizations", body = [Organization])
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_all_organizations(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Organization>>> {
    let mut conn = pool.acquire().await?;

    let is_admin = if let Some(user) = user {
        is_user_global_admin(&mut conn, user.id).await?
    } else {
        false
    };

    // Choose query based on admin status
    let raw_organizations = if is_admin {
        models::organizations::all_organizations_include_hidden(&mut conn).await?
    } else {
        models::organizations::all_organizations(&mut conn).await?
    };

    let organizations = raw_organizations
        .into_iter()
        .map(|org| Organization::from_database_organization(org, file_store.as_ref(), &app_conf))
        .collect();

    let token = skip_authorize();
    token.authorized_ok(web::Json(organizations))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}/courses"` - Returns a list of all courses in a organization.
*/
#[utoipa::path(
    get,
    path = "/{organization_id}/courses",
    operation_id = "getOrganizationCourses",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id"),
        ("page" = Option<i64>, Query, description = "Page number"),
        ("limit" = Option<i64>, Query, description = "Page size")
    ),
    responses(
        (status = 200, description = "Organization courses", body = [Course])
    )
)]
#[instrument(skip(pool))]
async fn get_organization_courses(
    organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
    pagination: web::Query<Pagination>,
) -> ControllerResult<web::Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;

    let user = user.map(|u| u.id);
    let courses = models::courses::organization_courses_visible_to_user_paginated(
        &mut conn,
        *organization_id,
        user,
        *pagination,
    )
    .await?;

    let token = skip_authorize();
    token.authorized_ok(web::Json(courses))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}/courses/duplicatable"` - Returns a list of all courses in a organization that the current user has permission to duplicate.
*/
#[utoipa::path(
    get,
    path = "/{organization_id}/courses/duplicatable",
    operation_id = "getOrganizationDuplicatableCourses",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    responses(
        (status = 200, description = "Duplicatable organization courses", body = [Course])
    )
)]
#[instrument(skip(pool))]
async fn get_organization_duplicatable_courses(
    organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let courses = models::courses::get_by_organization_id(&mut conn, *organization_id).await?;

    // We filter out the courses the user does not have permission to duplicate.
    // Prefetch roles so that we can do multiple authorization checks without repeteadly querying the database.
    let user_roles = models::roles::get_roles(&mut conn, user.id).await?;

    let mut duplicatable_courses = Vec::new();
    for course in courses {
        if authorize_with_fetched_list_of_roles(
            &mut conn,
            Action::Duplicate,
            Some(user.id),
            Resource::Course(course.id),
            &user_roles,
        )
        .await
        .is_ok()
        {
            duplicatable_courses.push(course);
        }
    }

    let token = skip_authorize();
    token.authorized_ok(web::Json(duplicatable_courses))
}

#[utoipa::path(
    get,
    path = "/{organization_id}/courses/count",
    operation_id = "getOrganizationCourseCount",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    responses(
        (status = 200, description = "Organization course count", body = CourseCount)
    )
)]
#[instrument(skip(pool))]
async fn get_organization_course_count(
    request_organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<CourseCount>> {
    let mut conn = pool.acquire().await?;
    let result =
        models::courses::organization_course_count(&mut conn, *request_organization_id).await?;

    let token = skip_authorize();
    token.authorized_ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/{organization_id}/courses/active",
    operation_id = "getOrganizationActiveCourses",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id"),
        ("page" = Option<i64>, Query, description = "Page number"),
        ("limit" = Option<i64>, Query, description = "Page size")
    ),
    responses(
        (status = 200, description = "Active organization courses", body = [Course])
    )
)]
#[instrument(skip(pool))]
async fn get_organization_active_courses(
    request_organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    pagination: web::Query<Pagination>,
) -> ControllerResult<Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let courses = models::courses::get_active_courses_for_organization(
        &mut conn,
        *request_organization_id,
        *pagination,
    )
    .await?;

    let token = skip_authorize();
    token.authorized_ok(Json(courses))
}

#[utoipa::path(
    get,
    path = "/{organization_id}/courses/active/count",
    operation_id = "getOrganizationActiveCourseCount",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    responses(
        (status = 200, description = "Active organization course count", body = CourseCount)
    )
)]
#[instrument(skip(pool))]
async fn get_organization_active_courses_count(
    request_organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<CourseCount>> {
    let mut conn = pool.acquire().await?;
    let result = models::courses::get_active_courses_for_organization_count(
        &mut conn,
        *request_organization_id,
    )
    .await?;

    let token = skip_authorize();
    token.authorized_ok(Json(result))
}

/**
PUT `/api/v0/main-frontend/organizations/:organizations_id/image` - Sets or updates the chapter image.

# Example

Request:
```http
PUT /api/v0/main-frontend/organizations/d332f3d9-39a5-4a18-80f4-251727693c37/image HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```
*/
#[utoipa::path(
    put,
    path = "/{organization_id}/image",
    operation_id = "updateOrganizationImage",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    request_body(content = inline(OrganizationImageUploadPayload), content_type = "multipart/form-data"),
    responses(
        (status = 200, description = "Updated organization", body = serde_json::Value)
    )
)]
#[instrument(skip(request, payload, pool, file_store, app_conf))]
async fn set_organization_image(
    request: HttpRequest,
    payload: Multipart,
    organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Organization>> {
    let mut conn = pool.acquire().await?;
    let organization = models::organizations::get_organization(&mut conn, *organization_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Organization(organization.id),
    )
    .await?;
    let organization_image = upload_image_for_organization(
        request.headers(),
        payload,
        &organization,
        &file_store,
        user,
        &mut conn,
    )
    .await?
    .to_string_lossy()
    .to_string();
    let updated_organization = models::organizations::update_organization_image_path(
        &mut conn,
        organization.id,
        Some(organization_image),
    )
    .await?;

    // Remove old image if one exists.
    if let Some(old_image_path) = organization.organization_image_path {
        let file = PathBuf::from_str(&old_image_path).map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_error.to_string(),
                Some(original_error.into()),
            )
        })?;
        file_store.delete(&file).await.map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_error.to_string(),
                Some(original_error.into()),
            )
        })?;
    }

    let response = Organization::from_database_organization(
        updated_organization,
        file_store.as_ref(),
        app_conf.as_ref(),
    );
    token.authorized_ok(web::Json(response))
}

/**
DELETE `/api/v0/main-frontend/organizations/:organizations_id/image` - Removes the organizations image.

# Example

Request:
```http
DELETE /api/v0/main-frontend/organizations/d332f3d9-39a5-4a18-80f4-251727693c37/image HTTP/1.1
```
*/
#[utoipa::path(
    delete,
    path = "/{organization_id}/image",
    operation_id = "deleteOrganizationImage",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    responses(
        (status = 200, description = "Organization image removed")
    )
)]
#[instrument(skip(pool, file_store))]
async fn remove_organization_image(
    organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let organization = models::organizations::get_organization(&mut conn, *organization_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Organization(organization.id),
    )
    .await?;
    if let Some(organization_image_path) = organization.organization_image_path {
        let file = PathBuf::from_str(&organization_image_path).map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_error.to_string(),
                Some(original_error.into()),
            )
        })?;
        let _res =
            models::organizations::update_organization_image_path(&mut conn, organization.id, None)
                .await?;
        file_store.delete(&file).await.map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_error.to_string(),
                Some(original_error.into()),
            )
        })?;
    }
    token.authorized_ok(web::Json(()))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}` - Returns an organizations with id.
*/
#[utoipa::path(
    get,
    path = "/{organization_id}",
    operation_id = "getOrganization",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    responses(
        (status = 200, description = "Organization", body = Organization)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_organization(
    organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Organization>> {
    let mut conn = pool.acquire().await?;
    let db_organization =
        models::organizations::get_organization(&mut conn, *organization_id).await?;
    if db_organization.deleted_at.is_some() {
        return Err(organization_not_found());
    }
    let token = if db_organization.hidden {
        let Some(user) = user else {
            return Err(organization_not_found());
        };
        match authorize(
            &mut conn,
            Act::Edit,
            Some(user.id),
            Res::Organization(db_organization.id),
        )
        .await
        {
            Ok(token) => token,
            Err(err) if matches!(err.error_type(), ControllerErrorType::Forbidden) => {
                return Err(organization_not_found());
            }
            Err(err) => return Err(err),
        }
    } else {
        skip_authorize()
    };
    let organization =
        Organization::from_database_organization(db_organization, file_store.as_ref(), &app_conf);

    token.authorized_ok(web::Json(organization))
}

fn organization_not_found() -> ControllerError {
    ControllerError::new(
        ControllerErrorType::NotFound,
        "Organization not found".to_string(),
        None,
    )
}

#[derive(Debug, Deserialize, ToSchema)]
struct OrganizationUpdatePayload {
    name: String,
    hidden: bool,
    slug: String,
}

/**
PUT `/api/v0/main-frontend/organizations/{organization_id}`

Updates an organization's name, hidden status, and slug.
*/
#[utoipa::path(
    put,
    path = "/{organization_id}",
    operation_id = "updateOrganization",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    request_body = OrganizationUpdatePayload,
    responses(
        (status = 200, description = "Organization updated")
    )
)]
#[instrument(skip(pool))]
async fn update_organization(
    organization_id: web::Path<Uuid>,
    payload: web::Json<OrganizationUpdatePayload>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let organization = models::organizations::get_organization(&mut conn, *organization_id).await?;

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Organization(organization.id),
    )
    .await?;

    models::organizations::update_name_and_hidden(
        &mut conn,
        *organization_id,
        &payload.name,
        payload.hidden,
        &payload.slug,
    )
    .await?;

    token.authorized_ok(web::Json(()))
}

#[derive(Debug, Deserialize, ToSchema)]
struct OrganizationCreatePayload {
    name: String,
    slug: String,
    hidden: bool,
}

/// POST `/api/v0/main-frontend/organizations`
/// Creates a new organization with the given name, slug, and visibility status.
///
/// # Request body (JSON)
/// {
///     "name": "Example Organization",
///     "slug": "example-org",
///     "hidden": false
/// }
///
/// # Response
/// Returns the created organization.
///
/// # Permissions
/// Only users with the `Admin` role can access this endpoint.
#[utoipa::path(
    post,
    path = "",
    operation_id = "createOrganization",
    tag = "organizations",
    request_body = OrganizationCreatePayload,
    responses(
        (status = 200, description = "Created organization", body = serde_json::Value)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
async fn create_organization(
    payload: web::Json<OrganizationCreatePayload>,
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
) -> ControllerResult<web::Json<Organization>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;

    let mut tx = conn.begin().await?;

    let org_id = match models::organizations::insert(
        &mut tx,
        PKeyPolicy::Generate,
        &payload.name,
        &payload.slug,
        None,
        payload.hidden,
    )
    .await
    {
        Ok(id) => id,
        Err(err) => {
            let err_str = err.to_string();
            if err_str.contains("organizations_slug_key") {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "An organization with this slug already exists.".to_string(),
                    None,
                ));
            }
            return Err(err.into());
        }
    };

    tx.commit().await?;

    let db_org = models::organizations::get_organization(&mut conn, org_id).await?;
    let org =
        Organization::from_database_organization(db_org, file_store.as_ref(), app_conf.as_ref());

    token.authorized_ok(web::Json(org))
}

#[utoipa::path(
    patch,
    path = "/{organization_id}",
    operation_id = "softDeleteOrganization",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    responses(
        (status = 200, description = "Organization soft deleted")
    )
)]
#[instrument(skip(pool))]
async fn soft_delete_organization(
    org_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Action::Administrate,
        Some(user.id),
        Resource::GlobalPermissions,
    )
    .await?;

    models::organizations::soft_delete(&mut conn, *org_id).await?;
    token.authorized_ok(web::Json(()))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}/course_exams` - Returns an organizations exams in CourseExam form.
*/
#[utoipa::path(
    get,
    path = "/{organization_id}/course_exams",
    operation_id = "getOrganizationCourseExams",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    responses(
        (status = 200, description = "Organization course exams", body = [CourseExam])
    )
)]
#[instrument(skip(pool))]
async fn get_course_exams(
    pool: web::Data<PgPool>,
    organization: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CourseExam>>> {
    let mut conn = pool.acquire().await?;
    let exams = models::exams::get_course_exams_for_organization(&mut conn, *organization).await?;

    let token = skip_authorize();
    token.authorized_ok(web::Json(exams))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}/exams` - Returns an organizations exams in Exam form.
*/
#[utoipa::path(
    get,
    path = "/{organization_id}/org_exams",
    operation_id = "getOrganizationExams",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    responses(
        (status = 200, description = "Organization exams", body = [OrgExam])
    )
)]
#[instrument(skip(pool))]
async fn get_org_exams(
    pool: web::Data<PgPool>,
    organization: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<OrgExam>>> {
    let mut conn = pool.acquire().await?;
    let exams = models::exams::get_exams_for_organization(&mut conn, *organization).await?;

    let token = skip_authorize();
    token.authorized_ok(web::Json(exams))
}

/**
GET `/api/v0/main-frontend/organizations/{exam_id}/fetch_org_exam
*/
#[utoipa::path(
    get,
    path = "/{exam_id}/fetch_org_exam",
    operation_id = "getOrganizationExamByExamId",
    tag = "organizations",
    params(
        ("exam_id" = Uuid, Path, description = "Exam id")
    ),
    responses(
        (status = 200, description = "Organization exam", body = OrgExam)
    )
)]
#[instrument(skip(pool))]
pub async fn get_org_exam_with_exam_id(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<OrgExam>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let exam = models::exams::get_organization_exam_with_exam_id(&mut conn, *exam_id).await?;

    token.authorized_ok(web::Json(exam))
}

/**
POST `/api/v0/main-frontend/organizations/{organization_id}/exams` - Creates new exam for the organization.
*/
#[utoipa::path(
    post,
    path = "/{organization_id}/exams",
    operation_id = "createOrganizationExam",
    tag = "organizations",
    params(
        ("organization_id" = Uuid, Path, description = "Organization id")
    ),
    request_body = NewExam,
    responses(
        (status = 200, description = "Organization exam created")
    )
)]
#[instrument(skip(pool))]
async fn create_exam(
    pool: web::Data<PgPool>,
    payload: web::Json<NewExam>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;

    let new_exam = payload.0;
    let token = authorize(
        &mut tx,
        Act::CreateCoursesOrExams,
        Some(user.id),
        Res::Organization(new_exam.organization_id),
    )
    .await?;

    let new_exam_id = models::exams::insert(&mut tx, PKeyPolicy::Generate, &new_exam).await?;
    pages::insert_exam_page(
        &mut tx,
        new_exam_id,
        NewPage {
            chapter_id: None,
            course_id: None,
            exam_id: Some(new_exam_id),
            front_page_of_chapter_id: None,
            content: vec![],
            content_search_language: Some("simple".to_string()),
            exercise_slides: vec![],
            exercise_tasks: vec![],
            exercises: vec![],
            title: "exam page".to_string(),
            url_path: "/".to_string(),
        },
        user.id,
    )
    .await?;

    models::roles::insert(
        &mut tx,
        user.id,
        models::roles::UserRole::Teacher,
        models::roles::RoleDomain::Exam(new_exam_id),
    )
    .await?;

    tx.commit().await?;

    token.authorized_ok(web::Json(()))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_all_organizations))
        .route("", web::post().to(create_organization))
        .route("/{organization_id}", web::get().to(get_organization))
        .route("/{organization_id}", web::put().to(update_organization))
        .route(
            "/{organization_id}",
            web::patch().to(soft_delete_organization),
        )
        .route(
            "/{organization_id}/courses",
            web::get().to(get_organization_courses),
        )
        .route(
            "/{organization_id}/courses/duplicatable",
            web::get().to(get_organization_duplicatable_courses),
        )
        .route(
            "/{organization_id}/courses/count",
            web::get().to(get_organization_course_count),
        )
        .route(
            "/{organization_id}/courses/active",
            web::get().to(get_organization_active_courses),
        )
        .route(
            "/{organization_id}/courses/active/count",
            web::get().to(get_organization_active_courses_count),
        )
        .route(
            "/{organization_id}/image",
            web::put().to(set_organization_image),
        )
        .route(
            "/{organization_id}/image",
            web::delete().to(remove_organization_image),
        )
        .route(
            "/{organization_id}/course_exams",
            web::get().to(get_course_exams),
        )
        .route("/{organization_id}/org_exams", web::get().to(get_org_exams))
        .route(
            "/{exam_id}/fetch_org_exam",
            web::get().to(get_org_exam_with_exam_id),
        )
        .route("/{organization_id}/exams", web::post().to(create_exam));
}
