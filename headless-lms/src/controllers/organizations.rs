//! Controllers for requests starting with `/api/v0/courses`.
use super::ApplicationError;
use crate::models::organizations::Organization;
use actix_web::web::ServiceConfig;
use actix_web::{
    web::{self, Json},
    Result,
};
use sqlx::PgPool;

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
async fn get_all_organizations(pool: web::Data<PgPool>) -> Result<Json<Vec<Organization>>> {
    let courses = crate::models::organizations::all_organizations(pool.get_ref())
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(courses))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_organizations_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_all_organizations));
}
