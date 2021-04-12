//! Controllers for requests starting with `/api/v0/courses`.
use std::str::FromStr;

use super::ApplicationResult;
use crate::models::{courses::Course, organizations::Organization};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/organizations` - Returns a list of all organizations.

# Example
```json
[
  {
    "id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
    "created_at": "2021-03-08T21:50:51.065821",
    "updated_at": "2021-03-08T21:50:51.065821",
    "name": "Helsingin yliopisto",
    "deleted": false
  }
]
```
 */
async fn get_all_organizations(
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Vec<Organization>>> {
    let courses = crate::models::organizations::all_organizations(pool.get_ref()).await?;
    Ok(Json(courses))
}

/**
GET `/api/v0/organizations/{organization_id}/courses"` - Returns a list of all courses in a organization.

# Example
```json
[
  {
    "id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
    "created_at": "2021-03-08T21:50:51.065821",
    "updated_at": "2021-03-08T21:50:51.065821",
    "name": "Helsingin yliopisto",
    "deleted": false
  }
]
```
 */
async fn get_organization_courses(
    params: web::Path<String>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Vec<Course>>> {
    let organization_id = Uuid::from_str(&params.into_inner())?;
    let courses =
        crate::models::courses::organization_courses(pool.get_ref(), &organization_id).await?;
    Ok(Json(courses))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_organizations_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_all_organizations)).route(
        "/{organization_id}/courses",
        web::get().to(get_organization_courses),
    );
}
