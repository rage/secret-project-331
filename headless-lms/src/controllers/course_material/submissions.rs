//! Controllers for requests starting with `/api/v0/course-material/submissions`.
use std::str::FromStr;

use crate::{
    controllers::ApplicationResult,
    models::{courses::Course, organizations::Organization},
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

/**
POST `/api/v0/course-material/submissions` - Post a new submission.

# Example
```json
[
  {
    "id": "7b14908b-56e5-4b36-9ae6-c44cafacbe83",
    "slug": "hy",
    "created_at": "2021-03-08T21:50:51.065821",
    "updated_at": "2021-03-08T21:50:51.065821",
    "name": "Helsingin yliopisto",
    "deleted": false
  }
]
```
 */
async fn post_submission(
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Vec<Organization>>> {
    let courses = crate::models::organizations::all_organizations(pool.get_ref()).await?;
    Ok(Json(courses))
}


/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_submissions_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "",
        web::post().to(post_submission),
    );
}
