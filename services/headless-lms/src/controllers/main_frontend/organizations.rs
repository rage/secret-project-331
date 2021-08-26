//! Controllers for requests starting with `/api/v0/main-frontend/organizations`.
use crate::{
    controllers::ControllerResult,
    models::{courses::Course, organizations::Organization},
    utils::file_store::FileStore,
    ApplicationConfiguration,
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

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
async fn get_all_organizations<T: FileStore>(
    pool: web::Data<PgPool>,
    file_store: web::Data<T>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<Json<Vec<Organization>>> {
    let mut conn = pool.acquire().await?;
    let organizations = crate::models::organizations::all_organizations(&mut conn)
        .await?
        .into_iter()
        .map(|org| Organization::from_database_organization(&org, file_store.as_ref(), &app_conf))
        .collect();
    Ok(Json(organizations))
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
) -> ControllerResult<Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let courses =
        crate::models::courses::organization_courses(&mut conn, &*request_organization_id).await?;
    Ok(Json(courses))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_organizations_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_all_organizations::<T>))
        .route(
            "/{organization_id}/courses",
            web::get().to(get_organization_courses),
        );
}
