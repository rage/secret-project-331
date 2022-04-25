//! Controllers for requests starting with `/api/v0/main-frontend/organizations`.

use std::{path::PathBuf, str::FromStr};

use models::{
    courses::{Course, CourseCount},
    exams::{CourseExam, NewExam, OrgExam},
    organizations::Organization,
    pages::{self, NewPage},
};

use crate::controllers::{helpers::media::upload_image_for_organization, prelude::*};
use actix_web::web::{self, Json};

/**
GET `/api/v0/main-frontend/organizations` - Returns a list of all organizations.
*/
#[generated_doc]
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
#[generated_doc]
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
    Ok(web::Json(courses))
}

#[generated_doc]
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

#[generated_doc]
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

#[generated_doc]
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
#[generated_doc]
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
        Some(user.id),
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
#[generated_doc]
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
        Some(user.id),
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
#[generated_doc]
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
GET `/api/v0/main-frontend/organizations/{organization_id}/course_exams` - Returns an organizations exams in CourseExam form.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_course_exams(
    pool: web::Data<PgPool>,
    organization: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CourseExam>>> {
    let mut conn = pool.acquire().await?;
    let exams = models::exams::get_course_exams_for_organization(&mut conn, *organization).await?;
    Ok(web::Json(exams))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}/exams` - Returns an organizations exams in Exam form.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_org_exams(
    pool: web::Data<PgPool>,
    organization: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<OrgExam>>> {
    let mut conn = pool.acquire().await?;
    let exams = models::exams::get_exams_for_organization(&mut conn, *organization).await?;
    Ok(web::Json(exams))
}

/**
POST `/api/v0/main-frontend/organizations/{organization_id}/exams` - Creates new exam for the organization.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn create_exam(
    pool: web::Data<PgPool>,
    payload: web::Json<NewExam>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;

    let new_exam = payload.0;
    authorize(
        &mut tx,
        Act::CreateCoursesOrExams,
        Some(user.id),
        Res::Organization(new_exam.organization_id),
    )
    .await?;

    let new_exam_id = models::exams::insert(&mut tx, &new_exam, None).await?;
    pages::insert_exam_page(
        &mut tx,
        new_exam_id,
        NewPage {
            chapter_id: None,
            course_id: None,
            exam_id: Some(new_exam_id),
            front_page_of_chapter_id: None,
            content: serde_json::Value::Array(vec![]),
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
    Ok(web::Json(()))
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
        .route(
            "/{organization_id}/course_exams",
            web::get().to(get_course_exams),
        )
        .route("/{organization_id}/org_exams", web::get().to(get_org_exams))
        .route("/{organization_id}/exams", web::post().to(create_exam));
}
