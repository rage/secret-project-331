//! Controllers for requests starting with `/api/v0/main-frontend/organizations`.

use std::{path::PathBuf, str::FromStr};

use models::{courses::Course, exams::CourseExam, organizations::Organization};

use crate::controllers::{helpers::media::upload_image_for_organization, prelude::*};

/**
GET `/api/v0/main-frontend/organizations` - Returns a list of all organizations.

# Example
```json
[
  {
    "id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
    "slug": "hy",
    "created_at": "2021-03-08T21:50:51.065821",
    "updated_at": "2021-03-08T21:50:51.065821",
    "name": "Helsingin yliopisto",
    "deleted_at": null
  }
]
```
 */
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
        .map(|org| Organization::from_database_organization(&org, &file_store, &app_conf))
        .collect();
    Ok(web::Json(organizations))
}

/**
GET `/api/v0/main-frontend/organizations/{organization_id}/courses"` - Returns a list of all courses in a organization.

# Example
```json
[
  {
    "id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
    "created_at": "2021-03-08T21:50:51.065821",
    "updated_at": "2021-03-08T21:50:51.065821",
    "name": "Helsingin yliopisto",
    "deleted_at": null
  }
]
```
 */
#[instrument(skip(pool))]
async fn get_organization_courses(
    request_organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let courses =
        models::courses::organization_courses(&mut conn, &*request_organization_id).await?;
    Ok(web::Json(courses))
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

Response:
```json
{
  "id": "d332f3d9-39a5-4a18-80f4-251727693c37",
  "created_at": "2021-04-28T16:11:47.477850",
  "updated_at": "2021-04-28T16:53:14.896121",
  "name": "The Basics",
  "description": "Org description"
  "deleted_at": null,
  "chapter_image_url": "http://project-331.local/api/v0/files/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/images/iHZMHdvsazy43ZtP0Ea01sy8AOpUiZ.png",
}
```
*/
#[instrument(skip(request, payload, pool, file_store, app_conf))]
async fn set_organization_image(
    request: HttpRequest,
    payload: Multipart,
    request_organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Organization>> {
    let mut conn = pool.acquire().await?;
    let organization =
        models::organizations::get_organization(&mut conn, *request_organization_id).await?;
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
        &updated_organization,
        &file_store,
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
#[instrument(skip(pool, file_store))]
async fn remove_organization_image(
    request_organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let organization =
        models::organizations::get_organization(&mut conn, *request_organization_id).await?;
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

# Example
```json
[
  {
    "id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
    "slug": "hy",
    "created_at": "2021-03-08T21:50:51.065821",
    "updated_at": "2021-03-08T21:50:51.065821",
    "name": "Helsingin yliopisto",
    "description": "Organization description",
    "organization_image_url": "http://project.local/organizations/7b14908b-56e5-4b36-9ae6-c44cafacbe83/images/ORGIMAGE.png"
    "deleted_at": null
  }
]
```
 */
#[instrument(skip(pool, file_store, app_conf))]
async fn get_organization(
    request_organization_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Organization>> {
    let mut conn = pool.acquire().await?;
    let db_organization =
        models::organizations::get_organization(&mut conn, *request_organization_id).await?;
    let organization =
        Organization::from_database_organization(&db_organization, &file_store, &app_conf);
    Ok(web::Json(organization))
}

async fn get_exams(
    pool: web::Data<PgPool>,
    organization: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CourseExam>>> {
    let mut conn = pool.acquire().await?;
    let exams =
        models::exams::get_exams_for_organization(&mut conn, organization.into_inner()).await?;
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
            "/{organization_id}/image",
            web::put().to(set_organization_image),
        )
        .route(
            "/{organization_id}/image",
            web::delete().to(remove_organization_image),
        )
        .route("/{organization_id}/exams", web::get().to(get_exams));
}
