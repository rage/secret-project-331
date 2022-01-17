//! Controllers for requests starting with `/api/v0/main-frontend/organizations`.

use std::{path::PathBuf, str::FromStr};

use models::{
    courses::{Course, CourseCount},
    exams::CourseExam,
    organizations::Organization,
};

use crate::controllers::{helpers::media::upload_image_for_organization, prelude::*};
use actix_web::web::{self, Json};

/**
GET `/api/v0/main-frontend/organizations` - Returns a list of all organizations.
*/
#[generated_doc(Organization)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_all_organizations(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Vec<Organization>>> {
    let mut conn = pool.acquire().await?;
    let organizations = models::organizations::all_organizations(&mut conn)
        .await?
        .into_iter()
        .map(|org| Organization::from_database_organization(org, file_store.as_ref(), &app_conf))
        .collect();
    Ok(web::Json(organizations))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}/courses"` - Returns a list of all courses in a organization.
*/
#[generated_doc(Vec<Course>)]
#[instrument(skip(pool))]
async fn get_organization_courses(
    organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    pagination: web::Query<Pagination>,
) -> ControllerResult<web::Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let courses =
        models::courses::organization_courses_paginated(&mut conn, &organization_id, &pagination)
            .await?;
    Ok(web::Json(courses))
}

#[instrument(skip(pool))]
async fn get_organization_course_count(
    request_organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<CourseCount>> {
    let mut conn = pool.acquire().await?;
    let result =
        models::courses::organization_course_count(&mut conn, *request_organization_id).await?;
    Ok(Json(result))
}

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
        &pagination,
    )
    .await?;
    Ok(Json(courses))
}

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
    Ok(Json(result))
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
#[generated_doc(Organization)]
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
    authorize(
        &mut conn,
        Act::Edit,
        user.id,
        Res::Organization(organization.id),
    )
    .await?;
    let organization_image =
        upload_image_for_organization(request.headers(), payload, &organization, &file_store)
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
            ControllerError::InternalServerError(original_error.to_string())
        })?;
        file_store.delete(&file).await.map_err(|original_error| {
            ControllerError::InternalServerError(original_error.to_string())
        })?;
    }

    let response = Organization::from_database_organization(
        updated_organization,
        file_store.as_ref(),
        app_conf.as_ref(),
    );

    Ok(web::Json(response))
}

/**
DELETE `/api/v0/main-frontend/organizations/:organizations_id/image` - Removes the organizations image.

# Example

Request:
```http
DELETE /api/v0/main-frontend/organizations/d332f3d9-39a5-4a18-80f4-251727693c37/image HTTP/1.1
```
*/
#[generated_doc(())]
#[instrument(skip(pool, file_store))]
async fn remove_organization_image(
    organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let organization = models::organizations::get_organization(&mut conn, *organization_id).await?;
    authorize(
        &mut conn,
        Act::Edit,
        user.id,
        Res::Organization(organization.id),
    )
    .await?;
    if let Some(organization_image_path) = organization.organization_image_path {
        let file = PathBuf::from_str(&organization_image_path).map_err(|original_error| {
            ControllerError::InternalServerError(original_error.to_string())
        })?;
        let _res =
            models::organizations::update_organization_image_path(&mut conn, organization.id, None)
                .await?;
        file_store.delete(&file).await.map_err(|original_error| {
            ControllerError::InternalServerError(original_error.to_string())
        })?;
    }
    Ok(web::Json(()))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}` - Returns an organizations with id.
*/
#[generated_doc(Organization)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_organization(
    organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Organization>> {
    let mut conn = pool.acquire().await?;
    let db_organization =
        models::organizations::get_organization(&mut conn, *organization_id).await?;
    let organization =
        Organization::from_database_organization(db_organization, file_store.as_ref(), &app_conf);
    Ok(web::Json(organization))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}/exams` - Returns an organizations with id.
*/
#[generated_doc(Vec<CourseExam>)]
#[instrument(skip(pool))]
async fn get_exams(
    pool: web::Data<PgPool>,
    organization: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CourseExam>>> {
    let mut conn = pool.acquire().await?;
    let exams = models::exams::get_exams_for_organization(&mut conn, *organization).await?;
    Ok(web::Json(exams))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_all_organizations))
        .route("/{organization_id}", web::get().to(get_organization))
        .route(
            "/{organization_id}/courses",
            web::get().to(get_organization_courses),
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
        .route("/{organization_id}/exams", web::get().to(get_exams));
}
