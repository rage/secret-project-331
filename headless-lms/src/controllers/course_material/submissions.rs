//! Controllers for requests starting with `/api/v0/course-material/submissions`.

use std::str::FromStr;

use crate::{
    controllers::ApplicationResult,
    models::{
        organizations::Organization,
        submissions::{NewSubmission, Submission},
    },
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
    payload: web::Json<NewSubmission>,
) -> ApplicationResult<Json<Submission>> {
    let user_id = Uuid::new_v4();
    let exercise_item_id = payload.0.exercise_item_id;
    let exercise_item =
        crate::models::exercise_items::get_exercise_item_by_id(pool.get_ref(), exercise_item_id)
            .await?;
    let exercise =
        crate::models::exercises::get_exercise_by_id(pool.get_ref(), exercise_item.exercise_id)
            .await?;
    crate::models::users::upsert_user_id(pool.get_ref(), &user_id).await?;
    let submission =
        crate::models::submissions::insert_submission(pool.get_ref(), payload.0, user_id, exercise)
            .await?;
    Ok(Json(submission))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_submissions_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_submission));
}
